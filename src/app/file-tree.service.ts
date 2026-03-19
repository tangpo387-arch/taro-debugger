import { Observable } from 'rxjs';

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
}

export abstract class FileTreeService {
  abstract getTree(rootPath: string): Observable<FileNode>;
  abstract readFile(path: string): Observable<string>;
}
