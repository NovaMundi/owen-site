// Alle keuzes in de Planeetmaker. Teksten zijn kindertaal en worden voorgelezen.

export const MAKERS = [
  { id: 'owen', naam: 'Owen' },
  { id: 'jake', naam: 'Jake' },
  { id: 'papa', naam: 'Papa' },
];
// Elke speler heeft drie planeetplekken: de eerste heet gewoon zoals de speler (zo bleven de
// planeten van vóór de plekken op hun plaats), de andere twee owen-2 en owen-3.
export const PLEKKEN = 3;
export const plekkenVan = (speler) => [speler, ...Array.from({ length: PLEKKEN - 1 }, (_, i) => `${speler}-${i + 2}`)];
export const spelerVan = (planeetId) => String(planeetId || '').split('-')[0];
export const plekNummer = (planeetId) => Number(String(planeetId).split('-')[1] || 1);
export const ALLE_PLANEETIDS = MAKERS.flatMap((m) => plekkenVan(m.id));

export const GEREEDSCHAP = [
  { id: 'grond', icoon: '🪨', label: 'Vorm', zeg: 'Hoe groot wordt je planeet? En wat voor grond krijgt hij? Bergen, heuvels of kraters?' },
  { id: 'water', icoon: '💧', label: 'Water', zeg: 'Houd de grote knop ingedrukt om water op je planeet te gieten. Welke kleur krijgt je zee?' },
  { id: 'kleur', icoon: '🎨', label: 'Kleuren', zeg: 'Welke kleuren krijgt de grond van je planeet?' },
  { id: 'hamer', icoon: '🔨', label: 'Boetseren', zeg: 'Veeg met je vinger over je planeet. Zo maak je bergen of graaf je kuilen!' },
  { id: 'kwast', icoon: '🖌️', label: 'Verven', zeg: 'Kies een kleur en verf met je vinger op je planeet.' },
  { id: 'lucht', icoon: '☁️', label: 'Lucht', zeg: 'Welke kleur heeft de lucht? Is je planeet droog of nat? En is het er stormachtig? Het weer wisselt vanzelf, net als echt.' },
  { id: 'klimaat', icoon: '🌡️', label: 'Klimaat', zeg: 'Is je planeet warm of koud? Zijn er seizoenen met winter en zomer? En zijn er woestijnen? Dat maakt veel uit voor je wezens!' },
  { id: 'bos', icoon: '🌳', label: 'Bossen', zeg: 'Laat er bossen groeien! Je mag meerdere soorten bomen kiezen. Elke boom groeit waar hij het fijnst vindt.' },
  { id: 'wezens', icoon: '🐾', label: 'Wezens', zeg: 'Teken je eigen wezen! Daarna komt hij tot leven op je planeet.' },
  { id: 'ruimte', icoon: '🪐', label: 'Ring en manen', zeg: 'Krijgt je planeet een ring? En hoeveel manen draaien eromheen?' },
  { id: 'naam', icoon: '⭐', label: 'Naam', zeg: 'Hoe heet jouw planeet? Is hij klaar? Druk dan op de feestknop!' },
  { id: 'wens', icoon: '🎤', label: 'Wens', verborgen: true, zeg: 'Wil je iets wat er nog niet is? Druk op de rode knop en vertel het aan papa!' },
  { id: 'verhaal', icoon: '📜', label: 'Verhaal', verborgen: true, zeg: 'Dit is het verhaal van jouw planeet. Kijk wat je wezens allemaal hebben meegemaakt!' },
];

export const VORMEN = [
  { id: 'heuvels', icoon: '🌄', label: 'Heuvels', zet: { bergen: 0.3, ruwheid: 0.3, kraters: 0 } },
  { id: 'bergen', icoon: '⛰️', label: 'Bergen', zet: { bergen: 0.7, ruwheid: 0.5, kraters: 0 } },
  { id: 'pieken', icoon: '🏔️', label: 'Reuzenpieken', zet: { bergen: 1, ruwheid: 0.95, kraters: 0 } },
  { id: 'vlak', icoon: '🏝️', label: 'Plat', zet: { bergen: 0.08, ruwheid: 0.15, kraters: 0 } },
  { id: 'kraters', icoon: '🌑', label: 'Kraters', zet: { bergen: 0.4, ruwheid: 0.5, kraters: 0.8 } },
];

