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

  describe('Row Action Buttons', () => {
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

      // Query action buttons – use aria-label to identify the memory button specifically
      const rows = fixture.debugElement.queryAll(By.css('.variable-row'));
      const row1MemBtn = rows[1].query(By.css('[aria-label="Inspect Memory"]')); // 'i' has no memRef
      const row2MemBtn = rows[2].query(By.css('[aria-label="Inspect Memory"]')); // 'ptr' has memRef

      // Assert presence / absence
      expect(row1MemBtn).toBeNull();
      expect(row2MemBtn).not.toBeNull();
      expect(row2MemBtn.nativeElement.innerHTML).toContain('memory');
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

      // Query the memory action button on the second row (ptr variable)
      const rows = fixture.debugElement.queryAll(By.css('.variable-row'));
      const memBtn = rows[1].query(By.css('[aria-label="Inspect Memory"]'));
      expect(memBtn).not.toBeNull();

      // Act
      memBtn.nativeElement.click();
      fixture.detectChanges();

      // Assert
      expect(emitSpy).toHaveBeenCalledWith(0x1234n);
    });

    it('should throw a UiFatalException when the memoryReference is invalid', () => {
      expect(() => component.onInspectMemory('invalid-ref')).toThrow(UiFatalException);
    });
  });

  describe('Scope Filtering', () => {
    it('should filter out the "Registers" scope', () => {
      const scopes: DapScope[] = [
        { name: 'Locals', variablesReference: 100, expensive: false },
        { name: 'Registers', variablesReference: 101, expensive: true },
        { name: 'register', variablesReference: 102, expensive: true },
        { name: 'Globals', variablesReference: 103, expensive: false }
      ];
      mockVariablesService.scopes$.next(scopes);
      fixture.detectChanges();
      
      const flatNodeNames = component.flatNodes.map(n => n.source.name);
      expect(flatNodeNames).toContain('Locals');
      expect(flatNodeNames).toContain('Globals');
      expect(flatNodeNames).not.toContain('Registers');
      expect(flatNodeNames).not.toContain('register');
    });
  });

  describe('Interactive Type Overlay', () => {
    it('should not show overlay if variable has no type', () => {
      const node = { source: { name: 'test', type: undefined }, level: 0, expandable: false } as any;
      const origin = {} as any;
      component.onToggleTypeOverlay(node, origin);
      // Node has no type, so activeNode should not be set
      expect(component.activeNode).toBeNull();
    });

    it('should set active node and origin when toggling type overlay open', () => {
      const node = { source: { name: 'test', type: 'int' }, level: 0, expandable: false } as any;
      const origin = {} as any;
      component.isTypeExpanded = true;
      component.onToggleTypeOverlay(node, origin);
      expect(component.activeNode).toBe(node);
      expect(component.activeOrigin).toBe(origin);
      expect(component.isTypeExpanded).toBe(false);
    });

    it('should close the overlay when toggling the same node again', () => {
      const node = { source: { name: 'test', type: 'int' }, level: 0, expandable: false } as any;
      const origin = {} as any;
      component.onToggleTypeOverlay(node, origin);
      expect(component.activeNode).toBe(node);
      // Toggle same node again - should close
      component.onToggleTypeOverlay(node, origin);
      expect(component.activeNode).toBeNull();
      expect(component.activeOrigin).toBeNull();
    });

    it('should reset isTypeExpanded when the overlay is closed', () => {
      const node = { source: { name: 'test', type: 'int' }, level: 0, expandable: false } as any;
      const origin = {} as any;
      component.onToggleTypeOverlay(node, origin);
      component.isTypeExpanded = true;
      // Close via outside-click path
      component.closeTypeOverlay();
      expect(component.activeNode).toBeNull();
      expect(component.isTypeExpanded).toBe(false);
    });

    it('should toggle type expansion state', () => {
      component.isTypeExpanded = false;
      component.toggleTypeExpand();
      expect(component.isTypeExpanded).toBe(true);
      component.toggleTypeExpand();
      expect(component.isTypeExpanded).toBe(false);
    });
  });
});
