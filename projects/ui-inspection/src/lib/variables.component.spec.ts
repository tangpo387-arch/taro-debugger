import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { BehaviorSubject } from 'rxjs';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { VariablesComponent } from './variables.component';
import { DapVariablesService, DapScope } from './dap-variables.service';
import { DapSessionService } from '@taro/dap-core';
import { UiFatalException } from '@taro/ui-shared';

function makeMockDapSession(overrides = {}) {
  const connectionStatus$ = new BehaviorSubject<boolean>(true);
  return {
    connectionStatus$,
    ...overrides
  };
}

function makeMockDapVariablesService() {
  const scopes$ = new BehaviorSubject<DapScope[]>([]);
  return {
    scopes$,
    getVariables: vi.fn().mockResolvedValue([]),
  };
}

describe('VariablesComponent', () => {
  let fixture: ComponentFixture<VariablesComponent>;
  let component: VariablesComponent;
  let mockSession: any;
  let mockVariablesService: any;

  beforeEach(async () => {
    mockSession = makeMockDapSession();
    mockVariablesService = makeMockDapVariablesService();

    await TestBed.configureTestingModule({
      imports: [VariablesComponent],
      providers: [
        { provide: DapSessionService, useValue: mockSession },
        { provide: DapVariablesService, useValue: mockVariablesService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VariablesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    TestBed.resetTestingModule();
  });

  describe('Standard Row Interaction', () => {
    it('should toggle expansion when a row is left-clicked, and NOT trigger inspectMemoryRequest', async () => {
      // Arrange
      const scopes: DapScope[] = [
        { name: 'Locals', variablesReference: 100, expensive: false }
      ];
      mockVariablesService.scopes$.next(scopes);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const inspectMemorySpy = vi.spyOn(component.inspectMemoryRequest, 'emit');
      const toggleNodeSpy = vi.spyOn(component, 'toggleNode');

      const rows = fixture.debugElement.queryAll(By.css('.variable-row'));
      expect(rows.length).toBe(1);

      // Act - Click the row to collapse it
      rows[0].nativeElement.click();
      fixture.detectChanges();

      // Assert
      expect(toggleNodeSpy).toHaveBeenCalled();
      expect(inspectMemorySpy).not.toHaveBeenCalled();
      expect(component.flatNodes[0].source.expanded).toBe(false);
    });
  });

  describe('Hover-to-Reveal Inline Actions', () => {
    it('should render the memory icon button ONLY for rows with a valid memoryReference', async () => {
      // Arrange
      const scopes: DapScope[] = [
        { name: 'Locals', variablesReference: 100, expensive: false }
      ];
      mockVariablesService.scopes$.next(scopes);
      fixture.detectChanges();

      // Expand the Locals scope to load variables
      mockVariablesService.getVariables.mockResolvedValue([
        { name: 'i', value: '42', type: 'int', variablesReference: 0 },
        { name: 'ptr', value: '0x7fffffffdc00', type: 'char*', variablesReference: 0, memoryReference: '0x1234' }
      ]);

      const toggleNodePromise = component.toggleNode(component.flatNodes[0]);
      fixture.detectChanges();
      await toggleNodePromise;
      fixture.detectChanges();

      // Assert tree is expanded
      expect(component.flatNodes.length).toBe(3); // Locals scope (0), i (1), ptr (2)

      // Query action buttons
      const rows = fixture.debugElement.queryAll(By.css('.variable-row'));
      const row1Btn = rows[1].query(By.css('.row-action-btn')); // row for 'i' (no memoryReference)
      const row2Btn = rows[2].query(By.css('.row-action-btn')); // row for 'ptr' (has memoryReference)

      // Assert presence / absence
      expect(row1Btn).toBeNull();
      expect(row2Btn).not.toBeNull();
      expect(row2Btn.nativeElement.innerHTML).toContain('memory');
    });

    it('should emit inspectMemoryRequest when the memory icon button is clicked', async () => {
      // Arrange
      const scopes: DapScope[] = [
        { name: 'Locals', variablesReference: 100, expensive: false }
      ];
      mockVariablesService.scopes$.next(scopes);
      fixture.detectChanges();

      mockVariablesService.getVariables.mockResolvedValue([
        { name: 'ptr', value: '0x7fffffffdc00', type: 'char*', variablesReference: 0, memoryReference: '0x1234' }
      ]);

      const toggleNodePromise = component.toggleNode(component.flatNodes[0]);
      fixture.detectChanges();
      await toggleNodePromise;
      fixture.detectChanges();

      const emitSpy = vi.spyOn(component.inspectMemoryRequest, 'emit');

      // Query action button on the second row (ptr variable)
      const rows = fixture.debugElement.queryAll(By.css('.variable-row'));
      const actionBtn = rows[1].query(By.css('.row-action-btn'));
      expect(actionBtn).not.toBeNull();

      // Act
      actionBtn.nativeElement.click();
      fixture.detectChanges();

      // Assert
      expect(emitSpy).toHaveBeenCalledWith(0x1234n);
    });

    it('should throw a UiFatalException when the memoryReference is invalid', () => {
      expect(() => component.onInspectMemory('invalid-ref')).toThrow(UiFatalException);
    });
  });
});
