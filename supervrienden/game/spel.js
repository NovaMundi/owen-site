/* Supervrienden en het geheim van de baas, spellogica.
 *
 * Gewoon script, geen module: de jongens openen het spel als los bestand en op
 * file:// weigert de browser modules.
 *
 * Opzet in drie lussen:
 *   per minuut  - de tocht: zoeken in de jungle met een rugzak die vol raakt
 *   per sessie  - het dorp: eieren uitbroeden en met glimstenen bouwen
 *   over weken  - het boek vol krijgen en de zes geheimen vinden
 */

/* Het dorp van Owen en Jake staat hier. Eén sleutel, één wereld.
 *
 * Papa ontwikkelt door terwijl zij spelen, en elke testopstelling begint met een vers
 * spel. Daarom slaat een testsessie op in een eigen sleutel: wat zij hebben opgebouwd
 * wordt dan nooit overschreven, hoe vaak er ook getest wordt. Je ziet linksboven in beeld
 * in welke wereld je zit. */
var ECHTE_OPSLAG = 'supervrienden-spel-v3';   // het oude ene spel, zie verhuisOudSpel()
var TEST_OPSLAG = 'supervrienden-test-v3';
var IN_TESTWERELD = /[?&](test=|opnieuwtest)/.test(location.search);
var OPSLAG = IN_TESTWERELD ? TEST_OPSLAG : ECHTE_OPSLAG;

/* Drie opslagplekken, zoals vroeger op een spelcomputer. Owen kan een eigen spel hebben,
 * Jake ook, en daarnaast spelen ze er samen een. Welke plek je gekozen hebt bepaalt waar
 * `bewaar()` naartoe schrijft; in de testwereld is er maar één plek, want daar hoeft niets
 * bewaard te blijven. */
var SLOT_SLEUTEL = 'supervrienden-plek-';
var LAATSTE_SLOT = 'supervrienden-laatste-plek';
var AANTAL_SLOTS = 3;
var huidigSlot = null;

function slotSleutel(nr) { return SLOT_SLEUTEL + nr; }

function kiesSlot(nr) {
  huidigSlot = nr;
  OPSLAG = slotSleutel(nr);
  try { localStorage.setItem(LAATSTE_SLOT, String(nr)); } catch (e) {}
}

function leesSlot(nr) {
  try {
    var rauw = localStorage.getItem(slotSleutel(nr));
    if (!rauw) return null;
    var s = JSON.parse(rauw);
    return (s && typeof s === 'object') ? s : null;
  } catch (e) { return null; }
}

function wisSlot(nr) {
  try { localStorage.removeItem(slotSleutel(nr)); } catch (e) {}
}

/* Het spel had eerst één wereld. Die staat nog onder de oude sleutel, en daar hebben ze
 * weken aan gebouwd. Bij de eerste start met opslagplekken verhuist hij naar plek 1 als
 * samen-spel. De oude sleutel blijft staan, voor het geval er iets misgaat. */
function verhuisOudSpel() {
  try {
    if (localStorage.getItem(slotSleutel(1))) return false;
    var oud = localStorage.getItem(ECHTE_OPSLAG);
    if (!oud) return false;
    var s = JSON.parse(oud);
    if (!s || !Array.isArray(s.wezens)) return false;
    s.wie = 'samen';
    s.plekNaam = 'Owen en Jake';
    localStorage.setItem(slotSleutel(1), JSON.stringify(s));
    return true;
  } catch (e) { return false; }
}

/* Wie speelt er op deze plek? 'owen', 'jake' of 'samen'. In een spel in je eentje zijn
 * beide plekken in het team van hetzelfde kind: je vecht nog steeds met twee wezens, want
 * daar hangt alles aan (het schild van een Wachter breekt alleen als er twee slaan, en de
 * supervriendenbonus ook). Alleen de namen eronder veranderen. */
function samenSpelen() { return !spel || !spel.wie || spel.wie === 'samen'; }

function hetKind() {
  var k = SPELERS.filter(function (s) { return s.id === spel.wie; })[0];
  return k || SPELERS[0];
}

function spelerVan(id) {
  var basis = SPELERS.filter(function (s) { return s.id === id; })[0] || SPELERS[0];
  if (samenSpelen()) return { id: basis.id, naam: basis.naam, emoji: basis.emoji, kleur: basis.id };
  var k = hetKind();
  return { id: id, naam: k.naam, emoji: k.emoji, kleur: k.id,
           plek: id === 'owen' ? 1 : 2, alleen: true };
}

function plekOmschrijving(s) {
  if (!s) return 'Leeg';
  if (s.wie === 'owen') return 'Owen alleen';
  if (s.wie === 'jake') return 'Jake alleen';
  return 'Owen en Jake samen';
}

/* Vóór iets wist, gaat er eerst een kopie opzij. Een spel van weken mag niet verdwijnen
 * door één verkeerd webadres. Er blijven er drie staan, oudste valt af. */
var VEILIG_VOOR = 'supervrienden-kopie-';

function legOpzij(reden, meegegeven) {
  try {
    // zonder tweede argument gaat het om het oude ene spel; met, om een opslagplek
    var rauw = meegegeven != null ? meegegeven : localStorage.getItem(ECHTE_OPSLAG);
    if (!rauw) return;
    localStorage.setItem(VEILIG_VOOR + Date.now(), JSON.stringify({
      reden: reden || 'onbekend', wanneer: new Date().toISOString(), spel: rauw
    }));
    var kopieen = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf(VEILIG_VOOR) === 0) kopieen.push(k);
    }
    kopieen.sort();
    while (kopieen.length > 3) localStorage.removeItem(kopieen.shift());
  } catch (e) {}
}

var SPELERS = [
  { id: 'owen', naam: 'Owen', emoji: '\u{1F49A}' },
  { id: 'jake', naam: 'Jake', emoji: '\u{1F9E1}' }
];

/* Vuur wint van plant, plant van water, water van vuur, bliksem van alles wat nat is. */
/* Een echte cirkel: ieder element verslaat er precies één en verliest van precies één.
 * Het was eerst vuur→plant→water→vuur met bliksem→water erbuiten. Bliksem kon daardoor
 * nooit verliezen en de eerste baas in de Diepte (die is van bliksem) was niet te
 * counteren. Vier op vier is bovendien makkelijker te onthouden dan een driehoek met een
 * losse vierde. */
var STERK = { vuur: 'plant', plant: 'water', water: 'bliksem', bliksem: 'vuur' };

