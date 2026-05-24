import fs from 'fs';
import path from 'path';

export interface DebuggerConfiguration {
  program: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
}

export interface SessionConfig {
  version: string;
  exportedAt: string;
  configuration: DebuggerConfiguration;
}

export interface Breakpoint {
  sourceFile: string;
  line: number;
  condition?: string;
  hitCount?: number;
}

export interface BreakpointsData {
  breakpoints: Breakpoint[];
}

export interface ChatMessage {
  channel: 'chat';
  id: string;
  timestamp: string;
  sender: 'client' | 'agent';
  content: string;
  context?: any;
}

export interface ChatData {
  chatHistory: ChatMessage[];
}

export class SessionManager {
  private sessionPath: string;
  private configFilePath: string;
  private breakpointsFilePath: string;
  private chatFilePath: string;
  private memoryFilePath: string;

  constructor(sessionPath: string) {
    this.sessionPath = path.resolve(sessionPath);
    if (!fs.existsSync(this.sessionPath)) {
      fs.mkdirSync(this.sessionPath, { recursive: true });
    }

    this.configFilePath = path.join(this.sessionPath, 'config.json');
    this.breakpointsFilePath = path.join(this.sessionPath, 'breakpoints.json');
    this.chatFilePath = path.join(this.sessionPath, 'chat.json');
    this.memoryFilePath = path.join(this.sessionPath, 'memory.md');

    this.initializeFiles();
  }

  private initializeFiles(): void {
    // Initialize config.json
    if (!fs.existsSync(this.configFilePath)) {
      const defaultConfig: SessionConfig = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        configuration: {
          program: '',
          args: [],
          cwd: process.cwd(),
          env: {}
        }
      };
      fs.writeFileSync(this.configFilePath, JSON.stringify(defaultConfig, null, 2), 'utf8');
    }

    // Initialize breakpoints.json
    if (!fs.existsSync(this.breakpointsFilePath)) {
      const defaultBreakpoints: BreakpointsData = { breakpoints: [] };
      fs.writeFileSync(this.breakpointsFilePath, JSON.stringify(defaultBreakpoints, null, 2), 'utf8');
    }

    // Initialize chat.json
    if (!fs.existsSync(this.chatFilePath)) {
      const defaultChat: ChatData = { chatHistory: [] };
      fs.writeFileSync(this.chatFilePath, JSON.stringify(defaultChat, null, 2), 'utf8');
    }

    // Initialize memory.md
    if (!fs.existsSync(this.memoryFilePath)) {
      fs.writeFileSync(
        this.memoryFilePath,
        '# Agentic AI Companion Cognitive Memory\n\nNo cognitive memory state initialized yet.\n',
        'utf8'
      );
    }
  }

  public getConfig(): SessionConfig {
    try {
      const content = fs.readFileSync(this.configFilePath, 'utf8');
      return JSON.parse(content);
    } catch (e) {
      throw new Error(`Failed to read config.json: ${(e as Error).message}`);
    }
  }

  public saveConfig(config: SessionConfig): void {
    fs.writeFileSync(this.configFilePath, JSON.stringify(config, null, 2), 'utf8');
  }

  public getBreakpoints(): BreakpointsData {
    try {
      const content = fs.readFileSync(this.breakpointsFilePath, 'utf8');
      return JSON.parse(content);
    } catch (e) {
      return { breakpoints: [] };
    }
  }

  public saveBreakpoints(data: BreakpointsData): void {
    fs.writeFileSync(this.breakpointsFilePath, JSON.stringify(data, null, 2), 'utf8');
  }

  public getChatHistory(): ChatData {
    try {
      const content = fs.readFileSync(this.chatFilePath, 'utf8');
      return JSON.parse(content);
    } catch (e) {
      return { chatHistory: [] };
    }
  }

  public appendChatMessage(message: ChatMessage): void {
    const data = this.getChatHistory();
    data.chatHistory.push(message);
    fs.writeFileSync(this.chatFilePath, JSON.stringify(data, null, 2), 'utf8');
  }

  public readAgentMemory(): string {
    try {
      return fs.readFileSync(this.memoryFilePath, 'utf8');
    } catch (e) {
      return '';
    }
  }

  public writeAgentMemory(content: string): void {
    fs.writeFileSync(this.memoryFilePath, content, 'utf8');
  }
}
