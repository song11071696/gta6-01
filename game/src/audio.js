// Sound, synthesized with the WebAudio API — no audio files anywhere. Engine hum
// is a looping oscillator whose pitch follows speed, the siren is two alternating
// tones, and one-shots (gunshot, punch, pickup, jingle, crash) are short envelopes
// of noise or sine. M toggles mute; everything is created lazily on first user
// gesture so browsers never block it.
export function createAudio() {
  let ctx = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;

  function ensure() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 50;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 700;
      engineOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(ctx.destination);
      sirenOsc.start();
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, vol, freq) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq || 1200;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(t);
  }

  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    toggleMute() { muted = !muted; return muted; },
    get muted() { return muted; },
    engine(speed01, on) {
      if (!ensure()) return;
      const target = muted || !on ? 0 : 0.03 + speed01 * 0.05;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(45 + speed01 * 130, ctx.currentTime, 0.1);
    },
    siren(on, dt) {
      if (!ensure()) return;
      if (!on || muted) { sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1); return; }
      sirenTimer += dt;
      const f = Math.sin(sirenTimer * 5) > 0 ? 950 : 650;
      sirenOsc.frequency.setTargetAtTime(f, ctx.currentTime, 0.05);
      sirenGain.gain.setTargetAtTime(0.02, ctx.currentTime, 0.1);
    },
    gunshot() { noise(0.14, 0.5, 2500); tone(160, 0.08, 'square', 0.2, 60); },
    punch() { noise(0.08, 0.35, 500); },
    pickup() { tone(880, 0.12, 'sine', 0.25); tone(1320, 0.18, 'sine', 0.2); },
    jingle() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.25), i * 110)); },
    crash() { noise(0.3, 0.5, 700); },
    busted() { tone(440, 0.4, 'sawtooth', 0.2, 220); tone(330, 0.5, 'sawtooth', 0.2, 165); },
    click() { tone(1200, 0.05, 'sine', 0.12); },
  };
}
