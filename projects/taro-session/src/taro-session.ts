#!/usr/bin/env node

import path from 'path';
import yargsParser from 'yargs-parser';
import { SessionLogger } from './logger.js';
import { SessionManager } from './session.js';
import { GdbProcessManager } from './gdb-process.js';
import { McpHost } from './mcp-host.js';
import { WebSocketServer } from './server.js';

function printUsage(): void {
  console.log(`
Taro Session Server Daemon (v1.0.0)

Usage:
  taro-session --session-path <directory> [--port <number>] [--gdb-path <path>] [--one-shot]

Options:
  --session-path   Path to the .tarodb session database directory (Mandatory)
  --port           Local loopback port allocation (Default: 8080)
  --gdb-path       Path to the GDB executable (Default: gdb)
  --one-shot       Terminate daemon on client disconnect (Default: true, use --no-one-shot to disable)
  --help           Show this help information
`);
}

async function bootstrap() {
  const argv = yargsParser(process.argv.slice(2));

  if (argv.help) {
    printUsage();
    process.exit(0);
  }

  const sessionPathArg = argv['session-path'];
  const port = parseInt(argv.port || '8080', 10);

  if (!sessionPathArg) {
    console.error('Error: Missing mandatory argument --session-path');
    printUsage();
    process.exit(1);
  }

  const sessionPath = path.resolve(sessionPathArg);
  console.log(`Initializing taro-session at: ${sessionPath}`);
  console.log(`Active loopback port: ${port}`);

  const gdbPathArg = argv['gdb-path'] || 'gdb';
  const oneShotArg = argv['one-shot'] !== false && argv['one-shot'] !== 'false';

  let running = true;

  let activeLogger: SessionLogger | null = null;
  let activeGdbProcess: GdbProcessManager | null = null;
  let activeWsServer: WebSocketServer | null = null;

  const handleSystemExit = async (signal: string) => {
    console.log(`Received system termination signal: ${signal}. Sweeping resources and exiting...`);
    if (activeWsServer) {
      activeWsServer.stop();
    }
    if (activeGdbProcess) {
      await activeGdbProcess.terminate();
    }
    if (activeLogger) {
      activeLogger.logStdout('taro-session stopped cleanly due to termination signal.');
      activeLogger.close();
    }
    process.exit(0);
  };

  process.on('SIGINT', () => handleSystemExit('SIGINT'));
  process.on('SIGTERM', () => handleSystemExit('SIGTERM'));

  while (running) {
    // 1. Setup persistence & logger services
    const logger = new SessionLogger(sessionPath);
    const sessionManager = new SessionManager(sessionPath);

    logger.logStdout('--- taro-session Daemon Starting ---');
    logger.logStdout(`Session path resolved: ${sessionPath}`);

    // 2. Setup GDB manager & MCP solver host
    const gdbProcess = new GdbProcessManager(logger);
    
    // Workspace root resolution (defaults to grandparent directory or cwd)
    const workspaceRoot = process.cwd();
    const mcpHost = new McpHost(sessionManager, logger, workspaceRoot);

    // 3. Setup WebSocket multiplexer server
    const wsServer = new WebSocketServer(port, logger, sessionManager, gdbProcess, mcpHost, gdbPathArg);

    // Keep active references for the signal handlers to access
    activeLogger = logger;
    activeGdbProcess = gdbProcess;
    activeWsServer = wsServer;

    // 4. Register completion trigger before starting the server to avoid any race conditions
    const closePromise = new Promise<void>((resolve) => {
      wsServer.onClose(() => {
        resolve();
      });
    });

    // 5. Start WebSocket server
    wsServer.start();

    // 6. Wait for this session's server to shut down on client disconnect
    await closePromise;

    // 6. Clean up resources of the completed cycle
    await gdbProcess.terminate();
    logger.logStdout('taro-session stopped cleanly for this connection cycle.');
    logger.close();

    activeLogger = null;
    activeGdbProcess = null;
    activeWsServer = null;

    if (oneShotArg) {
      running = false;
    } else {
      console.log('taro-session continuing to listen for new connections (continue loop mode)...');
    }
  }
}

bootstrap().catch((err) => {
  console.error(`Fatal bootstrap crash: ${(err as Error).message}`);
  process.exit(1);
});
