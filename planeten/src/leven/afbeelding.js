// Maakt het plaatje voor een soort die vanzelf is ontstaan. Uitgangspunt is de tekening van een
// ouder: die wordt omgekleurd naar de nieuwe leefomgeving (ijsblauw, zandkleurig...) en een
// kruising krijgt vlekken in de kleur van de andere ouder. Het witte stickerrandje en de zwarte
// lijnen blijven zoals ze waren, zodat het nog steeds als een kindertekening voelt.

import { maakRandom } from '../ruis.js';

function laad(url) {
  return new Promise((klaar, fout) => {
    const img = new Image();
    img.onload = () => klaar(img);
    img.onerror = fout;
    img.src = url;
  });
}

function naarHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}

function naarRgb(h, s, l) {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const kanaal = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [kanaal(h + 1 / 3) * 255, kanaal(h) * 255, kanaal(h - 1 / 3) * 255];
}

// Tint naar een kleur toe draaien over de kortste weg rond het kleurenwiel.
function draaiTint(h, doel, mate) {
  let d = doel - h;
  if (d > 0.5) d -= 1;
  if (d < -0.5) d += 1;
  return (h + d * mate + 1) % 1;
}

function omkleuren(img, { tint, vlekken, zaad }) {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const beeld = ctx.getImageData(0, 0, c.width, c.height);
  const d = beeld.data;
  // Vlekken: dezelfde plekken voor open en dichte ogen (zelfde zaadje).
  const rnd = maakRandom(zaad);
  const plekken = vlekken
    ? Array.from({ length: 7 + Math.floor(rnd() * 5) }, () => ({ x: rnd() * c.width, y: rnd() * c.height, r: (0.06 + rnd() * 0.08) * Math.min(c.width, c.height) }))
    : [];
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      const o = (y * c.width + x) * 4;
      if (d[o + 3] < 10) continue;
      const max = Math.max(d[o], d[o + 1], d[o + 2]), min = Math.min(d[o], d[o + 1], d[o + 2]);
      if (min > 232 || max < 50) continue; // wit randje, witte ogen en zwarte lijnen laten staan
      let [h, s, l] = naarHsl(d[o], d[o + 1], d[o + 2]);
      if (tint !== null && tint !== undefined) {
        h = draaiTint(h, tint, 0.7);
        s = Math.max(s, 0.35);
      }
      if (plekken.some((p) => (x - p.x) ** 2 + (y - p.y) ** 2 < p.r * p.r)) {
        h = vlekken.h;
        s = Math.max(0.45, vlekken.s);
        l = Math.min(0.75, Math.max(0.3, vlekken.l));
      }
      const [r, g, b] = naarRgb(h, s, l);
      d[o] = r;
      d[o + 1] = g;
      d[o + 2] = b;
    }
  }
  ctx.putImageData(beeld, 0, 0);
  const webp = c.toDataURL('image/webp', 0.9);
  return webp.startsWith('data:image/webp') ? webp : c.toDataURL('image/png');
}

// Een eenvoudig wezentje als er geen ouder-tekening meer is.
function standaardWezen(kleurHsl) {
  const c = document.createElement('canvas');
  c.width = c.height = 200;
  const ctx = c.getContext('2d');
  const [r, g, b] = naarRgb(kleurHsl?.h ?? 0.3, Math.max(0.5, kleurHsl?.s ?? 0.6), 0.55);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.ellipse(100, 110, 88, 78, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.strokeStyle = '#1c1c1e';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.ellipse(100, 110, 80, 70, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  return c.toDataURL('image/png');
}

export async function plaatjeVoorNieuweSoort({ ouder, tint, vlekken, zaad, kleur }) {
  try {
    if (!ouder || !ouder.plaatje) throw new Error('geen ouder');
    const [open, dicht] = await Promise.all([laad(ouder.plaatje), laad(ouder.dicht || ouder.plaatje)]);
    return {
      plaatje: omkleuren(open, { tint, vlekken, zaad }),
      dicht: omkleuren(dicht, { tint, vlekken, zaad }),
      verhouding: ouder.verhouding || open.width / open.height,
    };
  } catch {
    const url = standaardWezen(kleur);
    return { plaatje: url, dicht: url, verhouding: 200 / 200 };
  }
}
