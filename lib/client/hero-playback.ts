/** Shared motion-responsive playback for the homepage and ecosystem hero. */
export function createHeroPlayback(video: Pick<HTMLVideoElement, 'playbackRate' | 'play' | 'pause'>) {
  let disposed = false;
  let manual = false;
  let hidden = false;
  let moving = false;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let stopTimer: ReturnType<typeof setTimeout> | undefined;
  let frame: number | undefined;

  function cancelRamp() {
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = undefined;
  }
  function ramp(from: number, to: number, duration: number) {
    cancelRamp();
    const start = performance.now();
    video.playbackRate = from;
    const tick = () => {
      if (disposed || manual || hidden) return;
      const progress = Math.min(1, (performance.now() - start) / duration);
      // Smooth acceleration/deceleration, with no jump at either end.
      const eased = progress * progress * (3 - 2 * progress);
      video.playbackRate = from + (to - from) * eased;
      frame = progress < 1 ? requestAnimationFrame(tick) : undefined;
    };
    frame = requestAnimationFrame(tick);
  }
  function clearMotion() {
    clearTimeout(idleTimer);
    clearTimeout(stopTimer);
    cancelRamp();
    moving = false;
  }
  function resume() {
    clearTimeout(stopTimer);
    moving = false;
    if (disposed || manual || hidden) return;
    video.playbackRate = 0.5;
    void video.play().then(() => {
      if (disposed || manual || hidden) { video.pause(); return; }
      if (!moving) ramp(0.5, 1, 1000);
    }).catch(() => {});
  }
  function movement() {
    if (disposed || manual || hidden) return;
    if (!moving) {
      moving = true;
      ramp(video.playbackRate, 0.15, 1500);
      stopTimer = setTimeout(() => {
        cancelRamp();
        video.pause();
      }, 1500);
    }
    clearTimeout(idleTimer);
    idleTimer = setTimeout(resume, 500);
  }
  function setHidden(value: boolean) {
    hidden = value;
    clearMotion();
    video.pause();
    if (!hidden && !manual && !disposed) idleTimer = setTimeout(resume, 500);
  }
  function toggle() {
    manual = !manual;
    clearMotion();
    if (manual) video.pause();
    else if (!hidden) resume();
  }
  return { movement, setHidden, toggle, dispose() { disposed = true; clearMotion(); video.pause(); } };
}
