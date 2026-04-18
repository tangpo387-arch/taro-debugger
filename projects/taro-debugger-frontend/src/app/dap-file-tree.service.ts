import { Injectable, inject } from '@angular/core';
import { Observable, Subscription, catchError, from, map, throwError, tap, shareReplay, of, filter } from 'rxjs';
import { FileNode, FileTreeService } from './file-tree.service';
import { DapSessionService } from '@taro/dap-core';

@Injectable()
export class DapFileTreeService extends FileTreeService {
  private readonly dapSession = inject(DapSessionService);
  private readonly cache = new Map<string, string>();
  private readonly inFlight = new Map<string, Observable<string>>();
  private readonly lruOrder: string[] = [];
  private currentCacheSize = 0;
  private readonly MAX_CACHE_SIZE = 20 * 1024 * 1024; // 20 MB
  /** Tracks all subscriptions for teardown via destroy(). */
  private readonly subscriptions: Subscription[] = [];

  constructor() {
    super();
    // Defensive guard: flushes any cache entries that may have been populated
    // during an edge-case flow before a clean disconnect was observed.
    // The primary invalidation path is the connectionStatus$ subscription below.
    this.subscriptions.push(
      this.dapSession.onEvent().pipe(
        filter(e => e.event === 'initialized')
      ).subscribe(() => this.clearCache())
    );

    // Primary lifecycle hook: clears the cache whenever the session goes offline.
    this.subscriptions.push(
      this.dapSession.connectionStatus$.subscribe(connected => {
        if (!connected) {
          this.clearCache();
        }
      })
    );
  }

  /**
   * Unsubscribes all internal subscriptions and flushes the cache.
   * Called by `DebuggerComponent.ngOnDestroy()` as part of component lifecycle teardown.
   */
  public destroy(): void {
    this.subscriptions.forEach(s => s.unsubscribe());
    this.subscriptions.length = 0;
    this.clearCache();
  }

  /**
   * Issues a `loadedSources` DAP request and constructs a FileNode tree
   * from the adapter's source list.
   * @param rootPath Displayed root label for the tree; used as the root node's name and path.
   */
  getTree(rootPath: string): Observable<FileNode> {
    return from(this.dapSession.sendRequest('loadedSources', {})).pipe(
      map(response => {
        const sources = response.body?.sources || [];
        return this.buildTreeFromSources(sources, rootPath);
      }),
      catchError((err) => {
        console.warn('DAP loadedSources failed', err);
        return throwError(() => err);
      })
    );
  }

  /**
   * Returns the source content for a given file, using the LRU cache to
   * avoid redundant DAP `source` round-trips.
   *
   * Cache key priority: `ref:<sourceReference>` when `sourceReference > 0`,
   * otherwise `path:<path>`. In-flight requests for the same key are
   * deduplicated via a shared `shareReplay(1)` Observable.
   *
   * @param path       Absolute source file path (used when sourceReference is absent/zero).
   * @param sourceReference Optional DAP source reference ID for virtual (non-filesystem) sources.
   */
  readFile(path: string, sourceReference?: number): Observable<string> {
    const key = sourceReference && sourceReference > 0 ? `ref:${sourceReference}` : `path:${path}`;

    // 1. Cache hit — promote to most-recently-used position and return immediately.
    const cachedContent = this.cache.get(key);
    if (cachedContent !== undefined) {
      this.promoteKey(key);
      return of(cachedContent);
    }

    // 2. In-flight deduplication — return the shared Observable for concurrent callers.
    const inFlightRequest = this.inFlight.get(key);
    if (inFlightRequest) {
      return inFlightRequest;
    }

    // 3. Issue fresh DAP `source` request.
    const request$ = from(this.dapSession.sendRequest('source', {
      sourceReference: sourceReference || 0,
      source: { path }
    })).pipe(
      map(response => (response.body?.content || '') as string),
      tap(content => {
        this.addToCache(key, content);
        this.inFlight.delete(key);
      }),
      catchError((err) => {
        this.inFlight.delete(key);
        console.warn('DAP source request failed', err);
        return throwError(() => err);
      }),
      shareReplay(1)
    );

    this.inFlight.set(key, request$);
    return request$;
  }

  private clearCache() {
    this.cache.clear();
    this.lruOrder.length = 0;
    this.currentCacheSize = 0;
    this.inFlight.clear();
  }

  private promoteKey(key: string) {
    const index = this.lruOrder.indexOf(key);
    if (index !== -1) {
      this.lruOrder.splice(index, 1);
    }
    this.lruOrder.push(key);
  }

  private addToCache(key: string, content: string): void {
    const size = content.length;
    if (size > this.MAX_CACHE_SIZE) return;
    // Defensive guard: skip if the key was already populated by a concurrent flow.
    if (this.cache.has(key)) return;

    // Eviction loop: remove LRU entries until there is room for the new entry.
    while (this.currentCacheSize + size > this.MAX_CACHE_SIZE && this.lruOrder.length > 0) {
      const lruKey = this.lruOrder.shift()!;
      const lruContent = this.cache.get(lruKey);
      if (lruContent) {
        this.currentCacheSize -= lruContent.length;
        this.cache.delete(lruKey);
      }
    }

    this.cache.set(key, content);
    this.lruOrder.push(key);
    this.currentCacheSize += size;
  }

  private buildTreeFromSources(sources: any[], rootPath: string): FileNode {
    const rootName = rootPath ? (rootPath.split(/[/\\]/).pop() || 'Project') : 'Sources';
    const root: FileNode = { name: rootName, path: rootPath || '/', type: 'directory', children: [] };

    for (const source of sources) {
      const p = source.path as string;
      const ref = source.sourceReference as number;
      if (!p && !ref) continue; 

      const displayPath = p || `virtual://${ref}`;
      const parts = displayPath.split(/[/\\]/).filter(part => part.length > 0);
      if (parts.length === 0 && !ref) continue;

      let currentPath = (p && p.startsWith('/')) ? '' : (p && p.match(/^[a-zA-Z]:/) ? '' : '/');
      let current = root;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];

        if (i === 0 && p && p.startsWith('/')) {
          currentPath += '/' + part;
        } else if (i === 0 && p && p.match(/^[a-zA-Z]:/)) {
          currentPath += part;
        } else {
          currentPath += (currentPath.endsWith('/') || currentPath.endsWith('\\') ? '' : '/') + part;
        }

        const isFile = i === parts.length - 1;

        if (!current.children) {
          current.children = [];
        }

        let existing = current.children.find(c => c.name === part);
        if (!existing) {
          existing = {
            name: part,
            path: currentPath,
            type: isFile ? 'file' : 'directory',
            sourceReference: (isFile && ref) ? ref : undefined,
            children: isFile ? undefined : []
          };
          current.children.push(existing);
        }
        current = existing;
      }
    }

    this.sortTree(root);
    return root;
  }

  private sortTree(node: FileNode) {
    if (node.children) {
      node.children.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
      for (const child of node.children) {
        this.sortTree(child);
      }
    }
  }
}
