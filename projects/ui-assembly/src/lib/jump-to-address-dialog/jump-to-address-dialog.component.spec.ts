import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { JumpToAddressDialogComponent } from './jump-to-address-dialog.component';

describe('JumpToAddressDialogComponent', () => {
  let component: JumpToAddressDialogComponent;
  let fixture: ComponentFixture<JumpToAddressDialogComponent>;
  let mockDialogRef: any;

  beforeEach(async () => {
    mockDialogRef = {
      close: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [JumpToAddressDialogComponent],
      providers: [
        { provide: MatDialogRef, useValue: mockDialogRef }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(JumpToAddressDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should initialize with an empty address control', () => {
    expect(component.addressControl.value).toBe('');
    expect(component.addressControl.valid).toBe(false);
  });

  it('should validate hex address format', () => {
    // Invalid
    component.addressControl.setValue('xyz');
    expect(component.addressControl.hasError('pattern')).toBe(true);

    // Valid (prefixed)
    component.addressControl.setValue('0x401234');
    expect(component.addressControl.valid).toBe(true);

    // Valid (unprefixed)
    component.addressControl.setValue('401234');
    expect(component.addressControl.valid).toBe(true);
  });

  it('should close the dialog with normalized address on jump', () => {
    // Arrange
    component.addressControl.setValue('401234');

    // Act
    component.onJump();

    // Assert
    expect(mockDialogRef.close).toHaveBeenCalledWith('0x401234');
  });

  it('should not close the dialog if input is invalid', () => {
    // Arrange
    component.addressControl.setValue('xyz');

    // Act
    component.onJump();

    // Assert
    expect(mockDialogRef.close).not.toHaveBeenCalled();
  });

  it('should close the dialog on cancel', () => {
    // Act
    component.onCancel();

    // Assert
    expect(mockDialogRef.close).toHaveBeenCalledWith();
  });
});
