import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { WebSocket } from 'ws';
import { WebSocketServer } from './server.js';
import { SessionLogger } from './logger.js';

// ── Mock GdbProcessManager ──────────────────────────────────────────────────
let latestOnMessageCallback: ((msg: string) => void) | undefined;
let latestOnExitCallback: ((code: number | null) => void) | undefined;

vi.mock('./gdb-process.js', () => {
  return {
    GdbProcessManager: class {
      logger: any;
      constructor(logger: any) {
        this.logger = logger;
      }
      spawn = vi.fn().mockImplementation(() => {});
      onMessage = vi.fn().mockImplementation((cb) => {
        latestOnMessageCallback = cb;
      });
      onExit = vi.fn().mockImplementation((cb) => {
        latestOnExitCallback = cb;
      });
      write = vi.fn();
      terminate = vi.fn().mockResolvedValue(undefined);
      get isRunning() {
        return true;
      }
      // Testing Helpers
      public simulateMessage(message: string) {
        if (latestOnMessageCallback) {
          latestOnMessageCallback(message);
        }
      }
      public simulateExit(code: number) {
        if (latestOnExitCallback) {
          latestOnExitCallback(code);
        }
      }
    }
  };
});

// ── Test Socket Interface for Race-free Messaging ──────────────────────────
interface TestSocket {
  ws: WebSocket;
  messages: string[];
  waitForNextMessage: () => Promise<string>;
}

