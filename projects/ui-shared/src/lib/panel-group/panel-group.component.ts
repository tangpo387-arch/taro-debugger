import {
  Component,
  ContentChildren,
  QueryList,
  AfterContentInit,
  OnDestroy,
  Renderer2,
  inject,
  ChangeDetectionStrategy,
  ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { PanelComponent } from '../panel/panel.component';
import { Subject, merge } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'taro-panel-group',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './panel-group.component.html',
  styleUrls: ['./panel-group.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PanelGroupComponent implements AfterContentInit, OnDestroy {
  @ContentChildren(PanelComponent) public panels!: QueryList<PanelComponent>;

  private readonly renderer = inject(Renderer2);
  private destroy$ = new Subject<void>();

  // Track the current height of each panel instance
  private panelHeights = new Map<PanelComponent, number>();

  public ngAfterContentInit(): void {
    this.syncPanels();
    this.panels.changes.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.syncPanels();
    });
  }

  public ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private syncPanels(): void {
    const panelArray = this.panels.toArray();

    panelArray.forEach((panel, index) => {
      // 1. Initial State styling
      this.applyPanelStyle(panel);

      // 2. Subscribe to expand/collapse
      panel.expandedChange.pipe(
        takeUntil(merge(this.destroy$, this.panels.changes))
      ).subscribe(() => {
        // If a panel is toggled, clear all locked heights so flexbox can redistribute space naturally
        this.panelHeights.clear();
        panelArray.forEach(p => this.applyPanelStyle(p));
      });

      // 3. Subscribe to resizeDrag
      panel.resizeDrag.pipe(
        takeUntil(merge(this.destroy$, this.panels.changes))
      ).subscribe((clientY) => {
        this.onPanelResizeDrag(clientY, index, panelArray);
      });
    });
  }

  private applyPanelStyle(panel: PanelComponent): void {
    const el = panel.elementRef.nativeElement;
    if (panel.expanded) {
      if (this.panelHeights.has(panel)) {
        this.renderer.setStyle(el, 'flex', `1 1 ${this.panelHeights.get(panel)}px`);
      } else {
        // Initial state: allow native flex-grow to evenly distribute available space
        this.renderer.setStyle(el, 'flex', `1 1 0px`);
      }
      // CRITICAL: Prevent CSS Flexbox from crushing the panel to 0px
      this.renderer.setStyle(el, 'min-height', `${panel.minExpandedHeight}px`);
    } else {
      this.renderer.setStyle(el, 'flex', `0 0 var(--sys-density-header-height, 32px)`);
      this.renderer.setStyle(el, 'min-height', `var(--sys-density-header-height, 32px)`);
    }
  }

  private onPanelResizeDrag(clientY: number, panelIndex: number, panelArray: PanelComponent[]): void {
    const topPanel = panelArray[panelIndex];
    if (!topPanel.expanded) return;

    let bottomPanelIndex = panelIndex + 1;
    while (bottomPanelIndex < panelArray.length && !panelArray[bottomPanelIndex].expanded) {
      bottomPanelIndex++;
    }

    if (bottomPanelIndex >= panelArray.length) {
      return; 
    }

    const bottomPanel = panelArray[bottomPanelIndex];

    // Lazy lock: Before altering any flex-basis, ensure ALL expanded panels have their natural physical pixel height locked.
    // If we only set flex-basis for top/bottom, the others with basis 0px will disproportionately steal space.
    let needsApply = false;
    panelArray.forEach(p => {
      if (p.expanded && !this.panelHeights.has(p)) {
        this.panelHeights.set(p, p.elementRef.nativeElement.getBoundingClientRect().height);
        needsApply = true;
      }
    });
    if (needsApply) {
      panelArray.forEach(p => this.applyPanelStyle(p));
    }

    const topEl = topPanel.elementRef.nativeElement;
    const topRect = topEl.getBoundingClientRect();
    
    // Calculate precise proposed height via mouse position relative to panel top
    const proposedTopHeight = clientY - topRect.top;
    
    const minTop = topPanel.minExpandedHeight;
    const minBottom = bottomPanel.minExpandedHeight;
    
    // We use the recorded panelHeights instead of bounding rects to prevent float-rounding jitter during rapid drags
    const currentTop = this.panelHeights.get(topPanel)!;
    const currentBottom = this.panelHeights.get(bottomPanel)!;
    const totalHeight = currentTop + currentBottom;
    
    // Ensure we don't paradoxically set a max smaller than a min if container is constrained
    const maxTop = Math.max(minTop, totalHeight - minBottom);
    
    const actualTopHeight = Math.max(minTop, Math.min(maxTop, proposedTopHeight));
    const actualBottomHeight = Math.max(minBottom, totalHeight - actualTopHeight);

    this.panelHeights.set(topPanel, actualTopHeight);
    this.panelHeights.set(bottomPanel, actualBottomHeight);

    this.applyPanelStyle(topPanel);
    this.applyPanelStyle(bottomPanel);
  }
}
