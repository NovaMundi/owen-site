// 3D simplex-ruis met een zaadje, plus gelaagde varianten.
// Zelfde zaadje = zelfde planeet, op elk apparaat.

export function maakRandom(zaad) {
  let s = 0;
  for (const c of String(zaad)) s = (Math.imul(s, 31) + c.charCodeAt(0)) | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const RICHTINGEN = new Float32Array([
  1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0,
  1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1,
  0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1,
]);

export function maakRuis(zaad) {
  const rnd = maakRandom(zaad);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  const perm = new Uint8Array(512);
  const permMod12 = new Uint8Array(512);
  for (let i = 0; i < 512; i++) {
    perm[i] = p[i & 255];
    permMod12[i] = perm[i] % 12;
  }
  const F3 = 1 / 3, G3 = 1 / 6;

  function ruis3(x, y, z) {
    const s = (x + y + z) * F3;
    const i = Math.floor(x + s), j = Math.floor(y + s), k = Math.floor(z + s);
    const t = (i + j + k) * G3;
    const x0 = x - (i - t), y0 = y - (j - t), z0 = z - (k - t);
    let i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) {
      if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
      else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
      else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
    } else {
      if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
      else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
      else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
    }
    const x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3;
    const x2 = x0 - i2 + 2 * G3, y2 = y0 - j2 + 2 * G3, z2 = z0 - k2 + 2 * G3;
    const x3 = x0 - 1 + 3 * G3, y3 = y0 - 1 + 3 * G3, z3 = z0 - 1 + 3 * G3;
    const ii = i & 255, jj = j & 255, kk = k & 255;
    let n = 0, t0, g;
    t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
    if (t0 > 0) { g = permMod12[ii + perm[jj + perm[kk]]] * 3; t0 *= t0; n += t0 * t0 * (RICHTINGEN[g] * x0 + RICHTINGEN[g + 1] * y0 + RICHTINGEN[g + 2] * z0); }
    t0 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
    if (t0 > 0) { g = permMod12[ii + i1 + perm[jj + j1 + perm[kk + k1]]] * 3; t0 *= t0; n += t0 * t0 * (RICHTINGEN[g] * x1 + RICHTINGEN[g + 1] * y1 + RICHTINGEN[g + 2] * z1); }
    t0 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
    if (t0 > 0) { g = permMod12[ii + i2 + perm[jj + j2 + perm[kk + k2]]] * 3; t0 *= t0; n += t0 * t0 * (RICHTINGEN[g] * x2 + RICHTINGEN[g + 1] * y2 + RICHTINGEN[g + 2] * z2); }
    t0 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
    if (t0 > 0) { g = permMod12[ii + 1 + perm[jj + 1 + perm[kk + 1]]] * 3; t0 *= t0; n += t0 * t0 * (RICHTINGEN[g] * x3 + RICHTINGEN[g + 1] * y3 + RICHTINGEN[g + 2] * z3); }
    return 32 * n; // ongeveer -1..1
  }

  // Gelaagde ruis: grove vormen plus steeds fijnere details.
  function lagen(x, y, z, octaven, schaal) {
    let som = 0, amp = 1, totaal = 0, f = schaal;
    for (let o = 0; o < octaven; o++) {
      som += ruis3(x * f, y * f, z * f) * amp;
      totaal += amp;
      amp *= 0.5;
      f *= 2;
    }
    return som / totaal;
  }

  // Scherpe bergkammen: 1 - |ruis|, gekwadrateerd.
  function kammen(x, y, z, octaven, schaal) {
    let som = 0, amp = 1, totaal = 0, f = schaal, gewicht = 1;
    for (let o = 0; o < octaven; o++) {
      let r = 1 - Math.abs(ruis3(x * f, y * f, z * f));
      r *= r * gewicht;
      gewicht = Math.min(1, r * 2);
      som += r * amp;
      totaal += amp;
      amp *= 0.5;
      f *= 2;
    }
    return som / totaal;
  }

  return { ruis3, lagen, kammen };
}
