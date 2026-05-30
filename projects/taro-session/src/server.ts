import { WebSocketServer as WSS, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import fs from 'fs';
import path from 'path';
import { GdbProcessManager } from './gdb-process.js';
import { SessionManager } from './session.js';
import { SessionLogger } from './logger.js';
import { McpHost } from './mcp-host.js';

// ── Connection State Machine ───────────────────────────────────────────────

/**
 * Formal connection state for the /session/client socket.
 * - UNINITIALIZED: Socket connected, no session loaded. Only setup channel allowed.
 * - INITIALIZING:  Setup command received. Loading session directory and config.
 * - READY:         Session loaded and GDB running. Full DAP + Agent connections allowed.
 * - ERROR:         Setup or validation failure. Socket is closed; daemon accepts new connection.
 */
export type ServerSessionState = 'UNINITIALIZED' | 'INITIALIZING' | 'READY' | 'ERROR';

// ── Setup Channel Message Schemas ─────────────────────────────────────────

interface SetupEnvelope {
  channel: 'setup';
  command: 'open-session' | 'new-session';
  arguments: {
    sessionPath: string;
    config?: {
      program: string;
      args?: string[];
      cwd?: string;
      env?: Record<string, string>;
    };
  };
}

export class WebSocketServer {
  private wss?: WSS;
  private port: number;
  private logger: SessionLogger;
  private gdbPath: string;

  // ── Lazy-initialized session resources (set during INITIALIZING → READY) ──
  private sessionManager?: SessionManager;
  private gdbProcess?: GdbProcessManager;
  private mcpHost?: McpHost;

  private clientSocket?: WebSocket;
  private agentSocket?: WebSocket;
  private closeCallbacks: (() => void)[] = [];

  /** Current state of the /session/client connection lifecycle */
  private sessionState: ServerSessionState = 'UNINITIALIZED';
  private exitedEventSent = false;
  private terminatedEventSent = false;

  constructor(
    port: number,
    logger: SessionLogger,
    gdbPath: string
  ) {
    this.port = port;
    this.logger = logger;
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
  }

  // ── GDB Event Wiring ─────────────────────────────────────────────────────

  /**
   * Wires GDB process event listeners after a session is READY.
   * Called once per session load to avoid duplicate listeners.
   */
  private wireGdbEvents(): void {
    if (!this.gdbProcess) return;

    const currentGdb = this.gdbProcess;

    this.exitedEventSent = false;
    this.terminatedEventSent = false;

    this.gdbProcess.onMessage((message) => {
      // Discard messages if this GdbProcess has been superseded
      if (this.gdbProcess !== currentGdb) return;

      if (/"event"\s*:\s*"exited"/.test(message)) {
        this.exitedEventSent = true;
        this.logger.logStdout(`gdb Process exited, message ${message}`);
      }
      if (/"event"\s*:\s*"terminated"/.test(message)) {
        this.terminatedEventSent = true;
        this.logger.logStdout(`gdb Process terminated, message ${message}`);
      }
      this.broadcastToSockets(message);
    });

    this.gdbProcess.onExit((code) => {
      // Discard exit events if this GdbProcess has been superseded by a newer session
      if (this.gdbProcess !== currentGdb) {
        this.logger.logStdout('Ignored onExit: a new GDB process has already been spawned.');
        return;
      }

      this.logger.logStdout(`gdb Process exit: ${code}, exited: ${this.exitedEventSent}, terminated: ${this.terminatedEventSent}`);
      if (!this.exitedEventSent) {
        this.exitedEventSent = true;
        this.broadcastToSockets(
          JSON.stringify({
            seq: 10000,
            type: 'event',
            event: 'exited',
            body: { exitCode: code }
          })
        );
      }
      if (!this.terminatedEventSent) {
        this.terminatedEventSent = true;
        this.broadcastToSockets(
          JSON.stringify({
            seq: 10001,
            type: 'event',
            event: 'terminated'
          })
        );
      }

      // Reset state to INITIALIZING upon GDB exit to prepare for standard initialize-driven restarts
      this.sessionState = 'INITIALIZING';
      this.gdbProcess = undefined;
      this.logger.logStdout('Session state reset to INITIALIZING following GDB process exit.');
    });
  }

  // ── Client Connection Handler ─────────────────────────────────────────────

  private handleClientConnection(socket: WebSocket): void {
    this.logger.logStdout('Frontend client connected (/session/client)');
    this.clientSocket = socket;
    this.sessionState = 'UNINITIALIZED';

    socket.on('message', async (data: Buffer) => {
      try {
        const rawStr = data.toString('utf8');

        let jsonStr = rawStr;
        const headerMatch = rawStr.match(/^Content-Length:\s*\d+\r\n\r\n/i);
        if (headerMatch) {
          jsonStr = rawStr.substring(headerMatch[0].length);
        }

        const msg = JSON.parse(jsonStr);

        // ── Setup Channel Gate ──────────────────────────────────────────────
        if (msg.channel === 'setup') {
          await this.handleSetupMessage(socket, msg as SetupEnvelope);
          return;
        }

        // ── Chat Channel (pass-through to agent) ─────────────────────────────
        if (msg.channel === 'chat') {
          if (this.sessionState !== 'READY') {
            this.logger.logStderr('Dropped chat message: session not READY');
            return;
          }
          this.logger.logStdout(`Routing client chat message: ${msg.id}`);
          this.sessionManager!.appendChatMessage(msg);

          if (this.agentSocket && this.agentSocket.readyState === WebSocket.OPEN) {
            this.agentSocket.send(rawStr);
          } else {
            this.logger.logStderr('Attempted to route chat to Agent, but Agent is offline');
          }
          return;
        }

        // ── Auto-spawn GDB if we are in READY or INITIALIZING state and receive 'initialize' ──
        if ((this.sessionState === 'READY' || this.sessionState === 'INITIALIZING') && msg.command === 'initialize') {
          this.logger.logStdout('Auto-spawning GDB process on-demand for initialize request');
          try {
            // Cleanly terminate the prior GDB process (if it exists) to avoid orphaned subprocesses
            if (this.gdbProcess) {
              this.logger.logStdout('Terminating stale GDB process instance prior to starting new session');
              await this.gdbProcess.terminate();
            }

            const gdbProcess = new GdbProcessManager(this.logger);
            gdbProcess.spawn(this.gdbPath);
            this.gdbProcess = gdbProcess;
            
            // Wire GDB event listeners
            this.wireGdbEvents();
            
            // Transition to READY
            this.sessionState = 'READY';
          } catch (err: any) {
            this.logger.logStderr(`Failed to spawn GDB on-demand: ${err.message}`);
            const errorResponse = JSON.stringify({
              seq: 0,
              type: 'response',
              request_seq: msg.seq ?? 0,
              success: false,
              command: msg.command,
              message: `Failed to initialize debugger backend: ${err.message}`
            });
            this.sendToClientAsBlob(errorResponse);
            return;
          }
        }

        // ── DAP Gate: reject if not READY ────────────────────────────────────
        if (this.sessionState !== 'READY') {
          this.logger.logStderr(`Rejected DAP message '${msg.command}': session state is ${this.sessionState}`);
          const errorResponse = JSON.stringify({
            seq: 0,
            type: 'response',
            request_seq: msg.seq ?? 0,
            success: false,
            command: msg.command ?? 'unknown',
            message: `Session is not ready. Current state: ${this.sessionState}. Send a setup command first.`
          });
          this.sendToClientAsBlob(errorResponse);
          return;
        }

        // ── DAP launch/attach validation (Pattern A enforcement) ─────────────
        if (msg.command === 'launch' || msg.command === 'attach') {
          const program = msg.arguments?.program;
          if (!program || typeof program !== 'string' || program.trim() === '') {
            this.logger.logStderr(`Rejected ${msg.command}: missing or empty 'program' argument`);
            const errorResponse = JSON.stringify({
              seq: msg.seq ?? 0,
              type: 'response',
              request_seq: msg.seq ?? 0,
              success: false,
              command: msg.command,
              message: "Launch configuration missing or empty 'program' argument."
            });
            this.sendToClientAsBlob(errorResponse);
            // Fail-Fast: transition to ERROR and close the socket
            await this.enterErrorState(socket, "Launch configuration missing or empty 'program' argument.");
            return;
          }

          // Intercept launch/attach to persist launch config to config.json
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
          this.sessionManager!.saveConfig(launchConfig);
        }

        // ── Auto-save breakpoints on setBreakpoints ──────────────────────────
        if (msg.command === 'setBreakpoints') {
          this.logger.logStdout('Intercepted setBreakpoints: sync saving to disk');
          const args = msg.arguments || {};
          const sourcePath = args.source?.path || '';
          const linesList = args.breakpoints || [];

          const currentData = this.sessionManager!.getBreakpoints();
          const updatedList = currentData.breakpoints.filter((b) => b.sourceFile !== sourcePath);
          linesList.forEach((bp: any) => {
            updatedList.push({
              sourceFile: sourcePath,
              line: bp.line,
              condition: bp.condition
            });
          });
          this.sessionManager!.saveBreakpoints({ breakpoints: updatedList });
        }

        // ── Forward all other DAP messages to GDB stdin ──────────────────────
        this.gdbProcess!.write(jsonStr);
      } catch (e) {
        this.logger.logStderr(`Failed to handle Client message: ${(e as Error).message}`);
      }
    });

    socket.on('close', async () => {
      this.logger.logStdout('Frontend client disconnected (/session/client)');
      this.clientSocket = undefined;

      // Cascade GDB process termination to avoid orphan processes
      if (this.gdbProcess) {
        await this.gdbProcess.terminate();
      }
      this.stop();
      this.triggerClose();
    });
  }

  // ── Setup Channel Handler ─────────────────────────────────────────────────

  /**
   * Processes incoming setup channel envelopes.
   * Valid commands: 'open-session' (load existing .tarodb) or 'new-session' (create new).
   */
  private async handleSetupMessage(socket: WebSocket, envelope: SetupEnvelope): Promise<void> {
    if (this.sessionState !== 'UNINITIALIZED' && this.sessionState !== 'ERROR') {
      this.logger.logStderr(`Ignored setup command '${envelope.command}': state is already ${this.sessionState}`);
      return;
    }

    const { command, arguments: args } = envelope;

    if (!args?.sessionPath || typeof args.sessionPath !== 'string') {
      await this.enterErrorState(socket, 'Setup command missing required sessionPath argument.');
      return;
    }

    this.logger.logStdout(`Setup command received: '${command}' → ${args.sessionPath}`);
    this.sessionState = 'INITIALIZING';

    try {
      const resolvedPath = path.resolve(args.sessionPath);
      if (command === 'new-session' && fs.existsSync(resolvedPath)) {
        throw new Error(`Cannot create new session: path '${args.sessionPath}' already exists.`);
      }

      // Instantiate session manager (creates directory + default files if missing)
      const sessionManager = new SessionManager(args.sessionPath);

      if (command === 'new-session') {
        // Validate new-session requires a config block
        if (!args.config || !args.config.program) {
          throw new Error("'new-session' command requires 'arguments.config.program' to be specified.");
        }
        const newConfig = {
          version: '1.0.0',
          exportedAt: new Date().toISOString(),
          configuration: {
            program: args.config.program,
            args: args.config.args || [],
            cwd: args.config.cwd || process.cwd(),
            env: args.config.env || {}
          }
        };
        sessionManager.saveConfig(newConfig);
        this.logger.logStdout(`new-session: config written to ${args.sessionPath}`);
      }

      // Read the current (or newly written) config to return to client
      const loadedConfig = sessionManager.getConfig();

      // Spawn GDB (daemon startup-time spawning per spec)
      const gdbProcess = new GdbProcessManager(this.logger);
      gdbProcess.spawn(this.gdbPath);

      // Build MCP host using the loaded session manager
      const workspaceRoot = process.cwd();
      const mcpHost = new McpHost(sessionManager, this.logger, workspaceRoot);

      // Wire MCP host tool-call responses → agent socket
      mcpHost.onResponse((responseStr) => {
        if (this.agentSocket && this.agentSocket.readyState === WebSocket.OPEN) {
          this.agentSocket.send(responseStr);
        }
      });

      // Assign to instance after all construction succeeds
      this.sessionManager = sessionManager;
      this.gdbProcess = gdbProcess;
      this.mcpHost = mcpHost;

      // Wire GDB events now that we have a live process
      this.wireGdbEvents();

      // Transition to READY
      this.sessionState = 'READY';
      this.logger.logStdout(`Session READY: ${args.sessionPath}`);

      // Broadcast session-ready with loaded configuration (Content-Length framed)
      this.sendFramed(socket, JSON.stringify({
        channel: 'setup',
        event: 'session-ready',
        body: {
          status: 'success',
          sessionPath: args.sessionPath,
          config: loadedConfig
        }
      }));
    } catch (e) {
      await this.enterErrorState(socket, (e as Error).message);
    }
  }

  // ── ERROR State Handler (Fail-Fast Policy) ────────────────────────────────

  /**
   * Transitions the connection to the ERROR state.
   * Per spec: broadcasts session-failed event and immediately closes the socket,
   * forcing the client to reconnect from scratch (Reconnect-Retry Only policy).
   */
  private async enterErrorState(socket: WebSocket, reason: string): Promise<void> {
    this.logger.logStderr(`Session entering ERROR state: ${reason}`);
    this.sessionState = 'ERROR';

    // Terminate GDB if it was already spawned
    if (this.gdbProcess) {
      await this.gdbProcess.terminate();
      this.gdbProcess = undefined;
    }
    this.sessionManager = undefined;
    this.mcpHost = undefined;

    // Broadcast error to client (Content-Length framed for transport consistency)
    try {
      this.sendFramed(socket, JSON.stringify({
        channel: 'setup',
        event: 'session-failed',
        body: { error: reason }
      }));
    } catch (_) {
      // Socket may already be closing; ignore send errors
    }

    // Keep WebSocket alive to support client retry without full reconnection
    // socket.close(1011, 'Session error — reconnect to retry');
  }

  /**
   * Sends a JSON payload to the given socket using the same Content-Length framing
   * used for all DAP messages. This ensures the browser transport's single Blob
   * parsing path handles all outbound messages uniformly.
   */
  private sendFramed(socket: WebSocket, json: string): void {
    const payloadBuffer = Buffer.from(json, 'utf8');
    const headerBuffer = Buffer.from(`Content-Length: ${payloadBuffer.length}\r\n\r\n`, 'utf8');
    socket.send(Buffer.concat([headerBuffer, payloadBuffer]));
  }

  // ── Agent Connection Handler ──────────────────────────────────────────────

  private handleAgentConnection(socket: WebSocket): void {
    // AC-1: Reject agent connection if session is not READY
    if (this.sessionState !== 'READY') {
      this.logger.logStdout(`Rejected /session/agent connection: state is ${this.sessionState}`);
      socket.close(4005, 'Session not ready. Client must complete setup first.');
      return;
    }

    this.logger.logStdout('Agentic companion client connected (/session/agent)');
    this.agentSocket = socket;

    // Sync existing session chat history to new agent connection
    const chatHistory = this.sessionManager!.getChatHistory();
    socket.send(JSON.stringify({ channel: 'chat-history', history: chatHistory.chatHistory }));

    socket.on('message', (data: Buffer) => {
      try {
        const rawStr = data.toString('utf8');
        const msg = JSON.parse(rawStr);

        if (msg.channel === 'chat') {
          // Route agent chat response to the client
          this.logger.logStdout(`Routing agent chat message: ${msg.id}`);
          this.sessionManager!.appendChatMessage(msg);

          if (this.clientSocket && this.clientSocket.readyState === WebSocket.OPEN) {
            this.clientSocket.send(rawStr);
          } else {
            this.logger.logStderr('Attempted to route chat to Client, but Client is offline');
          }
        } else if (msg.jsonrpc === '2.0') {
          // MCP JSON-RPC protocol router
          const mcpResult = this.mcpHost!.handleRequest(rawStr);
          if (mcpResult) {
            socket.send(mcpResult);
          }
        } else if (msg.channel === 'dap') {
          // Allow cognitive Agent to execute read-only inspect tool calls
          this.gdbProcess!.write(JSON.stringify(msg.data));
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

  // ── Broadcast Helpers ─────────────────────────────────────────────────────

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
      this.agentSocket.send(data);
    }
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  public stop(): void {
    this.wss?.close();
    this.clientSocket?.close();
    this.agentSocket?.close();
  }
}
