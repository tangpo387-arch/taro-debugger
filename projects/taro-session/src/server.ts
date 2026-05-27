import { WebSocketServer as WSS, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { GdbProcessManager } from './gdb-process.js';
import { SessionManager } from './session.js';
import { SessionLogger } from './logger.js';
import { McpHost } from './mcp-host.js';

export class WebSocketServer {
  private wss?: WSS;
  private port: number;
  private logger: SessionLogger;
  private sessionManager: SessionManager;
  private gdbProcess: GdbProcessManager;
  private mcpHost: McpHost;
  private gdbPath: string;

  private clientSocket?: WebSocket;
  private agentSocket?: WebSocket;
  private closeCallbacks: (() => void)[] = [];

  constructor(
    port: number,
    logger: SessionLogger,
    sessionManager: SessionManager,
    gdbProcess: GdbProcessManager,
    mcpHost: McpHost,
    gdbPath: string
  ) {
    this.port = port;
    this.logger = logger;
    this.sessionManager = sessionManager;
    this.gdbProcess = gdbProcess;
    this.mcpHost = mcpHost;
    this.gdbPath = gdbPath;
  }

  public onClose(cb: () => void): void {
    this.closeCallbacks.push(cb);
  }

  private triggerClose(): void {
    for (const cb of this.closeCallbacks) {
      cb();
    }
  }

  public start(): void {
    // Bind WS server strictly to local loopback (127.0.0.1) for safety
    this.wss = new WSS({
      port: this.port,
      host: '127.0.0.1'
    });

    this.logger.logStdout(`WebSocket bridge server listening on ws://127.0.0.1:${this.port}`);

    this.wss.on('connection', (socket: WebSocket, req: IncomingMessage) => {
      const urlPath = req.url || '';

      if (urlPath.startsWith('/session/client')) {
        this.handleClientConnection(socket);
      } else if (urlPath.startsWith('/session/agent')) {
        this.handleAgentConnection(socket);
      } else {
        socket.close(4004, 'Invalid connection channel');
      }
    });

    // Wire GDB process events
    this.gdbProcess.onMessage((message) => {
      this.broadcastToSockets(message);
    });

    this.gdbProcess.onExit((code) => {
      this.broadcastToSockets(
        JSON.stringify({
          seq: 10000,
          type: 'event',
          event: 'exited',
          body: { exitCode: code }
        })
      );
      this.broadcastToSockets(
        JSON.stringify({
          seq: 10001,
          type: 'event',
          event: 'terminated'
        })
      );
    });

    // Wire MCP host tool calling responses
    this.mcpHost.onResponse((responseStr) => {
      if (this.agentSocket && this.agentSocket.readyState === WebSocket.OPEN) {
        this.agentSocket.send(responseStr);
      }
    });
  }

  private handleClientConnection(socket: WebSocket): void {
    this.logger.logStdout('Frontend client connected (/session/client)');
    this.clientSocket = socket;

    // Dynamic GDB Spawning removed: GDB is now exclusively spawned at daemon startup.

    socket.on('message', async (data: Buffer) => {
      try {
        const rawStr = data.toString('utf8');
        
        let jsonStr = rawStr;
        const headerMatch = rawStr.match(/^Content-Length:\s*\d+\r\n\r\n/i);
        if (headerMatch) {
          jsonStr = rawStr.substring(headerMatch[0].length);
        }

        const msg = JSON.parse(jsonStr);

        if (msg.channel === 'chat') {
          // Route chat dialogue envelope directly to the agent
          this.logger.logStdout(`Routing client chat message: ${msg.id}`);
          
          // Append chat to .tarodb chat history log
          this.sessionManager.appendChatMessage(msg);

          if (this.agentSocket && this.agentSocket.readyState === WebSocket.OPEN) {
            this.agentSocket.send(rawStr);
          } else {
            this.logger.logStderr('Attempted to route chat to Agent, but Agent is offline');
          }
        } else {
          // Check if this is an initialize command to dynamically spawn GDB
          if (msg.command === 'initialize') {
            this.logger.logStdout('Received initialize command: spawning GDB dynamically');
            await this.gdbProcess.terminate();
            this.gdbProcess.spawn(this.gdbPath);
          }

          // Forward standard DAP requests directly to GDB stdin
          // Intercept launch/attach request to auto-save launch configurations
          if (msg.command === 'launch' || msg.command === 'attach') {
            this.logger.logStdout(`Intercepted ${msg.command}: saving launch configuration to config.json`);
            const args = msg.arguments || {};
            const launchConfig = {
              version: '1.0.0',
              exportedAt: new Date().toISOString(),
              configuration: {
                program: args.program || '',
                args: args.args || [],
                cwd: args.cwd || process.cwd(),
                env: args.env || {}
              }
            };
            this.sessionManager.saveConfig(launchConfig);
          }

          // Auto-save breakpoints update if the command is setBreakpoints
          if (msg.command === 'setBreakpoints') {
            this.logger.logStdout(`Intercepted setBreakpoints: sync saving to disk`);
            const args = msg.arguments || {};
            const sourcePath = args.source?.path || '';
            const linesList = args.breakpoints || [];
            
            const currentData = this.sessionManager.getBreakpoints();
            // Filter and update existing active list
            const updatedList = currentData.breakpoints.filter((b) => b.sourceFile !== sourcePath);
            linesList.forEach((bp: any) => {
              updatedList.push({
                sourceFile: sourcePath,
                line: bp.line,
                condition: bp.condition
              });
            });
            this.sessionManager.saveBreakpoints({ breakpoints: updatedList });
          }

          this.gdbProcess.write(jsonStr);
        }
      } catch (e) {
        this.logger.logStderr(`Failed to handle Client message: ${(e as Error).message}`);
      }
    });

    socket.on('close', async () => {
      this.logger.logStdout('Frontend client disconnected (/session/client)');
      this.clientSocket = undefined;
      
      // Cascade GDB process termination when client drops to avoid orphan processes
      await this.gdbProcess.terminate();
      this.stop();
      this.triggerClose();
    });
  }

  private handleAgentConnection(socket: WebSocket): void {
    this.logger.logStdout('Agentic companion client connected (/session/agent)');
    this.agentSocket = socket;

    // sync existing session chat history
    const chatHistory = this.sessionManager.getChatHistory();
    socket.send(JSON.stringify({ channel: 'chat-history', history: chatHistory.chatHistory }));

    socket.on('message', (data: Buffer) => {
      try {
        const rawStr = data.toString('utf8');
        const msg = JSON.parse(rawStr);

        if (msg.channel === 'chat') {
          // Route agent chat response to the client
          this.logger.logStdout(`Routing agent chat message: ${msg.id}`);

          // Append chat to .tarodb chat history log
          this.sessionManager.appendChatMessage(msg);

          if (this.clientSocket && this.clientSocket.readyState === WebSocket.OPEN) {
            this.clientSocket.send(rawStr);
          } else {
            this.logger.logStderr('Attempted to route chat to Client, but Client is offline');
          }
        } else if (msg.jsonrpc === '2.0') {
          // MCP JSON-RPC protocol router
          const mcpResult = this.mcpHost.handleRequest(rawStr);
          if (mcpResult) {
            socket.send(mcpResult);
          }
        } else if (msg.channel === 'dap') {
          // Allow cognitive Agent to execute read-only inspect tool calls
          this.gdbProcess.write(JSON.stringify(msg.data));
        }
      } catch (e) {
        this.logger.logStderr(`Failed to handle Agent message: ${(e as Error).message}`);
      }
    });

    socket.on('close', () => {
      this.logger.logStdout('Agentic companion client disconnected (/session/agent)');
      this.agentSocket = undefined;
    });
  }

  private sendToClientAsBlob(data: string): void {
    if (this.clientSocket && this.clientSocket.readyState === WebSocket.OPEN) {
      const payloadBuffer = Buffer.from(data, 'utf8');
      const headerBuffer = Buffer.from(`Content-Length: ${payloadBuffer.length}\r\n\r\n`, 'utf8');
      const blobBuffer = Buffer.concat([headerBuffer, payloadBuffer]);
      this.clientSocket.send(blobBuffer);
    }
  }

  private broadcastToSockets(data: string): void {
    this.sendToClientAsBlob(data);
    
    if (this.agentSocket && this.agentSocket.readyState === WebSocket.OPEN) {
      // Agent socket can still receive plain text/buffer based on its own implementation,
      // but if it also needs standard DAP framing, we would wrap it too.
      // Currently, agent might expect raw DAP JSON string, so we send it as string.
      this.agentSocket.send(data);
    }
  }

  public stop(): void {
    this.wss?.close();
    this.clientSocket?.close();
    this.agentSocket?.close();
  }
}
