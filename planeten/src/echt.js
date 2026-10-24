import { wolk } from './wolk.js';
// "Maak echt" aan de kant van de browser: tekening klaarmaken voor de beeldmotor en het
// resultaat netjes bijsnijden tot een los wezen zonder achtergrond.

function laad(url) {
  return new Promise((klaar, fout) => {
    const img = new Image();
    img.onload = () => klaar(img);
    img.onerror = fout;
    img.src = url;
  });
}

// Tekening midden op een wit vel van 1024×1024, zoals een echt getekend blaadje.
export async function tekeningVoorMotor(w) {
  // Het plaatje met de ogen erin (de ruwe tekening heeft ze los, om te knipperen; dan ziet de
  // beeldmotor geen ogen).
  const img = await laad(w.plaatje || w.tekening);
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 1024, 1024);
  // Bijsnijden tot de tekening zelf, zodat het wezen groot in beeld staat.
  const t = document.createElement('canvas');
  t.width = img.width;
  t.height = img.height;
  const tc = t.getContext('2d', { willReadFrequently: true });
  tc.drawImage(img, 0, 0);
  const [x0, y0, x1, y1] = randen(tc.getImageData(0, 0, t.width, t.height), (d, o) => d[o + 3] > 20);
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  const schaal = Math.min(820 / bw, 820 / bh);
  ctx.drawImage(t, x0, y0, bw, bh, (1024 - bw * schaal) / 2, (1024 - bh * schaal) / 2, bw * schaal, bh * schaal);
  return c.toDataURL('image/png');
}

// Uitkomst van de motor: witte achtergrond (als die er toch is) weghalen, bijsnijden, verkleinen.
export async function echtUitMotor(dataUrl) {
  const img = await laad(dataUrl);
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const beeld = ctx.getImageData(0, 0, c.width, c.height);
  const d = beeld.data;
  const hoek = (x, y) => d[(y * c.width + x) * 4 + 3] > 200;
  if (hoek(0, 0) && hoek(c.width - 1, 0) && hoek(0, c.height - 1) && hoek(c.width - 1, c.height - 1)) haalAchtergrondWeg(d, c.width, c.height);
  ctx.putImageData(beeld, 0, 0);
  const [x0, y0, x1, y1] = randen(beeld, (dd, o) => dd[o + 3] > 30);
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  const schaal = Math.min(1, 384 / Math.max(bw, bh));
  const uit = document.createElement('canvas');
  uit.width = Math.round(bw * schaal);
  uit.height = Math.round(bh * schaal);
  uit.getContext('2d').drawImage(c, x0, y0, bw, bh, 0, 0, uit.width, uit.height);
  const webp = uit.toDataURL('image/webp', 0.88);
  return { plaatje: webp.startsWith('data:image/webp') ? webp : uit.toDataURL('image/png'), verhouding: uit.width / uit.height };
}

function randen(beeld, telt) {
  const { width: B, height: H, data: d } = beeld;
  let x0 = B, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < B; x++)
      if (telt(d, (y * B + x) * 4)) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < 0) return [0, 0, B - 1, H - 1];
  return [x0, y0, x1, y1];
}

// Vanaf de randen alle (bijna) witte pixels doorzichtig maken, met een zachte overgang.
function haalAchtergrondWeg(d, B, H) {
  const wit = (o) => d[o] > 235 && d[o + 1] > 235 && d[o + 2] > 235;
  const gezien = new Uint8Array(B * H);
  const stapel = [];
  for (let x = 0; x < B; x++) stapel.push(x, 0, x, H - 1);
  for (let y = 0; y < H; y++) stapel.push(0, y, B - 1, y);
  while (stapel.length) {
    const y = stapel.pop(), x = stapel.pop();
    if (x < 0 || y < 0 || x >= B || y >= H) continue;
    const i = y * B + x;
    if (gezien[i]) continue;
    gezien[i] = 1;
    const o = i * 4;
    if (!wit(o)) {
      // Randpixel van het wezen: half doorzichtig voor een zachte rand.
      if (d[o] > 215 && d[o + 1] > 215 && d[o + 2] > 215) d[o + 3] = 120;
      continue;
    }
    d[o + 3] = 0;
    stapel.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
  }
}

// Twee manieren om te toveren: op papa's laptop via de eigen server (node server.mjs), en op
// de sites van de jongens via de functie op jakevanpelt.com (alleen met een familiecode).
const ONLINE = location.hostname.endsWith('jakevanpelt.com') || location.port === '8888' ? '/.netlify/functions/planeet-echt' : 'https://jakevanpelt.com/.netlify/functions/planeet-echt';
let route = null; // 'lokaal' | 'online' | null

async function kiesRoute(code) {
  if (['localhost', '127.0.0.1'].includes(location.hostname)) {
    try {
      const r = await fetch('/api/echt?wie=test');
      if (r.ok && (await r.json()).kan) return 'lokaal';
    } catch {}
  }
  return code ? 'online' : null;
}

// Even vragen of de knop werkt en hoe vaak het nog kan vandaag.
export async function echtStatus(wie, code) {
  route = await kiesRoute(code);
  try {
    if (route === 'lokaal') return await (await fetch('/api/echt?wie=' + encodeURIComponent(wie))).json();
    if (route === 'online') {
      const r = await fetch(`${ONLINE}?code=${code}&wie=${wie}`, { headers: wolk.kop() });
      if (!r.ok) return { kan: false };
      return await r.json();
    }
  } catch {}
  return { kan: false };
}

export async function vraagEcht(wie, w, code) {
  const image = await tekeningVoorMotor(w);
  const body = JSON.stringify({ wie, image, huid: w.huid, beweging: w.beweging, maat: w.maat });
  let data;
  if (route === 'lokaal') {
    const r = await fetch('/api/echt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    data = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(data.fout || 'mislukt'), { status: r.status, data });
  } else {
    // Online: opdracht geven, dan elke paar seconden kijken of het klaar is (± 20-40 s).
    const r = await fetch(`${ONLINE}?code=${code}&wie=${wie}`, { method: 'POST', headers: wolk.kop({ 'Content-Type': 'application/json' }), body });
    const start = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(start.fout || 'mislukt'), { status: r.status, data: start });
    const tot = Date.now() + 150000;
    while (Date.now() < tot) {
      await new Promise((k) => setTimeout(k, 3000));
      const p = await fetch(`${ONLINE}?code=${code}&wie=${wie}&taak=${start.taak}`, { headers: wolk.kop() }).then((x) => x.json()).catch(() => null);
      if (!p || !p.klaar) continue;
      if (p.fout) throw Object.assign(new Error(p.fout), { status: p.status || 500 });
      data = p;
      break;
    }
    if (!data) throw Object.assign(new Error('duurde te lang'), { status: 504 });
  }
  const echt = await echtUitMotor(data.beeld);
  return { echt, over: data.over };
}
