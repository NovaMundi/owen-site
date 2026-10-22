// Bewaren op dit apparaat.
//
// De kleine dingen (keuzes, namen, de wereld) staan in localStorage. Plaatjes en geluiden zijn
// groot, en localStorage is klein (een paar MB): die raakte stil vol. Daarom gaan plaatjes en
// geluiden naar IndexedDB, waar veel meer in past. In localStorage staat dan alleen een korte
// verwijzing 'm:<code>'. Dezelfde tekening wordt maar één keer bewaard, hoe vaak hij ook voorkomt
// (in de oeps-geschiedenis, de prullenbak...).
//
// Bij het opstarten laden we alle plaatjes in het geheugen. Daarna werken lees() en schrijf()
// meteen, net als vroeger. Lukt IndexedDB niet (privévenster), dan gaat alles zoals vroeger.

// Testomgeving (?sandbox=1): alles in eigen laatjes, zodat testen nooit de echte planeten raakt.
export const SANDBOX = new URLSearchParams(location.search).has('sandbox');
export const sleutel = (k) => (SANDBOX ? 'zandbak-' + k : k);

const DB = 'planeetmakers-media';
const WINKEL = 'media';
const GROOT = 300; // korter dan dit is geen plaatje of geluid
const cache = new Map(); // code -> data-URL
const bekend = new Map(); // data-URL -> code (scheelt steeds opnieuw uitrekenen)
let db = null;

function openDb() {
  return new Promise((ok, mis) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(WINKEL);
    r.onsuccess = () => ok(r.result);
    r.onerror = () => mis(r.error);
    r.onblocked = () => mis(new Error('geblokkeerd'));
  });
}

// Alle verwijzingen die nog ergens in localStorage staan.
function gebruikteCodes() {
  const codes = new Set();
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !(k.startsWith('planeetmakers') || k.startsWith('zandbak-planeetmakers'))) continue;
    for (const m of (localStorage.getItem(k) || '').matchAll(/"m:([a-z0-9]+)"/g)) codes.add(m[1]);
  }
  return codes;
}

// Hooguit 3 seconden wachten op IndexedDB; daarna gewoon door zonder (nooit een zwart scherm).
const binnen = (p, ms) => Promise.race([p, new Promise((_, mis) => setTimeout(() => mis(new Error('te traag')), ms))]);
export const mediaKlaar = (async () => {
  if (!('indexedDB' in window)) return;
  try {
    db = await binnen(openDb(), 3000);
    await binnen(new Promise((ok) => {
      const req = db.transaction(WINKEL).objectStore(WINKEL).openCursor();
      req.onsuccess = () => {
        const c = req.result;
        if (!c) return ok();
        cache.set(c.key, c.value);
        c.continue();
      };
      req.onerror = () => ok();
    }), 8000);
    // Opruimen: plaatjes waar niets meer naar verwijst (weggegooide wezens van lang geleden).
    const nodig = gebruikteCodes();
    const weg = [...cache.keys()].filter((c) => !nodig.has(c));
    if (weg.length) {
      const st = db.transaction(WINKEL, 'readwrite').objectStore(WINKEL);
      for (const c of weg) {
        st.delete(c);
        cache.delete(c);
      }
    }
  } catch {
    // Lukt het niet (op tijd), dan alles zoals vroeger in localStorage. Er wordt dan ook niets
    // opgeruimd, dus er raakt niets kwijt.
    db = null;
  }
})();

// Snelle vingerafdruk van een lange tekst (cyrb53).
function code(t) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < t.length; i++) {
    const ch = t.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36) + t.length.toString(36);
}

// Pas een verwijzing teruggeven als het plaatje echt in IndexedDB staat (transactie klaar).
// Tot dan blijft het plaatje gewoon zelf in localStorage staan: zo raakt er nooit iets kwijt,
// ook niet als de tablet de app net op dat moment sluit.
const onderweg = new Set();
function bewaarMedia(t) {
  let c = bekend.get(t);
  if (!c) {
    c = code(t);
    if (bekend.size > 400) bekend.clear();
    bekend.set(t, c);
  }
  if (cache.has(c)) return 'm:' + c;
  if (!onderweg.has(c)) {
    onderweg.add(c);
    try {
      const tx = db.transaction(WINKEL, 'readwrite');
      tx.objectStore(WINKEL).put(t, c);
      tx.oncomplete = () => {
        cache.set(c, t);
        onderweg.delete(c);
      };
      tx.onerror = tx.onabort = () => onderweg.delete(c);
    } catch {
      onderweg.delete(c);
    }
  }
  return t;
}

function naarRef(v) {
  if (typeof v === 'string') return db && v.length > GROOT && v.startsWith('data:') ? bewaarMedia(v) : v;
  if (Array.isArray(v)) return v.map(naarRef);
  if (v && typeof v === 'object') {
    const uit = {};
    for (const [k, x] of Object.entries(v)) uit[k] = naarRef(x);
    return uit;
  }
  return v;
}

function vanRef(v) {
  if (typeof v === 'string') return v.startsWith('m:') && cache.has(v.slice(2)) ? cache.get(v.slice(2)) : v;
  if (Array.isArray(v)) return v.map(vanRef);
  if (v && typeof v === 'object') {
    for (const k of Object.keys(v)) v[k] = vanRef(v[k]);
    return v;
  }
  return v;
}

// Staat er ergens een verwijzing naar een plaatje dat er niet (meer) is? Zo'n planeet sturen we
// niet naar de wolk, anders raken de andere apparaten dat wezen kwijt.
export function heeftGaten(v) {
  if (typeof v === 'string') return v.startsWith('m:') && v.length < 40;
  if (Array.isArray(v)) return v.some(heeftGaten);
  if (v && typeof v === 'object') return Object.values(v).some(heeftGaten);
  return false;
}

export function lees(naam, standaard) {
  try {
    const v = JSON.parse(localStorage.getItem(sleutel(naam)));
    return v == null ? standaard : vanRef(v);
  } catch {
    return standaard;
  }
}

export function schrijf(naam, waarde) {
  try {
    if (waarde == null) localStorage.removeItem(sleutel(naam));
    else localStorage.setItem(sleutel(naam), JSON.stringify(naarRef(waarde)));
    return true;
  } catch {
    return false;
  }
}
