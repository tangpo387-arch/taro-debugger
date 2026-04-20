// @vitest-environment jsdom
import { DapConfigService, DapConfig } from './dap-config.service';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('DapConfigService', () => {
  let service: DapConfigService;

  const mockConfig: DapConfig = {
    serverAddress: 'localhost:9999',
    transportType: 'tcp',
    launchMode: 'attach',
    executablePath: '/path/to/exe',
    sourcePath: '/path/to/src',
    programArgs: '--help'
  };

  // Suppress console.log emitted by setConfig() to keep CI output clean (QCR §7)
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    localStorage.clear();
    // Re-initialize service to ensure it starts with fresh localStorage state
    service = new DapConfigService();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('should be created with default config', () => {
    expect(service).toBeTruthy();
    const config = service.getConfig();
    // Check initial default values defined in the service
    expect(config.serverAddress).toBe('localhost:4711');
    expect(config.transportType).toBe('websocket');
    expect(config.launchMode).toBe('launch');
  });

  it('should set and get config correctly', () => {
    // Arrange — mockConfig defined at suite level

    // Act
    service.setConfig(mockConfig);
    const config = service.getConfig();

    // Assert
    expect(config).toEqual(mockConfig);
    // Ensure it returns a defensive copy, not the same reference
    expect(config).not.toBe(mockConfig);
  });

  it('should persist config to localStorage when setConfig is called', () => {
    // Arrange — mockConfig defined at suite level

    // Act
    service.setConfig(mockConfig);

    // Assert
    const stored = localStorage.getItem('taro_dap_config');
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored!)).toEqual(mockConfig);
  });

  it('should load config from localStorage on initialization', () => {
    // Arrange
    localStorage.setItem('taro_dap_config', JSON.stringify(mockConfig));

    // Act — constructor triggers loadFromStorage()
    const newService = new DapConfigService();

    // Assert
    expect(newService.getConfig()).toEqual(mockConfig);
  });

  it('should handle invalid JSON in localStorage gracefully', () => {
    // Arrange
    localStorage.setItem('taro_dap_config', 'invalid-json-string');
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Act
    const newService = new DapConfigService();

    // Assert — should fall back to default values and log the parse error
    const config = newService.getConfig();
    expect(config.serverAddress).toBe('localhost:4711');
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('should merge defaults with partial stored config', () => {
    // Arrange — only persist a subset of fields
    const partialConfig = { serverAddress: 'custom:1234', launchMode: 'attach' };
    localStorage.setItem('taro_dap_config', JSON.stringify(partialConfig));

    // Act
    const newService = new DapConfigService();
    const config = newService.getConfig();

    // Assert — stored fields override defaults; unspecified fields keep defaults
    expect(config.serverAddress).toBe('custom:1234');
    expect(config.launchMode).toBe('attach');
    expect(config.transportType).toBe('websocket');
    expect(config.executablePath).toBe('');
  });
});
