import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'cppSignature',
  standalone: true
})
export class CppSignaturePipe implements PipeTransform {
  transform(value: string | undefined): string {
    if (!value) return '';
    return this.simplifySignature(value);
  }

  private simplifySignature(sig: string): string {
    // Hide operators that use angle brackets so they don't break the template parser
    let safeSig = sig
      .replace(/\boperator\s*<</g, '___OP_LSHIFT___')
      .replace(/\boperator\s*>>/g, '___OP_RSHIFT___')
      .replace(/\boperator\s*<=/g, '___OP_LTE___')
      .replace(/\boperator\s*>=/g, '___OP_GTE___')
      .replace(/\boperator\s*</g, '___OP_LT___')
      .replace(/\boperator\s*>/g, '___OP_GT___')
      .replace(/\boperator\s*->/g, '___OP_ARROW___');
    
    let result = '';
    let angleDepth = 0;
    let parenDepth = 0;
    
    for (let i = 0; i < safeSig.length; i++) {
      const char = safeSig[i];
      
      if (char === '<') {
        if (angleDepth === 0 && parenDepth === 0) {
          result += (i + 1 < safeSig.length && safeSig[i + 1] === '>') ? '<>' : '<...>';
        }
        angleDepth++;
        continue;
      }
      if (char === '>') {
        if (angleDepth > 0) {
          angleDepth--;
          continue;
        }
      }
      
      if (char === '(') {
        if (parenDepth === 0 && angleDepth === 0) {
          result += (i + 1 < safeSig.length && safeSig[i + 1] === ')') ? '()' : '(...)';
        }
        parenDepth++;
        continue;
      }
      if (char === ')') {
        if (parenDepth > 0) {
          parenDepth--;
          continue;
        }
      }
      
      if (angleDepth === 0 && parenDepth === 0) {
        result += char;
      }
    }
    
    // Fallback: if we somehow ended up with unbalanced brackets, return original
    if (angleDepth !== 0 || parenDepth !== 0) {
      result = safeSig;
    }
    
    return result
      .replace(/___OP_LSHIFT___/g, 'operator<<')
      .replace(/___OP_RSHIFT___/g, 'operator>>')
      .replace(/___OP_LTE___/g, 'operator<=')
      .replace(/___OP_GTE___/g, 'operator>=')
      .replace(/___OP_LT___/g, 'operator<')
      .replace(/___OP_GT___/g, 'operator>')
      .replace(/___OP_ARROW___/g, 'operator->');
  }
}
