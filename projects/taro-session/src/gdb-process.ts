import { spawn, ChildProcess } from 'child_process';
import { SessionLogger } from './logger.js';

export class GdbProcessManager {
  private gdbProcess?: ChildProcess;
  private logger: SessionLogger;
  private onMessageCallback?: (message: string) => void;
  private onExitCallback?: (code: number | null) => void;
  private buffer = Buffer.alloc(0);
  private isTerminating = false;

  constructor(logger: SessionLogger) {
    this.logger = logger;
  }

  public spawn(gdbPath: string | undefined): void {
    const activeGdbPath = gdbPath || 'gdb';
    this.logger.logStdout(`Spawning GDB process (${activeGdbPath})`);

    // Clear residual state and buffers from previous sessions
    this.buffer = Buffer.alloc(0);
    this.isTerminating = false;

    // Set up GDB environment and spawn arguments
    // We spawn GDB using the DAP interpreter.
    const spawnArgs = ['--interpreter=dap'];

    // GDB is standard, we spawn GDB in DAP interpreter mode.
    this.gdbProcess = spawn(activeGdbPath, spawnArgs, {
      cwd: process.cwd(),
      env: process.env
    });

    this.gdbProcess.stdout?.on('data', (chunk: Buffer) => {
      this.handleStdoutData(chunk);
    });

    this.gdbProcess.stderr?.on('data', (chunk: Buffer) => {
      const dataStr = chunk.toString('utf8');
      this.logger.logStderr(dataStr);
    });

    this.gdbProcess.on('exit', (code) => {
      this.logger.logStdout(`GDB exited with code ${code}`);
      if (this.onExitCallback && !this.isTerminating) {
        this.onExitCallback(code);
      }
    });

    this.gdbProcess.on('error', (err) => {
      this.logger.logStderr(`GDB spawn error: ${err.message}`);
    });

    // Automatically send initial launch/attach command if needed, or let client send it.
  }

  public onMessage(callback: (message: string) => void): void {
    this.onMessageCallback = callback;
  }

  public onExit(callback: (code: number | null) => void): void {
    this.onExitCallback = callback;
  }

  public write(message: string): void {
    if (!this.gdbProcess || !this.gdbProcess.stdin) {
      this.logger.logStderr('Attempted to write to GDB, but process stdin is not available');
      return;
    }

    // DAP demands content-length header
    const payload = Buffer.from(message, 'utf8');
    const header = `Content-Length: ${payload.length}\r\n\r\n`;

    this.gdbProcess.stdin.write(header);
    this.gdbProcess.stdin.write(payload);

    this.logger.logDap('out', message);
  }

  private handleStdoutData(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);

    while (this.buffer.length > 0) {
      const dataStr = this.buffer.toString('utf8');
      const contentLengthMatch = dataStr.match(/^Content-Length:\s*(\d+)\r\n\r\n/i);

      if (!contentLengthMatch) {
        // If we don't match a complete Content-Length header yet, check if the header has incomplete format
        if (!dataStr.startsWith('Content-Length') && dataStr.length > 0) {
          // If we received garbage that doesn't start with Content-Length, clear it or find next
          const nextHeaderIndex = dataStr.indexOf('Content-Length');
          if (nextHeaderIndex !== -1) {
            this.buffer = this.buffer.subarray(nextHeaderIndex);
          } else {
            // No header found at all, drop buffer to avoid leak
            this.buffer = Buffer.alloc(0);
          }
        }
        break;
      }

      const contentLength = parseInt(contentLengthMatch[1], 10);
      const headerLength = contentLengthMatch[0].length;
      const totalLength = headerLength + contentLength;

      if (this.buffer.length < totalLength) {
        // Buffer doesn't contain the full message body yet
        break;
      }

      // Slice out the body payload
      const body = this.buffer.subarray(headerLength, totalLength).toString('utf8');

      // Remove parsed message from buffer
      this.buffer = this.buffer.subarray(totalLength);

      this.logger.logDap('in', body);

      if (this.onMessageCallback) {
        this.onMessageCallback(body);
      }
    }
  }

  public async terminate(): Promise<void> {
    if (this.isTerminating || !this.gdbProcess) return;
    this.isTerminating = true;

    this.logger.logStdout('Terminating GDB process...');

    // Remove the exit listener to prevent residual exit events from triggering onExitCallback
    this.gdbProcess.removeAllListeners('exit');

    // Send SIGTERM since the client is responsible for sending DAP disconnect
    if (this.gdbProcess.exitCode === null) {
      this.logger.logStdout('Sending SIGTERM to GDB.');
      this.gdbProcess.kill('SIGTERM');

      // Wait up to 2 seconds for GDB to exit cleanly
      const exited = await Promise.race([
        new Promise<boolean>((resolve) => {
          this.gdbProcess?.once('exit', () => resolve(true));
        }),
        new Promise<boolean>((resolve) => {
          setTimeout(() => resolve(false), 2000);
        })
      ]);

      if (!exited) {
        this.logger.logStdout('GDB did not exit within grace period. Issuing SIGKILL.');
        this.gdbProcess.kill('SIGKILL');
      }
    }

    this.gdbProcess = undefined;
    this.isTerminating = false;
  }

  public get isRunning(): boolean {
    return this.gdbProcess !== undefined && this.gdbProcess.exitCode === null;
  }
}