describe('WebSocketServer', () => {
  let tempDirs: string[] = [];
  let tempDir: string;
  let logger: SessionLogger;
  let server: WebSocketServer;
  let socketsToClose: WebSocket[] = [];

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'taro-session-server-test-'));
    tempDirs.push(tempDir);
    logger = new SessionLogger(tempDir);
    socketsToClose = [];
  });

  afterEach(async () => {
    // Cleanly close all sockets opened in tests
    for (const ws of socketsToClose) {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    }
    if (server) {
      server.stop();
    }
    logger.close();
  });

  afterAll(async () => {
    // Wait for all server resources, sockets, and stream flushes to complete
    await new Promise((resolve) => setTimeout(resolve, 200));
    for (const dir of tempDirs) {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  // ── Testing Helpers ────────────────────────────────────────────────────────

  async function startServer(wsServer: WebSocketServer): Promise<number> {
    await new Promise<void>((resolve) => {
      wsServer.start(() => resolve());
    });
    return wsServer.getPort();
  }

  function connectTestSocket(url: string): Promise<TestSocket> {
    return new Promise<TestSocket>((resolve, reject) => {
      const ws = new WebSocket(url);
      const messages: string[] = [];
      const waiters: ((msg: string) => void)[] = [];

      socketsToClose.push(ws);

      ws.on('message', (data) => {
        const msgStr = data.toString('utf8');
        if (waiters.length > 0) {
          const waiter = waiters.shift();
          waiter!(msgStr);
        } else {
          messages.push(msgStr);
        }
      });

      ws.once('open', () => {
        const testSocket: TestSocket = {
          ws,
          messages,
          waitForNextMessage: () => {
            if (messages.length > 0) {
              return Promise.resolve(messages.shift()!);
            }
            return new Promise<string>((res) => {
              waiters.push(res);
            });
          }
        };
        resolve(testSocket);
      });

      ws.once('error', reject);
    });
  }

  function parseFramedMessage(data: string | Buffer): any {
    const rawStr = data.toString('utf8');
    const headerMatch = rawStr.match(/^Content-Length:\s*\d+\r\n\r\n/i);
    if (headerMatch) {
      const jsonStr = rawStr.substring(headerMatch[0].length);
      return JSON.parse(jsonStr);
    }
    return JSON.parse(rawStr);
  }

  // ── Connection Gating Tests ────────────────────────────────────────────────

  it('should reject unauthorized /session/agent connections if state is not READY', async () => {
    // Arrange
    server = new WebSocketServer(0, logger, 'mock-gdb');
    const port = await startServer(server);

    // Act & Assert
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/session/agent`);
      socketsToClose.push(ws);
      
      let closed = false;
      let errored = false;
      
      ws.on('close', (code, reason) => {
        if (errored || closed) return;
        closed = true;
        try {
          expect(code).toBe(4005);
          expect(reason.toString()).toContain('Session not ready');
          resolve();
        } catch (err) {
          reject(err);
        }
      });
      
      ws.on('error', (err) => {
        if (closed || errored) return;
        errored = true;
        reject(err);
      });
    });
  });

  it('should initialize session and transition state to READY upon setup command', async () => {
    // Arrange
    server = new WebSocketServer(0, logger, 'mock-gdb');
    const port = await startServer(server);

    // Act
    const client = await connectTestSocket(`ws://127.0.0.1:${port}/session/client`);

    const setupMsg = {
      channel: 'setup',
      command: 'new-session',
      arguments: {
        sessionPath: path.join(tempDir, 'active-session'),
        config: {
          program: 'my-app',
          args: [],
          cwd: tempDir,
          env: {}
        }
      }
    };

    client.ws.send(JSON.stringify(setupMsg));

    // Wait for session-ready event
    const rawResponse = await client.waitForNextMessage();
    const response = parseFramedMessage(rawResponse);

    // Assert
    expect(response.channel).toBe('setup');
    expect(response.event).toBe('session-ready');
    expect(response.body.status).toBe('success');
    expect(server.getSessionState()).toBe('READY');
    expect(server.getSessionManager()).toBeDefined();
    expect(server.getGdbProcess()).toBeDefined();
  });

  // ── Concurrent Event Broadcasting Tests ────────────────────────────────────

  it('should broadcast GDB events to both client and agent concurrently', async () => {
    // Arrange
    server = new WebSocketServer(0, logger, 'mock-gdb');
    const port = await startServer(server);

    const client = await connectTestSocket(`ws://127.0.0.1:${port}/session/client`);

    // Setup the session to transition to READY
    const setupMsg = {
      channel: 'setup',
      command: 'new-session',
      arguments: {
        sessionPath: path.join(tempDir, 'active-session'),
        config: { program: 'my-app' }
      }
    };
    client.ws.send(JSON.stringify(setupMsg));
    await client.waitForNextMessage(); // Consume session-ready response

    // Connect the agent socket
    const agent = await connectTestSocket(`ws://127.0.0.1:${port}/session/agent`);
    await agent.waitForNextMessage(); // Consume initial chat-history sync event

    // Act: Simulate an event coming from GDB process stdout stream
    const mockGdbEvent = JSON.stringify({
      seq: 42,
      type: 'event',
      event: 'stopped',
      body: { reason: 'breakpoint' }
    });

    const gdbMock = server.getGdbProcess() as any;
    expect(gdbMock).toBeDefined();

    const clientPromise = client.waitForNextMessage();
    const agentPromise = agent.waitForNextMessage();

    gdbMock.simulateMessage(mockGdbEvent);

    const clientData = await clientPromise;
    const agentData = await agentPromise;

    // Assert: Check both client and agent sockets received it concurrently
    const clientPayload = parseFramedMessage(clientData);
    expect(clientPayload.event).toBe('stopped');
    expect(clientPayload.seq).toBe(42);

    const agentPayload = JSON.parse(agentData);
    expect(agentPayload.event).toBe('stopped');
    expect(agentPayload.seq).toBe(42);
  });

  // ── Bidirectional Chat Routing Tests ───────────────────────────────────────

  it('should route chat bidirectionally and persist messages in chat.json', async () => {
    // Arrange
    server = new WebSocketServer(0, logger, 'mock-gdb');
    const port = await startServer(server);

    const client = await connectTestSocket(`ws://127.0.0.1:${port}/session/client`);

    // Setup session
    const sessionPath = path.join(tempDir, 'active-session');
    const setupMsg = {
      channel: 'setup',
      command: 'new-session',
      arguments: {
        sessionPath,
        config: { program: 'my-app' }
      }
    };
    client.ws.send(JSON.stringify(setupMsg));
    await client.waitForNextMessage(); // Consume session-ready response

    // Connect the agent
    const agent = await connectTestSocket(`ws://127.0.0.1:${port}/session/agent`);
    await agent.waitForNextMessage(); // Consume initial chat-history sync event

    // Act & Assert 1: Client message routed to Agent
    const clientChat = {
      channel: 'chat',
      id: 'msg-client-1',
      timestamp: new Date().toISOString(),
      sender: 'client',
      content: 'Hello Agent!'
    };

    const agentReceivePromise = agent.waitForNextMessage();
    client.ws.send(JSON.stringify(clientChat));
    const agentReceivedStr = await agentReceivePromise;
    const agentReceived = JSON.parse(agentReceivedStr);

    expect(agentReceived.id).toBe('msg-client-1');
    expect(agentReceived.content).toBe('Hello Agent!');

    // Act & Assert 2: Agent response routed to Client
    const agentChat = {
      channel: 'chat',
      id: 'msg-agent-1',
      timestamp: new Date().toISOString(),
      sender: 'agent',
      content: 'Hello Client, I am online.'
    };

    const clientReceivePromise = client.waitForNextMessage();
    agent.ws.send(JSON.stringify(agentChat));
    const clientReceivedStr = await clientReceivePromise;
    const clientReceived = JSON.parse(clientReceivedStr);

    expect(clientReceived.id).toBe('msg-agent-1');
    expect(clientReceived.content).toBe('Hello Client, I am online.');

    // Assert 3: Both messages are persisted in chat.json
    const chatFilePath = path.join(sessionPath, 'chat.json');
    expect(fs.existsSync(chatFilePath)).toBe(true);
    const persistedData = JSON.parse(fs.readFileSync(chatFilePath, 'utf8'));
    expect(persistedData.chatHistory.length).toBe(2);
    expect(persistedData.chatHistory[0].id).toBe('msg-client-1');
    expect(persistedData.chatHistory[1].id).toBe('msg-agent-1');
  });
});
