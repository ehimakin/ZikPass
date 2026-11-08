"use client";

import { useEffect, useRef, useState } from "react";

// Original eight-bar lounge loop, synthesised locally; no media service or requests.
const progression = [
  { chord: [60, 64, 67, 71], bass: 36, melody: [76, 74, 71, 67] },
  { chord: [57, 60, 64, 67], bass: 33, melody: [72, 71, 69, 64] },
  { chord: [53, 57, 60, 64], bass: 29, melody: [69, 72, 76, 72] },
  { chord: [55, 59, 62, 65], bass: 31, melody: [74, 71, 69, 67] },
  { chord: [52, 55, 59, 62], bass: 28, melody: [71, 74, 76, 74] },
  { chord: [57, 61, 64, 67], bass: 33, melody: [73, 71, 69, 67] },
  { chord: [50, 53, 57, 60], bass: 26, melody: [69, 72, 74, 72] },
  { chord: [55, 59, 62, 65], bass: 31, melody: [71, 69, 67, 62] }
];

function startLounge(context: AudioContext) {
  const master = context.createGain();
  master.gain.setValueAtTime(0, context.currentTime);
  master.gain.linearRampToValueAtTime(.22, context.currentTime + .25);
  master.connect(context.destination);
  const tone = (note: number, when: number, duration: number, volume: number, bass = false) => {
    const voice = context.createGain();
    voice.gain.setValueAtTime(0, when);
    voice.gain.linearRampToValueAtTime(volume, when + .025);
    voice.gain.exponentialRampToValueAtTime(.001, when + duration);
    voice.connect(master);
    const oscillators = [1, 2, 3].map((harmonic, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = 440 * 2 ** ((note - 69) / 12) * harmonic;
      gain.gain.value = index === 0 ? 1 : bass ? .025 : .12 / harmonic;
      oscillator.connect(gain);
      gain.connect(voice);
      oscillator.start(when);
      oscillator.stop(when + duration + .03);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      return oscillator;
    });
    oscillators[0].addEventListener("ended", () => voice.disconnect());
  };
  const beat = 60 / 86;
  let bar = 0;
  let next = context.currentTime + .08;
  const schedule = () => {
    while (next < context.currentTime + .2) {
      const notes = progression[bar % progression.length];
      notes.chord.forEach((note, index) => {
        tone(note, next + index * .012, beat * 1.7, .12);
        tone(note, next + beat * 2.5 + index * .012, beat * 1.3, .085);
      });
      tone(notes.bass, next, beat * 1.8, .26, true);
      tone(notes.bass + 7, next + beat * 2, beat * 1.8, .2, true);
      notes.melody.forEach((note, index) => tone(note, next + beat * (index + (index % 2 ? .16 : 0)), beat * .85, .14));
      next += beat * 4;
      bar++;
    }
  };
  schedule();
  const timer = window.setInterval(schedule, 100);
  return () => {
    window.clearInterval(timer);
    master.disconnect();
    void context.close().catch(() => {});
  };
}

export function HomeMusic() {
  const stopRef = useRef<(() => void) | null>(null);
  const pendingRef = useRef<AudioContext | null>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");

  const stop = () => {
    stopRef.current?.();
    stopRef.current = null;
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (pending) void pending.close().catch(() => {});
  };

  useEffect(() => {
    const hide = () => {
      if (document.hidden) { stop(); setPlaying(false); }
    };
    document.addEventListener("visibilitychange", hide);
    return () => { document.removeEventListener("visibilitychange", hide); stop(); };
  }, []);

  async function toggle() {
    if (stopRef.current || pendingRef.current) { stop(); setPlaying(false); return; }
    setError("");
    try {
      const context = new AudioContext();
      pendingRef.current = context;
      await context.resume();
      // A second tap, navigation or hidden tab may cancel a pending start.
      if (pendingRef.current !== context) return;
      pendingRef.current = null;
      stopRef.current = startLounge(context);
      setPlaying(true);
    } catch {
      stop();
      setPlaying(false);
      setError("Audio couldn’t start. Tap to try again.");
    }
  }

  return <div className="fixed right-4 top-[4.25rem] z-40 flex max-w-[calc(100vw-2rem)] flex-col items-end gap-2">
    <button type="button" onClick={() => void toggle()} aria-pressed={playing} aria-label={playing ? "Pause elevator music" : "Play elevator music"} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/20 bg-[#18251b]/90 px-4 text-sm font-semibold text-[#f0f5df] shadow-sm backdrop-blur focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d6ef66]">
      <span aria-hidden="true">{playing ? "Ⅱ" : "♫"}</span>{playing ? "Music on" : "Elevator music"}
    </button>
    {error ? <p role="status" className="rounded-lg bg-[#18251b] p-2 text-xs text-white">{error}</p> : null}
  </div>;
}
