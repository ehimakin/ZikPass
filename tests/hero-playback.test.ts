import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createHeroPlayback } from '@/lib/client/hero-playback';
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
  vi.stubGlobal('requestAnimationFrame', (callback: () => void) => setTimeout(callback, 16));
  vi.stubGlobal('cancelAnimationFrame', (id: ReturnType<typeof setTimeout>) => clearTimeout(id));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
const media = () => ({ playbackRate: 1, play: vi.fn(async () => {}), pause: vi.fn() });
test('brief movement slows playback without pausing and resumes after 500ms idle', async () => {
  const video = media(), control = createHeroPlayback(video);
  control.movement();
  await vi.advanceTimersByTimeAsync(300);
  expect(video.playbackRate).toBeLessThan(1);
  expect(video.pause).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(200);
  expect(video.playbackRate).toBe(0.5);
  expect(video.play).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(500);
  expect(video.playbackRate).toBeGreaterThan(0.5);
  expect(video.playbackRate).toBeLessThan(1);
  await vi.advanceTimersByTimeAsync(520);
  expect(video.playbackRate).toBe(1);
  control.dispose();
});
test('sustained movement pauses at 1.5 seconds and resumes only after 500ms idle', async () => {
  const video = media(), control = createHeroPlayback(video);
  control.movement();
  for (let i = 0; i < 7; i++) { await vi.advanceTimersByTimeAsync(200); control.movement(); }
  expect(video.pause).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(100);
  expect(video.pause).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(399);
  expect(video.play).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(video.playbackRate).toBe(0.5);
  expect(video.play).toHaveBeenCalledTimes(1);
  control.dispose();
});
test('manual pause and hidden documents suppress automatic restarts', async () => {
  const video = media(), control = createHeroPlayback(video);
  control.movement(); control.toggle();
  await vi.advanceTimersByTimeAsync(3000);
  expect(video.play).not.toHaveBeenCalled();
  control.setHidden(true); control.toggle();
  await vi.advanceTimersByTimeAsync(3000);
  expect(video.play).not.toHaveBeenCalled();
  control.setHidden(false);
  await vi.advanceTimersByTimeAsync(500);
  expect(video.play).toHaveBeenCalledTimes(1);
  control.dispose();
  await vi.advanceTimersByTimeAsync(3000);
  expect(video.play).toHaveBeenCalledTimes(1);
});
