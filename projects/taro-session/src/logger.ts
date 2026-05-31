import fs from 'fs';
import path from 'path';

export class SessionLogger {
  private stdoutStream?: fs.WriteStream;
  private stderrStream?: fs.WriteStream;
  private dapStream?: fs.WriteStream;
  public readonly logsDir: string;

  constructor(sessionPath: string) {
    this.logsDir = path.join(sessionPath, 'logs');
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }

    this.stdoutStream = fs.createWriteStream(path.join(this.logsDir, 'stdout.log'), { flags: 'a', encoding: 'utf8' });
    this.stderrStream = fs.createWriteStream(path.join(this.logsDir, 'stderr.log'), { flags: 'a', encoding: 'utf8' });
    this.dapStream = fs.createWriteStream(path.join(this.logsDir, 'dap.log'), { flags: 'a', encoding: 'utf8' });
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
