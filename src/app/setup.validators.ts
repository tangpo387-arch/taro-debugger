import { AbstractControl, ValidationErrors } from '@angular/forms';

/**
 * Custom validator: Validate DAP Server address format (host:port)
 * Support IPv4, IPv6 (basic brackets), and Hostname
 */
export function serverAddressValidator(control: AbstractControl): ValidationErrors | null {
  const value = (control.value as string)?.trim();
  if (!value) return null; // Let the required validator handle empty values

  // Pattern: [IPv6] or host part, then a colon, then 1-5 digits
  const pattern = /^(\[[a-fA-F0-9:]+\]|[a-zA-Z0-9._-]+):(\d{1,5})$/;
  const match = value.match(pattern);

  if (!match) return { invalidFormat: true };

  const port = parseInt(match[2], 10);
  if (port < 1 || port > 65535) {
    return { invalidPort: true };
  }

  return null;
}
