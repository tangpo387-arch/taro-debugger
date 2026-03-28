// @vitest-environment jsdom
import { DapConfigService, DapConfig } from './dap-config.service';
import { describe, it, expect, beforeEach, vi } from 'vitest';

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

  beforeEach(() => {
    localStorage.clear();
    // Re-initialize service to ensure it starts with fresh localStorage state
    service = new DapConfigService();
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
    service.setConfig(mockConfig);
    const config = service.getConfig();
    expect(config).toEqual(mockConfig);
    // Ensure it returns a copy, not the same reference
    expect(config).not.toBe(mockConfig);
  });

  it('should persist config to localStorage when setConfig is called', () => {
    service.setConfig(mockConfig);
    const stored = localStorage.getItem('taro_dap_config');
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored!)).toEqual(mockConfig);
  });

  it('should load config from localStorage on initialization', () => {
    // Manually set item in localStorage before service creation
    localStorage.setItem('taro_dap_config', JSON.stringify(mockConfig));
    
    // Create new instance which should trigger loadFromStorage()
    const newService = new DapConfigService();
    expect(newService.getConfig()).toEqual(mockConfig);
  });

  it('should handle invalid JSON in localStorage gracefully', () => {
    localStorage.setItem('taro_dap_config', 'invalid-json-string');
    
    // Spy on console.error to verify the error is logged
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    const newService = new DapConfigService();
    
    // Should fallback to default values
    const config = newService.getConfig();
    expect(config.serverAddress).toBe('localhost:4711');
    
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('should merge defaults with partial stored config', () => {
    // Only store serverAddress and launchMode
    const partialConfig = {
      serverAddress: 'custom:1234',
      launchMode: 'attach'
    };
    localStorage.setItem('taro_dap_config', JSON.stringify(partialConfig));
    
    const newService = new DapConfigService();
    const config = newService.getConfig();
    
    expect(config.serverAddress).toBe('custom:1234');
    expect(config.launchMode).toBe('attach');
    // Other fields should remain defaults
    expect(config.transportType).toBe('websocket');
    expect(config.executablePath).toBe('');
  });
});
