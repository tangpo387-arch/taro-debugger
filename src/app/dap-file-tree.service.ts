import { Observable, catchError, from, map, throwError } from 'rxjs';
import { FileNode, FileTreeService } from './file-tree.service';
import { DapSessionService } from './dap-session.service';

export class DapFileTreeService extends FileTreeService {
  constructor(private dapSession: DapSessionService) {
    super();
  }

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

  readFile(path: string): Observable<string> {
    return from(this.dapSession.sendRequest('source', { sourceReference: 0, source: { path } })).pipe(
      map(response => (response.body?.content || '') as string),
      catchError((err) => {
        console.warn('DAP source request failed', err);
        return throwError(() => err);
      })
    );
  }

  private buildTreeFromSources(sources: any[], rootPath: string): FileNode {
    const rootName = rootPath ? (rootPath.split(/[/\\]/).pop() || 'Project') : 'Sources';
    const root: FileNode = { name: rootName, path: rootPath || '/', type: 'directory', children: [] };

    for (const source of sources) {
      const p = source.path as string;
      if (!p) continue; // Skip sources without a path

      const parts = p.split(/[/\\]/).filter(part => part.length > 0);
      if (parts.length === 0) continue;

      let currentPath = p.startsWith('/') ? '' : (p.match(/^[a-zA-Z]:/) ? '' : '/');
      let current = root;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];

        if (i === 0 && p.startsWith('/')) {
          currentPath += '/' + part;
        } else if (i === 0 && p.match(/^[a-zA-Z]:/)) {
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