// namen voor de wilde wezens die je onderweg tegenkomt; die gaan weer even hard weg
var WILDE_NAMEN = [
  'Knauw', 'Brompoot', 'Sliertje', 'Grommel', 'Takkebek', 'Modderkop',
  'Snuifel', 'Klauwtje', 'Zoemer', 'Rotsbek', 'Spikkel', 'Dreun',
  'Krabbel', 'Puffel', 'Schorre', 'Tandje'
];

/* Wezens die de jongens houden krijgen een naam die bij ze past, en nooit twee keer
 * dezelfde. Het eerste stuk komt van het element, het tweede van waar hij mee slaat of
 * wat hij extra heeft. Zo heet een vuurwezen met klauwen bijvoorbeeld Vlamklauw, en is
 * de naam al een hint over wat hij kan. Ze mogen hem altijd zelf overschrijven. */
var NAAM_VOOR = {
  vuur:    ['Vlam', 'Vonk', 'Gloei', 'Smeul', 'Brand', 'Roet'],
  water:   ['Drup', 'Plons', 'Golf', 'Mist', 'Spat', 'Bries'],
  plant:   ['Mos', 'Blad', 'Twijg', 'Wortel', 'Knop', 'Varen'],
  bliksem: ['Flits', 'Knetter', 'Zoem', 'Schok', 'Tintel', 'Bliep']
};
var NAAM_ACHTER = {
  poten: {
    hoef: ['hoef', 'draf'],      klauw: ['klauw', 'krab'],   stomp: ['poot', 'stomp'],
    spring: ['spring', 'wip'],   insect: ['spriet', 'tik'],  tentakel: ['slinger', 'zwiep'],
    robot: ['bout', 'veer'],     steen: ['rots', 'blok']
  },
  extra: {
    staart: ['staart', 'zwaai'], hoorns: ['hoorn', 'stoot'], oren: ['oor', 'flap'],
    kam: ['kam', 'stekel'],      antenne: ['tast', 'piep'],  vleugels: ['vleugel', 'wiek'],
    bol: ['zweef', 'bal'],       kristalvleugels: ['glans', 'schicht']
  }
};

// alle namen die al vergeven zijn, zodat er geen twee Vlamklauwen rondlopen
function namenInGebruik() {
  var bezet = {};
  (spel.wezens || []).forEach(function (w) {
    if (w.naam) bezet[w.naam.toLowerCase()] = true;
  });
  return bezet;
}

function verzinNaam(w, ookBezet) {
  var voor = NAAM_VOOR[w.element] || NAAM_VOOR.vuur;
  var achter = (NAAM_ACHTER.poten[w.poten] || []).concat(NAAM_ACHTER.extra[w.extra] || []);
  if (!achter.length) achter = ['beest'];

  var bezet = namenInGebruik();
  (ookBezet || []).forEach(function (n) { if (n) bezet[n.toLowerCase()] = true; });

  var vrij = [];
  voor.forEach(function (v) {
    achter.forEach(function (a) { if (!bezet[(v + a).toLowerCase()]) vrij.push(v + a); });
  });
  if (vrij.length) return kies(vrij);

  /* Alle combinaties voor dit soort wezen zijn op. Liever een nummer erachter dan twee
   * wezens met exact dezelfde naam, want dan weten ze niet meer wie wie is. */
  var basis = kies(voor) + kies(achter);
  for (var n = 2; n < 99; n++) {
    if (!bezet[(basis + ' ' + n).toLowerCase()]) return basis + ' ' + n;
  }
  return basis;
}

var HINTS = [
  'Een kras in een boom. Het lijkt wel een deur.',
  'Een veer. Maar dan van metaal.',
  'Hele grote voetstappen. En dan ineens niet meer.',
  'Een stukje van een kaart, met een kruisje erop.',
  'Een geluid uit de grond. Alsof er iets ademt.',
  'Een sleutel van steen. Hij past nergens op. Of toch?'
];

/* Het schatei komt alleen uit de diepte. Het garandeert minstens één zeldzaam of beter
 * onderdeel, en hoe dieper je komt hoe groter de kans op iets legendarisch. */
var SCHAT_EI = {
  naam: 'Schatei', warmte: 20, minimaal: 'zeldzaam',
  rangen: { gewoon: 4, ongewoon: 16, zeldzaam: 34, superzeldzaam: 30, legendarisch: 16 }
};

/* Eieren. Zeldzamer ei betekent langer warmhouden en een sterker wezen.
 * De warmte komt van zoekacties, niet van de klok. */
/* Wat voor ei je uitbroedt bepaalt niet een los bonusgetal, maar hoe zeldzaam de
 * onderdelen van het wezen zijn. Zo loopt alle kracht via één systeem: de rang. */
var EISOORTEN = {
  gewoon:    { naam: 'Gewoon ei',        warmte: 4,
               rangen: { gewoon: 62, ongewoon: 28, zeldzaam: 8,  superzeldzaam: 2,  legendarisch: 0 } },
  zeldzaam:  { naam: 'Zeldzaam ei',      warmte: 9,
               rangen: { gewoon: 25, ongewoon: 38, zeldzaam: 25, superzeldzaam: 10, legendarisch: 2 } },
  schat:     SCHAT_EI,
  bijzonder: { naam: 'Heel bijzonder ei', warmte: 16,
               rangen: { gewoon: 6,  ongewoon: 20, zeldzaam: 34, superzeldzaam: 28, legendarisch: 12 } }
};

/* Wilde wezens worden gevaarlijker én interessanter naarmate je verder weg gaat.
 * In de grotten zie je onderdelen die je zelf misschien nog niet hebt. */
var ZONE_RANGEN = [
  { gewoon: 70, ongewoon: 24, zeldzaam: 6,  superzeldzaam: 0,  legendarisch: 0 },
  { gewoon: 35, ongewoon: 38, zeldzaam: 20, superzeldzaam: 6,  legendarisch: 1 },
  { gewoon: 12, ongewoon: 28, zeldzaam: 33, superzeldzaam: 21, legendarisch: 6 }
];

/* De diepte. Elke Wachter wordt opgebouwd uit echte onderdelen, net als elk ander wezen,
 * alleen groter en uit zeldzamere delen naarmate je dieper komt. Eerst was het elke keer
 * precies dezelfde sprite met andere cijfers, en dan is verdieping zeven hetzelfde plaatje
 * als verdieping twee. Bijkomend voordeel: je ziet legendarische onderdelen op een Wachter
 * staan voordat je ze zelf ooit hebt gehad. */
var BAAS_ELEMENTEN = ['bliksem', 'water', 'plant', 'vuur'];

