import { firstValueFrom, Subject, BehaviorSubject } from 'rxjs';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DapFileTreeService } from './dap-file-tree.service';
import { DapResponse, DapEvent } from '@taro/dap-core';
import { FileNode } from './file-tree.service';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeResponse(body?: any): DapResponse {
  return { seq: 1, type: 'response', request_seq: 1, success: true, command: 'mock', body };
}

/**
 * Extended mock interface that exposes the underlying Subjects for imperative
 * event and connection-status control within tests.
 */
interface MockSession {
  sendRequest: ReturnType<typeof vi.fn>;
  onEvent: ReturnType<typeof vi.fn>;
  connectionStatus$: ReturnType<BehaviorSubject<boolean>['asObservable']>;
  /** Push a named DAP event into the service under test. */
  triggerEvent: (event: string) => void;
  /** Simulate connect (true) or disconnect (false). */
  setConnected: (connected: boolean) => void;
}

/**
 * Factory — always returns a fresh mock to prevent cross-test state leakage.
 * @param responseBody   Optional body returned by sendRequest on success.
 * @param shouldFail     When true, sendRequest rejects with 'DAP request failed'.
 */
function makeMockSession(responseBody?: any, shouldFail = false): MockSession {
  const eventSubject = new Subject<DapEvent>();
  const connectionStatusSubject = new BehaviorSubject<boolean>(true);

  return {
    sendRequest: vi.fn().mockImplementation(() =>
      shouldFail
        ? Promise.reject(new Error('DAP request failed'))
        : Promise.resolve(makeResponse(responseBody))
    ),
    onEvent: vi.fn().mockReturnValue(eventSubject.asObservable()),
    connectionStatus$: connectionStatusSubject.asObservable(),
    triggerEvent: (event: string) =>
      eventSubject.next({ seq: 0, type: 'event', event, body: {} }),
    setConnected: (connected: boolean) =>
      connectionStatusSubject.next(connected),
  };
}

/** Walk the tree depth-first; return the first node whose name matches. */
function findNode(node: FileNode, name: string): FileNode | undefined {
  if (node.name === name) return node;
  for (const child of node.children ?? []) {
    const found = findNode(child, name);
    if (found) return found;
  }
  return undefined;
}

/** Collect all leaf (file) nodes from the tree recursively. */
function allFiles(node: FileNode): FileNode[] {
  if (node.type === 'file') return [node];
  return (node.children ?? []).flatMap(allFiles);
}

// ── Test Suite ────────────────────────────────────────────────────────────────

