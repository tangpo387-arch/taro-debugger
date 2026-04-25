import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TaroEmptyStateComponent } from './taro-empty-state.component';
import { MatIconModule } from '@angular/material/icon';

describe('TaroEmptyStateComponent', () => {
  let fixture: ComponentFixture<TaroEmptyStateComponent>;
  let component: TaroEmptyStateComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TaroEmptyStateComponent, MatIconModule],
    }).compileComponents();

    fixture = TestBed.createComponent(TaroEmptyStateComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
    TestBed.resetTestingModule();
  });

  describe('Default Rendering (Required Message)', () => {
    it('should render the message text and apply centered class by default', () => {
      // Arrange
      component.message = 'Test Message';

      // Act
      fixture.detectChanges();

      // Assert
      const messageEl = fixture.debugElement.query(By.css('.empty-state-message'));
      const containerEl = fixture.debugElement.query(By.css('.empty-state-container'));
      const iconEl = fixture.debugElement.query(By.css('mat-icon'));
      const descriptionEl = fixture.debugElement.query(By.css('.empty-state-description'));

      expect(messageEl.nativeElement.textContent).toContain('Test Message');
      expect(containerEl.nativeElement.classList.contains('centered')).toBe(true);
      expect(iconEl).toBeNull();
      expect(descriptionEl).toBeNull();
    });
  });

  describe('Optional Icon Rendering', () => {
    it('should render the mat-icon when icon input is provided', () => {
      // Arrange
      component.message = 'Test Message';
      component.icon = 'visibility_off';

      // Act
      fixture.detectChanges();

      // Assert
      const iconEl = fixture.debugElement.query(By.css('mat-icon'));
      expect(iconEl).not.toBeNull();
      expect(iconEl.nativeElement.textContent.trim()).toBe('visibility_off');
    });
  });

  describe('Optional Description Rendering', () => {
    it('should render the description when provided', () => {
      // Arrange
      component.message = 'Test Message';
      component.description = 'Additional details here';

      // Act
      fixture.detectChanges();

      // Assert
      const descriptionEl = fixture.debugElement.query(By.css('.empty-state-description'));
      expect(descriptionEl).not.toBeNull();
      expect(descriptionEl.nativeElement.textContent).toContain('Additional details here');
    });
  });

  describe('Centering Control', () => {
    it('should NOT apply centered class when centered input is false', () => {
      // Arrange
      component.message = 'Test Message';
      component.centered = false;

      // Act
      fixture.detectChanges();

      // Assert
      const containerEl = fixture.debugElement.query(By.css('.empty-state-container'));
      expect(containerEl.nativeElement.classList.contains('centered')).toBe(false);
    });
  });

  describe('Visual Layout Consistency', () => {
    it('should have flex-direction column on the container', () => {
      // Arrange
      component.message = 'Test Message';

      // Act
      fixture.detectChanges();

      // Assert
      const containerEl = fixture.debugElement.query(By.css('.empty-state-container'));
      const styles = window.getComputedStyle(containerEl.nativeElement);
      expect(styles.display).toBe('flex');
      expect(styles.flexDirection).toBe('column');
    });
  });
});