/* Zijn naam komt van zijn eigen kop, zodat de naam klopt met wat je ziet staan. */
var WACHTER_TITELS = {
  kikker: 'Kwaak', hagedis: 'Schub', schildpad: 'Schild', wolf: 'Wolf', vogel: 'Veder',
  kever: 'Kever', robot: 'IJzer', kristal: 'Kristal', vis: 'Diep', uil: 'Nacht',
  haai: 'Haai', lava: 'Lava', ijs: 'IJs', draak: 'Draken', ster: 'Sterren'
};

/* Hoe dieper, hoe zeldzamer zijn onderdelen. Bij verdieping 7 is hij bijna helemaal
 * legendarisch. */
function baasRangen(niveau) {
  var t = Math.min(1, (niveau - 1) / 6);
  return {
    gewoon:        Math.max(0, Math.round(30 - 30 * t)),
    ongewoon:      Math.round(34 - 22 * t),
    zeldzaam:      Math.round(26 - 4 * t),
    superzeldzaam: Math.round(8 + 22 * t),
    legendarisch:  Math.round(2 + 34 * t)
  };
}

function maakWachter(niveau) {
  var w = wezenUitRangen(baasRangen(niveau), '', niveau >= 3 ? 'zeldzaam' : null);
  w.naam = niveau === 1 ? 'De Oude Wachter'
    : 'De ' + (WACHTER_TITELS[w.kop] || 'Oude') + 'wachter';
  w.niveau = niveau;
  w.element = BAAS_ELEMENTEN[(niveau - 1) % BAAS_ELEMENTEN.length];
  w.maxLevensVast = 380 + niveau * 230;
  w.krachtVast = 8 + niveau * 4;
  w.schild = true;
  w.wachter = true;
  w.kant = 'wild';
  return w;
}

/* Eenmaal gerold blijft een Wachter dezelfde, anders zie je in de lijst een ander beest
 * dan je even later tegenkomt. Hij wordt dus bewaard, en voor het gevecht gekopieerd,
 * want daar lopen zijn levens doorheen. */
function baasVan(niveau) {
  if (!spel.wachters) spel.wachters = {};
  if (!spel.wachters[niveau]) { spel.wachters[niveau] = maakWachter(niveau); bewaar(); }
  var bron = spel.wachters[niveau], kopie = {};
  for (var k in bron) kopie[k] = bron[k];
  return kopie;
}

function baasBuit(niveau) {
  return {
    glim: 20 + niveau * 14,
    ei: niveau === 1 ? 'bijzonder' : 'schat'
  };
}

/* Je kan niet de ene Wachter na de andere doen. Elke verdieping na de eerste kost twee
 * Wachterssleutels, en die liggen in de jungle: één per tocht, op de plek waar vroeger de
 * geheimen lagen. Dus tussen twee bazen door ga je echt spelen. Ze worden pas afgerekend
 * als je wint, zodat opnieuw proberen gratis blijft. */
function sleutelsVoor(niveau) { return niveau <= 1 ? 0 : 2; }
function magNaarVerdieping(niveau) {
  return niveau === (spel.diepte || 0) + 1 &&
         (spel.sleutels || 0) >= sleutelsVoor(niveau);
}

/* Bij het kruisen leunt een mutatie bewust naar de lage rangen. Een legendarisch
 * onderdeel krijg je dus vooral door het van een ouder te erven, niet door geluk.
 * Daarmee blijft kruisen de hoofdweg naar het ultieme wezen. */
var MUTATIE_RANGEN = { gewoon: 40, ongewoon: 30, zeldzaam: 18, superzeldzaam: 9, legendarisch: 3 };

/* De grote kruishut maakt een verrassing béter, niet vaker. Vaker muteren klonk als een
 * upgrade maar was het tegendeel: elke mutatie gooit een geërfd onderdeel weg, dus met
 * 28 procent mutatiekans had je gemiddeld 81 kruisingen nodig voor een wezen met vier
 * legendarische delen in plaats van 47. Je betaalde 30 glimstenen om verder van je doel
 * af te komen. Met deze tabel is niveau 2 een kleine vooruitgang (44). */
var MUTATIE_RANGEN_GROOT = { gewoon: 18, ongewoon: 27, zeldzaam: 30, superzeldzaam: 17, legendarisch: 8 };

/* De gebieden. Elk gebied is gevaarlijker en levert betere eieren. */
var GEBIEDEN = [
  /* Elk gebied heeft zijn eigen schilderij. Ze deelden eerst allemaal jungle.png, en dan is
   * de beloning voor het bouwen van de uitkijktoren een gebied dat er precies hetzelfde
   * uitziet. Verder weg moet je ook kúnnen zien. */
  { naam: 'De jungle',    emoji: '\u{1F334}', achter: 'jungle.webp', kracht: 0,
    kansen: { gewoon: 70, zeldzaam: 25, bijzonder: 5 } },
  { naam: 'Het moeras',   emoji: '\u{1FAB7}', achter: 'moeras.webp', kracht: 4,
    kansen: { gewoon: 40, zeldzaam: 45, bijzonder: 15 } },
  { naam: 'De grotten',   emoji: '\u{1F5FF}', achter: 'grotten.webp', kracht: 9,
    kansen: { gewoon: 15, zeldzaam: 50, bijzonder: 35 } }
];

/* Wat je kan bouwen. Elk gebouw haalt een rem van het spel af, dus elke bouw
 * verandert hoe je speelt in plaats van alleen een getal te verhogen. */
var GEBOUWEN = {
  /* Het tentje is de allereerste basis. Daarmee heb je pas een nest en een tas,
   * dus het dorp begint echt leeg en groeit uit één keuze. */
  tent:    { naam: 'Tentje',      sprite: 'bouw-tent',   maat: 0.15, max: 1, prijzen: [0, 8],
             wat: 'Jullie eerste onderdak. Hiermee heb je meteen een nest en een tas.' },
  /* prijzen[n] is wat niveau n kost. Index 0 en het startniveau blijven leeg,
   * dus de lijst moet altijd max+1 lang zijn. */
  nest:    { naam: 'Broednest',    sprite: 'bouw-nest',   maat: 0.11, max: 4, prijzen: [0, 0, 8, 20, 40],
             wat: 'Een plek om een ei warm te houden. Meer nesten is meer eieren tegelijk.' },
  rugzak:  { naam: 'Opslaghut',    sprite: 'bouw-opslag', maat: 0.17, max: 5, prijzen: [0, 0, 0, 10, 24, 45],
             wat: 'Hier laat je spullen achter, zodat je meer eieren kan meenemen op een tocht.' },
  rust:    { naam: 'Vuurplaats',   sprite: 'bouw-rust',   maat: 0.16, max: 1, prijzen: [0, 12],
             wat: 'Je wezens worden weer helemaal beter als je thuiskomt.' },
  lab:     { naam: 'Kruishut',     sprite: 'bouw-lab',    maat: 0.18, max: 2, prijzen: [0, 10, 30],
             wat: 'Hier kan je twee wezens kruisen. Groter betekent dat een verrassing vaker iets zeldzaams is.' },
  toren:   { naam: 'Uitkijktoren', sprite: 'bouw-toren',  maat: 0.13, max: 2, prijzen: [0, 28, 70],
             wat: 'Vanaf hier zie je een nieuw gebied liggen.' }
};

