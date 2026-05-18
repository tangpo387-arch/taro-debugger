import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { JumpToAddressDialogComponent } from './jump-to-address-dialog.component';

describe('JumpToAddressDialogComponent', () => {
  let fixture: ComponentFixture<JumpToAddressDialogComponent>;
  let component: JumpToAddressDialogComponent;
  let mockDialogRef: any;

  beforeEach(async () => {
    mockDialogRef = {
      close: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [
        JumpToAddressDialogComponent,
        ReactiveFormsModule
      ],
      providers: [
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: MAT_DIALOG_DATA, useValue: {
            title: 'Test Jump',
            placeholder: 'Test Placeholder',
            initialValue: '',
            description: 'Test Description'
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(JumpToAddressDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    TestBed.resetTestingModule();
  });

  describe('Initialization', () => {
    it('should initialize with standard data and default values', () => {
      expect(component).toBeTruthy();
      expect(component.data.title).toBe('Test Jump');
      expect(component.addressControl.value).toBe('');
      expect(component.addressControl.valid).toBe(false); // starts empty, required field
    });
  });

  describe('Address Validation', () => {
    it('should be invalid when address is empty or whitespace', () => {
      component.addressControl.setValue('');
      expect(component.addressControl.valid).toBe(false);
      expect(component.addressControl.hasError('required')).toBe(true);

      component.addressControl.setValue('   ');
      expect(component.addressControl.valid).toBe(false);
      expect(component.addressControl.hasError('invalidAddress')).toBe(true);
    });

    it('should be valid for decimal numbers', () => {
      component.addressControl.setValue('123456');
      expect(component.addressControl.valid).toBe(true);
      expect(component.addressControl.errors).toBeNull();
    });

    it('should be valid for hexadecimal numbers starting with 0x or 0X', () => {
      component.addressControl.setValue('0x4000');
      expect(component.addressControl.valid).toBe(true);

      component.addressControl.setValue('0X7FFFFFFFD120');
      expect(component.addressControl.valid).toBe(true);
    });

    it('should be invalid for hexadecimal numbers without 0x prefix', () => {
      component.addressControl.setValue('7fffffffd120');
      expect(component.addressControl.valid).toBe(false);
      expect(component.addressControl.hasError('invalidAddress')).toBe(true);

      component.addressControl.setValue('aaaa');
      expect(component.addressControl.valid).toBe(false);
      expect(component.addressControl.hasError('invalidAddress')).toBe(true);
    });

    it('should be invalid for non-numeric/non-hex symbols', () => {
      component.addressControl.setValue('main');
      expect(component.addressControl.valid).toBe(false);
      expect(component.addressControl.hasError('invalidAddress')).toBe(true);

      component.addressControl.setValue('0xinvalid');
      expect(component.addressControl.valid).toBe(false);
      expect(component.addressControl.hasError('invalidAddress')).toBe(true);
    });
  });

  describe('onJump() Action', () => {

    it('should close dialog with parsed bigint when decimal is submitted', () => {
      component.addressControl.setValue('1234');
      component.onJump();

      expect(mockDialogRef.close).toHaveBeenCalledWith(1234n);
    });

    it('should close dialog with parsed bigint when hex with 0x prefix is submitted', () => {
      component.addressControl.setValue('0xaaaa');
      component.onJump();

      expect(mockDialogRef.close).toHaveBeenCalledWith(43690n);
    });

    it('should not close dialog if form is invalid', () => {
      component.addressControl.setValue('main');
      component.onJump();

      expect(mockDialogRef.close).not.toHaveBeenCalled();
    });
  });

  describe('onCancel() Action', () => {
    it('should close the dialog without any value', () => {
      component.onCancel();

      expect(mockDialogRef.close).toHaveBeenCalledOnce();
      expect(mockDialogRef.close).toHaveBeenCalledWith();
    });
  });
});
