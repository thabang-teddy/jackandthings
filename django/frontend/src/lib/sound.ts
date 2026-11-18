/** A two-note chime from the Web Audio API — no sound files ship. 880 Hz then 660 Hz, 180 ms each. */
let ctx: AudioContext | null = null;

export function chime(kind: string = "bell"): void {
  if (kind === "none") return;
  try {
    ctx = ctx ?? new AudioContext();
    const notes = kind === "soft" ? [660, 520] : [880, 660];
    notes.forEach((freq, i) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      const start = ctx!.currentTime + i * 0.2;
      osc.frequency.value = freq;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(start);
      osc.stop(start + 0.2);
    });
  } catch {
    /* audio blocked or unsupported: the visual change is enough */
  }
}