/* Versiering doet niets voor het spel en dat is precies de bedoeling: het dorp wordt
 * er van hen van. Je mag er zoveel kopen als je wil. */
var DECORATIES = {
  bloemen:    { naam: 'Bloemenperk',   sprite: 'deco-bloemen',    maat: 0.11, prijs: 4 },
  bessen:     { naam: 'Glimbessen',    sprite: 'deco-bessen',     maat: 0.11, prijs: 5 },
  stenen:     { naam: 'Stapel stenen', sprite: 'deco-stenen',     maat: 0.09, prijs: 3 },
  bank:       { naam: 'Houten bank',   sprite: 'deco-bank',       maat: 0.12, prijs: 5 },
  lampionnen: { naam: 'Lampionnen',    sprite: 'deco-lampionnen', maat: 0.17, prijs: 7 },
  totem:      { naam: 'Totempaal',     sprite: 'deco-totem',      maat: 0.09, prijs: 8 },
  bord:       { naam: 'Wegwijzer',     sprite: 'bouw-bord',       maat: 0.08, prijs: 4 }
};

/* Het dorpsveld. Elk ding heeft een eigen plek die de jongens zelf bepalen.
 * x en y zijn verhoudingen van het veld, y is waar de voet staat. */
var VELD_BOVEN = 0.46;   // niet hoger dan dit, anders zweeft het in de bomen
var VELD_ONDER = 0.95;

/* Linksboven staat het ruimteschip in de achtergrond geschilderd. Daar kan je niets
 * neerzetten, want een voorwerp zou er verkeerd overheen vallen; het schip zit immers
 * ín de achtergrond en kan nooit vóór iets staan. */
var SCHIP = { xTot: 0.34, yTot: 0.74 };

function plekVrij(x, y) { return !(x < SCHIP.xTot && y < SCHIP.yTot); }

function klemPlek(x, y) {
  x = Math.min(0.97, Math.max(0.03, x));
  y = Math.min(VELD_ONDER, Math.max(VELD_BOVEN, y));
  if (plekVrij(x, y)) return { x: x, y: y };
  // naar de dichtstbijzijnde rand van het schip duwen
  return (SCHIP.xTot - x) < (SCHIP.yTot - y)
    ? { x: SCHIP.xTot, y: y }
    : { x: x, y: SCHIP.yTot };
}

function sprietVan(soort) {
  return (GEBOUWEN[soort] && GEBOUWEN[soort].sprite) ||
         (DECORATIES[soort] && DECORATIES[soort].sprite) || null;
}
function maatVan(soort) {
  return (GEBOUWEN[soort] && GEBOUWEN[soort].maat) ||
         (DECORATIES[soort] && DECORATIES[soort].maat) || 0.1;
}

var spel = null;

/* ---------- opslag ---------- */

function bewaar() {
  try { localStorage.setItem(OPSLAG, JSON.stringify(spel)); } catch (e) {}
}

function laadSpel() {
  try {
    var rauw = localStorage.getItem(OPSLAG);
    if (rauw) {
      spel = JSON.parse(rauw);
      if (!spel || typeof spel !== 'object') return false;
      herstelSpel();
      return true;
    }
  } catch (e) {}
  return false;
}

/* Een wezen met een onderdeel dat niet meer bestaat sloopt elk scherm waar hij op staat:
 * de stal, de arena, de kruishut. Dat kan door een kapotte opslag, maar ook doordat wij
 * ooit een onderdeel hernoemen. Liever oplappen dan weggooien: ze raken hun wezen niet
 * kwijt, hij ziet er alleen iets anders uit. */
function lapWezenOp(w) {
  ['kop', 'lijf', 'poten', 'extra'].forEach(function (sleuf) {
    if (!Wezen.SLEUVEN[sleuf][w[sleuf]]) w[sleuf] = Object.keys(Wezen.SLEUVEN[sleuf])[0];
  });
  if (!Wezen.ELEMENTEN[w.element]) w.element = Object.keys(Wezen.ELEMENTEN)[0];
  if (typeof w.schade !== 'number') w.schade = 0;
  if (typeof w.bonus !== 'number') w.bonus = 0;
  if (!w.naam) w.naam = verzinNaam(w);
  return w;
}

/* Een opgeslagen spel kan van vóór een nieuwe functie komen. Dan ontbreken er velden en
 * ziet het dorp er leeg uit terwijl de speler wel nesten heeft. Hier vullen we aan wat
 * er mist, in plaats van de voortgang weg te gooien. */