export const WATER = [
  { label: 'Blauw', kleur: '#1f6fd1' },
  { label: 'Turquoise', kleur: '#14c4c0' },
  { label: 'Slijm', kleur: '#6fe03a' },
  { label: 'Limonade', kleur: '#ff5fb0' },
  { label: 'Chocola', kleur: '#6b3a1e' },
  { label: 'Paars', kleur: '#8a3dff' },
  { label: 'Goud', kleur: '#ffc21a' },
  { label: 'Melk', kleur: '#f4f1ea' },
  { label: 'Lava', kleur: '#ff5a10', gloeit: true },
];

export const THEMAS = [
  { label: 'Gras', grond: { strand: '#e8d9a8', laag: '#5aa83f', midden: '#2f7a2c', hoog: '#7a6a58', top: '#f4f4f4' } },
  { label: 'Woestijn', grond: { strand: '#f3dfa9', laag: '#e4b86c', midden: '#cf8a46', hoog: '#a65a2e', top: '#7a3d22' } },
  { label: 'Herfst', grond: { strand: '#e9cf9a', laag: '#e08a2c', midden: '#c2471f', hoog: '#7d3b26', top: '#ffd34d' } },
  { label: 'Snoep', grond: { strand: '#fff1c9', laag: '#9be37a', midden: '#ffd166', hoog: '#c38bff', top: '#ffffff' } },
  { label: 'Vulkaan', grond: { strand: '#3a2a24', laag: '#2b211e', midden: '#1c1716', hoog: '#3d3330', top: '#ff6a2a' } },
  { label: 'IJs', grond: { strand: '#cfe9f2', laag: '#a9cfe0', midden: '#8fb4cf', hoog: '#d9ecf7', top: '#ffffff' } },
  { label: 'Regenboog', grond: { strand: '#ff4d4d', laag: '#ffb83d', midden: '#4cd964', hoog: '#3fa9ff', top: '#b06bff' } },
  { label: 'Neon', grond: { strand: '#1b1035', laag: '#2a1a5e', midden: '#00e5ff', hoog: '#ff2bd6', top: '#faff00' } },
  { label: 'Steen', grond: { strand: '#8d8a86', laag: '#77736f', midden: '#625e5a', hoog: '#8a8580', top: '#b5b0aa' } },
];

export const VERF = [
  '#ff3b30', '#ff9500', '#ffcc00', '#4cd964', '#1e8f3a', '#5ac8fa',
  '#007aff', '#5856d6', '#ff2d92', '#a2845e', '#ffffff', '#1c1c1e',
];

export const LUCHT = [
  { label: 'Blauw', kleur: '#6fb8ff' },
  { label: 'Roze', kleur: '#ff8fd8' },
  { label: 'Oranje', kleur: '#ff9a3a' },
  { label: 'Groen', kleur: '#6dff9a' },
  { label: 'Paars', kleur: '#a77bff' },
  { label: 'Goud', kleur: '#ffd96b' },
  { label: 'Rood', kleur: '#ff4a3a' },
  { label: 'Wit', kleur: '#e8f0ff' },
];

export const WOLKEN = [
  { label: 'Wit', kleur: '#ffffff' },
  { label: 'Roze suikerspin', kleur: '#ffc4ea' },
  { label: 'Grijs onweer', kleur: '#8a8f99' },
  { label: 'Goud', kleur: '#ffe08a' },
  { label: 'Groen gif', kleur: '#b8ff7a' },
  { label: 'Paars', kleur: '#c9a8ff' },
];

