import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { SessionLogger } from './logger.js';

describe('SessionLogger', () => {
  let tempDirs: string[] = [];
  let tempDir: string;
  let logger: SessionLogger;

  beforeEach(() => {
    // Arrange: Create a temporary directory for logs
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'taro-session-logger-test-'));
    tempDirs.push(tempDir);
  });

  afterEach(() => {
    if (logger) {
      logger.close();
    }
  });

  afterAll(async () => {
    // Wait for all streams across all tests to flush and close cleanly before deleting directories
    await new Promise((resolve) => setTimeout(resolve, 200));
    for (const dir of tempDirs) {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it('should create the logs directory and log files on instantiation', async () => {
    // Act
    logger = new SessionLogger(tempDir);
    // Allow small window for file descriptors to open on disk
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Assert
    const logsDir = path.join(tempDir, 'logs');
    expect(fs.existsSync(logsDir)).toBe(true);
    expect(fs.statSync(logsDir).isDirectory()).toBe(true);
    expect(fs.existsSync(path.join(logsDir, 'stdout.log'))).toBe(true);
    expect(fs.existsSync(path.join(logsDir, 'stderr.log'))).toBe(true);
    expect(fs.existsSync(path.join(logsDir, 'dap.log'))).toBe(true);
  });

  it('should correctly append messages with ISO-8601 timestamps to stdout.log', async () => {
    // Arrange
    logger = new SessionLogger(tempDir);
    const message = 'Standard output test message';

    // Act
    logger.logStdout(message);
    // Allow stream to flush to disk
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Assert
    const logFilePath = path.join(tempDir, 'logs', 'stdout.log');
    const content = fs.readFileSync(logFilePath, 'utf8');
    expect(content).toContain(message);
    // Verify ISO-8601 timestamp format e.g. [2026-05-31T09:44:00.000Z]
    const timestampRegex = /^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/;
    expect(timestampRegex.test(content)).toBe(true);
  });

  it('should correctly append messages with ISO-8601 timestamps to stderr.log', async () => {
    // Arrange
    logger = new SessionLogger(tempDir);
    const message = 'Error output test message';

    // Act
    logger.logStderr(message);
    // Allow stream to flush to disk
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Assert
    const logFilePath = path.join(tempDir, 'logs', 'stderr.log');
    const content = fs.readFileSync(logFilePath, 'utf8');
    expect(content).toContain(message);
    const timestampRegex = /^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/;
    expect(timestampRegex.test(content)).toBe(true);
  });

  it('should correctly append formatted direction and payload with ISO-8601 timestamps to dap.log', async () => {
    // Arrange
    logger = new SessionLogger(tempDir);
    const payload = JSON.stringify({ command: 'initialize', seq: 1 });

    // Act
    logger.logDap('in', payload);
    logger.logDap('out', payload);
    // Allow stream to flush to disk
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Assert
    const logFilePath = path.join(tempDir, 'logs', 'dap.log');
    const content = fs.readFileSync(logFilePath, 'utf8');
    const lines = content.trim().split('\n');
    expect(lines.length).toBe(2);

    expect(lines[0]).toContain('[IN]');
    expect(lines[0]).toContain(payload);
    expect(lines[1]).toContain('[OUT]');
    expect(lines[1]).toContain(payload);

    const timestampRegex = /^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/;
    expect(timestampRegex.test(lines[0])).toBe(true);
    expect(timestampRegex.test(lines[1])).toBe(true);
  });

  it('should behave cleanly and close the streams when close is called', () => {
    // Arrange
    logger = new SessionLogger(tempDir);
    logger.logStdout('Pre-close message');

    // Act & Assert
    expect(() => logger.close()).not.toThrow();
  });
});
