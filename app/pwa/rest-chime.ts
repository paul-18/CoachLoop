/** Tiny Web Audio beep for RestTimer expiry. No audio file: two short
 * oscillator blips (880 Hz, then 1174.66 Hz). iOS Safari only lets an
 * AudioContext run if it was created/resumed inside a user gesture, so the
 * context is unlocked on the first pointerdown/keydown during a workout and
 * reused at expiry; if audio is unavailable the toast still fires. */

let sharedContext: AudioContext | null = null;

export function unlockRestAudio() {
  try {
    if (typeof window === "undefined") return;
    if (!sharedContext) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      sharedContext = new Ctor();
    }
    if (sharedContext.state === "suspended") void sharedContext.resume();
  } catch {
    sharedContext = null;
  }
}

export function playRestChime() {
  try {
    if (!sharedContext || sharedContext.state !== "running") return;
    const ctx = sharedContext;
    const start = ctx.currentTime + 0.01;
    [880, 1174.66].forEach((frequency, index) => {
      const offset = index * 0.18;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start + offset);
      gain.gain.exponentialRampToValueAtTime(0.12, start + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start + offset);
      osc.stop(start + offset + 0.18);
    });
  } catch {
    // Audio is best-effort; the "Rest complete" toast still fires.
  }
}
