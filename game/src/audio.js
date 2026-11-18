// Solmar Bay — every sound is synthesised live with WebAudio. No audio files,
// no samples: oscillators and filtered noise, built fresh when the player
// first interacts with the page.
export function createAudio() {
  return {
    ctx: null,
    master: null,
    muted: false,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    sirenTimer: 0,
    sirenHigh: false,
  };
}

export function initAudio(audio) {
  if (audio.ctx) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    audio.ctx = new AC();
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = 0.5;
    audio.master.connect(audio.ctx.destination);
    // Engine hum: a low sawtooth whose pitch follows the car speed.
    audio.engineOsc = audio.ctx.createOscillator();
    audio.engineOsc.type = 'sawtooth';
    audio.engineOsc.frequency.value = 55;
    audio.engineGain = audio.ctx.createGain();
    audio.engineGain.gain.value = 0;
    const engineFilter = audio.ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    audio.engineOsc.connect(engineFilter);
    engineFilter.connect(audio.engineGain);
    audio.engineGain.connect(audio.master);
    audio.engineOsc.start();
    // Police siren: a sine that alternates between two notes.
    audio.sirenOsc = audio.ctx.createOscillator();
    audio.sirenOsc.type = 'sine';
    audio.sirenOsc.frequency.value = 660;
    audio.sirenGain = audio.ctx.createGain();
    audio.sirenGain.gain.value = 0;
    audio.sirenOsc.connect(audio.sirenGain);
    audio.sirenGain.connect(audio.master);
    audio.sirenOsc.start();
  } catch (err) {
    audio.ctx = null;
  }
}

function burst(audio, duration, type, freq, vol, slideTo) {
  if (!audio.ctx || audio.muted) return;
  try {
    const t = audio.ctx.currentTime;
    const osc = audio.ctx.createOscillator();
    const gain = audio.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + duration);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain);
    gain.connect(audio.master);
    osc.start(t);
    osc.stop(t + duration);
  } catch (err) { /* audio is best-effort */ }
}

function noiseBurst(audio, duration, vol, filterFreq) {
  if (!audio.ctx || audio.muted) return;
  try {
    const t = audio.ctx.currentTime;
    const len = Math.floor(audio.ctx.sampleRate * duration);
    const buffer = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = audio.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = audio.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = audio.ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(audio.master);
    src.start(t);
  } catch (err) { /* audio is best-effort */ }
}

export function playGunshot(audio) {
  noiseBurst(audio, 0.14, 0.5, 2600);
  burst(audio, 0.08, 'square', 180, 0.25, 60);
}

export function playPunch(audio) {
  noiseBurst(audio, 0.09, 0.4, 700);
}

export function playCrash(audio, hard) {
  noiseBurst(audio, hard ? 0.35 : 0.18, hard ? 0.7 : 0.35, hard ? 500 : 900);
  burst(audio, 0.2, 'sine', 90, 0.3, 40);
}

export function playPickup(audio) {
  burst(audio, 0.12, 'sine', 660, 0.3, 990);
  burst(audio, 0.18, 'sine', 990, 0.25, 1320);
}

export function playMissionComplete(audio) {
  [523, 659, 784, 1046].forEach((f, i) => {
    if (!audio.ctx || audio.muted) return;
    try {
      const t = audio.ctx.currentTime + i * 0.11;
      const osc = audio.ctx.createOscillator();
      const gain = audio.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.connect(gain);
      gain.connect(audio.master);
      osc.start(t);
      osc.stop(t + 0.32);
    } catch (err) { /* audio is best-effort */ }
  });
}

export function playBusted(audio) {
  burst(audio, 0.7, 'sawtooth', 220, 0.3, 55);
}

// Called every frame: engine pitch follows speed, siren wails while wanted.
export function updateAudio(audio, driving, speedRatio, wanted, dt) {
  if (!audio.ctx) return;
  try {
    if (audio.ctx.state === 'suspended') audio.ctx.resume();
    if (audio.engineOsc) {
      audio.engineOsc.frequency.value = 50 + speedRatio * 140;
      audio.engineGain.gain.value = audio.muted ? 0 : (driving ? 0.05 + speedRatio * 0.06 : 0);
    }
    if (audio.sirenOsc) {
      audio.sirenTimer += dt;
      if (audio.sirenTimer > 0.45) {
        audio.sirenTimer = 0;
        audio.sirenHigh = !audio.sirenHigh;
        audio.sirenOsc.frequency.value = audio.sirenHigh ? 880 : 660;
      }
      const target = audio.muted || wanted === 0 ? 0 : 0.035;
      audio.sirenGain.gain.value += (target - audio.sirenGain.gain.value) * Math.min(1, dt * 6);
    }
  } catch (err) { /* audio is best-effort */ }
}

export function toggleMute(audio) {
  audio.muted = !audio.muted;
  if (audio.master) audio.master.gain.value = audio.muted ? 0 : 0.5;
  return audio.muted;
}