function herstelSpel() {
  // een spel van voor de opslagplekken was altijd een samen-spel
  if (spel.wie !== 'owen' && spel.wie !== 'jake') spel.wie = 'samen';
  if (typeof spel.diepte !== 'number') spel.diepte = 0;
  if (typeof spel.sleutels !== 'number') spel.sleutels = 0;
  if (!spel.wachters || typeof spel.wachters !== 'object') spel.wachters = {};
  if (typeof spel.volgendeId !== 'number') spel.volgendeId = 1;
  /* Ontbrekende tellers gaven "undefined" in de bovenbalk, en een gebied dat niet bestaat
   * liet het junglescherm vastlopen. Alles wat de interface rechtstreeks toont eerst
   * terugzetten op iets geldigs. */
  if (typeof spel.geheimen !== 'number') spel.geheimen = 0;
  if (typeof spel.gewonnen !== 'number') spel.gewonnen = 0;
  if (typeof spel.glim !== 'number') spel.glim = 0;
  if (spel.stand !== 'moeilijk') spel.stand = 'gewoon';
  spel.zone = Math.min(GEBIEDEN.length - 1, Math.max(0, spel.zone | 0));
  if (!Array.isArray(spel.tas)) spel.tas = [];
  if (!Array.isArray(spel.nesten)) spel.nesten = [];
  if (!spel.boek) spel.boek = { kop: {}, lijf: {}, poten: {}, extra: {}, element: {}, uitgekomen: 0 };
  if (!spel.dorp) spel.dorp = { tent: 0, nest: 0, rugzak: 0, rust: 0, lab: 0, toren: 0 };
  if (typeof spel.dorp.tent !== 'number') spel.dorp.tent = spel.dorp.nest > 0 ? 1 : 0;

  /* Twee aparte stallen samenvoegen tot één. Zo gaat een opgeslagen spel van vóór de
   * gezamenlijke stal niet verloren: wie wat gevonden had blijft staan als `van`. */
  if (!Array.isArray(spel.wezens)) {
    spel.wezens = [];
    spel.mee = { owen: 0, jake: 0 };
    if (spel.spelers) {
      SPELERS.forEach(function (s) {
        var oud = spel.spelers[s.id];
        if (!oud || !Array.isArray(oud.wezens)) return;
        spel.mee[s.id] = spel.wezens.length + (oud.actief || 0);
        oud.wezens.forEach(function (w) {
          if (!w.van) w.van = s.id;
          spel.wezens.push(w);
        });
      });
    }
  }
  if (!spel.mee) spel.mee = { owen: 0, jake: 0 };
  delete spel.spelers;
  spel.wezens = spel.wezens.filter(function (w) { return w && typeof w === 'object'; });
  spel.wezens.forEach(lapWezenOp);
  if (!spel.naamBeurt) spel.naamBeurt = 'owen';
  // allebei hetzelfde wezen meenemen kan niet: dan vecht er eentje twee keer
  SPELERS.forEach(function (s) {
    if (typeof spel.mee[s.id] !== 'number' || !spel.wezens[spel.mee[s.id]]) spel.mee[s.id] = 0;
  });
  if (spel.wezens.length > 1 && spel.mee.owen === spel.mee.jake) {
    spel.mee.jake = (spel.mee.owen + 1) % spel.wezens.length;
  }
  if (!spel.verhaal) spel.verhaal = spel.wezens.length ? 'vrij' : 'kiezen';
  /* Afbreken tussen Owens keuze en die van Jake in gaf een spel dat nooit meer goed kwam:
   * één wezen, voor allebei dezelfde `mee`, dus hetzelfde beest twee keer in de arena en
   * Owen nooit aan de beurt. Is de startkeuze niet afgemaakt, dan doen ze hem opnieuw. */
  if (spel.verhaal === 'kiezen' && spel.wezens.length < 2) spel.wezens = [];

  // het dorpsveld opnieuw opbouwen uit wat er gebouwd is
  if (!Array.isArray(spel.veld)) spel.veld = [];
  var aanwezig = {};
  spel.veld.forEach(function (d) { aanwezig[d.soort] = (aanwezig[d.soort] || 0) + 1; });

  for (var n = aanwezig.nest || 0; n < spel.dorp.nest; n++) veldToevoegen('nest');
  ['tent', 'rugzak', 'rust', 'lab', 'toren'].forEach(function (sleutel) {
    var gebouwd = sleutel === 'rugzak' ? spel.dorp.rugzak >= 3 : spel.dorp[sleutel] > 0;
    if (gebouwd && !aanwezig[sleutel]) veldToevoegen(sleutel);
  });
}

function nieuwSpel(wie) {
  spel = {
    stand: 'gewoon', intro: false,
    wie: wie || 'samen',   // 'owen', 'jake' of 'samen': wie er op deze plek speelt
    geheimen: 0, gewonnen: 0, glim: 0, zone: 0, diepte: 0,
    sleutels: 0,      // Wachterssleutels: hiermee open je de volgende verdieping
    wachters: {},     // per verdieping de Wachter die daar staat, eenmaal gerold
    verhaal: 'kiezen',
    dorp: { tent: 0, nest: 0, rugzak: 0, rust: 0, lab: 0, toren: 0 },
    tas: [],          // eieren die je bij je draagt
    nesten: [],       // eieren die warm liggen: {soort, warmte, nodig}
    veld: [],         // alles wat op het dorpsveld staat: {soort, x, y, id}
    volgendeId: 1,
    plekken: null,
    boek: { kop: {}, lijf: {}, poten: {}, extra: {}, element: {}, uitgekomen: 0 },
    /* Eén gezamenlijke stal. Wezens zijn niet van Owen óf van Jake, want dan krijg je ruzie
     * over wie het mooiste ei mag hebben. Ze kiezen allebei per tocht één wezen uit dezelfde
     * verzameling. `van` is alleen wie hem een naam gaf: krediet, geen bezit. */
    wezens: [],
    mee: { owen: 0, jake: 0 },
    naamBeurt: 'owen'
  };
  spel.plekken = nieuwePlekken();

  bewaar();
}

/* ---------- het dorpsveld ---------- */

function veldToevoegen(soort) {
  // een plekje zoeken dat niet bovenop iets anders staat
  var beste = null, besteAfstand = -1;
  for (var poging = 0; poging < 24; poging++) {
    var x = 0.1 + Math.random() * 0.8;
    var y = VELD_BOVEN + 0.06 + Math.random() * (VELD_ONDER - VELD_BOVEN - 0.1);
    var dichtst = 99;
    spel.veld.forEach(function (d) {
      var dx = (d.x - x) * 1.6, dy = d.y - y;     // breder meten dan hoog, het veld is breed
      var afstand = Math.sqrt(dx * dx + dy * dy);
      if (afstand < dichtst) dichtst = afstand;
    });
    if (!plekVrij(x, y)) continue;
    if (dichtst > besteAfstand) { besteAfstand = dichtst; beste = { x: x, y: y }; }
    if (dichtst > 0.22) break;
  }
  if (!beste) beste = { x: 0.5, y: 0.78 };
  var ding = { soort: soort, x: beste.x, y: beste.y, id: spel.volgendeId++ };
  spel.veld.push(ding);
  bewaar();
  return ding;
}

function veldWeg(id) {
  spel.veld = spel.veld.filter(function (d) { return d.id !== id; });
  bewaar();
}

function koopDeco(sleutel) {
  var d = DECORATIES[sleutel];
  if (!d || spel.glim < d.prijs) return null;
  spel.glim -= d.prijs;
  return veldToevoegen(sleutel);
}

/* ---------- wezens ---------- */

function maakWezen(basis) {
  return {
    kop: basis.kop, lijf: basis.lijf, poten: basis.poten,
    extra: basis.extra, element: basis.element,
    naam: basis.naam || '', bonus: basis.bonus || 0
  };
}

function statsVan(w) {
  var s = Wezen.stats(w);
  var b = w.bonus || 0;
  return { kracht: s.kracht + b, snelheid: s.snelheid + b, leven: s.leven + b };
}

