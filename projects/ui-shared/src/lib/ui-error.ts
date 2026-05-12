/** 
 * Exception thrown when a UI component or layout system encounters 
 * an unrecoverable failure.
 */
export class UiFatalException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UiFatalException';
  }
}
