import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  inject,
  NgZone,
  ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

/**
 * PanelComponent — reusable collapsible panel header.
 *
 * Layout contract:
 *   - When expanded: flex: 1 1 0, min-height: 0 → fills available space.
 *   - When collapsed: flex: 0 0 32px → shows only the 32px header bar.
 *   - A 4px drag handle at the bottom border fires resize events when two panels
 *     are both expanded. The host is responsible for applying the resulting pixel heights.
 */
@Component({
  selector: 'taro-panel',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule],
  templateUrl: './panel.component.html',
  styleUrls: ['./panel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PanelComponent {
  private readonly zone = inject(NgZone);
  public readonly elementRef = inject(ElementRef<HTMLElement>);

  /** Panel label shown in the 32px header. Should be UPPERCASE. */
  @Input() public label: string = 'PANEL';

  /** Minimum height in pixels when expanded (header + minimum content). Defaults to 72. */
  @Input() public minExpandedHeight: number = 72;

  /** Whether this panel is currently expanded. Two-way bindable via (expandedChange). */
  @Input() public expanded: boolean = true;
  @Output() public expandedChange = new EventEmitter<boolean>();

  /** Emitted during drag with the raw clientY value so the host can compute heights. */
  @Output() public resizeDrag = new EventEmitter<number>();

  /** Whether a resize drag handle should be shown at the bottom of the content area. */
  @Input() public resizable: boolean = false;

  /** Toggle expand/collapse state. */
  public toggle(): void {
    this.expanded = !this.expanded;
    this.expandedChange.emit(this.expanded);
  }

  /**
   * Initiates a vertical resize drag.
   * Runs outside Angular zone for performance; re-enters zone on mouseup.
   */
  public onResizeHandleMousedown(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();

    this.zone.runOutsideAngular(() => {
      const onMouseMove = (e: MouseEvent) => {
        this.zone.run(() => this.resizeDrag.emit(e.clientY));
      };

      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });
  }
}
