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
  'bouw-hol', 'bouw-hut', 'bouw-koraal', 'bouw-iglo', 'bouw-huis', 'bouw-fabriek', 'bouw-vuur', 'bouw-akker',
];
const BESCHIKBAAR = new Set(LIJST);

export function icoon(id, emoji, klasse = 'ico') {
  return BESCHIKBAAR.has(id) ? `<img class="${klasse}" src="./kunst/iconen/${id}.webp" alt="${emoji || ''}" draggable="false">` : emoji || '';
}
