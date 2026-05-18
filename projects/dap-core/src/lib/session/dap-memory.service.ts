import { Injectable, inject } from '@angular/core';
import { Subject } from 'rxjs';
import { DapSessionService } from './dap-session.service';

@Injectable()
export class DapMemoryService {
  private readonly dapSession = inject(DapSessionService);
  private readonly memoryUpdatedSubject = new Subject<{ memoryReference: string; offset: number; length: number }>();

  /** Emits whenever memory is written to, allowing UI components to refresh. */
  public readonly onMemoryUpdated$ = this.memoryUpdatedSubject.asObservable();

  /**
   * Reads memory from the debuggee and converts it from Base64 to Uint8Array.
   */
  public async read(memoryReference: bigint, offset: number, count: number): Promise<Uint8Array> {
    const response = await this.dapSession.readMemory({ memoryReference: `0x${memoryReference.toString(16)}`, offset, count });

    if (!response.success || !response.body?.data) {
      return new Uint8Array(0);
    }

    return this.base64ToUint8Array(response.body.data);
  }

  /**
   * Writes memory to the debuggee and converts it from Uint8Array to Base64.
   */
  public async write(memoryReference: string, offset: number, data: Uint8Array): Promise<number> {
    const base64Data = this.uint8ArrayToBase64(data);
    const response = await this.dapSession.writeMemory({ memoryReference, offset, data: base64Data });

    if (response.success) {
      const bytesWritten = response.body?.bytesWritten ?? data.length;
      this.memoryUpdatedSubject.next({ memoryReference, offset, length: bytesWritten });
      return bytesWritten;
    }

    return 0;
  }

  private base64ToUint8Array(base64: string): Uint8Array {
    try {
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    } catch (e) {
      console.error('Failed to decode Base64 memory data', e);
      return new Uint8Array(0);
    }
  }

  private uint8ArrayToBase64(bytes: Uint8Array): string {
    try {
      let binaryString = '';
      for (let i = 0; i < bytes.length; i++) {
        binaryString += String.fromCharCode(bytes[i]);
      }
      return btoa(binaryString);
    } catch (e) {
      console.error('Failed to encode memory data to Base64', e);
      return '';
    }
  }
}
