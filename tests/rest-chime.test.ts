import test from "node:test";
import assert from "node:assert/strict";
import { playRestChime, unlockRestAudio } from "../app/pwa/rest-chime";

test("rest chime is silent and safe with no AudioContext", () => {
  // No window at all in this runner: both calls must be no-ops, not throws.
  assert.doesNotThrow(() => {
    unlockRestAudio();
    playRestChime();
  });
});

test("rest chime plays two blips once audio is unlocked", () => {
  const oscillators: { frequency: { value: number }; start: (when: number) => void; stop: (when: number) => void; connect: (target: unknown) => void }[] = [];
  const gains: { gain: { setValueAtTime: () => void; exponentialRampToValueAtTime: () => void }; connect: (target: unknown) => void }[] = [];
  class FakeAudioContext {
    state = "suspended";
    currentTime = 10;
    destination = {};
    resume = async () => { this.state = "running"; };
    createOscillator() {
      const osc = { frequency: { value: 0 }, start: () => {}, stop: () => {}, connect: () => {} };
      oscillators.push(osc);
      return osc;
    }
    createGain() {
      const gain = { gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} }, connect: () => {} };
      gains.push(gain);
      return gain;
    }
    close = async () => {};
  }
  (globalThis as unknown as { window: { AudioContext: typeof FakeAudioContext } }).window = { AudioContext: FakeAudioContext };
  try {
    unlockRestAudio();
    // Unlock is async (resume); wait a tick for the fake context to run.
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        playRestChime();
        assert.equal(oscillators.length, 2, "two blips");
        assert.deepEqual(oscillators.map((osc) => osc.frequency.value), [880, 1174.66]);
        assert.equal(gains.length, 2);
        resolve();
      }, 0);
    });
  } finally {
    delete (globalThis as unknown as { window?: unknown }).window;
  }
});
