// Sonidos sintetizados con Web Audio (no requieren archivos), vibración y pantalla encendida.

let ctx = null;
let enabled = true;
let vibrate = true;

export function configureFeedback({ sound, vibration }) {
  enabled = sound !== false;
  vibrate = vibration !== false;
}

/** Los navegadores exigen un gesto del usuario para habilitar el audio: se llama en el primer toque. */
export function unlockAudio() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!ctx) ctx = new AC();
    if (ctx.state === 'suspended') ctx.resume();
  } catch {
    ctx = null;
  }
}

function tone(freq, { at = 0, dur = 0.15, type = 'sine', gain = 0.18, slide = 0 } = {}) {
  if (!enabled || !ctx) return;
  const t0 = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export const sound = {
  start() {
    tone(523, { dur: 0.12 });
    tone(659, { at: 0.12, dur: 0.12 });
    tone(784, { at: 0.24, dur: 0.25, gain: 0.22 });
  },
  count() {
    tone(660, { dur: 0.12, type: 'triangle' });
  },
  go() {
    tone(988, { dur: 0.3, type: 'triangle', gain: 0.22 });
  },
  hit() {
    tone(880, { dur: 0.09, type: 'triangle' });
    tone(1320, { at: 0.07, dur: 0.16, type: 'triangle' });
  },
  skip() {
    tone(260, { dur: 0.16, type: 'sine', slide: -90 });
  },
  warn() {
    tone(740, { dur: 0.16, type: 'square', gain: 0.1 });
    tone(740, { at: 0.22, dur: 0.16, type: 'square', gain: 0.1 });
  },
  tick() {
    tone(1200, { dur: 0.04, type: 'square', gain: 0.06 });
  },
  end() {
    tone(220, { dur: 0.6, type: 'sawtooth', gain: 0.16, slide: -80 });
    tone(165, { at: 0.05, dur: 0.6, type: 'square', gain: 0.08 });
  },
  dice() {
    for (let i = 0; i < 9; i++) tone(180 + Math.random() * 220, { at: i * 0.11, dur: 0.05, type: 'square', gain: 0.07 });
  },
  step() {
    tone(520, { dur: 0.06, type: 'triangle', gain: 0.1 });
  },
  win() {
    [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, { at: i * 0.13, dur: 0.22, type: 'triangle', gain: 0.2 }));
  },
  tap() {
    tone(420, { dur: 0.04, type: 'triangle', gain: 0.05 });
  },
};

export function buzz(pattern) {
  if (!vibrate || !navigator.vibrate) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* sin soporte */
  }
}

/* ---------- Pantalla encendida durante la ronda ---------- */
let lock = null;
let wantLock = false;

export async function keepAwake(on) {
  wantLock = on;
  try {
    if (on && 'wakeLock' in navigator && !lock) {
      lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => (lock = null));
    } else if (!on && lock) {
      await lock.release();
      lock = null;
    }
  } catch {
    lock = null;
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && wantLock) keepAwake(true);
});