export const BOMEN = [
  { id: 'den', icoon: '🌲', label: 'Dennen' },
  { id: 'bol', icoon: '🌳', label: 'Bolbomen' },
  { id: 'palm', icoon: '🌴', label: 'Palmen' },
  { id: 'paddenstoel', icoon: '🍄', label: 'Paddenstoelen' },
  { id: 'kristal', icoon: '💎', label: 'Kristallen' },
];

export const BOOMKLEUREN = ['#2e8b3a', '#7ad04a', '#1e5a2a', '#e8483a', '#ff9de0', '#ffd23a', '#5ab8ff', '#b06bff', '#ffffff', '#ff7a1a'];

export const MAANKLEUREN = ['#c9c9c9', '#e8d6a8', '#b07a5a', '#8ad0ff', '#ff9de0', '#9cff8a', '#ffd23a', '#6a5a8a'];

export const RINGKLEUREN = ['#d8c9a3', '#bfe8ff', '#ff9de0', '#ffd23a', '#9cff8a', '#c9a8ff', '#ff6a3a', '#ffffff'];

// ---------- Wezens ----------
export const TEKENKLEUREN = [
  '#1c1c1e', '#ffffff', '#ff3b30', '#ff9500', '#ffcc00', '#4cd964', '#1e8f3a',
  '#5ac8fa', '#007aff', '#5856d6', '#ff2d92', '#a2845e', '#f5c6a5', '#8e8e93',
];

export const BEWEGINGEN = [
  { id: 'lopen', icoon: '🚶', label: 'Lopen', zeg: 'Hij loopt over de grond.' },
  { id: 'huppen', icoon: '🐸', label: 'Huppen', zeg: 'Hij huppelt rond!' },
  { id: 'zwemmen', icoon: '🐟', label: 'Zwemmen', zeg: 'Hij zwemt in de zee.' },
  { id: 'vliegen', icoon: '🦅', label: 'Vliegen', zeg: 'Hij vliegt door de lucht!' },
  { id: 'zweven', icoon: '👻', label: 'Zweven', zeg: 'Hij zweeft een beetje boven de grond.' },
];

export const MATEN = [
  { id: 'mier', icoon: '🐜', label: 'Piepklein', maat: 0.006 },
  { id: 'hond', icoon: '🐕', label: 'Gewoon', maat: 0.014 },
  { id: 'olifant', icoon: '🐘', label: 'Groot', maat: 0.03 },
  { id: 'reus', icoon: '🦖', label: 'Reus', maat: 0.07 },
];

export const AANTALLEN = [1, 3, 10, 30];

// Vacht of huid: zie je niet aan een tekening, maar maakt veel uit als hij "echt" wordt.
export const HUIDEN = [
  { id: 'veren', icoon: '🪶', label: 'Veren' },
  { id: 'pluizig', icoon: '🐣', label: 'Pluizig' },
  { id: 'harig', icoon: '🦁', label: 'Vacht' },
  { id: 'schubben', icoon: '🐍', label: 'Schubben' },
  { id: 'glad', icoon: '🐸', label: 'Glad' },
  { id: 'pantser', icoon: '🐢', label: 'Pantser' },
  { id: 'stekels', icoon: '🦔', label: 'Stekels' },
];

// Rare namen verzinnen
const BEGIN = ['Zor', 'Bli', 'Kwa', 'Lu', 'Mo', 'Tri', 'Pim', 'Gal', 'Xa', 'Ro', 'Fli', 'Nu', 'Spro', 'Ka', 'Wub', 'Zi'];
const MIDDEN = ['', '', 'ra', 'lo', 'mi', 'ba', 'ze', 'ku'];
const EIND = ['tron', 'lix', 'bo', 'zia', 'mus', 'nox', 'pie', 'tar', 'ion', 'bel', 'ox', 'ka'];
export function verzinNaam() {
  const p = (l) => l[Math.floor(Math.random() * l.length)];
  let naam = p(BEGIN) + p(MIDDEN) + p(EIND);
  if (Math.random() < 0.35) naam += ' ' + (2 + Math.floor(Math.random() * 98));
  return naam;
}