describe('DapFileTreeService', () => {
  let session: MockSession;
  let svc: DapFileTreeService;

  // Rebuild both mock and service before every test to guarantee full isolation.
  beforeEach(() => {
    session = makeMockSession();
    svc = new DapFileTreeService(session as any);
  });

  // Tear down subscriptions after every test to prevent bleeding between suites.
  afterEach(() => {
    svc.destroy();
  });

  // ── getTree() ─────────────────────────────────────────────────────────────
  describe('getTree()', () => {
    it('should build a tree containing src and include directories (Unix paths)', async () => {
      // Arrange
      session.sendRequest = vi.fn().mockResolvedValue(makeResponse({
        sources: [
          { path: '/project/src/main.c' },
          { path: '/project/src/utils.c' },
          { path: '/project/include/utils.h' },
        ],
      }));

      // Act
      const tree = await firstValueFrom(svc.getTree('/'));

      // Assert
      const srcDir = findNode(tree, 'src');
      expect(srcDir).toBeDefined();
      expect(srcDir!.type).toBe('directory');
      expect(srcDir!.children?.length).toBe(2);

      const includeDir = findNode(tree, 'include');
      expect(includeDir).toBeDefined();
      expect(includeDir!.type).toBe('directory');
    });

    it('should build a tree containing project directory under C: (Windows paths)', async () => {
      // Arrange
      session.sendRequest = vi.fn().mockResolvedValue(makeResponse({
        sources: [
          { path: 'C:\\project\\main.c' },
          { path: 'C:\\project\\utils.c' },
        ],
      }));

      // Act
      const tree = await firstValueFrom(svc.getTree(''));

      // Assert
      const cDrive = findNode(tree, 'C:');
      expect(cDrive).toBeDefined();
      const projectDir = findNode(cDrive!, 'project');
      expect(projectDir).toBeDefined();
      expect(projectDir!.type).toBe('directory');
      expect(projectDir!.children?.length).toBe(2);
    });

    it('should preserve sourceReference in FileNode for physical sources', async () => {
      // Arrange
      session.sendRequest = vi.fn().mockResolvedValue(makeResponse({
        sources: [{ path: '/project/main.c', sourceReference: 42 }],
      }));

      // Act
      const tree = await firstValueFrom(svc.getTree('/'));

      // Assert
      const mainNode = findNode(tree, 'main.c');
      expect(mainNode?.sourceReference).toBe(42);
    });

    it('should handle virtual files that carry only a sourceReference (no path)', async () => {
      // Arrange
      session.sendRequest = vi.fn().mockResolvedValue(makeResponse({
        sources: [{ sourceReference: 100 }],
      }));

      // Act
      const tree = await firstValueFrom(svc.getTree('/'));

      // Assert
      const virtualNode = findNode(tree, '100');
      expect(virtualNode).toBeDefined();
      expect(virtualNode?.sourceReference).toBe(100);
      expect(virtualNode?.path).toContain('virtual:');
      expect(virtualNode?.path).toContain('100');
    });

    it('should sort directories before files, and entries alphabetically within the same level', async () => {
      // Arrange
      session.sendRequest = vi.fn().mockResolvedValue(makeResponse({
        sources: [
          { path: '/p/zebra.c' },
          { path: '/p/alpha.c' },
          { path: '/p/lib/helper.c' },
        ],
      }));

      // Act
      const tree = await firstValueFrom(svc.getTree('/'));
      const pDir = findNode(tree, 'p');
      const children = pDir!.children!;

      // Assert — lib directory first, then files alpha-sorted
      expect(children[0].name).toBe('lib');
      expect(children[1].name).toBe('alpha.c');
      expect(children[2].name).toBe('zebra.c');
    });

    it('should skip sources that have neither a path nor a sourceReference', async () => {
      // Arrange
      session.sendRequest = vi.fn().mockResolvedValue(makeResponse({
        sources: [
          { name: 'no-path-source' }, // no path or ref — must be skipped
          { path: '/project/main.c' },
        ],
      }));

      // Act
      const tree = await firstValueFrom(svc.getTree('/'));

      // Assert — only main.c should appear; the unnamed, path-less source is ignored
      const files = allFiles(tree);
      expect(files.length).toBe(1);
      expect(files[0].name).toBe('main.c');
    });

    it('should throw when the loadedSources DAP request fails', async () => {
      // Arrange
      session.sendRequest = vi.fn().mockRejectedValue(new Error('DAP request failed'));

      // Act & Assert
      await expect(firstValueFrom(svc.getTree('/any'))).rejects.toThrow('DAP request failed');
    });
  });

  // ── readFile() and LRU Cache ───────────────────────────────────────────────
  describe('readFile() and LRU Cache', () => {

    it('should return the content field from the source response', async () => {
      // Arrange
      session.sendRequest = vi.fn().mockResolvedValue(
        makeResponse({ content: '#include <stdio.h>\nint main(){}' })
      );

      // Act
      const content = await firstValueFrom(svc.readFile('/project/main.c'));

      // Assert
      expect(content).toBe('#include <stdio.h>\nint main(){}');
      expect(session.sendRequest).toHaveBeenCalledWith(
        'source',
        { sourceReference: 0, source: { path: '/project/main.c' } }
      );
    });

    it('should return an empty string when the response body carries no content field', async () => {
      // Arrange — body exists but content property is absent
      session.sendRequest = vi.fn().mockResolvedValue(makeResponse({}));

      // Act
      const content = await firstValueFrom(svc.readFile('/project/empty.c'));

      // Assert
      expect(content).toBe('');
    });

    it('should propagate the error when the DAP source request fails', async () => {
      // Arrange
      session.sendRequest = vi.fn().mockRejectedValue(new Error('DAP request failed'));

      // Act & Assert
      await expect(
        firstValueFrom(svc.readFile('/project/missing.c'))
      ).rejects.toThrow('DAP request failed');
    });

    it('should return cached content on second call without a DAP round-trip', async () => {
      // Arrange
      session.sendRequest = vi.fn().mockResolvedValue(makeResponse({ content: 'content v1' }));

      // Act
      const res1 = await firstValueFrom(svc.readFile('/a.cpp'));
      const res2 = await firstValueFrom(svc.readFile('/a.cpp'));

      // Assert
      expect(res1).toBe('content v1');
      expect(res2).toBe('content v1');
      expect(session.sendRequest).toHaveBeenCalledTimes(1);
    });

    it('should key on sourceReference rather than path for virtual sources', async () => {
      // Arrange
      session.sendRequest = vi.fn().mockResolvedValue(makeResponse({ content: 'virtual content' }));

      // Act — first call establishes ref:5 entry; second call uses a different path but same ref
      await firstValueFrom(svc.readFile('/ignored/path.cpp', 5));
      const res = await firstValueFrom(svc.readFile('/another/path.cpp', 5));

      // Assert — only one DAP round-trip; second call resolved from cache
      expect(res).toBe('virtual content');
      expect(session.sendRequest).toHaveBeenCalledTimes(1);
      expect(session.sendRequest).toHaveBeenCalledWith(
        'source',
        expect.objectContaining({ sourceReference: 5 })
      );
    });

    it('should deduplicate concurrent in-flight requests for the same path', async () => {
      // Arrange — a pending Promise that we resolve manually after both calls are initiated
      let resolveRequest!: (res: any) => void;
      const pendingPromise = new Promise(resolve => { resolveRequest = resolve; });
      session.sendRequest = vi.fn().mockReturnValue(pendingPromise);

      // Act — fire two reads before the first resolves
      const p1 = firstValueFrom(svc.readFile('/long.c'));
      const p2 = firstValueFrom(svc.readFile('/long.c'));
      resolveRequest(makeResponse({ content: 'long content' }));

      // Assert — both callers receive the same content; only one request went to the adapter
      const [res1, res2] = await Promise.all([p1, p2]);
      expect(res1).toBe('long content');
      expect(res2).toBe('long content');
      expect(session.sendRequest).toHaveBeenCalledTimes(1);
    });

    it('should evict the least recently used entry when total size exceeds 20 MB', async () => {
      // Arrange — file1 (10 MB) + file2 (15 MB) > 20 MB; file1 must be evicted
      const content1 = 'a'.repeat(10 * 1024 * 1024); // 10 MB — the initial LRU
      const content2 = 'b'.repeat(15 * 1024 * 1024); // 15 MB — triggers eviction of file1
      session.sendRequest = vi.fn()
        .mockResolvedValueOnce(makeResponse({ content: content1 }))
        .mockResolvedValueOnce(makeResponse({ content: content2 }))
        .mockResolvedValueOnce(makeResponse({ content: 're-fetched file1' }));

      // Act
      await firstValueFrom(svc.readFile('/file1.c')); // cache: [file1=10MB]
      await firstValueFrom(svc.readFile('/file2.c')); // file1 evicted; cache: [file2=15MB]
      const result = await firstValueFrom(svc.readFile('/file1.c')); // cache miss → fresh fetch

      // Assert
      expect(result).toBe('re-fetched file1');
      expect(session.sendRequest).toHaveBeenCalledTimes(3);
    });

    it('should retain the accessed entry and evict the actual LRU when promoted', async () => {
      // Arrange — A (12 MB) inserted first, B (5 MB) inserted second; total 17 MB < 20 MB
      const contentA = 'a'.repeat(12 * 1024 * 1024); // 12 MB
      const contentB = 'b'.repeat(5 * 1024 * 1024);  //  5 MB
      const contentD = 'd'.repeat(5 * 1024 * 1024);  //  5 MB — adding D pushes total to 22 MB
      session.sendRequest = vi.fn()
        .mockResolvedValueOnce(makeResponse({ content: contentA }))  // fetch A
        .mockResolvedValueOnce(makeResponse({ content: contentB }))  // fetch B
        .mockResolvedValueOnce(makeResponse({ content: contentD }))  // fetch D
        .mockResolvedValueOnce(makeResponse({ content: 're-fetched B' })); // B evicted → re-fetch

      // Act
      await firstValueFrom(svc.readFile('/a.c'));         // cache: [A=12MB]; order: [A]
      await firstValueFrom(svc.readFile('/b.c'));         // cache: [A, B]; order: [A, B]
      await firstValueFrom(svc.readFile('/a.c'));         // cache hit on A → promotes A; order: [B, A]
      await firstValueFrom(svc.readFile('/d.c'));         // 17+5=22MB > 20MB; evicts B (LRU); order: [A, D]
      const reFetchedB = await firstValueFrom(svc.readFile('/b.c')); // B gone → fresh request
      const cachedA    = await firstValueFrom(svc.readFile('/a.c')); // A still in cache → no request

      // Assert — 4 DAP calls total: A, B, D, re-fetch B (A re-read served from cache)
      expect(reFetchedB).toBe('re-fetched B');
      expect(cachedA).toBe(contentA);
      expect(session.sendRequest).toHaveBeenCalledTimes(4);
    });

    it('should flush the cache when the DAP server emits an "initialized" event', async () => {
      // Arrange — populate cache with one entry
      session.sendRequest = vi.fn().mockResolvedValue(makeResponse({ content: 'old content' }));
      await firstValueFrom(svc.readFile('/file.c'));
      expect(session.sendRequest).toHaveBeenCalledTimes(1);

      // Act — simulate session re-initialization
      session.triggerEvent('initialized');
      session.sendRequest = vi.fn().mockResolvedValue(makeResponse({ content: 'fresh content' }));

      // Assert — cache was cleared; next read issues a new DAP request
      const res = await firstValueFrom(svc.readFile('/file.c'));
      expect(res).toBe('fresh content');
      expect(session.sendRequest).toHaveBeenCalledTimes(1);
    });

    it('should flush the cache on disconnect and issue fresh requests in the new session', async () => {
      // Arrange — Session 1: populate cache
      session.sendRequest = vi.fn().mockResolvedValue(makeResponse({ content: 'session-1' }));
      await firstValueFrom(svc.readFile('/main.c'));

      // Act — simulate full session lifecycle: disconnect → reconnect
      session.setConnected(false);  // triggers clearCache()
      session.setConnected(true);   // new session begins
      session.sendRequest = vi.fn().mockResolvedValue(makeResponse({ content: 'session-2' }));

      // Assert — previously cached path now issues a fresh DAP request
      const res = await firstValueFrom(svc.readFile('/main.c'));
      expect(res).toBe('session-2');
      expect(session.sendRequest).toHaveBeenCalledTimes(1);
    });
  });
});
