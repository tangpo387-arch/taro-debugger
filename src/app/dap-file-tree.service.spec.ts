import { firstValueFrom } from 'rxjs';
import { vi, describe, it, expect } from 'vitest';
import { DapFileTreeService } from './dap-file-tree.service';
import { DapSessionService } from './dap-session.service';
import { DapResponse } from './dap.types';
import { FileNode } from './file-tree.service';

function makeResponse(body?: any): DapResponse {
  return { seq: 1, type: 'response', request_seq: 1, success: true, command: 'mock', body };
}

function makeMockSession(responseBody?: any, shouldFail = false): Partial<DapSessionService> {
  return {
    sendRequest: vi.fn().mockImplementation(() =>
      shouldFail
        ? Promise.reject(new Error('DAP request failed'))
        : Promise.resolve(makeResponse(responseBody))
    )
  };
}

/** Walk the tree and find the first node matching name. */
function findNode(node: FileNode, name: string): FileNode | undefined {
  if (node.name === name) return node;
  for (const child of node.children ?? []) {
    const found = findNode(child, name);
    if (found) return found;
  }
  return undefined;
}

/** Collect all leaf (file) nodes recursively. */
function allFiles(node: FileNode): FileNode[] {
  if (node.type === 'file') return [node];
  return (node.children ?? []).flatMap(allFiles);
}

describe('DapFileTreeService', () => {

  // ─────────────────────────────────────────────────────────────────────────
  // getTree
  // ─────────────────────────────────────────────────────────────────────────
  describe('getTree()', () => {
    it('should build a tree containing src and include directories (Unix paths)', async () => {
      const session = makeMockSession({
        sources: [
          { path: '/project/src/main.c' },
          { path: '/project/src/utils.c' },
          { path: '/project/include/utils.h' }
        ]
      });
      const svc = new DapFileTreeService(session as DapSessionService);

      const tree = await firstValueFrom(svc.getTree('/'));

      const srcDir = findNode(tree, 'src');
      expect(srcDir).toBeDefined();
      expect(srcDir!.type).toBe('directory');
      expect(srcDir!.children?.length).toBe(2);

      const includeDir = findNode(tree, 'include');
      expect(includeDir).toBeDefined();
      expect(includeDir!.type).toBe('directory');
    });

    it('should build a tree containing project directory under C: (Windows paths)', async () => {
      const session = makeMockSession({
        sources: [
          { path: 'C:\\project\\main.c' },
          { path: 'C:\\project\\utils.c' }
        ]
      });
      const svc = new DapFileTreeService(session as DapSessionService);

      const tree = await firstValueFrom(svc.getTree(''));

      const cDrive = findNode(tree, 'C:');
      expect(cDrive).toBeDefined();
      const projectDir = findNode(cDrive!, 'project');
      expect(projectDir).toBeDefined();
      expect(projectDir!.type).toBe('directory');
      expect(projectDir!.children?.length).toBe(2);
    });

    it('should sort directories before files, and entries alphabetically within the same level', async () => {
      const session = makeMockSession({
        sources: [
          { path: '/p/zebra.c' },
          { path: '/p/alpha.c' },
          { path: '/p/lib/helper.c' }
        ]
      });
      const svc = new DapFileTreeService(session as DapSessionService);

      // Root is '/' so the root node's children will be ['p']
      // Navigate inside 'p' to check the ordering
      const tree = await firstValueFrom(svc.getTree('/'));
      const pDir = findNode(tree, 'p');
      expect(pDir).toBeDefined();
      const children = pDir!.children!;

      // 'lib' directory must come first
      expect(children[0].type).toBe('directory');
      expect(children[0].name).toBe('lib');
      // then files in alphabetical order
      expect(children[1].name).toBe('alpha.c');
      expect(children[2].name).toBe('zebra.c');
    });

    it('should skip sources without a path property', async () => {
      const session = makeMockSession({
        sources: [
          { name: 'no-path-source' }, // no path – should be ignored
          { path: '/project/main.c' }
        ]
      });
      const svc = new DapFileTreeService(session as DapSessionService);

      const tree = await firstValueFrom(svc.getTree('/'));
      const files = allFiles(tree);
      // Only main.c should appear
      expect(files.length).toBe(1);
      expect(files[0].name).toBe('main.c');
    });

    it('should throw an error when loadedSources fails', async () => {
      const session = makeMockSession(undefined, true);
      const svc = new DapFileTreeService(session as DapSessionService);

      await expect(firstValueFrom(svc.getTree('/any'))).rejects.toThrow('DAP request failed');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // readFile
  // ─────────────────────────────────────────────────────────────────────────
  describe('readFile()', () => {
    it('should return the content field from the source response', async () => {
      const session = makeMockSession({ content: '#include <stdio.h>\nint main(){}' });
      const svc = new DapFileTreeService(session as DapSessionService);

      const content = await firstValueFrom(svc.readFile('/project/main.c'));

      expect(content).toBe('#include <stdio.h>\nint main(){}');
      expect(session.sendRequest).toHaveBeenCalledWith('source', { source: { path: '/project/main.c' } });
    });

    it('should return an empty string when body.content is missing', async () => {
      const session = makeMockSession({}); // body exists but no content field
      const svc = new DapFileTreeService(session as DapSessionService);

      const content = await firstValueFrom(svc.readFile('/project/empty.c'));
      expect(content).toBe('');
    });

    it('should throw an error when source request fails', async () => {
      const session = makeMockSession(undefined, true);
      const svc = new DapFileTreeService(session as DapSessionService);

      await expect(firstValueFrom(svc.readFile('/project/missing.c'))).rejects.toThrow('DAP request failed');
    });
  });
});
