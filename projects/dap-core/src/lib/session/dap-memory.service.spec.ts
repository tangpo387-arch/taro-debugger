import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { DapMemoryService } from './dap-memory.service';
import { DapSessionService } from './dap-session.service';

function makeMockDapSession() {
  return {
    readMemory: vi.fn(),
    writeMemory: vi.fn(),
  };
}

describe('DapMemoryService', () => {
  let service: DapMemoryService;
  let mockSession: any;

  beforeEach(() => {
    mockSession = makeMockDapSession();

    TestBed.configureTestingModule({
      providers: [
        DapMemoryService,
        { provide: DapSessionService, useValue: mockSession }
      ]
    });

    service = TestBed.inject(DapMemoryService);
  });

  describe('read()', () => {
    it('should successfully read (Base64 to Uint8Array)', async () => {
      // Arrange
      mockSession.readMemory.mockResolvedValue({
        success: true,
        body: { data: 'SGVsbG8=' } // "Hello"
      });

      // Act
      const result = await service.read(0x100n, 0, 5);

      // Assert
      expect(result).toEqual(new Uint8Array([72, 101, 108, 108, 111]));
      expect(mockSession.readMemory).toHaveBeenCalledWith({
        memoryReference: '0x100',
        offset: 0,
        count: 5
      });
    });

    it('should return empty array on failed read', async () => {
      // Arrange
      mockSession.readMemory.mockResolvedValue({
        success: false,
        message: 'Memory read failed'
      });

      // Act
      const result = await service.read(0x100n, 0, 5);

      // Assert
      expect(result).toEqual(new Uint8Array(0));
    });

    it('should return empty array on decoding error', async () => {
      // Arrange
      mockSession.readMemory.mockResolvedValue({
        success: true,
        body: { data: '!!!' } // Invalid Base64
      });

      // Act
      const result = await service.read(0x100n, 0, 5);

      // Assert
      expect(result).toEqual(new Uint8Array(0));
    });
  });

  describe('write()', () => {
    it('should successfully write (Uint8Array to Base64)', async () => {
      // Arrange
      const data = new Uint8Array([72, 101, 108, 108, 111]);
      mockSession.writeMemory.mockResolvedValue({
        success: true,
        body: { bytesWritten: 5 }
      });

      // Act
      const result = await service.write('0x100', 0, data);

      // Assert
      expect(result).toBe(5);
      expect(mockSession.writeMemory).toHaveBeenCalledWith({
        memoryReference: '0x100',
        offset: 0,
        data: 'SGVsbG8='
      });
    });

    it('should return 0 on failed write', async () => {
      // Arrange
      const data = new Uint8Array([72, 101, 108, 108, 111]);
      mockSession.writeMemory.mockResolvedValue({
        success: false
      });

      // Act
      const result = await service.write('0x100', 0, data);

      // Assert
      expect(result).toBe(0);
    });
  });

  describe('Reactive Updates', () => {
    it('should emit onMemoryUpdated$ notification', async () => {
      // Arrange
      const data = new Uint8Array([65, 66, 67]);
      mockSession.writeMemory.mockResolvedValue({
        success: true,
        body: { bytesWritten: 3 }
      });
      const updatePromise = firstValueFrom(service.onMemoryUpdated$);

      // Act
      await service.write('0x200', 10, data);
      const updateEvent = await updatePromise;

      // Assert
      expect(updateEvent).toEqual({
        memoryReference: '0x200',
        offset: 10,
        length: 3
      });
    });
  });
});
