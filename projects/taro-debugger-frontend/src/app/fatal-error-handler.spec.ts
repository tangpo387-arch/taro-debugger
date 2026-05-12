// @vitest-environment jsdom
import { TestBed } from '@angular/core/testing';
import { ErrorHandler } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { GlobalFatalErrorHandler } from './fatal-error-handler';
import { DapFatalException } from '@taro/dap-core';
import { UiFatalException } from '@taro/ui-shared';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('GlobalFatalErrorHandler', () => {
  let handler: ErrorHandler;
  let mockDialog: any;
  let mockRouter: any;

  beforeEach(() => {
    mockDialog = {
      open: vi.fn().mockReturnValue({
        afterClosed: () => of(true)
      })
    };

    mockRouter = {
      navigate: vi.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: ErrorHandler, useClass: GlobalFatalErrorHandler },
        { provide: MatDialog, useValue: mockDialog },
        { provide: Router, useValue: mockRouter }
      ]
    });

    handler = TestBed.inject(ErrorHandler);
  });

  it('should handle DapFatalException by opening a dialog and navigating to setup', () => {
    const error = new DapFatalException('Protocol crash');
    handler.handleError(error);

    expect(mockDialog.open).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      data: expect.objectContaining({ hideRetry: true })
    }));
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/setup']);
  });

  it('should handle UiFatalException by opening a dialog and navigating to setup', () => {
    const error = new UiFatalException('UI crash');
    handler.handleError(error);

    expect(mockDialog.open).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      data: expect.objectContaining({ hideRetry: true })
    }));
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/setup']);
  });

  it('should handle wrapped fatal errors (Zone.js/RxJS style)', () => {
    const error = { rejection: new DapFatalException('Async Protocol crash') };
    handler.handleError(error);

    expect(mockDialog.open).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      data: expect.objectContaining({ hideRetry: true })
    }));
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/setup']);
  });

  it('should log normal errors to console and NOT open a dialog', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('Normal error');
    
    handler.handleError(error);

    expect(mockDialog.open).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(error);
    consoleSpy.mockRestore();
  });
});
