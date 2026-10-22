// Sterrenstof voor de geboorte, vuurwerk voor het feest, en de sterrenhemel.

import * as THREE from 'three';

export function maakSterren() {
  const aantal = 4000;
  const p = new Float32Array(aantal * 3);
  const kl = new Float32Array(aantal * 3);
  const c = new THREE.Color();
  const v = new THREE.Vector3();
  for (let i = 0; i < aantal; i++) {
    v.randomDirection().multiplyScalar(60 + Math.random() * 40);
    p.set([v.x, v.y, v.z], i * 3);
    c.setHSL(0.55 + Math.random() * 0.2, 0.4, 0.6 + Math.random() * 0.4);
    kl.set([c.r, c.g, c.b], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  g.setAttribute('color', new THREE.BufferAttribute(kl, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ size: 0.25, vertexColors: true, depthWrite: false }));
}

// Zacht rond lichtpuntje als textuur voor deeltjes.
let puntTex = null;
function punt() {
  if (puntTex) return puntTex;
  const d = document.createElement('canvas');
  d.width = d.height = 64;
  const ctx = d.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.8)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  puntTex = new THREE.CanvasTexture(d);
  return puntTex;
}

// Een wolkje gekleurd sterrenstof dat rondjes draait en bij elke tik feller wordt.
export class Sterrenstof {
  constructor() {
    const n = 900;
    this.n = n;
    this.basis = [];
    const p = new Float32Array(n * 3), kl = new Float32Array(n * 3);
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(0.08 + Math.random() ** 1.6 * 0.95);
      this.basis.push({ v, snel: 0.2 + Math.random() * 0.8, as: new THREE.Vector3().randomDirection() });
      c.setHSL(Math.random(), 0.7, 0.7);
      kl.set([c.r, c.g, c.b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    g.setAttribute('color', new THREE.BufferAttribute(kl, 3));
    this.punten = new THREE.Points(
      g,
      new THREE.PointsMaterial({ size: 0.09, map: punt(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    this.krimp = 1;
    this.doelKrimp = 1;
    this.t = 0;
  }
  tik(stap) {
    this.doelKrimp = [1, 0.7, 0.45, 0.25][stap] ?? 0.2;
    this.punten.material.size = 0.09 + stap * 0.03;
  }
  update(dt) {
    this.t += dt;
    this.krimp += (this.doelKrimp - this.krimp) * Math.min(1, dt * 4);
    const pos = this.punten.geometry.attributes.position;
    const tmp = new THREE.Vector3();
    for (let i = 0; i < this.n; i++) {
      const b = this.basis[i];
      tmp.copy(b.v).applyAxisAngle(b.as, this.t * b.snel).multiplyScalar(this.krimp * (1 + Math.sin(this.t * 2 + i) * 0.04));
      pos.setXYZ(i, tmp.x, tmp.y, tmp.z);
    }
    pos.needsUpdate = true;
  }
  opruimen() {
    this.punten.geometry.dispose();
    this.punten.material.dispose();
  }
}

// Vuurwerk: knallen rond de planeet.
export class Vuurwerk {
  constructor(scene) {
    this.scene = scene;
    this.knallen = [];
  }
  knal(plek, kleurHex, { aantal = 160, grootte = 0.2, kracht = 1 } = {}) {
    const n = aantal;
    const p = new Float32Array(n * 3);
    const snel = [];
    for (let i = 0; i < n; i++) {
      p.set([plek.x, plek.y, plek.z], i * 3);
      snel.push(new THREE.Vector3().randomDirection().multiplyScalar((0.5 + Math.random() * 0.7) * kracht));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const m = new THREE.PointsMaterial({ size: grootte, map: punt(), color: kleurHex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const punten = new THREE.Points(g, m);
    this.scene.add(punten);
    this.knallen.push({ punten, snel, leeftijd: 0 });
  }
  update(dt) {
    for (const k of this.knallen) {
      k.leeftijd += dt;
      const pos = k.punten.geometry.attributes.position;
      for (let i = 0; i < k.snel.length; i++) {
        const s = k.snel[i];
        pos.setXYZ(i, pos.getX(i) + s.x * dt, pos.getY(i) + s.y * dt, pos.getZ(i) + s.z * dt);
        s.multiplyScalar(1 - dt * 1.2);
      }
      pos.needsUpdate = true;
      k.punten.material.opacity = Math.max(0, 1 - k.leeftijd / 1.8);
    }
    this.knallen = this.knallen.filter((k) => {
      if (k.leeftijd < 1.8) return true;
      this.scene.remove(k.punten);
      k.punten.geometry.dispose();
      k.punten.material.dispose();
      return false;
    });
  }
}
