// Rekenhulp op de achtergrond: het zware ruiswerk, zodat animaties blijven lopen.

import { maakRuis } from './ruis.js';
import { velden, wiebel, vocht } from './velden.js';

const bollen = new Map();

// Bol uit een kubus: zes rasters, opgeblazen tot een bol. Gelijkmatiger dan een icosaëder
// en veel sneller te maken op hoge fijnheid.
function maakBol(N) {
  const zijden = [
    [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
    [[-1, 0, 0], [0, 1, 0], [0, 0, 1]],
    [[0, 1, 0], [0, 0, 1], [1, 0, 0]],
    [[0, -1, 0], [0, 0, 1], [1, 0, 0]],
    [[0, 0, 1], [1, 0, 0], [0, 1, 0]],
    [[0, 0, -1], [1, 0, 0], [0, 1, 0]],
  ];
  const maxPunten = 6 * (N + 1) * (N + 1);
  const pos = new Float32Array(maxPunten * 3);
  const index = new Uint32Array(6 * N * N * 6);
  const randen = new Map();
  let p = 0, q = 0;
  const raster = new Uint32Array((N + 1) * (N + 1));
  for (const [n, u, v] of zijden) {
    const kruis = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const goedOm = kruis[0] * n[0] + kruis[1] * n[1] + kruis[2] * n[2] > 0;
    for (let j = 0; j <= N; j++) {
      for (let i = 0; i <= N; i++) {
        const a = -1 + (2 * i) / N, b = -1 + (2 * j) / N;
        const x = n[0] + u[0] * a + v[0] * b;
        const y = n[1] + u[1] * a + v[1] * b;
        const z = n[2] + u[2] * a + v[2] * b;
        const x2 = x * x, y2 = y * y, z2 = z * z;
        let sx = x * Math.sqrt(1 - y2 / 2 - z2 / 2 + (y2 * z2) / 3);
        let sy = y * Math.sqrt(1 - z2 / 2 - x2 / 2 + (z2 * x2) / 3);
        let sz = z * Math.sqrt(1 - x2 / 2 - y2 / 2 + (x2 * y2) / 3);
        const l = Math.hypot(sx, sy, sz);
        sx /= l; sy /= l; sz /= l;
        const rand = i === 0 || j === 0 || i === N || j === N;
        let id;
        if (rand) {
          const sleutel = Math.round(sx * 1e6) + ',' + Math.round(sy * 1e6) + ',' + Math.round(sz * 1e6);
          id = randen.get(sleutel);
          if (id === undefined) {
            id = p++;
            randen.set(sleutel, id);
            pos[id * 3] = sx; pos[id * 3 + 1] = sy; pos[id * 3 + 2] = sz;
          }
        } else {
          id = p++;
          pos[id * 3] = sx; pos[id * 3 + 1] = sy; pos[id * 3 + 2] = sz;
        }
        raster[j * (N + 1) + i] = id;
      }
    }
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const a = raster[j * (N + 1) + i], b = raster[j * (N + 1) + i + 1];
        const c = raster[(j + 1) * (N + 1) + i], d = raster[(j + 1) * (N + 1) + i + 1];
        if (goedOm) index.set([a, b, d, a, d, c], q);
        else index.set([a, d, b, a, c, d], q);
        q += 6;
      }
    }
  }
  return { dirs: pos.slice(0, p * 3), index };
}

onmessage = (e) => {
  const { id, soort } = e.data;
  if (soort === 'basis') {
    const { N, zaad, ruwheid } = e.data;
    if (!bollen.has(N)) bollen.set(N, maakBol(N));
    const bol = bollen.get(N);
    const ruis = maakRuis(zaad);
    const n = bol.dirs.length / 3;
    const cont = new Float32Array(n), kam = new Float32Array(n), fijn = new Float32Array(n), wieb = new Float32Array(n), nat = new Float32Array(n);
    const uit = [0, 0, 0];
    const d = bol.dirs;
    for (let i = 0; i < n; i++) {
      const x = d[i * 3], y = d[i * 3 + 1], z = d[i * 3 + 2];
      velden(ruis, ruwheid, x, y, z, uit);
      cont[i] = uit[0];
      kam[i] = uit[1];
      fijn[i] = uit[2];
      wieb[i] = wiebel(ruis, x, y, z);
      nat[i] = vocht(ruis, x, y, z);
    }
    const dirs = bol.dirs.slice(), index = bol.index.slice();
    postMessage({ id, dirs, index, cont, kam, fijn, wiebel: wieb, vocht: nat }, [dirs.buffer, index.buffer, cont.buffer, kam.buffer, fijn.buffer, wieb.buffer, nat.buffer]);
  } else if (soort === 'wolken') {
    const { B, H, zaad } = e.data;
    const ruis = maakRuis(zaad + '-wolken');
    const veld = new Float32Array(B * H);
    for (let yy = 0; yy < H; yy++) {
      const lat = (yy / H) * Math.PI;
      const sl = Math.sin(lat), cl = Math.cos(lat);
      for (let xx = 0; xx < B; xx++) {
        const lon = (xx / B) * Math.PI * 2;
        // Zelfde mapping als de bol in three.js, zodat de naad onzichtbaar is.
        veld[yy * B + xx] = ruis.lagen(-Math.cos(lon) * sl, cl * 2.2, Math.sin(lon) * sl, 5, 2.2);
      }
    }
    postMessage({ id, veld }, [veld.buffer]);
  }
};