/* Levens en schade zijn zo afgesteld dat een gevecht vier tot zes rondes duurt. */
function maxLevens(w) {
  // de baas heeft geen onderdelen, die draagt zijn eigen cijfers bij zich
  if (w.maxLevensVast) return w.maxLevensVast;
  return statsVan(w).leven * 10;
}
function krachtVan(w) { return w.krachtVast || statsVan(w).kracht; }

function kies(lijst) { return lijst[Math.floor(Math.random() * lijst.length)]; }

// Trekt een rang uit een gewichtentabel.
function trekRang(gewichten) {
  var totaal = 0, k;
  for (k in gewichten) totaal += gewichten[k];
  var worp = Math.random() * totaal, op = 0;
  for (k in gewichten) { op += gewichten[k]; if (worp < op) return k; }
  return 'gewoon';
}

// Kiest een onderdeel uit een sleuf, met een rang die uit de tabel komt rollen.
function trekDeel(sleuf, gewichten) {
  var rang = trekRang(gewichten);
  var opties = Object.keys(Wezen.SLEUVEN[sleuf]).filter(function (k) {
    return Wezen.rangVan(sleuf, k) === rang;
  });
  if (!opties.length) opties = Object.keys(Wezen.SLEUVEN[sleuf]);
  return kies(opties);
}

function wezenUitRangen(gewichten, naam, minimaal) {
  var w = maakWezen({
    kop: trekDeel('kop', gewichten),
    lijf: trekDeel('lijf', gewichten),
    poten: trekDeel('poten', gewichten),
    extra: trekDeel('extra', gewichten),
    element: kies(Object.keys(Wezen.ELEMENTEN)),
    naam: naam || kies(WILDE_NAMEN)
  });
  /* Een schatei belooft minstens één zeldzaam deel. Kwam dat er niet uit rollen, dan
   * krijgt één willekeurige sleuf het alsnog. Zo klopt de belofte altijd. */
  if (minimaal) {
    var sleuven = ['kop', 'lijf', 'poten', 'extra'];
    var drempel = Wezen.RANGORDE.indexOf(minimaal);
    var haalt = sleuven.some(function (s) { return Wezen.RANGORDE.indexOf(Wezen.rangVan(s, w[s])) >= drempel; });
    if (!haalt) {
      var sleuf = kies(sleuven);
      var beter = Object.keys(Wezen.SLEUVEN[sleuf]).filter(function (k) {
        return Wezen.RANGORDE.indexOf(Wezen.rangVan(sleuf, k)) >= drempel;
      });
      if (beter.length) w[sleuf] = kies(beter);
    }
  }
  return w;
}

function wildWezen(zone) {
  var tabel = ZONE_RANGEN[Math.min(ZONE_RANGEN.length - 1, zone || 0)];
  return wezenUitRangen(tabel);
}

/* ---------- het boek ---------- */

function boekBij(w) {
  var b = spel.boek;
  ['kop', 'lijf', 'poten', 'extra'].forEach(function (sleuf) { b[sleuf][w[sleuf]] = true; });
  b.element[w.element] = true;
}

function boekStand() {
  var gezien = 0, totaal = 0;
  ['kop', 'lijf', 'poten', 'extra'].forEach(function (sleuf) {
    var sleutels = Object.keys(Wezen.SLEUVEN[sleuf]);
    totaal += sleutels.length;
    sleutels.forEach(function (k) { if (spel.boek[sleuf][k]) gezien++; });
  });
  Object.keys(Wezen.ELEMENTEN).forEach(function (k) {
    totaal++; if (spel.boek.element[k]) gezien++;
  });
  return { gezien: gezien, totaal: totaal };
}

/* ---------- eieren ---------- */

function trekEisoort() {
  var kansen = GEBIEDEN[spel.zone].kansen;
  var worp = Math.random() * 100, op = 0;
  var soorten = ['gewoon', 'zeldzaam', 'bijzonder'];
  for (var i = 0; i < soorten.length; i++) {
    op += kansen[soorten[i]];
    if (worp < op) return soorten[i];
  }
  return 'gewoon';
}

// vóór het tentje heb je nog geen tas; dan is hij niet "vol" maar bestaat hij niet
function tasVol() { return spel.dorp.rugzak > 0 && spel.tas.length >= spel.dorp.rugzak; }
function vrijeNesten() { return spel.dorp.nest - spel.nesten.length; }

/* Van best naar minst, voor als het spel zelf moet kiezen. */
var EI_VOLGORDE = ['schat', 'bijzonder', 'zeldzaam', 'gewoon'];

/* Jij kiest welk ei warm komt te liggen. Eerst werd de tas van voor naar achter
 * leeggeschud, en dan moest je eerst twee gewone eieren uitbroeden voordat je zeldzame ei
 * aan de beurt was. Een nest is het schaarse ding in dit spel, dus wie erin ligt hoort
 * een keuze te zijn. */
function legEiInNest(index) {
  var ei = spel.tas[index];
  if (!ei || vrijeNesten() <= 0) return false;
  spel.tas.splice(index, 1);
  spel.nesten.push({ soort: ei, warmte: 0, nodig: EISOORTEN[ei].warmte });
  bewaar();
  return true;
}

/* Weggooien levert niets op. Dat hoort ook niet: het is bedoeld om ruimte te maken in een
 * volle tas, niet om aan te verdienen. Wil je er iets voor terug, dan broed je hem uit en
 * laat je het wezen gaan. Dat kost je wel een nest. */
function gooiEiWeg(index) {
  if (!spel.tas[index]) return false;
  spel.tas.splice(index, 1);
  bewaar();
  return true;
}

function legInNesten() {
  var gelegd = 0;
  while (spel.tas.length && vrijeNesten() > 0) {
    // het zeldzaamste eerst, anders zet deze knop alsnog je schatei achteraan de rij
    var beste = 0;
    for (var i = 1; i < spel.tas.length; i++) {
      if (EI_VOLGORDE.indexOf(spel.tas[i]) < EI_VOLGORDE.indexOf(spel.tas[beste])) beste = i;
    }
    legEiInNest(beste);
    gelegd++;
  }
  return gelegd;
}

// Elke zoekactie geeft warmte aan alles wat in een nest ligt.
function warmteErbij() {
  spel.nesten.forEach(function (n) { n.warmte++; });
}

// Welk wezen zit er in dit ei? Pas aanroepen op het moment dat het ei echt opengaat.
function wezenUitEi(soort) {
  var w = wezenUitRangen(EISOORTEN[soort].rangen, '', EISOORTEN[soort].minimaal);
  w.uitEi = soort;
  w.naam = verzinNaam(w);
  return w;
}

