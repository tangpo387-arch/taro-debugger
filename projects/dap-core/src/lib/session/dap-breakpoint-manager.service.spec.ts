import { TestBed } from '@angular/core/testing';
import { DapBreakpointManager, VerifiedBreakpoint } from './dap-breakpoint-manager.service';
import { DapSessionService } from './dap-session.service';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('DapBreakpointManager', () => {
  let manager: DapBreakpointManager;
  let mockSession: any;

  beforeEach(() => {
    mockSession = {
      sendRequestInternal: vi.fn().mockImplementation((command, args) => {
        if (command === 'setBreakpoints') {
          return Promise.resolve({
            success: true,
            body: {
              breakpoints: (args.breakpoints || []).map((bp: any, idx: number) => ({
                verified: true,
                line: bp.line,
                id: idx + 1
              }))
            }
          });
        }
        return Promise.resolve({
          success: true,
          body: {
            breakpoints: [{ verified: true, line: 10, id: 1 }]
          }
        });
      })
    };

    TestBed.configureTestingModule({
      providers: [
        DapBreakpointManager,
        { provide: DapSessionService, useValue: mockSession }
      ]
    });

    manager = TestBed.inject(DapBreakpointManager);
  });

  it('should initialize with empty state', () => {
    // Arrange & Act & Assert
    expect(manager.getBreakpointsMap().size).toBe(0);
    expect(manager.isSystemBreakpoint(1)).toBe(false);
  });

  it('should set breakpoints and return verified ones', async () => {
    // Act
    const bps = await manager.setBreakpoints('/src/main.cpp', [10]);
    
    // Assert
    expect(bps).toHaveLength(1);
    expect(bps[0].verified).toBe(true);
    expect(bps[0].line).toBe(10);
    expect(mockSession.sendRequestInternal).toHaveBeenCalledWith('setBreakpoints', expect.any(Object));
  });

  it('should toggle breakpoint optimistically and sync', async () => {
    // Act
    await manager.toggleBreakpoint('/src/main.cpp', 15);
    
    // Assert
    const bpsMap = manager.getBreakpointsMap();
    const bps = bpsMap.get('/src/main.cpp');
    expect(bps).toBeDefined();
    expect(bps).toHaveLength(1);
    expect(bps![0].line).toBe(15);
  });

  it('should toggle breakpoint enabled state', async () => {
    // Arrange
    await manager.toggleBreakpoint('/src/main.cpp', 20);

    // Act
    await manager.toggleBreakpointEnabled('/src/main.cpp', 20);

    // Assert
    const bps = manager.getBreakpointsMap().get('/src/main.cpp');
    expect(bps![0].enabled).toBe(false);
  });

  it('should remove breakpoint', async () => {
    // Arrange
    await manager.toggleBreakpoint('/src/main.cpp', 30);
    expect(manager.getBreakpointsMap().get('/src/main.cpp')).toHaveLength(1);

    // Act
    await manager.removeBreakpoint('/src/main.cpp', 30);

    // Assert
    expect(manager.getBreakpointsMap().get('/src/main.cpp')).toHaveLength(0);
  });

  it('should handle incoming breakpoint events', () => {
    // Arrange
    const event = {
      seq: 1,
      type: 'event' as const,
      event: 'breakpoint',
      body: {
        reason: 'new',
        breakpoint: {
          id: 5,
          verified: true,
          line: 45,
          source: { path: '/src/main.cpp' }
        }
      }
    };

    // Act
    manager.handleBreakpointEvent(event);

    // Assert
    const bps = manager.getBreakpointsMap().get('/src/main.cpp');
    expect(bps).toHaveLength(1);
    expect(bps![0].id).toBe(5);
    expect(bps![0].line).toBe(45);
    expect(bps![0].verified).toBe(true);
  });
});
