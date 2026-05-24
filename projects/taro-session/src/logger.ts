import fs from 'fs';
import path from 'path';

export class SessionLogger {
  private stdoutStream?: fs.WriteStream;
  private stderrStream?: fs.WriteStream;
  private dapStream?: fs.WriteStream;

  constructor(sessionPath: string) {
    const logsDir = path.join(sessionPath, 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    this.stdoutStream = fs.createWriteStream(path.join(logsDir, 'stdout.log'), { flags: 'a', encoding: 'utf8' });
    this.stderrStream = fs.createWriteStream(path.join(logsDir, 'stderr.log'), { flags: 'a', encoding: 'utf8' });
    this.dapStream = fs.createWriteStream(path.join(logsDir, 'dap.log'), { flags: 'a', encoding: 'utf8' });
  }

  public logStdout(message: string): void {
    this.stdoutStream?.write(`[${new Date().toISOString()}] ${message}\n`);
  }

  public logStderr(message: string): void {
    this.stderrStream?.write(`[${new Date().toISOString()}] ${message}\n`);
  }

  public logDap(direction: 'in' | 'out', payload: string): void {
    this.dapStream?.write(`[${new Date().toISOString()}] [${direction.toUpperCase()}] ${payload}\n`);
  }

  public close(): void {
    this.stdoutStream?.end();
    this.stderrStream?.end();
    this.dapStream?.end();
  }
}
