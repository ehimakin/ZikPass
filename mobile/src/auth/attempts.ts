/** Invalidates in-flight authentication when the app locks or navigation changes. */
export class UnlockAttempts {
  private revision = 0;
  private pending = false;
  begin(): number | null {
    if (this.pending) return null;
    this.pending = true;
    return this.revision;
  }
  invalidate() { this.revision++; }
  valid(ticket: number) { return ticket === this.revision; }
  finish() { this.pending = false; }
}
