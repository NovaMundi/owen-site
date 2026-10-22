// Getekende icoontjes (gemaakt met Higgsfield, bewerkt met tools/vrijstaand.mjs, in kunst/iconen/).
// Alles in één zachte "klei-speelgoed"-stijl. Wat nog geen plaatje heeft, toont gewoon de emoji.

const LIJST = [
  // gereedschap
  'grond', 'water', 'kleur', 'hamer', 'kwast', 'lucht', 'klimaat', 'bos', 'wezens', 'ruimte', 'naam', 'feest', 'wens', 'verhaal',
  // bomen en vormen
  'boom-den', 'boom-bol', 'boom-palm', 'boom-paddenstoel', 'boom-kristal',
  'vorm-heuvels', 'vorm-bergen', 'vorm-pieken', 'vorm-vlak', 'vorm-kraters',
  // bewegen en vacht
  'beweeg-lopen', 'beweeg-huppen', 'beweeg-zwemmen', 'beweeg-vliegen', 'beweeg-zweven',
  'huid-veren', 'huid-pluizig', 'huid-harig', 'huid-schubben', 'huid-glad', 'huid-pantser', 'huid-stekels',
  'maat-mier', 'maat-hond', 'maat-olifant', 'maat-reus',
  // knoppen
  'ui-teken', 'ui-slot', 'ui-tover', 'ui-krijt', 'ui-bezoek', 'ui-luister', 'ui-weg', 'ui-huis', 'ui-stem', 'ui-oeps', 'ui-wolk', 'ui-prullenbak',
  // bouwwerken (ook voorbeeld voor de 3D-vormen)
  'kies-regen', 'kies-bliksem', 'kies-boom', 'kies-museum', 'kies-stickers', 'kies-cadeau',
  'bouw-hol', 'bouw-hut', 'bouw-koraal', 'bouw-iglo', 'bouw-huis', 'bouw-fabriek', 'bouw-vuur', 'bouw-akker',
  // ontdekkingen (en de eigen paden van zee en lucht)
  'tech-nesten', 'tech-stokken', 'tech-taal', 'tech-vuur', 'tech-vissen', 'tech-boten', 'tech-wiel', 'tech-metaal', 'tech-schrift', 'tech-kristal',
  'tech-sterren', 'tech-machines', 'tech-stroom', 'tech-schoon',
  'tech-zee-vuur', 'tech-zee-wiel', 'tech-zee-landbouw', 'tech-zee-machines', 'tech-lucht-hutten', 'tech-lucht-boten', 'tech-lucht-wiel',
  // wat de wezens aan het doen zijn
  'act-eten', 'act-slapen', 'act-bidden',
];
const BESCHIKBAAR = new Set(LIJST);

// Icoon voor een ontdekking, passend bij de soort: zeewezens en vliegers hebben hun eigen pad.
// Waar al een passend plaatje bestaat, wordt dat gebruikt (hutten = het hutje, raket = de raket).
const ZELFDE = { 'tech-hutten': 'bouw-hut', 'tech-landbouw': 'bouw-akker', 'tech-raket': 'feest', 'tech-zee-hutten': 'bouw-koraal' };
export function techIcoon(id, soort, emoji, klasse = 'ico') {
  const rijk = soort?.beweging === 'zwemmen' ? 'zee' : soort?.beweging === 'vliegen' ? 'lucht' : null;
  const kandidaten = [];
  if (id === 'vuur' && soort?.vlaggen?.gloed) kandidaten.push('tech-kristal');
  if (rijk) kandidaten.push(`tech-${rijk}-${id}`);
  kandidaten.push(`tech-${id}`);
  for (const k of kandidaten) {
    const plaatje = ZELFDE[k] || k;
    if (BESCHIKBAAR.has(plaatje)) return icoon(plaatje, emoji, klasse);
  }
  return emoji || '';
}

export function icoon(id, emoji, klasse = 'ico') {
  return BESCHIKBAAR.has(id) ? `<img class="${klasse}" src="./kunst/iconen/${id}.webp" alt="${emoji || ''}" draggable="false">` : emoji || '';
}
