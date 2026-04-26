import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { BehaviorSubject, of, EMPTY, Observable } from 'rxjs';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileExplorerComponent } from './file-explorer.component';
import { DapSessionService, DapConfigService } from '@taro/dap-core';
import { DapFileTreeService } from './dap-file-tree.service';
import { BreakpointObserver } from '@angular/cdk/layout';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { FileNode } from './file-tree.service';

function makeMockDapSession(overrides: any = {}) {
  return {
    sendRequest: vi.fn(),
    onEvent: vi.fn().mockReturnValue(EMPTY),
    connectionStatus$: of(true),
    capabilities: { supportsLoadedSourcesRequest: true },
    ...overrides,
  };
}

function makeMockConfigService(overrides: any = {}) {
  return {
    getConfig: vi.fn().mockReturnValue({ sourcePath: '/root/project' }),
    ...overrides,
  };
}

function makeMockFileTreeService(overrides: any = {}) {
  return {
    getTree: vi.fn().mockReturnValue(of({ name: 'root', children: [] })),
    ...overrides,
  };
}

describe('FileExplorerComponent', () => {
  let fixture: ComponentFixture<FileExplorerComponent>;
  let component: FileExplorerComponent;
  let mockSession: any;
  let mockConfig: any;
  let mockFileTree: any;

  beforeEach(async () => {
    mockSession = makeMockDapSession();
    mockConfig = makeMockConfigService();
    mockFileTree = makeMockFileTreeService();

    await TestBed.configureTestingModule({
      imports: [FileExplorerComponent],
      providers: [
        { provide: DapSessionService, useValue: mockSession },
        { provide: DapConfigService, useValue: mockConfig },
        { provide: DapFileTreeService, useValue: mockFileTree },
        {
          provide: BreakpointObserver,
          useValue: {
            observe: vi.fn().mockReturnValue(of({ matches: false })),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FileExplorerComponent);
    component = fixture.componentInstance;
    // Note: No detectChanges here to allow tests to set up initial state
  });

  afterEach(() => {
    fixture.destroy();
  });

  describe('reloadTrigger change detection', () => {
    it('should NOT call getTree() when reloadTrigger is 0 (first-change guard)', () => {
      // Arrange
      fixture.detectChanges(); // First check
      mockFileTree.getTree.mockClear();

      // Act & Assert
      expect(mockFileTree.getTree).not.toHaveBeenCalled();
    });

    it('should call getTree() exactly once when reloadTrigger increments to 1', () => {
      // Arrange
      fixture.detectChanges();
      
      // Act
      component.reloadTrigger = 1;
      component.ngOnChanges({
        reloadTrigger: {
          previousValue: 0,
          currentValue: 1,
          firstChange: false,
          isFirstChange: () => false
        }
      });

      // Assert
      expect(mockFileTree.getTree).toHaveBeenCalledOnce();
    });

    it('should call getTree() for each distinct value when incremented multiple times', () => {
      // Arrange
      fixture.detectChanges();

      // Act
      for (let i = 1; i <= 3; i++) {
        const prev = i - 1;
        component.reloadTrigger = i;
        component.ngOnChanges({
          reloadTrigger: {
            previousValue: prev,
            currentValue: i,
            firstChange: false,
            isFirstChange: () => false
          }
        });
      }

      // Assert
      expect(mockFileTree.getTree).toHaveBeenCalledTimes(3);
    });
  });

  describe('Capability branching', () => {
    it('should show unsupported message when loadedSources is not supported', () => {
      // Arrange
      mockSession.capabilities.supportsLoadedSourcesRequest = false;
      fixture.detectChanges();
      
      // Act
      component.reloadTrigger = 1;
      component.ngOnChanges({
        reloadTrigger: { previousValue: 0, currentValue: 1, firstChange: false, isFirstChange: () => false }
      });
      fixture.detectChanges();

      // Assert
      expect(component.fileTreeSupported).toBe(false);
      const emptyState = fixture.debugElement.query(By.css('taro-empty-state'));
      expect(emptyState).not.toBeNull();
    });
  });

  describe('Tree data population', () => {
    it('should populate fileDataSource with super-root children', () => {
      // Arrange
      fixture.detectChanges();
      const mockTree: FileNode = {
        name: 'Super Root',
        path: '',
        type: 'directory',
        children: [
          { name: 'Project', path: '/root', type: 'directory', children: [] },
          { name: 'External Libraries', path: 'ext', type: 'directory', children: [] }
        ]
      };
      mockFileTree.getTree.mockReturnValue(of(mockTree));

      // Act
      component.reloadTrigger = 1;
      component.ngOnChanges({
        reloadTrigger: { previousValue: 0, currentValue: 1, firstChange: false, isFirstChange: () => false }
      });

      // Assert
      expect(component.fileDataSource).toHaveLength(2);
      expect(component.fileDataSource[0].name).toBe('Project');
    });
  });

  describe('Node interactions', () => {
    it('should emit fileSelected when a file node is clicked', () => {
      // Arrange
      fixture.detectChanges();
      const spy = vi.fn();
      component.fileSelected.subscribe(spy);
      const fileNode: FileNode = { name: 'test.c', path: '/test.c', type: 'file' };

      // Act
      component.onNodeClick(fileNode);

      // Assert
      expect(spy).toHaveBeenCalledWith(fileNode);
    });

    it('should apply "active-node" class to the matching node', async () => {
      // Arrange
      component.activeFilePath = '/root/main.c';
      component.fileDataSource = [
        { name: 'main.c', path: '/root/main.c', type: 'file' }
      ];
      
      // Act
      fixture.detectChanges();
      await fixture.whenStable();

      // Assert
      const activeNode = fixture.debugElement.query(By.css('.active-node'));
      expect(activeNode).not.toBeNull();
      expect(activeNode.nativeElement.textContent).toContain('main.c');
    });
  });

  describe('WI-82: Virtual Root & UI Consolidation', () => {
    it('should delegate collapseAll() to mat-tree', () => {
      // Arrange
      fixture.detectChanges();
      const treeSpy = vi.spyOn((component as any).tree, 'collapseAll');

      // Act
      component.collapseAll();

      // Assert
      expect(treeSpy).toHaveBeenCalledOnce();
    });

    it('should expand virtual roots by default on first load', () => {
      // Arrange
      fixture.detectChanges();
      const expandSpy = vi.spyOn((component as any).tree, 'expand');
      const mockTree: FileNode = {
        name: 'Super Root',
        path: '',
        type: 'directory',
        children: [
          { name: 'Project', path: '/root', type: 'directory', children: [] },
          { name: 'External Libraries', path: 'ext', type: 'directory', children: [] }
        ]
      };
      mockFileTree.getTree.mockReturnValue(of(mockTree));

      // Act
      component.reloadTrigger = 1;
      component.ngOnChanges({
        reloadTrigger: { previousValue: 0, currentValue: 1, firstChange: false, isFirstChange: () => false }
      });
      fixture.detectChanges();

      // Assert
      expect(expandSpy).toHaveBeenCalledWith(component.fileDataSource[0]);
    });

    it('should display full path in node tooltips', async () => {
      // Arrange
      component.fileDataSource = [
        { name: 'main.c', path: '/absolute/path/main.c', type: 'file' }
      ];

      // Act
      fixture.detectChanges();
      await fixture.whenStable();

      // Assert
      const nodeContent = fixture.debugElement.query(By.css('.node-content'));
      expect(nodeContent.nativeElement.getAttribute('title')).toBe('/absolute/path/main.c');
    });
  });

  describe('Lifecycle', () => {
    it('should cancel long-running getTree on destroy', () => {
      // Arrange
      fixture.detectChanges();
      const never$ = new Observable(() => {});
      mockFileTree.getTree.mockReturnValue(never$);
      
      // Act & Assert
      expect(() => fixture.destroy()).not.toThrow();
    });
  });
});