function hoeveelKlaar() {
  return spel.nesten.filter(function (n) { return n.warmte >= n.nodig; }).length;
}

/* ---------- kruisen ---------- */

var LIJFSLEUVEN = ['kop', 'lijf', 'poten', 'extra'];

// gemiddelde rangindex (0 gewoon tot 4 legendarisch) over de vier delen van beide ouders
function oudersNiveau(a, b) {
  var som = 0;
  LIJFSLEUVEN.forEach(function (s) {
    som += Wezen.RANGORDE.indexOf(Wezen.rangVan(s, a[s]));
    som += Wezen.RANGORDE.indexOf(Wezen.rangVan(s, b[s]));
  });
  return som / (LIJFSLEUVEN.length * 2);
}

/* Kruisen kost meer naarmate de ouders zeldzamer zijn. Het stond op 3, en dat was precies
 * wat vrijlaten oplevert, dus herrollen was gratis. En het laatste stuk van het spel speelt
 * zich helemaal in het dorp af, dus daar hoort ook iets tegenover te staan. */
function kruisKosten(a, b) {
  if (!a || !b) return 6;
  return 6 + Math.round(oudersNiveau(a, b) * 2);
}

/* De verse trekking bij een kruising. Hoe beter de ouders, hoe hoger de kans op een zeldzaam
 * onderdeel: de verdeling centreert zich op hun gemiddelde rang. Er gaat een kleine straf
 * vanaf zodat het geen gratis roltrap wordt; zonder die straf zou elk kind gemiddeld beter
 * zijn dan zijn ouders en was het einddoel een kwestie van vaak genoeg klikken.
 * De grote kruishut schuift het middelpunt een stukje omhoog. */
function kruisRangen(a, b) {
  var mik = oudersNiveau(a, b) - 0.45 + (spel.dorp.lab >= 2 ? 0.4 : 0);
  var tabel = {};
  Wezen.RANGORDE.forEach(function (rang, i) {
    tabel[rang] = Math.round(Math.exp(-Math.abs(i - mik) * 1.15) * 1000);
  });
  return tabel;
}

function kruis(a, b, vanTweeSpelers) {
  /* Hooguit één onderdeel van elke ouder. Daarvoor erfde elke sleuf 50/50, met maar 15
   * procent kans op iets nieuws, en dan lijkt een kind bijna precies op zijn ouders. Nu
   * komen er twee delen van de ouders en worden de andere twee vers getrokken, gestuurd
   * door hoe zeldzaam de ouders zijn. */
  var kind = { bonus: 0 };
  var mutaties = 0;
  var volgorde = LIJFSLEUVEN.slice();
  for (var i = volgorde.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = volgorde[i]; volgorde[i] = volgorde[j]; volgorde[j] = t;
  }
  var verseTabel = kruisRangen(a, b);
  volgorde.forEach(function (sleuf, plek) {
    if (plek === 0) kind[sleuf] = a[sleuf];           // één deel van de ene ouder
    else if (plek === 1) kind[sleuf] = b[sleuf];      // één deel van de andere
    else { kind[sleuf] = trekDeel(sleuf, verseTabel); mutaties++; }
  });
  // het element erft gewoon van een van de ouders, met een kleine kans op iets anders
  kind.element = Math.random() < 0.12
    ? kies(Object.keys(Wezen.ELEMENTEN))
    : (Math.random() < 0.5 ? a.element : b.element);
  /* De samenwerkingsbonus stapelde onbeperkt: elk kind erfde de hoogste en kreeg er 2 bij,
   * dus na twintig kruisingen stond er +40 op kracht, snelheid én leven. Dat is precies het
   * upgradesysteem dat we bewust niet wilden, en het haalde de rangenladder in. Hij loopt
   * nu tot 6, drie generaties, en daarna moet het van de onderdelen komen. */
  kind.bonus = Math.min(6, Math.max(a.bonus || 0, b.bonus || 0) + (vanTweeSpelers ? 2 : 0));
  kind.naam = verzinNaam(kind);
  return { wezen: maakWezen(kind), mutaties: mutaties, samen: !!vanTweeSpelers };
}

/* ---------- bouwen ---------- */

function bouwPrijs(sleutel) {
  var g = GEBOUWEN[sleutel];
  var nu = spel.dorp[sleutel];
  if (nu >= g.max) return null;
  return g.prijzen[nu + 1] || null;
}

/* Een prijs van 0 is geen koopje maar een lege plek in de tabel: het broednest begint op
 * niveau 1 en de opslaghut op niveau 2, en die krijg je allebei van het tentje. Zonder dit
 * onderscheid waren ze gratis te bouwen vóór het tentje er stond, en was het tentje daarna
 * 8 glimstenen voor niks. En "helemaal klaar" is iets anders dan "komt nog". */
function komtMetTentje(sleutel) {
  var g = GEBOUWEN[sleutel], nu = spel.dorp[sleutel];
  return nu < g.max && !g.prijzen[nu + 1];
}
function helemaalKlaar(sleutel) {
  return spel.dorp[sleutel] >= GEBOUWEN[sleutel].max;
}

function kanBouwen(sleutel) {
  var prijs = bouwPrijs(sleutel);
  return prijs !== null && spel.glim >= prijs;
}

function bouw(sleutel) {
  if (!kanBouwen(sleutel)) return false;
  spel.glim -= bouwPrijs(sleutel);
  spel.dorp[sleutel]++;
  /* Elk broednest is een eigen ding op het veld. De andere gebouwen staan er maar één
   * keer, dus die komen erbij zodra er nog geen staat. Niet op niveau kijken: de
   * opslaghut begint al op twee. */
  // het tentje is de basis: daarmee heb je meteen een nest en een tas
  if (sleutel === 'tent') {
    spel.dorp.nest = Math.max(1, spel.dorp.nest);
    spel.dorp.rugzak = Math.max(2, spel.dorp.rugzak);
    if (!spel.veld.some(function (d) { return d.soort === 'nest'; })) veldToevoegen('nest');
    spel.verhaal = 'vrij';
  }
  var staatEr = spel.veld.some(function (d) { return d.soort === sleutel; });
  if (sleutel === 'nest' || !staatEr) veldToevoegen(sleutel);
  bewaar();
  return true;
}

function zonesOpen() { return Math.min(GEBIEDEN.length, 1 + spel.dorp.toren); }

/* ---------- jungle ---------- */

