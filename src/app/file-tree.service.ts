import { Observable } from 'rxjs';

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  sourceReference?: number;
  children?: FileNode[];
}

export abstract class FileTreeService {
  abstract getTree(rootPath: string): Observable<FileNode>;
  abstract readFile(path: string, sourceReference?: number): Observable<string>;
  /** Release any internal subscriptions held by this service. */
  abstract destroy(): void;
}
