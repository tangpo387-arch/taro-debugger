#!/usr/bin/env node

import yargsParser from 'yargs-parser';
import os from 'os';
import path from 'path';
import { SessionLogger } from './logger.js';
import { GdbProcessManager } from './gdb-process.js';
import { WebSocketServer } from './server.js';

function printUsage(): void {
  console.log(`
Taro Session Server Daemon (v1.0.0)

Usage:
  taro-session [--port <number>] [--gdb-path <path>] [--one-shot] [--log-path <directory>]

Options:
  --port           Local loopback port allocation (Default: 8080)
  --gdb-path       Path to the GDB executable (Default: gdb)
  --log-path       Directory to write session log files (Default: OS temp directory)
  --one-shot       Terminate daemon on client disconnect (Default: true, use --no-one-shot to disable)
  --help           Show this help information

Note:
  --session-path is no longer required at startup. The client frontend specifies the session
  directory via the setup channel (open-session or new-session command) after connecting.
`);
}

async function bootstrap() {
  const argv = yargsParser(process.argv.slice(2));

  if (argv.help) {
    printUsage();
    process.exit(0);
  }

  const port = parseInt(argv.port || '8080', 10);
  const gdbPathArg = argv['gdb-path'] || 'gdb';
  const logPathArg = argv['log-path'] || path.join(os.tmpdir(), `taro-session-logs-${process.pid}`);
  const oneShotArg = argv['one-shot'] !== false && argv['one-shot'] !== 'false';

  console.log(`taro-session daemon starting on ws://127.0.0.1:${port}`);
  console.log(`GDB executable: ${gdbPathArg}`);
  console.log(`Log path: ${logPathArg}`);
  console.log(`One-shot mode: ${oneShotArg}`);
  console.log('Session path: determined by client setup channel command');

  let running = true;

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
    process.exit(0);
  };

  process.on('SIGINT', () => handleSystemExit('SIGINT'));
  process.on('SIGTERM', () => handleSystemExit('SIGTERM'));

  while (running) {
    // Logger uses a fixed log path; session-specific file I/O is handled by SessionManager
    // which is instantiated lazily by WebSocketServer during the setup handshake.
    const logger = new SessionLogger(logPathArg);

    logger.logStdout('--- taro-session Daemon Starting ---');
    logger.logStdout(`Listening on port: ${port}`);
    logger.logStdout(`GDB path: ${gdbPathArg}`);

    // WebSocketServer now owns the lifecycle of SessionManager, GdbProcessManager, and McpHost.
    // These are instantiated lazily inside the server after the client sends the setup command.
    const wsServer = new WebSocketServer(port, logger, gdbPathArg);

    activeWsServer = wsServer;

    // Register completion trigger before starting the server to avoid any race conditions
    const closePromise = new Promise<void>((resolve) => {
      wsServer.onClose(() => {
        resolve();
      });
    });

    // Start WebSocket server
    wsServer.start();

    // Wait for this session's server to shut down on client disconnect
    await closePromise;

    // Clean up resources of the completed cycle
    logger.logStdout('taro-session stopped cleanly for this connection cycle.');
    logger.close();

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