function nieuwePlekken() {
  var soorten = ['ei', 'ei', 'glim', 'glim', 'beest', 'beest', 'beest', 'niets'];
  /* Zolang de deur dicht is ligt hier een geheim, daarna een Wachterssleutel. Die plek
   * werd anders voorgoed 'niets' zodra je alle zes geheimen had: één van de acht plekken
   * leverde dan nooit meer iets op, precies op het moment dat de diepte begint. */
  if (spel.geheimen < HINTS.length) soorten[7] = 'geheim';
  else soorten[7] = 'sleutel';
  for (var i = soorten.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = soorten[i]; soorten[i] = soorten[j]; soorten[j] = t;
  }
  return soorten.map(function (s) { return { soort: s, gezocht: false }; });
}

/* ---------- gevecht ---------- */

var strijd = null;

function startGevecht() {
  var gebied = GEBIEDEN[spel.zone];
  var moeilijk = spel.stand === 'moeilijk';
  var aantal = Math.random() < 0.45 ? 2 : 1;
  /* De zwaarte komt nu uit de rangen van het gebied: in de grotten lopen wezens rond
   * met zeldzame onderdelen. De moeilijke stand legt daar nog een kleine bonus bovenop. */
  var extraKracht = (moeilijk ? 2 : 0) + Math.floor(spel.gewonnen / 6);

  var vijanden = [];
  for (var i = 0; i < aantal; i++) {
    var v = wildWezen(spel.zone);
    v.bonus = extraKracht;
    v.kant = 'wild';
    v.levens = maxLevens(v);
    vijanden.push(v);
  }

  var helden = SPELERS.map(function (s) {
    var w = meeWezen(s.id);
    w.kant = s.id;
    if (typeof w.schade !== 'number') w.schade = 0;
    w.levens = Math.max(1, maxLevens(w) - w.schade);
    return w;
  });

  strijd = {
    helden: helden, vijanden: vijanden,
    ronde: 1, aanDeBeurt: 0,
    elementKlaar: { owen: true, jake: true },
    helpGebruikt: { owen: false, jake: false },
    doelwitVan: {},
    verslag: []
  };
  return strijd;
}

function levend(w) { return w.levens > 0; }

function elementFactor(aanvaller, doel) {
  if (STERK[aanvaller.element] === doel.element) return 2;
  if (STERK[doel.element] === aanvaller.element) return 0.5;
  return 1;
}

function doeSchade(aanvaller, doel, maal) {
  var f = elementFactor(aanvaller, doel);
  var ruw = krachtVan(aanvaller) * 1.6 * maal * f;
  var schade = Math.max(1, Math.round(ruw * (0.85 + Math.random() * 0.3)));
  doel.levens = Math.max(0, doel.levens - schade);
  return { schade: schade, factor: f };
}

/* Schade blijft staan tot je uitrust. Dat is de reden om naar het dorp terug te gaan,
 * en met een vuurplaats gaat dat vanzelf. */
function onthoudSchade() {
  strijd.helden.forEach(function (w) {
    w.schade = Math.max(0, maxLevens(w) - w.levens);
    w.levens = undefined; w.kant = undefined;
  });
  bewaar();
}

function rustUit() {
  spel.wezens.forEach(function (w) { w.schade = 0; });
  bewaar();
}

/* ---------- de gezamenlijke stal ---------- */

// welk wezen neemt deze speler mee op tocht
function meeWezen(spelerId) {
  return spel.wezens[spel.mee[spelerId]] || spel.wezens[0];
}

/* Eén wezen kan niet door allebei tegelijk meegenomen worden, want dan zou hetzelfde
 * beest twee keer in de arena staan. Pakt de een wat de ander had, dan ruilen ze. */
function neemMee(spelerId, index) {
  if (!spel.wezens[index]) return;
  var ander = SPELERS.filter(function (s) { return s.id !== spelerId; })[0];
  if (ander && spel.mee[ander.id] === index) spel.mee[ander.id] = spel.mee[spelerId];
  spel.mee[spelerId] = index;
  bewaar();
}

/* Het spel wijst nooit aan wélk wezen weg kan. Dat is geprobeerd en weer weggehaald:
 * als de jongens er eentje cool vinden houden ze hem, ook al is hij zwakker, en dan hoeft
 * er geen spel tegen ze in te praten. Het aanbod is alleen: je kán er eentje vrijlaten. */

/* Altijd hetzelfde, hoe zeldzaam het wezen ook was. Het liep eerst op met de rangen, maar
 * dan hangt het spel een prijskaartje aan hun wezens en wordt een goeie wegdoen juist
 * aantrekkelijk. Dit is een bedankje voor het opruimen, geen beloning voor het inleveren. */
function vrijlaatOpbrengst() { return 3; }

/* Je kan er altijd maar eentje missen als er genoeg overblijven, en nooit eentje die
 * iemand net heeft uitgekozen om mee te nemen. Zo kan er niets wegvallen wat ze nodig
 * hebben, ook niet per ongeluk. */
function magVrijlaten(index) {
  if (spel.wezens.length <= 2) return false;
  return !SPELERS.some(function (s) { return spel.mee[s.id] === index; });
}

function laatVrij(index) {
  if (!magVrijlaten(index)) return 0;
  var buit = vrijlaatOpbrengst(spel.wezens[index]);
  spel.wezens.splice(index, 1);
  // de plekken schuiven op, dus wie wie meeneemt moet meeschuiven
  SPELERS.forEach(function (s) { if (spel.mee[s.id] > index) spel.mee[s.id]--; });
  spel.glim += buit;
  bewaar();
  return buit;
}

/* Een net uitgekomen wezen dat je niet houdt. Hij gaat niet via de stal, dus de regel
 * "er moeten er twee overblijven" speelt hier niet: je hebt er daarna net zoveel als
 * ervoor. Hij komt wél in het boek, net als bij vrijlaten uit de stal. De naambeurt
 * schuift ook door, want er is wel degelijk een wezen uitgekomen. */
function laatMeteenGaan(wezen) {
  boekBij(wezen);
  spel.boek.uitgekomen++;
  spel.glim += vrijlaatOpbrengst(wezen);
  spel.naamBeurt = spel.naamBeurt === 'owen' ? 'jake' : 'owen';
  bewaar();
  return vrijlaatOpbrengst(wezen);
}

function voegWezenToe(wezen, vanWie) {
  wezen.schade = 0;
  wezen.van = vanWie || spel.naamBeurt;     // wie hem een naam gaf, puur als krediet
  spel.wezens.push(wezen);
  boekBij(wezen);
  spel.boek.uitgekomen++;
  // om de beurt mag de ander de volgende naam verzinnen, dan is daar ook geen ruzie over
  spel.naamBeurt = spel.naamBeurt === 'owen' ? 'jake' : 'owen';
  bewaar();
}
