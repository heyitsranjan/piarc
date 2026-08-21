/**
 * @module lib/sound
 * Synthesized completion chime via the Web Audio API.
 * No asset files — the tone is generated at runtime.
 */

let ctx: AudioContext | null = null;

/**
 * Play a short two-note chime (E5 → A5, ~180ms).
 * Lazily creates an AudioContext on first call.
 * No-ops silently if audio is unavailable (headless, suspended, etc.).
 */
export function playCompletionSound(): void {
  try {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();

    const now = ctx.currentTime;

    // Note 1: E5 (659.25 Hz)
    const o1 = ctx.createOscillator();
    const g1 = ctx.createGain();
    o1.type = "sine";
    o1.frequency.value = 659.25;
    g1.gain.setValueAtTime(0, now);
    g1.gain.linearRampToValueAtTime(0.15, now + 0.01);
    g1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    o1.connect(g1).connect(ctx.destination);
    o1.start(now);
    o1.stop(now + 0.12);

    // Note 2: A5 (880 Hz) — starts as note 1 fades
    const o2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    o2.type = "sine";
    o2.frequency.value = 880;
    g2.gain.setValueAtTime(0, now + 0.08);
    g2.gain.linearRampToValueAtTime(0.15, now + 0.09);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    o2.connect(g2).connect(ctx.destination);
    o2.start(now + 0.08);
    o2.stop(now + 0.18);
  } catch {
    // AudioContext unavailable — silent no-op.
  }
}
