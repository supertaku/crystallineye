export function rhythmicFixture(sampleRate: number, seconds: number, bpm: number, missing = false, extra = false): Float32Array {
  const period = 60 / bpm;
  return Float32Array.from({ length: sampleRate * seconds }, (_, i) => {
    const time = i / sampleRate;
    const beat = Math.floor(time / period);
    const age = time - beat * period;
    const kick = missing && beat % 7 === 4 ? 0
      : 0.65 * Math.exp(-age / 0.055) * Math.sin(2 * Math.PI * (65 * age + 3 * (1 - Math.exp(-age * 30))));
    const click = age < 0.012 ? 0.18 * Math.exp(-age / 0.003) * Math.sin(2 * Math.PI * 2300 * age) : 0;
    const offbeat = age - period / 2;
    const extraClick = extra && offbeat >= 0 ? 0.18 * Math.exp(-offbeat / 0.018) * Math.sin(2 * Math.PI * 1500 * offbeat) : 0;
    return kick + (missing && beat % 7 === 4 ? 0 : click) + extraClick;
  });
}
