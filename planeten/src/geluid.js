// Alle geluiden worden ter plekke gemaakt met de Web Audio API: geen geluidsbestanden nodig.

let ctx = null;
let hoofd = null;

function audio() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    hoofd = ctx.createGain();
    hoofd.gain.value = 0.5;
    hoofd.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function toon(freq, duur, { type = 'sine', vol = 0.3, glijNaar = null, vertraging = 0 } = {}) {
  const a = audio();
  const t = a.currentTime + vertraging;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (glijNaar) o.frequency.exponentialRampToValueAtTime(glijNaar, t + duur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, t + duur);
  o.connect(g).connect(hoofd);
  o.start(t);
  o.stop(t + duur + 0.05);
}

function ruisBuffer(sec) {
  const a = audio();
  const buf = a.createBuffer(1, a.sampleRate * sec, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function ruis(duur, { freq = 800, q = 1, vol = 0.3, type = 'lowpass', glijNaar = null } = {}) {
  const a = audio();
  const t = a.currentTime;
  const bron = a.createBufferSource();
  bron.buffer = ruisBuffer(duur + 0.1);
  const f = a.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  if (glijNaar) f.frequency.exponentialRampToValueAtTime(glijNaar, t + duur);
  f.Q.value = q;
  const g = a.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + duur);
  bron.connect(f).connect(g).connect(hoofd);
  bron.start(t);
}

// Opgenomen geluiden (gemaakt met Higgsfield, kunst/geluid/). Ze laden pas na de eerste tik;
// tot ze er zijn, klinkt het zelfgemaakte geluid hieronder.
const OPGENOMEN = ['donder', 'geboorte', 'fanfare', 'knal', 'rommel', 'poef', 'boing'];
const buffers = {};
function laadOpnames() {
  const a = audio();
  for (const naam of OPGENOMEN) {
    fetch(new URL(`../kunst/geluid/${naam}.mp3`, import.meta.url))
      .then((r) => r.arrayBuffer())
      .then((b) => a.decodeAudioData(b))
      .then((buf) => (buffers[naam] = buf))
      .catch(() => {});
  }
}
function speel(naam, { vol = 1, snelheid = 1 } = {}) {
  const buf = buffers[naam];
  if (!buf) return false;
  const a = audio();
  const bron = a.createBufferSource();
  bron.buffer = buf;
  bron.playbackRate.value = snelheid;
  const g = a.createGain();
  g.gain.value = vol;
  bron.connect(g).connect(hoofd);
  bron.start();
  return true;
}

// Rustige muziek op de achtergrond. Aan of uit wordt onthouden op dit apparaat.
const muziek = new Audio(new URL('../kunst/geluid/muziek.mp3', import.meta.url));
muziek.loop = true;
muziek.volume = 0.12;
muziek.preload = 'none';
let muziekAan = true;
try {
  muziekAan = localStorage.getItem('planeetmakers-muziek') !== 'uit';
} catch {}

export const geluid = {
  get muziekAan() {
    return muziekAan;
  },
  muziek(aan = muziekAan) {
    muziekAan = aan;
    try {
      localStorage.setItem('planeetmakers-muziek', aan ? 'aan' : 'uit');
    } catch {}
    if (aan) muziek.play().catch(() => {});
    else muziek.pause();
  },
  // Even zachter tijdens het voorlezen en opnemen.
  muziekZacht(zacht) {
    muziek.volume = zacht ? 0.04 : 0.12;
  },
  // Tijdens een opname (wens, geluid van een wezen) helemaal stil, anders neemt de microfoon het op.
  opname(bezig) {
    if (bezig) muziek.pause();
    else if (muziekAan) muziek.play().catch(() => {});
  },
  aan: true,
  klik() {
    if (this.aan) toon(660, 0.12, { type: 'triangle', vol: 0.25, glijNaar: 990 });
  },
  plop() {
    if (this.aan) toon(320, 0.18, { type: 'sine', vol: 0.4, glijNaar: 900 });
  },
  pling(stap = 0) {
    if (!this.aan) return;
    const noten = [523, 659, 784, 1047, 1319];
    toon(noten[stap % noten.length], 0.4, { type: 'sine', vol: 0.25 });
    toon(noten[stap % noten.length] * 2, 0.3, { type: 'sine', vol: 0.08 });
  },
  zwiep() {
    if (this.aan) ruis(0.5, { freq: 300, glijNaar: 4000, type: 'bandpass', q: 2, vol: 0.35 });
  },
  rommel() {
    if (!this.aan) return;
    if (speel('rommel', { vol: 0.5, snelheid: 0.9 + Math.random() * 0.3 })) return;
    ruis(0.35, { freq: 180, vol: 0.5 });
    toon(70, 0.3, { type: 'sine', vol: 0.3, glijNaar: 45 });
  },
  schep() {
    if (!this.aan) return;
    ruis(0.2, { freq: 900, type: 'bandpass', q: 3, vol: 0.35 });
  },
  kwast() {
    if (this.aan) ruis(0.18, { freq: 3000, type: 'highpass', vol: 0.12 });
  },
  bubbel() {
    if (!this.aan) return;
    const f = 300 + Math.random() * 500;
    toon(f, 0.12, { type: 'sine', vol: 0.18, glijNaar: f * 2.2 });
  },
  donder(sterkte = 1) {
    if (!this.aan || sterkte <= 0.02) return;
    if (speel('donder', { vol: sterkte, snelheid: 0.85 + Math.random() * 0.3 })) return;
    ruis(2.2, { freq: 400, glijNaar: 60, vol: 0.7 * sterkte });
  },
  poef() {
    if (!this.aan) return;
    if (speel('poef', { vol: 0.7 })) return;
    ruis(0.6, { freq: 2000, glijNaar: 200, vol: 0.4 });
    toon(200, 0.5, { type: 'sine', vol: 0.3, glijNaar: 600 });
  },
  geboorte() {
    if (!this.aan) return;
    if (speel('geboorte', { vol: 0.9 })) return;
    ruis(1.6, { freq: 100, glijNaar: 3000, type: 'bandpass', q: 1.5, vol: 0.5 });
    [262, 330, 392, 523, 659, 784].forEach((f, i) => toon(f, 1.4, { type: 'sine', vol: 0.18, vertraging: 0.5 + i * 0.09 }));
  },
  fanfare() {
    if (!this.aan) return;
    if (speel('fanfare', { vol: 0.9 })) return;
    const melodie = [523, 659, 784, 1047, 784, 1047];
    const duur = [0.15, 0.15, 0.15, 0.35, 0.15, 0.6];
    let t = 0;
    melodie.forEach((f, i) => {
      toon(f, duur[i] + 0.2, { type: 'triangle', vol: 0.25, vertraging: t });
      toon(f / 2, duur[i] + 0.2, { type: 'sine', vol: 0.15, vertraging: t });
      t += duur[i];
    });
  },
  boing(hoogte = 1) {
    if (!this.aan) return;
    if (speel('boing', { vol: 0.6, snelheid: hoogte })) return;
    toon(180 * hoogte, 0.35, { type: 'sine', vol: 0.4, glijNaar: 520 * hoogte });
    toon(260 * hoogte, 0.25, { type: 'triangle', vol: 0.12, glijNaar: 700 * hoogte, vertraging: 0.05 });
  },
  knal() {
    if (!this.aan) return;
    if (speel('knal', { vol: 0.55, snelheid: 0.85 + Math.random() * 0.35 })) return;
    ruis(0.5, { freq: 1500, glijNaar: 150, vol: 0.4 });
  },
};

// Eerste aanraking ontgrendelt het geluid (browsers eisen dat).
// Dan ook de opnames laden en de muziek starten (als die aan staat).
window.addEventListener(
  'pointerdown',
  () => {
    audio();
    laadOpnames();
    if (muziekAan) muziek.play().catch(() => {});
  },
  { once: true }
);
