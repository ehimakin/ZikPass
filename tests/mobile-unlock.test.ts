import { describe, expect, it } from 'vitest';
import { UnlockAttempts } from '../mobile/src/auth/attempts';
describe('native unlock lifecycle', () => {
  it('rejects a successful response that arrives after background lock or navigation away', async () => {
    const attempts = new UnlockAttempts();
    const ticket = attempts.begin()!;
    let resolve!: () => void;
    const challenge = new Promise<void>(done => { resolve = done; });
    const result = challenge.then(() => attempts.valid(ticket));
    attempts.invalidate(); resolve();
    expect(await result).toBe(false);
    attempts.finish();
    expect(attempts.valid(attempts.begin()!)).toBe(true);
  });
  it('prevents overlapping biometric challenges even while a cancelled challenge settles', () => {
    const attempts = new UnlockAttempts();
    attempts.begin(); expect(attempts.begin()).toBeNull();
    attempts.invalidate(); expect(attempts.begin()).toBeNull();
    attempts.finish(); expect(attempts.begin()).not.toBeNull();
  });
  it('allows retry after cancellation without reusing an invalidated grant', () => {
    const attempts = new UnlockAttempts();
    const old = attempts.begin()!;
    attempts.invalidate(); attempts.finish();
    const retry = attempts.begin()!;
    expect(attempts.valid(old)).toBe(false);
    expect(attempts.valid(retry)).toBe(true);
  });
});
