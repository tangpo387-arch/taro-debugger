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
  taro-session --session-path <directory> [--port <number>]

Options:
  --session-path   Path to the .tarodb session database directory (Mandatory)
  --port           Local loopback port allocation (Default: 8080)
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

  const gdbPathArg = argv['gdb-path'] || 'gdb';

  // 3. Setup WebSocket multiplexer server
  const wsServer = new WebSocketServer(port, logger, sessionManager, gdbProcess, mcpHost, gdbPathArg);

  // 5. Start WebSocket server
  wsServer.start();

  // 6. Graceful daemon shutdown triggers
  const handleExit = async (signal: string) => {
    logger.logStdout(`Received termination signal: ${signal}. Sweeping GDB and closing files...`);
    wsServer.stop();
    await gdbProcess.terminate();
    logger.logStdout('taro-session stopped cleanly.');
    logger.close();
    process.exit(0);
  };

  process.on('SIGINT', () => handleExit('SIGINT'));
  process.on('SIGTERM', () => handleExit('SIGTERM'));
}

bootstrap().catch((err) => {
  console.error(`Fatal bootstrap crash: ${(err as Error).message}`);
  process.exit(1);
});
