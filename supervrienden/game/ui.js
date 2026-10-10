/* Schermen en knoppen van het spel. Gewoon script, geen module: moet werken op file://. */

var SCHERMEN = ['s-laden','s-plekken','s-wie','s-start','s-intro','s-dorp','s-bouwen','s-zone','s-jungle','s-arena','s-uitkomen','s-kruisen','s-boek','s-geheim','s-diepte','s-kies','s-opslag'];

/* Elk scherm heeft zijn eigen achtergrondkunst. Eén vaste laag achter alles, zodat de
 * panelen er als glas overheen liggen in plaats van als losse kaartjes op een vlakke kleur. */
var ACHTERGROND = {
  's-laden': 'dorp.webp',   's-start': 'jungle.webp', 's-dorp': 'dorp.webp',
  's-bouwen': 'dorp.webp',  's-zone': 'jungle.webp',  's-jungle': 'jungle.webp',
  's-arena': 'arena.webp',  's-uitkomen': 'dorp.webp','s-kruisen': 'dorp.webp',
  's-boek': 'dorp.webp',    's-geheim': 'arena.webp', 's-diepte': 'grot.webp', 's-kies': 'jungle.webp',
  's-intro': 'dorp.webp'
};
var huidigeAchtergrond = null;

function zetAchtergrond(bestand) {
  if (bestand === huidigeAchtergrond) return;
  huidigeAchtergrond = bestand;
  var img = document.getElementById('bg-img');
  img.classList.remove('aan');
  var nieuw = new Image();
  /* Twee achtergronden kunnen tegelijk laden. Zonder deze controle zet een trage
   * laadbeurt de verkeerde achtergrond terug zodra hij eindelijk binnen is. */
  nieuw.onload = function () {
    if (bestand !== huidigeAchtergrond) return;
    img.src = nieuw.src; img.classList.add('aan');
  };
  nieuw.onerror = function () {
    if (bestand === huidigeAchtergrond) img.classList.remove('aan');
  };
  nieuw.src = '../art/achtergronden/' + bestand;
}

function toon(id) {
  if (typeof stopWekker === 'function') stopWekker();
  SCHERMEN.forEach(function (s) { document.getElementById(s).classList.add('verborgen'); });
  document.getElementById(id).classList.remove('verborgen');
  zetAchtergrond(ACHTERGROND[id] || 'jungle.webp');
  window.scrollTo(0, 0);
}

/* Iconen zijn echte plaatjes, geen emoji. Emoji zien er op elk apparaat anders uit
 * en verraden meteen dat het geen echte game is. */
var EI_ICOON = {
  gewoon: 'icoon-ei-gewoon', zeldzaam: 'icoon-ei-zeldzaam',
  bijzonder: 'icoon-ei-bijzonder', schat: 'icoon-ei-bijzonder'
};
// het schatei deelt het gouden plaatje, maar krijgt een eigen kleurzweem
function eiPlaatje(soort, klasse) {
  return '<img class="' + (klasse || 'ic') + (soort === 'schat' ? ' schatei' : '') +
    '" src="../onderdelen/' + EI_ICOON[soort] + '.webp" alt="">';
}

function ic(naam, klasse) {
  return '<img class="' + (klasse || 'ic') + '" src="../onderdelen/' + naam + '.webp" alt="">';
}

/* Voorlezen is voor Jake geen extraatje maar de manier waarop hij het spel begrijpt.
 *
 * Het ging eerst met `speechSynthesis`, de stem die in het apparaat zit. Die is op elke
 * tablet een andere, op sommige Engels, en op een enkele is er helemaal geen Nederlandse
 * stem. Nu is alles ingesproken door papa.
 *
 * De ingesproken stukjes zijn vooraf gemaakt met Piper (zie gereedschap/stem/). Welke er
 * klaarstaan weet het spel uit `stem/lijst.js`; dat is een script en geen json, want op
 * file:// mag een pagina geen bestanden ophalen.
 *
 * Een zin wordt in stukjes gezegd: een vast stuk, een naam, een getal. Ontbreekt er ook
 * maar één stukje, dan gaat de hele zin naar de systeemstem. Half ingesproken en half
 * robot klinkt kapotter dan helemaal robot. */
var stemRij = [];
var stemNu = null;

function heeftClip(sleutel) {
  return !!(window.STEM_LIJST && STEM_LIJST[sleutel]);
}

function stopStem() {
  stemRij = [];
  if (stemNu) { try { stemNu.pause(); } catch (e) {} stemNu = null; }
}

function volgendeClip() {
  if (!stemRij.length) { stemNu = null; return; }
  var sleutel = stemRij.shift();
  stemNu = new Audio('../stem/' + sleutel + '.mp3');
  stemNu.onended = volgendeClip;
  stemNu.onerror = volgendeClip;     // één ontbrekend bestand mag de rest niet ophouden
  stemNu.play().catch(volgendeClip);
}

/* Alleen papa's stem, of stilte. De robotstem van het apparaat is er helemaal uit.
 *
 * Dat is een bewuste keuze en geen bezuiniging: de enige zinnen die niet ingesproken zijn,
 * zijn zinnen met een wezennaam of een aantal erin ("Vlamklauw raakt Knauw voor 8"). Die
 * tijdens een gevecht door een robot laten oplezen is eerder irritant dan behulpzaam, en
 * het wisselen tussen twee stemmen maakt het alleen maar rommeliger. Staat er geen opname
 * klaar, dan zegt het spel niets.
 *
 * `tekst` blijft meegaan omdat het leest als documentatie bij de aanroep: je ziet in de
 * code wat er klinkt zonder de zinnenlijst erbij te pakken. */
function spreek(tekst, sleutels) {
  stopStem();
  if (!sleutels) return;
  var lijst = typeof sleutels === 'string' ? [sleutels] : sleutels;
  if (!lijst.length || !lijst.every(heeftClip)) return;
  stemRij = lijst.slice();
  volgendeClip();
}
Array.prototype.forEach.call(document.querySelectorAll('.luidspreker[data-zeg]'), function (k) {
  k.addEventListener('click', function () { spreek(k.dataset.zeg, k.dataset.sleutel); });
});

/* Elk wezen wordt levend getekend: het lichaam staat stil, maar zijn element beweegt.
 * Vuur stijgt, water zakt, blaadjes dwarrelen, bliksem schiet heen en weer. */
function tekenIn(canvas, wezen, breedte, hoogte) {
  Wezen.animeer(canvas, wezen, breedte, hoogte);
}

/* ---------- bovenbalk ---------- */

function balkTekst() {
  var b = boekStand();
  return '<span class="pil">' + ic('icoon-glim') + '<b>' + spel.glim + '</b></span>' +
    '<span class="pil' + (tasVol() ? ' vol' : '') + '">' + ic('icoon-ei-gewoon') +
      '<b>' + spel.tas.length + '/' + spel.dorp.rugzak + '</b>' + (tasVol() ? ' vol' : '') + '</span>' +
    '<span class="pil">' + ic('icoon-nest') + '<b>' + spel.nesten.length + '/' + spel.dorp.nest + '</b></span>' +
    /* Zolang de deur dicht is telt de sleutel de geheimen; daarna de Wachterssleutels,
       want 6/6 blijven tonen is een pil die nooit meer verandert. */
    '<span class="pil">' + ic('icoon-sleutel') + '<b>' + (deurOpen()
        ? (spel.sleutels || 0) +
          /* geen '/0' tonen: de eerste verdieping kost niets, en 2/0 leest als kapot */
          (sleutelsVoor((spel.diepte || 0) + 1)
            ? '/' + sleutelsVoor((spel.diepte || 0) + 1) : '')
        : spel.geheimen + '/' + HINTS.length) + '</b></span>' +
    // echt icoon, geen emoji: die zien er op elk apparaat anders uit
    '<span class="pil">' + ic('menu-boek') + '<b>' + b.gezien + '/' + b.totaal + '</b></span>';
}

function tekenBalken() {
  ['hud-dorp','hud-bouw','hud-zone','hud-jungle','hud-kruis','hud-boek','hud-diepte'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = balkTekst();
  });
}

/* ---------- dorp ---------- */

/* ---------- het dorpsveld ---------- */

var weghaalModus = false;

/* Het dorp vult het hele scherm, maar de tekening blijft 16:9. De achtergrond wordt dus
 * bijgesneden ('cover'), en dat betekent dat een plek op het scherm niet dezelfde plek in de
 * tekening is. De plekken van de dingen staan in tekening-coördinaten, want het ruimteschip
 * staat op een vaste plek in de tekening. Dit rekent heen en weer, bij elk vensterformaat. */
var VELD_VERHOUDING = 16 / 9;

function coverVlak(breed, hoog) {
  var bb = breed, bh = breed / VELD_VERHOUDING;
  if (bh < hoog) { bh = hoog; bb = hoog * VELD_VERHOUDING; }
  return { links: (breed - bb) / 2 / breed, boven: (hoog - bh) / 2 / hoog,
           breed: bb / breed, hoog: bh / hoog };
}
function veldVlak() {
  var veld = document.getElementById('veld');
  return coverVlak(veld.clientWidth || 1, veld.clientHeight || 1);
}
function naarScherm(x, y) {
  var v = veldVlak();
  return { x: v.links + x * v.breed, y: v.boven + y * v.hoog };
}
function naarTekening(x, y) {
  var v = veldVlak();
  return { x: (x - v.links) / v.breed, y: (y - v.boven) / v.hoog };
}
/* Wat buiten beeld valt door het bijsnijden mag je er ook niet neerzetten, en onder de
 * knoppenbalk evenmin: daar kan je het niet meer pakken. */
// klemPlek uit spel.js met een punt in plaats van twee losse getallen
function klemPlek2(p) { return klemPlek(p.x, p.y); }

function zichtKlem(p) {
  var veld = document.getElementById('veld');
  var balk = document.querySelector('.balk');
  var onder = balk ? (balk.offsetHeight + 24) / (veld.clientHeight || 1) : 0.16;
  var la = naarTekening(0.03, 0.10), rb = naarTekening(0.97, 1 - onder);
  return { x: Math.min(Math.max(p.x, la.x), rb.x), y: Math.min(Math.max(p.y, la.y), rb.y) };
}

function tekenVeld() {
  var achter = document.getElementById('veld-achter');
  if (!achter.src) achter.src = '../art/achtergronden/dorp-leeg.webp';

  var bak = document.getElementById('dingen');
  bak.innerHTML = '';
  var nestTeller = 0;
  var vlak = veldVlak();

  /* Niets verschuiven in de opslag. Dat deed het eerst wel, en bij een breed en laag
   * venster (of een tablet in portret) knijpt de zichtklem zo hard dat de hele
   * dorpsindeling naar het midden kroop, en dat werd opgeslagen. Het venster weer groot
   * maken zette niets terug. Nu wordt er alleen voor het tékenen geklemd, en blijft wat
   * de jongens hebben neergezet gewoon staan. */

  // van achter naar voren tekenen, zodat wat lager staat er vóór staat
  spel.veld.slice().sort(function (a, b) { return a.y - b.y; }).forEach(function (d) {
    var sprite = sprietVan(d.soort);
    if (!sprite) return;
    var el = document.createElement('div');
    el.className = 'ding';
    el.dataset.id = d.id;
    // dingen die lager staan zijn dichterbij, dus iets groter
    var diepte = 0.86 + (d.y - VELD_BOVEN) / (VELD_ONDER - VELD_BOVEN) * 0.3;
    /* Klemmen alleen om te tekenen, en de schipregel als laatste zodat die altijd wint:
     * een voorwerp dat half in het geschilderde ruimteschip staat ziet er kapot uit. */
    var opPlek = klemPlek2(zichtKlem({ x: d.x, y: d.y }));
    var plek = naarScherm(opPlek.x, opPlek.y);
    el.style.left = (plek.x * 100) + '%';
    el.style.top = (plek.y * 100) + '%';
    el.style.width = (maatVan(d.soort) * diepte * vlak.breed * 100) + '%';
    el.style.zIndex = String(100 + Math.round(d.y * 500));
    if (d.soort === 'nest') {
      /* Het nest, dan het ei, dan de apart getekende voorrand eroverheen. Zo ligt het ei
       * echt in de kom in plaats van erop. */
      var nestNr = nestTeller++;
      var ei = spel.nesten[nestNr];
      el.innerHTML =
        '<img src="../onderdelen/bouw-nest.webp" alt="">' +
        (ei ? eiPlaatje(ei.soort, 'eiop') : '') +
        '<img class="nestvoorrand" src="../onderdelen/nest-voorrand.webp" alt="">';
      if (ei) {
        var klaar = ei.warmte >= ei.nodig;
        if (klaar) {
          el.classList.add('klaar');
          // tikken op een klaar nest laat dát ei uitkomen, en gaat vóór op slepen
          el.tikActie = (function (nr) { return function () { broedUit(nr); }; })(nestNr);
          el.tikAltijd = true;
        }
        else {
          // tikken op een ei dat nog niet warm is deed niets; nu zegt het tenminste waarom
          el.tikActie = (function (over) {
            return function () {
              spreek(over === 1 ? 'Nog één keer op pad, dan komt hij uit.'
                                : 'Hij is nog niet warm genoeg. Ga nog een paar keer op pad.',
                     over === 1 ? 'ei-bijna' : 'ei-nietwarm');
            };
          })(ei.nodig - ei.warmte);
        }
        el.innerHTML += '<div class="warm"><span style="width:' +
          Math.min(100, Math.round(ei.warmte / ei.nodig * 100)) + '%"></span></div>';
        el.title = klaar ? 'Tik erop, hij komt uit!' : ei.warmte + ' van de ' + ei.nodig + ' warmte';
      } else el.title = 'Leeg nest';
    } else {
      el.innerHTML = '<img src="../onderdelen/' + sprite + '.webp" alt="">';
    }

    if (weghaalModus && DECORATIES[d.soort]) {
      var kruis = document.createElement('button');
      kruis.className = 'weg';
      kruis.textContent = '✕';
      kruis.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
      kruis.addEventListener('click', function (e) {
        e.stopPropagation();
        veldWeg(d.id);
        tekenVeld();
      });
      el.appendChild(kruis);
    }

    maakSleepbaar(el, d);
    bak.appendChild(el);
  });
}

/* Slepen met de muis of met een vinger. Pointer events doen allebei tegelijk. */
function maakSleepbaar(el, ding) {
  el.addEventListener('pointerdown', function (e) {
    if (e.button !== undefined && e.button !== 0) return;
    var veld = document.getElementById('veld');
    var kader = veld.getBoundingClientRect();
    el.setPointerCapture(e.pointerId);
    el.classList.add('pakt');
    el.style.zIndex = '9999';
    /* Tikken en slepen op hetzelfde ding. De drempel stond op 6 pixels en dat is te streng
     * voor een kinderhand: een tik op het ei eindigde als een sleepje en dan kwam het ei
     * niet uit. Op een nest dat klaar is wint de tik sowieso; dat nest verschuiven kan
     * altijd nog nadat het ei eruit is. */
    var tikDrempel = el.tikAltijd ? 9999 : 14;
    var startX = e.clientX, startY = e.clientY, verplaatst = false;

    function beweeg(ev) {
      if (Math.abs(ev.clientX - startX) > tikDrempel ||
          Math.abs(ev.clientY - startY) > tikDrempel) verplaatst = true;
      if (!verplaatst) return;
      var t = naarTekening((ev.clientX - kader.left) / kader.width,
                           (ev.clientY - kader.top) / kader.height);
      // schipregel als laatste, net als bij het tekenen
      var plek = klemPlek2(zichtKlem({ x: t.x, y: t.y }));
      ding.x = plek.x; ding.y = plek.y;
      var opScherm = naarScherm(ding.x, ding.y);
      el.style.left = (opScherm.x * 100) + '%';
      el.style.top = (opScherm.y * 100) + '%';
      var diepte = 0.86 + (ding.y - VELD_BOVEN) / (VELD_ONDER - VELD_BOVEN) * 0.3;
      el.style.width = (maatVan(ding.soort) * diepte * veldVlak().breed * 100) + '%';
    }
    function los(ev) {
      el.releasePointerCapture(ev.pointerId);
      el.removeEventListener('pointermove', beweeg);
      el.removeEventListener('pointerup', los);
      el.removeEventListener('pointercancel', los);
      el.classList.remove('pakt');
      // ook na een tik opnieuw tekenen, anders blijft dit ding op z-index 9999 bovenaan hangen
      if (!verplaatst && el.tikActie) { el.tikActie(); return tekenVeld(); }
      bewaar();
      tekenVeld();     // opnieuw sorteren op diepte
    }
    el.addEventListener('pointermove', beweeg);
    el.addEventListener('pointerup', los);
    el.addEventListener('pointercancel', los);
    e.preventDefault();
  });
}

/* De tas is geen vitrine maar een keuze. Tik op een ei en dát ei gaat het nest in; in de
 * weggooistand verdwijnt het. Zelfde patroon als de stal: eerst een kruisje, dan pas een
 * vinkje, zodat één tik nooit iets wegdoet. */
var eiWegModus = false;
var eiWegVraag = -1;

function tekenTas() {
  var bak = document.getElementById('tas');
  bak.innerHTML = '';
  var vrij = vrijeNesten();

  for (var i = 0; i < spel.dorp.rugzak; i++) {
    (function (i) {
      var soort = spel.tas[i];
      if (!soort) {
        var leeg = document.createElement('div');
        leeg.className = 'tasvak';
        bak.appendChild(leeg);
        return;
      }
      var naam = EISOORTEN[soort].naam.toLowerCase();
      var vak = document.createElement('button');
      vak.className = 'tasvak vol';
      vak.innerHTML = eiPlaatje(soort, '');

      if (eiWegModus) {
        if (eiWegVraag === i) {
          vak.classList.add('vraagt');
          vak.title = 'Dit ' + naam + ' echt weggooien';
          vak.innerHTML = '<span class="weggooi">&#10003;</span>';
          vak.addEventListener('click', function () {
            gooiEiWeg(i);
            eiWegVraag = -1;
            spreek('Weg ermee.', 'ei-weg');
            tekenDorp();
          });
        } else {
          vak.classList.add('gaatweg');
          vak.title = 'Dit ' + naam + ' weggooien';
          vak.addEventListener('click', function () { eiWegVraag = i; tekenDorp(); });
        }
      } else if (vrij > 0) {
        vak.classList.add('kanleggen');
        vak.title = 'Dit ' + naam + ' in een nest leggen';
        vak.addEventListener('click', function () {
          if (!legEiInNest(i)) return;
          spreek('Het ei ligt nu warm.', 'ei-warm');
          tekenDorp();
        });
      } else {
        vak.disabled = true;
        vak.title = 'Alle nesten liggen vol';
      }
      bak.appendChild(vak);
    })(i);
  }

  if (!spel.tas.length) {
    var p = document.createElement('span');
    p.style.cssText = 'color:#7e8ea0;font-size:14px';
    p.textContent = 'Nog geen eieren bij je.';
    bak.appendChild(p);
  }

  document.getElementById('tas-uitleg').textContent = !spel.tas.length
    ? 'Zoek in de jungle, dan vul je hem vanzelf.'
    : eiWegModus
      ? 'Tik op een ei om het weg te gooien. Je krijgt er niks voor terug; het maakt alleen plaats.'
      : vrij > 0
        ? 'Tik op het ei dat jij als eerste warm wil hebben. Er ' +
          (vrij === 1 ? 'is nog 1 nest' : 'zijn nog ' + vrij + ' nesten') + ' vrij.'
        : 'Alle nesten liggen vol. Laat eerst een ei uitkomen, of bouw een nest erbij.';

  var wegKnop = document.getElementById('k-ei-weg');
  wegKnop.classList.toggle('verborgen', !spel.tas.length);
  wegKnop.textContent = eiWegModus ? '✓ Klaar met weggooien' : '✖ Een ei weggooien';
  document.getElementById('k-leggen').disabled = !spel.tas.length || vrij <= 0 || eiWegModus;
}

/* Eén stal voor allebei. Onder elk wezen staan twee knopjes in hun eigen kleur: daarmee
 * zegt Owen of Jake wie hem deze tocht meeneemt. Niemand is eigenaar, dus er valt ook
 * niets te verdelen. */
/* Vrijlaten in plaats van weggooien: het wezen gaat terug de jungle in en laat glimstenen
 * achter. Er gaat dus niets kapot, en in het boek blijft hij gewoon staan. Het zit achter
 * een stand, en daarbinnen moet je het ook nog een keer bevestigen, want een kind van zes
 * tikt zo twee keer op hetzelfde plekje. */
var vrijlaatModus = false;
var vrijlaatVraag = -1;

function tekenStal(bakId) {
  var bak = document.getElementById(bakId);
  bak.innerHTML = '';

  var rij = document.createElement('div');
  rij.className = 'stal';
  spel.wezens.forEach(function (w, i) {
    var meeVan = SPELERS.filter(function (s) { return spel.mee[s.id] === i; })[0];
    var kaart = maakKaartje(w, w.van || 'owen', !!meeVan, null);
    // bij alleen spelen zijn beide plekken van hetzelfde kind, dus ook dezelfde kleur rand
    if (meeVan) kaart.classList.add('mee-' + spelerVan(meeVan.id).kleur);

    if (vrijlaatModus) {
      if (magVrijlaten(i)) {
        if (vrijlaatVraag === i) {
          kaart.classList.add('vraagt');
          var ja = document.createElement('button');
          ja.className = 'weg ja';
          ja.innerHTML = '&#10003;';
          ja.title = w.naam + ' echt vrijlaten';
          ja.addEventListener('click', function (e) {
            e.stopPropagation();
            var buit = laatVrij(i);
            vrijlaatVraag = -1;
            spreek('Hij rent de jungle in en laat glimstenen achter.', 'vrijlaten-weg');
            tekenDorp();
          });
          var zeker = document.createElement('div');
          zeker.className = 'zekervraag';
          zeker.innerHTML = 'Vrijlaten?<br><span>' + ic('icoon-glim') + ' +' +
            vrijlaatOpbrengst(w) + '</span>';
          kaart.appendChild(zeker);
          kaart.appendChild(ja);       // de ja-knop komt onderaan, niet op de eerste tik
        } else {
          var kruis = document.createElement('button');
          kruis.className = 'weg';
          kruis.innerHTML = '&#8599;';
          kruis.title = w.naam + ' vrijlaten';
          kruis.addEventListener('click', function (e) {
            e.stopPropagation();
            vrijlaatVraag = i;
            tekenDorp();
          });
          kaart.appendChild(kruis);
        }
      } else kaart.classList.add('blijft');
    }

    var kiesrij = document.createElement('div');
    kiesrij.className = 'meekiezer';
    SPELERS.forEach(function (s) {
      /* Samen: een groen en een oranje hartje, van Owen en Jake. Alleen: twee plekken in
         jouw eigen team, allebei in jouw kleur, met een 1 en een 2 erop. */
      var p = spelerVan(s.id);
      var knop = document.createElement('button');
      knop.className = 'meeknop ' + p.kleur + (spel.mee[s.id] === i ? ' aan' : '');
      knop.innerHTML = p.alleen ? String(p.plek) : p.emoji;
      knop.title = p.alleen
        ? (w.naam || 'dit wezen') + ' op plek ' + p.plek + ' van je team'
        : p.naam + ' neemt ' + (w.naam || 'dit wezen') + ' mee';
      knop.addEventListener('click', function (e) {
        e.stopPropagation();
        neemMee(s.id, i);
        tekenDorp();
      });
      kiesrij.appendChild(knop);
    });
    kaart.appendChild(kiesrij);
    rij.appendChild(kaart);
  });
  bak.appendChild(rij);

  var knop = document.getElementById('k-vrijlaten');
  knop.classList.toggle('verborgen', spel.wezens.length <= 2);
  knop.textContent = vrijlaatModus ? '✓ Klaar met vrijlaten' : '\u{1F343} Eentje vrijlaten';
  document.getElementById('stal-uitleg').innerHTML = vrijlaatModus
    ? 'Tik op het pijltje als je een wezen de jungle in wil sturen. Hij laat glimstenen ' +
      'achter, en in het boek blijft hij gewoon staan. Jullie bepalen zelf wie er mag blijven.'
    : samenSpelen()
      ? 'Alle wezens zijn van jullie samen. Tik op het groene hartje als Owen hem meeneemt, ' +
        'op het oranje als Jake hem meeneemt.'
      : heeftMaatje()
        ? 'Tik op het hartje om te kiezen wie jij meeneemt en wie ' + spel.maatje.naam + ' meeneemt.'
        : 'Je neemt er twee mee op pad. Tik op de <strong>1</strong> of de <strong>2</strong> ' +
          'om te kiezen wie er in je team staan.';
}

/* Een rij van vier stipjes, één per lichaamsdeel, in de kleur van zijn rang.
 * Zo zie je in één oogopslag hoe zeldzaam een wezen is zonder tekst te lezen. */
function rangStippen(w) {
  var rij = document.createElement('div');
  rij.className = 'rangrij';
  ['kop', 'lijf', 'poten', 'extra'].forEach(function (sleuf) {
    var rang = Wezen.rangVan(sleuf, w[sleuf]);
    var stip = document.createElement('span');
    stip.className = 'stip';
    stip.style.background = Wezen.RANGEN[rang].kleur;
    stip.title = Wezen.SLEUVEN[sleuf][w[sleuf]].naam + ' (' + Wezen.RANGEN[rang].naam + ')';
    rij.appendChild(stip);
  });
  return rij;
}

/* Volledig overzicht van de vier delen met hun rang, voor het uitkomscherm en de kruishut. */
function rangOverzicht(w) {
  var bak = document.createElement('div');
  bak.className = 'rangbalk';
  [['kop','Kop'], ['lijf','Lijf'], ['poten','Armen en poten'], ['extra','Extra']].forEach(function (p) {
    var rang = Wezen.rangVan(p[0], w[p[0]]);
    var r = Wezen.RANGEN[rang];
    var regel = document.createElement('div');
    regel.className = 'rangregel';
    regel.innerHTML = '<span class="vlag" style="background:' + r.kleur + '"></span>' +
      '<span class="deel">' + p[1] + ': <strong>' + Wezen.SLEUVEN[p[0]][w[p[0]]].naam + '</strong></span>' +
      '<span class="rnaam" style="color:' + r.kleur + '">' + r.naam + '</span>';
    bak.appendChild(regel);
  });
  return bak;
}

function maakKaartje(w, spelerId, actief, bijKlik) {
  var st = statsVan(w);
  var top = Wezen.topRang(w);
  var kaart = document.createElement('div');
  kaart.className = 'kaartje ' + spelerId + (actief ? ' aan' : '') + ' rang-' + top;
  if (Wezen.allesLegendarisch(w)) kaart.classList.add('ultiem');
  var c = document.createElement('canvas');
  kaart.appendChild(c);
  var n = document.createElement('div');
  n.className = 'naam'; n.textContent = w.naam || 'Naamloos';
  kaart.appendChild(n);
  kaart.appendChild(rangStippen(w));
  var cij = document.createElement('div');
  cij.className = 'cijfers';
  cij.textContent = Wezen.ELEMENTEN[w.element].emoji + ' ' + st.kracht + ' / ' + st.snelheid + ' / ' + st.leven;
  kaart.appendChild(cij);
  if (w.uitEi && w.uitEi !== 'gewoon') {
    var ster = document.createElement('img');
    ster.className = 'merk';
    ster.src = '../onderdelen/' + EI_ICOON[w.uitEi] + '.webp';
    kaart.appendChild(ster);
  }
  if (w.schade > 0) {
    var au = document.createElement('div');
    au.className = 'gewond';
    au.textContent = '\u{1FA79}';
    kaart.appendChild(au);
  }
  if (bijKlik) kaart.addEventListener('click', bijKlik);
  tekenIn(c, w, 104, 142);
  return kaart;
}

/* De wezens en de tas zitten onder een knop in plaats van permanent in beeld. Het dorp
 * zelf is het scherm; wat je niet nodig hebt hoort er niet overheen te liggen. */
var ladeOpen = null;

function wisselLade(welke) {
  if (ladeOpen === welke) sluitLade();
  else toonLade(welke);
}
function toonLade(welke) {
  ladeOpen = welke;
  document.getElementById('lade').classList.remove('verborgen');
  document.getElementById('lade-wezens').classList.toggle('verborgen', welke !== 'wezens');
  document.getElementById('lade-tas').classList.toggle('verborgen', welke !== 'tas');
  if (welke === 'wezens') {
    document.getElementById('stal-kop').textContent =
      (samenSpelen() || heeftMaatje()) ? 'Jullie wezens' : 'Je wezens';
    tekenStal('stal-owen');
  } else {
    tekenTas();          // zet zelf de uitleg en de knoppen goed
  }
}
function sluitLade() {
  ladeOpen = null;
  vrijlaatModus = false;      // niet per ongeluk in de vrijlaatstand terugkomen
  vrijlaatVraag = -1;
  eiWegModus = false;
  eiWegVraag = -1;
  document.getElementById('lade').classList.add('verborgen');
}

function tekenDorp() {
  tekenBalken();
  var pk = document.getElementById('k-plekken-wie');
  if (pk) pk.textContent = IN_TESTWERELD ? 'Test' : plekOmschrijving(spel);
  document.getElementById('k-plekken').classList.toggle('verborgen', IN_TESTWERELD);
  tekenVeld();
  if (ladeOpen) toonLade(ladeOpen);
  document.getElementById('k-kruisen').disabled = spel.dorp.lab < 1;
  document.getElementById('k-diepte').classList.toggle('verborgen', !deurOpen());
  /* Als er thuis niets te doen is wijst Op pad zichzelf aan. Vier van de zeven knoppen
   * leiden in het begin naar een leeg scherm, en dan weet je niet waar je moet beginnen. */
  var nietsTeDoen = !spel.tas.length && !hoeveelKlaar() &&
    !Object.keys(GEBOUWEN).some(function (s) { return kanBouwen(s); });
  document.getElementById('k-jungle').classList.toggle('wijst', nietsTeDoen);
  document.getElementById('zeg-dorp').onclick = function () {
    /* Stond hier eerst met het aantal glimstenen en een tip erin. Dat kan niet meer nu
     * alles ingesproken is, en het hoeft ook niet: de tellers staan in beeld. */
    spreek('Jullie zijn in het dorp.', 'uitleg-dorp');
  };
}

/* ---------- bouwen ---------- */

function tekenBouwen() {
  tekenBalken();
  var bak = document.getElementById('gebouwen');
  bak.innerHTML = '';
  Object.keys(GEBOUWEN).forEach(function (sleutel) {
    var g = GEBOUWEN[sleutel];
    var nu = spel.dorp[sleutel];
    var prijs = bouwPrijs(sleutel);
    var vak = document.createElement('div');
    vak.className = 'gebouw' + (helemaalKlaar(sleutel) ? ' max' : '');
    var kop = document.createElement('h3');
    kop.innerHTML = '<img class="gic" src="../onderdelen/' + g.sprite + '.webp" alt=""> ' + g.naam;
    vak.appendChild(kop);
    var niveau = document.createElement('div');
    niveau.className = 'niveau';
    niveau.textContent = nu > 0 ? 'Niveau ' + nu + ' van ' + g.max : 'Nog niet gebouwd';
    vak.appendChild(niveau);
    var wat = document.createElement('div');
    wat.className = 'wat'; wat.textContent = g.wat;
    vak.appendChild(wat);
    var knop = document.createElement('button');
    knop.className = 'knop';
    if (helemaalKlaar(sleutel)) { knop.textContent = 'Helemaal klaar ✓'; knop.disabled = true; }
    else if (komtMetTentje(sleutel)) {
      // niet te koop, maar ook niet af: die krijg je zodra het tentje er staat
      knop.textContent = 'Hoort bij het tentje';
      knop.disabled = true;
    } else if (sleutel !== 'tent' && !tentjeStaatEr()) {
      // op slot tot het tentje er staat, en zeg waaróm: anders lijkt de knop kapot
      knop.textContent = '\u{1F512} Eerst het tentje';
      knop.disabled = true;
      vak.classList.add('wacht');
    } else {
      knop.textContent = (nu ? 'Groter maken' : 'Bouwen') + ' \u{1F48E} ' + prijs;
      knop.disabled = !kanBouwen(sleutel);
      knop.addEventListener('click', function () {
        if (bouw(sleutel)) {
          spreek('Gebouwd!', 'gebouwd');
          tekenBouwen();
        }
      });
    }
    vak.appendChild(knop);
    bak.appendChild(vak);
  });

  // versiering: doet niets voor het spel, maar maakt het dorp van hen
  var deco = document.getElementById('versiering');
  deco.innerHTML = '';
  Object.keys(DECORATIES).forEach(function (sleutel) {
    var d = DECORATIES[sleutel];
    var aantal = spel.veld.filter(function (v) { return v.soort === sleutel; }).length;
    var vak = document.createElement('div');
    vak.className = 'decovak';
    vak.innerHTML = '<img src="../onderdelen/' + d.sprite + '.webp" alt="">' +
      '<div class="dnaam">' + d.naam + '</div>' +
      (aantal ? '<div class="daantal">je hebt er ' + aantal + '</div>' : '');
    var knop = document.createElement('button');
    knop.className = 'knop';
    // versiering is leuk, maar niet voordat er een dorp staat om te versieren
    if (!tentjeStaatEr()) {
      knop.innerHTML = '\u{1F512} Eerst het tentje';
      knop.disabled = true;
    } else {
      knop.innerHTML = 'Koop ' + ic('icoon-glim') + ' ' + d.prijs;
      knop.disabled = spel.glim < d.prijs;
    }
    knop.addEventListener('click', function () {
      if (koopDeco(sleutel)) { spreek('Gekocht!', 'deco-gekocht'); tekenBouwen(); }
    });
    vak.appendChild(knop);
    deco.appendChild(vak);
  });
}

/* ---------- gebieden ---------- */

function tekenZones() {
  tekenBalken();
  var bak = document.getElementById('zones');
  bak.innerHTML = '';
  GEBIEDEN.forEach(function (g, i) {
    var open = i < zonesOpen();
    var vak = document.createElement('div');
    vak.className = 'zone' + (i === spel.zone ? ' aan' : '') + (open ? '' : ' op-slot');
    vak.innerHTML = '<span class="em">' + (open ? g.emoji : '\u{1F512}') + '</span>' +
      (open ? g.naam : 'Op slot') +
      (open ? '' : '<br><span style="font-size:13px">Bouw een uitkijktoren</span>');
    if (open) vak.addEventListener('click', function () {
      spel.zone = i;
      spel.plekken = nieuwePlekken();
      bewaar();
      sluitVondst();
      toon('s-jungle'); tekenJungle();
    });
    bak.appendChild(vak);
  });
}

/* ---------- jungle ---------- */

/* Elk gebied is een zoekplaat: de acht plekken zijn in het schilderij zelf geschilderd.
 * Daarboven liggen alleen onzichtbare rondjes. Dat is het verschil met hiervoor, toen er
 * acht losse plaatjes op een achtergrond geplakt stonden: dan kies je er een van acht,
 * nu moet je de plaat echt afzoeken.
 *
 * x, y en r zijn verhoudingen van de téékening, niet van het scherm — de plek zit immers
 * in de verf. r is een deel van de breedte, zodat een rondje rond blijft. De plaat wordt
 * daarom passend getoond en niet bijgesneden; anders zou een plek buiten beeld kunnen
 * vallen en was hij niet te vinden.
 *
 * De volgorde is die van spel.plekken: wat er verstopt zit wisselt per tocht, de plaatsen
 * niet. De namen zijn er voor het voorlezen. */
var ZOEKSCENES = [
  { beeld: 'zoekscene-jungle.webp', plekken: [
    { naam: 'de hangende lianen',    x: 0.660, y: 0.160, r: 0.075 },
    { naam: 'de lichtgevende struik', x: 0.420, y: 0.355, r: 0.075 },
    { naam: 'de stapel stenen',      x: 0.595, y: 0.393, r: 0.070 },
    { naam: 'de holle boomstam',     x: 0.260, y: 0.440, r: 0.080 },
    { naam: 'de termietenheuvel',    x: 0.870, y: 0.460, r: 0.075 },
    { naam: 'de plas',               x: 0.560, y: 0.700, r: 0.090 },
    { naam: 'de oude boomstronk',    x: 0.150, y: 0.700, r: 0.090 },
    { naam: 'de varens',             x: 0.400, y: 0.780, r: 0.075 }
  ] },
  { beeld: 'zoekscene-moeras.webp', plekken: [
    { naam: 'het hangende mos',      x: 0.680, y: 0.150, r: 0.080 },
    { naam: 'de modderheuvel',       x: 0.365, y: 0.265, r: 0.075 },
    { naam: 'de struik met bloemen', x: 0.170, y: 0.370, r: 0.085 },
    { naam: 'het hoge riet',         x: 0.550, y: 0.370, r: 0.075 },
    { naam: 'de boomstronk met paddenstoelen', x: 0.810, y: 0.425, r: 0.090 },
    { naam: 'de holle boomstam',     x: 0.320, y: 0.710, r: 0.080 },
    { naam: 'het donkere water',     x: 0.625, y: 0.725, r: 0.090 },
    { naam: 'de gladde stenen',      x: 0.940, y: 0.730, r: 0.070 }
  ] },
  { beeld: 'zoekscene-grotten.webp', plekken: [
    { naam: 'de hangende wortels',   x: 0.185, y: 0.203, r: 0.080 },
    { naam: 'de gele kristallen',    x: 0.740, y: 0.345, r: 0.065 },
    { naam: 'de stapel stenen',      x: 0.873, y: 0.354, r: 0.055 },
    { naam: 'de hoge druipsteen',    x: 0.415, y: 0.425, r: 0.070 },
    { naam: 'de stenen boomstam',    x: 0.235, y: 0.583, r: 0.080 },
    { naam: 'de witte varens',       x: 0.660, y: 0.590, r: 0.080 },
    { naam: 'de plas',               x: 0.400, y: 0.760, r: 0.090 },
    { naam: 'de versteende stronk',  x: 0.800, y: 0.770, r: 0.090 }
  ] }
];

function zoekScene() { return ZOEKSCENES[spel.zone % ZOEKSCENES.length]; }

/* Waar de plaat precies staat binnen het veld.
 *
 * De plaat krijgt alleen de ruimte tússen de twee zwevende balken. Dat moet: de balken
 * liggen erover, en een zoekplek die achter de knopbalk verdwijnt is niet te vinden.
 * Eerst stond de plaat over de volle hoogte en vielen de onderste twee plekken in de
 * grotten half achter 'Naar huis'. De randen die overblijven worden gevuld door de vage
 * kopie eronder, dus je ziet er niets van. */
function plaatVlak() {
  var veld = document.getElementById('jungle-veld');
  var achter = document.getElementById('jungle-achter');
  var breed = veld.clientWidth;
  var hoog = veld.clientHeight;
  if (!breed || !hoog) return { links: 0, boven: 0, breed: 0, hoog: 0 };

  var vr = veld.getBoundingClientRect();
  var hud = document.getElementById('hud-jungle');
  var balk = document.querySelector('#s-jungle .balk');
  var boven = 0, onder = 0;
  if (hud && hud.offsetHeight) boven = Math.max(0, hud.getBoundingClientRect().bottom - vr.top + 10);
  if (balk && balk.offsetHeight) onder = Math.max(0, vr.bottom - balk.getBoundingClientRect().top + 10);
  var vrij = Math.max(120, hoog - boven - onder);

  // het beeld zelf krijgt precies die band, zodat 'passend' en deze som hetzelfde zeggen
  achter.style.top = boven + 'px';
  achter.style.height = vrij + 'px';

  var bb = achter.naturalWidth || 2688, bh = achter.naturalHeight || 1520;
  var schaal = Math.min(breed / bb, vrij / bh);
  var pb = bb * schaal, ph = bh * schaal;
  var vlak = { links: (breed - pb) / 2, boven: boven + (vrij - ph) / 2, breed: pb, hoog: ph };

  var lijst = document.getElementById('jungle-lijst');
  if (lijst) {
    lijst.style.left = Math.round(vlak.links) + 'px';
    lijst.style.top = Math.round(vlak.boven) + 'px';
    lijst.style.width = Math.round(vlak.breed) + 'px';
    lijst.style.height = Math.round(vlak.hoog) + 'px';
  }
  return vlak;
}

function tekenJungle() {
  tekenBalken();

  /* Het vondstkaartje hoort bij de vorige tik, niet bij dit scherm. Kwam je uit de arena
   * terug met "Verder zoeken", dan stond "Er springt iets uit de struiken!" er nog, midden
   * over de zoekplaat heen, terwijl dat beest al lang verjaagd was. Hier opruimen dekt elke
   * manier waarop je de jungle binnenkomt; `zoek()` tekent eerst en zet daarna zijn eigen
   * kaartje neer, dus een echte vondst blijft gewoon staan. */
  sluitVondst();

  var scene = zoekScene();
  var achter = document.getElementById('jungle-achter');
  var waas = document.getElementById('jungle-waas');
  var wil = '../art/achtergronden/' + scene.beeld;
  if (achter.getAttribute('src') !== wil) {
    achter.src = wil;
    waas.src = wil;
    // de maten van de plaat zijn pas bekend als hij geladen is
    achter.onload = function () { plaatsZoekplekken(); };
  }

  var bak = document.getElementById('plekken');
  bak.innerHTML = '';
  var over = 0;

  spel.plekken.forEach(function (p, i) {
    var plek = scene.plekken[i % scene.plekken.length];
    var knop = document.createElement('button');
    knop.className = 'zoekplek' + (p.gezocht ? ' gezocht' : '');
    knop.title = p.gezocht ? 'Hier hebben jullie al gezocht' : 'Zoek bij ' + plek.naam;
    knop.dataset.plek = String(i);
    knop.style.zIndex = String(100 + Math.round(plek.y * 500));
    if (!p.gezocht) {
      over++;
      knop.addEventListener('click', function (e) { e.stopPropagation(); zoek(i); });
    } else {
      knop.disabled = true;
    }
    bak.appendChild(knop);
  });

  plaatsZoekplekken();
  zetZoektip();

  document.getElementById('jungle-kop').textContent = over
    ? GEBIEDEN[spel.zone].naam + ' · kijk goed, nog ' + over + ' plekken'
    : GEBIEDEN[spel.zone].naam + ' · alles doorzocht, ga maar naar huis';
}

/* De rondjes worden in pixels gezet en niet in procenten, want ze moeten rond zijn en op
 * de plaat staan, niet op het veld. Bij elke maatverandering opnieuw. */
function plaatsZoekplekken() {
  var v = plaatVlak();
  if (v.breed < 2) return;   // het scherm staat nog niet aan; de waarnemer hieronder roept opnieuw
  var scene = zoekScene();
  var knoppen = document.getElementById('plekken').querySelectorAll('.zoekplek');
  Array.prototype.forEach.call(knoppen, function (knop) {
    var plek = scene.plekken[(knop.dataset.plek | 0) % scene.plekken.length];
    // een vinger is breder dan een muisaanwijzer: nooit kleiner dan 46 pixels straal
    var straal = Math.max(46, plek.r * v.breed);
    knop.style.left = Math.round(v.links + plek.x * v.breed - straal) + 'px';
    knop.style.top = Math.round(v.boven + plek.y * v.hoog - straal) + 'px';
    knop.style.width = Math.round(straal * 2) + 'px';
    knop.style.height = Math.round(straal * 2) + 'px';
  });
}

/* Niets aanwijzen is spannend, maar vastlopen is dat niet. Gebeurt er een tijdje niets,
 * dan gaat één plek die nog niet doorzocht is zachtjes gloeien. */
var zoektipKlok = null;

function stopZoektip() {
  if (zoektipKlok) { clearInterval(zoektipKlok); zoektipKlok = null; }
}

function zetZoektip() {
  stopZoektip();
  var stil = 0;
  zoektipKlok = setInterval(function () {
    var scherm = document.getElementById('s-jungle');
    if (!scherm || scherm.classList.contains('verborgen')) return stopZoektip();
    stil += 2;
    var open = document.getElementById('plekken')
      .querySelectorAll('.zoekplek:not(.gezocht)');
    Array.prototype.forEach.call(open, function (k) { k.classList.remove('tip'); });
    if (stil >= 16 && open.length) {
      open[Math.floor(Math.random() * open.length)].classList.add('tip');
    }
  }, 2000);
}

/* Een tik náást een plek mag niet in het niets vallen; dan denkt een kind dat het spel
 * stuk is. Een rimpeltje zegt: gezien, maar hier zit niets. */
function zetMisrimpel() {
  var veld = document.getElementById('jungle-veld');
  veld.addEventListener('click', function (e) {
    if (e.target.closest('.zoekplek') || e.target.closest('.vondstkaart')) return;
    var vlak = veld.getBoundingClientRect();
    var ring = document.createElement('div');
    ring.className = 'mis';
    ring.style.left = (e.clientX - vlak.left) + 'px';
    ring.style.top = (e.clientY - vlak.top) + 'px';
    veld.appendChild(ring);
    setTimeout(function () { ring.remove(); }, 520);
  });
}

/* Het vondstkaartje bleef staan tot je iets anders zocht of wegging, en het ligt midden
 * over de zoekplaat heen. Dus: een kruisje erop, hij gaat vanzelf weg, en een tik erop doet
 * hem ook dicht. De tijd schaalt met de lengte van de tekst, want een geheim is drie regels
 * en "niks gevonden" is er een; en hij is nooit korter dan het voorlezen duurt. */
var vondstKlok = null;

function sluitVondst() {
  if (vondstKlok) { clearTimeout(vondstKlok); vondstKlok = null; }
  document.getElementById('vondst').classList.add('verborgen');
}

function toonVondst(html, zegTekst, sleutel) {
  var vak = document.getElementById('vondst');
  if (vondstKlok) { clearTimeout(vondstKlok); vondstKlok = null; }
  vak.classList.remove('verborgen');
  // de kaart is zelf al glas, dus geen paneel in een paneel
  vak.innerHTML = html + '<button class="vondstweg" title="Weg">&#10005;</button>';
  vak.querySelector('.vondstweg').addEventListener('click', function (e) {
    e.stopPropagation();
    sluitVondst();
  });
  vak.onclick = sluitVondst;
  if (zegTekst) spreek(zegTekst, sleutel);

  var leesTijd = Math.min(12000, 2600 + vak.textContent.length * 55);
  vondstKlok = setTimeout(function () { vondstKlok = null; sluitVondst(); }, leesTijd);
  return vak;
}

function zoek(i) {
  var plek = spel.plekken[i];
  if (plek.gezocht) return;
  plek.gezocht = true;
  warmteErbij();          // doorspelen maakt de eieren warm, niet wachten
  bewaar();
  tekenJungle();

  if (plek.soort === 'niets') {
    toonVondst('<p>&#127796; Niks. Alleen een lege schelp en een boze kever.</p>', 'Niks gevonden.', 'vondst-niets');
    return;
  }
  if (plek.soort === 'glim') {
    var aantal = 1 + Math.floor(Math.random() * 3) + spel.zone;
    spel.glim += aantal; bewaar(); tekenBalken();
    var steentjes = aantal === 1 ? 'glimsteen' : 'glimstenen';
    toonVondst('<p>&#128142; <strong>' + aantal + ' ' + steentjes + '!</strong> Daar kan je mee bouwen.</p>',
      'Glimstenen gevonden.', 'vondst-glim');
    return;
  }
  if (plek.soort === 'geheim') {
    if (spel.geheimen < HINTS.length) spel.geheimen++;
    bewaar(); tekenBalken();
    toonVondst('<p>&#128081; <strong>Een geheim!</strong><br>' + HINTS[spel.geheimen - 1] +
      '</p><p>Je hebt er nu <strong>' + spel.geheimen + ' van de ' + HINTS.length + '</strong>.</p>',
      'Een geheim gevonden.', ['vondst-geheim', 'geheim-' + spel.geheimen]);
    return;
  }
  if (plek.soort === 'sleutel') {
    spel.sleutels = (spel.sleutels || 0) + 1;
    bewaar(); tekenBalken();
    var nodig = sleutelsVoor((spel.diepte || 0) + 1);
    var tekort = Math.max(0, nodig - spel.sleutels);
    /* Let op de eerste verdieping: die kost geen sleutels, dus "de volgende staat open"
     * zou net doen alsof deze sleutel dat gedaan heeft. */
    var zin = !nodig ? 'Bewaar hem, straks heb je hem nodig om dieper te komen.'
            : tekort ? 'Nog ' + tekort + ' en de volgende verdieping gaat open.'
                     : 'De volgende verdieping staat open.';
    toonVondst('<p>' + ic('icoon-sleutel') + ' <strong>Een Wachterssleutel!</strong></p>' +
      '<p>Je hebt er nu <strong>' + spel.sleutels + '</strong>. ' + zin + '</p>',
      'Een Wachterssleutel gevonden.', 'vondst-sleutel');
    return;
  }
  if (plek.soort === 'ei') {
    if (tasVol()) {
      toonVondst('<p>&#129370; Er ligt een ei... maar <strong>je tas zit vol</strong>.</p>' +
        '<p>Ga naar huis om ze in de nesten te leggen. Of gooi thuis bij je tas een ei weg ' +
        'dat je toch niet wil, dan heb je weer plek.</p>',
        'Er ligt een ei, maar je tas zit vol.', 'vondst-tasvol');
      return;
    }
    var soort = trekEisoort();
    spel.tas.push(soort);
    bewaar(); tekenBalken();
    var e = EISOORTEN[soort];
    toonVondst('<p>' + eiPlaatje(soort) + ' <strong>' + e.naam + '!</strong> In je tas.</p>' +
      '<p>Hij heeft <strong>' + e.warmte + ' warmte</strong> nodig voor hij uitkomt.' +
      (soort !== 'gewoon' ? ' Hier komt iets sterks uit.' : '') + '</p>' +
      (tasVol() ? '<p><strong>Je tas zit nu vol.</strong> Tijd om naar huis te gaan.</p>' : ''),
      'Een ei gevonden.', 'vondst-ei');
    return;
  }
  toonVondst('<p>&#129503; <strong>Er springt iets uit de struiken!</strong></p>', 'Pas op!', 'vecht-pasop');
  /* Deze wekker moet je kunnen afzetten. Tikte je binnen die 0,9 seconde op "Naar huis",
   * dan werd je alsnog de arena in getrokken; tikte je een tweede beest aan, dan liepen er
   * twee gevechten door elkaar heen. */
  zetWekker(naarArena, 900);
}

/* Eén wekker tegelijk voor dingen die het scherm wisselen. Bij elke schermwissel gaat hij
 * af, zodat er nooit een gevecht of een aanval begint nadat je al ergens anders bent. */
var wekker = null;
function zetWekker(wat, na) {
  stopWekker();
  wekker = setTimeout(function () { wekker = null; wat(); }, na);
}
function stopWekker() {
  if (wekker !== null) { clearTimeout(wekker); wekker = null; }
}

/* ---------- thuiskomen en uitkomen ---------- */

var uitkomstRij = [];

/* Thuiskomen laat de eieren met rust. Een ei komt pas uit als er iemand op tikt, want
 * dat moment is het leukste van het hele spel en dat moet je zelf doen, niet overkomen. */
function naarHuis() {
  if (spel.dorp.rust >= 1) rustUit();
  bewaar();
  toon('s-dorp');
  tekenDorp();
}

/* Eén nest opendoen: dat ene ei komt uit, de rest blijft gewoon liggen.
 *
 * Het slot is nodig omdat het nest in het dorp blijft bestaan terwijl de onthulling loopt.
 * Tikte je twee keer snel, dan haalde de tweede tik het volgende ei uit de lijst en
 * overschreef het wezen van de eerste. Dan was er een ei weg dat nooit is uitgekomen. */
var uitkomstBezig = false;

function broedUit(nestIndex) {
  if (uitkomstBezig) return;
  var n = spel.nesten[nestIndex];
  if (!n || n.warmte < n.nodig) return;
  uitkomstBezig = true;
  spel.nesten.splice(nestIndex, 1);
  var w = wezenUitEi(n.soort);
  bewaar();
  uitkomstRij = [w];
  volgendeUitkomst();
}

/* De onthulling. Eerst wiebelt en scheurt het ei twee tellen lang, dan knalt het open en
 * springt de kaart tevoorschijn, en pas daarna lichten de vier rangen één voor één op.
 * De spanning zit in die volgorde: tot het laatste stipje weet je niet wat je hebt. */
var onthulKlokken = [];

function speelOnthulling(w, klaar) {
  onthulKlokken.forEach(clearTimeout);
  onthulKlokken = [];

  var onthul = document.getElementById('onthul');
  var kaart = document.getElementById('uitkomen-kaart');
  onthul.classList.remove('verborgen');
  kaart.classList.add('verborgen');

  /* De animaties opnieuw laten starten door het blok even uit de pagina te halen. De kloon
   * neemt alles over wat er op dat moment op stond, dus klasse en tekst eerst terugzetten:
   * anders hield elk volgend ei de paarse schateizweem en begon de onthulling met het
   * eindtekstje van de vorige. */
  var vers = onthul.cloneNode(true);
  onthul.parentNode.replaceChild(vers, onthul);
  var groot = vers.querySelector('#groot-ei');
  groot.src = '../onderdelen/' + EI_ICOON[w.uitEi] + '.webp';
  groot.classList.toggle('schatei', w.uitEi === 'schat');

  var tekst = vers.querySelector('#onthultekst');
  tekst.textContent = 'Er beweegt iets...';
  onthulKlokken.push(setTimeout(function () { tekst.textContent = 'Er zit een barst in!'; }, 950));
  onthulKlokken.push(setTimeout(function () { tekst.textContent = 'Hij gaat open...'; }, 1600));
  onthulKlokken.push(setTimeout(function () {
    vers.classList.add('verborgen');
    klaar();
  }, 2350));
}

function volgendeUitkomst() {
  if (!uitkomstRij.length) { uitkomstBezig = false; toon('s-dorp'); tekenDorp(); return; }
  var w = uitkomstRij[0];
  var kaart = document.getElementById('uitkomen-kaart');
  kaart.innerHTML = '';
  var e = EISOORTEN[w.uitEi];

  var kop = document.createElement('h2');
  kop.style.margin = '0 0 6px';
  kop.innerHTML = eiPlaatje(w.uitEi) + ' Uit het ' + e.naam.toLowerCase() + ' kruipt...';
  kaart.appendChild(kop);

  var c = document.createElement('canvas');
  c.style.cssText = 'display:block;margin:0 auto';
  kaart.appendChild(c);

  var st = statsVan(w);
  var rangen = rangOverzicht(w);
  rangen.classList.add('traag');       // de vier rangen lichten één voor één op
  kaart.appendChild(rangen);
  var info = document.createElement('p');
  info.innerHTML = Wezen.ELEMENTEN[w.element].emoji + ' Kracht ' + st.kracht +
    ' &middot; Snelheid ' + st.snelheid + ' &middot; Leven ' + st.leven;
  if (Wezen.allesLegendarisch(w)) {
    info.innerHTML += '<br><strong style="color:#ffc94a">&#11088; ALLES LEGENDARISCH! ' +
      'Dit is het wezen waar jullie al die tijd naar zochten.</strong>';
  }
  kaart.appendChild(info);

  var naamvak = document.createElement('input');
  naamvak.type = 'text';
  naamvak.placeholder = 'Hoe heet hij?';
  naamvak.value = w.naam || '';
  kaart.appendChild(naamvak);

  /* Geen "voor wie is hij" meer: hij is van allebei. Wel om de beurt een naam verzinnen,
   * zodat er iets te kiezen valt zonder dat er iemand naast het mooiste wezen grijpt. */
  var beurt = SPELERS.filter(function (s) { return s.id === spel.naamBeurt; })[0] || SPELERS[0];
  var wie = document.createElement('p');
  wie.className = 'zacht';
  wie.style.margin = '10px 0 4px';
  wie.innerHTML = (samenSpelen() || heeftMaatje())
    ? beurt.emoji + ' <strong>' + beurt.naam + '</strong> mag hem een naam geven.'
    : beurt.emoji + ' Geef hem een naam.';
  kaart.insertBefore(wie, naamvak);

  var rij = document.createElement('div');
  rij.className = 'knoprij';
  rij.style.marginTop = '12px';
  var klaarKnop = document.createElement('button');
  klaarKnop.className = 'knop';
  klaarKnop.textContent = '\u{1F44D} Hij hoort er nu bij!';
  klaarKnop.addEventListener('click', function () {
    /* Twee keer tikken van opwinding mag geen twee wezens opleveren. Het scherm wisselt
     * pas na deze klik, dus zonder slot komt de tweede klik er nog doorheen. */
    if (klaarKnop.disabled) return;
    klaarKnop.disabled = true;
    w.naam = naamvak.value.trim() || verzinNaam(w);
    voegWezenToe(w, beurt.id);
    uitkomstRij.shift();
    volgendeUitkomst();
  });
  rij.appendChild(klaarKnop);

  /* Meteen laten gaan. Zonder deze knop moest je een wezen dat je niet wilde eerst in de
   * stal zetten en daarna weer opzoeken om hem vrij te laten, en met maar twee plekken in
   * de stal zat je dan vast. Hij levert hetzelfde op als vrijlaten uit de stal, en hij
   * komt gewoon in het boek: wat je gezien hebt, heb je gezien.
   *
   * Twee tikken, want dit is het enige knopje op dit scherm dat iets weggooit, en het
   * staat naast een wezen waar net vijf minuten op gewacht is. */
  var gaanKnop = document.createElement('button');
  gaanKnop.className = 'knop rustig';
  gaanKnop.innerHTML = '\u{1F343} Laat hem gaan ' + ic('icoon-glim') + ' +' + vrijlaatOpbrengst(w);
  var zekerGevraagd = false;
  gaanKnop.addEventListener('click', function () {
    if (klaarKnop.disabled) return;
    if (!zekerGevraagd) {
      zekerGevraagd = true;
      gaanKnop.classList.add('bevestig');
      gaanKnop.textContent = 'Zeker weten? Tik nog een keer';
      spreek('Weet je het zeker? Dan gaat hij de jungle in.', 'zeker-vrijlaten');
      return;
    }
    klaarKnop.disabled = true;
    gaanKnop.disabled = true;
    w.naam = naamvak.value.trim() || verzinNaam(w);
    laatMeteenGaan(w);
    spreek('Hij rent de jungle in en laat glimstenen achter.', 'vrijlaten-weg');
    uitkomstRij.shift();
    volgendeUitkomst();
  });
  rij.appendChild(gaanKnop);
  kaart.appendChild(rij);

  toon('s-uitkomen');
  spreek('Er beweegt iets in het ei!', 'ei-beweegt');

  speelOnthulling(w, function () {
    kaart.classList.remove('verborgen');
    kaart.classList.remove('wipt');     // anders springt alleen het eerste ei van de sessie
    void kaart.offsetWidth;
    kaart.classList.add('wipt');
    // een zeldzame of beter mag even stralen, dat is tenslotte waar je op hoopte
    kaart.classList.toggle('mooi', Wezen.RANGORDE.indexOf(Wezen.topRang(w)) >= 2);
    tekenIn(c, w, 180, 240);
    var top = Wezen.RANGEN[Wezen.topRang(w)];
    setTimeout(function () {
      var bijzonder = Wezen.RANGORDE.indexOf(Wezen.topRang(w)) >= 2;
      spreek(bijzonder ? 'Wauw! Een wezen met een bijzonder onderdeel!'
                       : 'Er is een wezen uitgekomen!',
             bijzonder ? 'ei-mooi' : 'ei-uit');
    }, 1700);
  });
}

/* ---------- arena ---------- */

var gekozenDoel = null;

function naarArena() {
  startGevecht();
  gekozenDoel = null;
  toon('s-arena');
  tekenArena();
  volgendeBeurt(true);
}

/* De zandvloer zit in de geschilderde achtergrond en die wordt bijgesneden naar het venster.
 * Een vast percentage zou de vechters bij een ander vensterformaat in de struiken of door de
 * onderrand zetten, dus de staanlijn wordt uitgerekend, net als op het dorpsveld. */
var STAANLIJN = 0.72;   // waar in de tekening de voeten horen te staan

function zetStrijdvloer() {
  var vloer = document.querySelector('.strijdvloer');
  if (!vloer) return;
  var hoog = window.innerHeight || 1;
  var v = coverVlak(window.innerWidth || 1, hoog);
  var y = (v.boven + STAANLIJN * v.hoog) * hoog;
  /* In een laag venster snijdt de achtergrond zoveel weg dat de staanlijn achter de
   * knoppenbalk zou vallen. Dan wint de balk: je moet de vechters kunnen zien. */
  /* De balk wordt pas na het tekenen met knoppen gevuld, dus meet niet te optimistisch. */
  var balk = document.querySelector('#s-arena .balk');
  var ruimte = hoog - (Math.max(balk ? balk.offsetHeight : 0, 130) + 24);
  vloer.style.top = (Math.min(y, ruimte) / hoog * 100) + '%';
}

function tekenVechter(w, wie) {
  var vak = document.createElement('div');
  vak.className = 'vechter ' + (w.kant === 'wild' ? 'wild' : w.kant) +
    (levend(w) ? '' : ' dood') + (w.wachter || w.sprite ? ' baas' : '');
  if (wie) vak.dataset.wie = wie;
  var plaat = document.createElement('div');
  plaat.className = 'naamplaat';
  plaat.textContent = Wezen.ELEMENTEN[w.element].emoji + ' ' + (w.naam || 'Wezen') +
    (w.niveau ? ' · ' + w.niveau : '');
  vak.appendChild(plaat);

  /* Een Wachter is tegenwoordig een gestapeld wezen zoals elk ander, alleen groter:
   * dan ziet elke verdieping er anders uit. Alleen een oud opgeslagen gevecht kan nog een
   * vaste sprite hebben. */
  if (w.sprite) {
    var img = document.createElement('img');
    img.className = 'baasbeeld';
    img.src = '../onderdelen/' + w.sprite + '.webp';
    vak.appendChild(img);
  } else {
    var c = document.createElement('canvas');
    vak.appendChild(c);
    // een Wachter is een kop groter dan een gewoon wezen, anders is hij geen baas
    if (w.wachter) tekenIn(c, w, 240, 326); else tekenIn(c, w, 150, 204);
  }

  var balk = document.createElement('div');
  balk.className = 'balkje';
  var vul = document.createElement('span');
  vul.style.width = Math.round(w.levens / maxLevens(w) * 100) + '%';
  balk.appendChild(vul);
  vak.appendChild(balk);

  if (w.schild) {
    var sb = document.createElement('div');
    sb.className = 'schildbalk';
    sb.innerHTML = '<span style="width:100%"></span>';
    sb.title = 'Schild: breekt als jullie allebei in dezelfde ronde slaan';
    vak.appendChild(sb);
  }
  return vak;
}

function tekenArena() {
  document.getElementById('t-ronde').textContent = 'Ronde ' + strijd.ronde;
  var h = document.getElementById('partij-helden'); h.innerHTML = '';
  var v = document.getElementById('partij-wild'); v.innerHTML = '';
  strijd.helden.forEach(function (w, i) { h.appendChild(tekenVechter(w, 'h' + i)); });
  strijd.vijanden.forEach(function (w, i) {
    var vak = tekenVechter(w, 'v' + i);
    if (gekozenDoel === i) vak.classList.add('doel');
    if (levend(w)) vak.addEventListener('click', function () {
      gekozenDoel = i;
      // meteen laten zien welk beest gekozen is, anders weet niemand of het gelukt is
      Array.prototype.forEach.call(document.querySelectorAll('.vechter.doel'),
        function (d) { d.classList.remove('doel'); });
      vak.classList.add('doel');
    });
    v.appendChild(vak);
  });
  var verslag = document.getElementById('verslag');
  verslag.innerHTML = '';
  strijd.verslag.slice(-2).forEach(function (r) {
    var d = document.createElement('div'); d.innerHTML = r; verslag.appendChild(d);
  });
  zetStrijdvloer();
  speelSlag();
}

/* ---------- de klap in beeld ---------- */

/* tekenArena bouwt de vechters elke beurt opnieuw op, dus een animatie overleeft dat niet.
 * De zet wordt daarom eerst onthouden en pas afgespeeld op de verse elementen. */
var slagOmTeTonen = null;
function slaAan(van, naar, soort) { slagOmTeTonen = { van: van, naar: naar, soort: soort }; }

function wieVan(w) {
  var i = strijd.helden.indexOf(w);
  if (i >= 0) return 'h' + i;
  i = strijd.vijanden.indexOf(w);
  return i >= 0 ? 'v' + i : null;
}
function vechterVak(w) {
  var wie = w && wieVan(w);
  return wie ? document.querySelector('.vechter[data-wie="' + wie + '"]') : null;
}
function zetKlasse(vak, klasse) {
  if (!vak) return;
  vak.classList.remove(klasse);
  void vak.offsetWidth;          // de browser dwingen de animatie opnieuw te starten
  vak.classList.add(klasse);
}

function speelSlag() {
  var s = slagOmTeTonen;
  slagOmTeTonen = null;
  if (!s) return;

  if (s.soort === 'help') {
    zetKlasse(vechterVak(s.naar), 'geholpen');
    return;
  }

  zetKlasse(vechterVak(s.van), 'valtaan');

  // de baas raakt iedereen tegelijk, dan schudt de hele ploeg
  var geraakt = s.naar ? [s.naar] : strijd.helden.filter(levend);
  geraakt.forEach(function (w) {
    var vak = vechterVak(w);
    if (!vak) return;
    zetKlasse(vak, 'geraakt');
    var bots = document.createElement('span');
    bots.className = 'bots';
    vak.appendChild(bots);
    setTimeout(function () { if (bots.parentNode) bots.parentNode.removeChild(bots); }, 700);
  });
}

function meld(tekst, zeg, sleutel) { strijd.verslag.push(tekst); if (zeg) spreek(zeg, sleutel); }
function levendeVijanden() { return strijd.vijanden.filter(levend); }
function levendeHelden() { return strijd.helden.filter(levend); }

function volgendeBeurt(eerste) {
  if (!levendeVijanden().length) return klaarGevecht(true);
  if (!levendeHelden().length) return klaarGevecht(false);
  var held = strijd.helden[strijd.aanDeBeurt];
  if (!held || !levend(held)) {
    strijd.aanDeBeurt++;
    if (strijd.aanDeBeurt >= strijd.helden.length) return vijandenAanZet();
    return volgendeBeurt();
  }
  if (eerste) meld('Een wild wezen valt aan!', 'Pas op, een wild wezen!', 'vecht-pasop');
  var speler = spelerVan(held.kant);
  /* Samen: wie van de twee aan zet is. Alleen: twee keer 'Owen is aan de beurt' zegt niks,
     dus dan staat er welk wezen er aan zet is. */
  document.getElementById('t-beurt').textContent = (samenSpelen() || heeftMaatje())
    ? speler.emoji + ' ' + speler.naam + ' is aan de beurt'
    : speler.emoji + ' ' + (held.naam || 'Jouw wezen') + ' is aan de beurt';
  tekenArena();
  tekenActies(held, speler);
}

function tekenActies(held, speler) {
  var bak = document.getElementById('acties');
  bak.innerHTML = '';
  var maatje = strijd.helden.filter(function (w) { return w !== held; })[0];

  var slaan = document.createElement('button');
  slaan.className = 'knop';
  slaan.textContent = '\u{2694}\u{FE0F} Sla!';
  slaan.addEventListener('click', function () { doeZet(held, speler, 'slaan'); });
  bak.appendChild(slaan);

  var el = document.createElement('button');
  el.className = 'knop blauw';
  var klaar = strijd.elementKlaar[speler.id];
  el.textContent = Wezen.ELEMENTEN[held.element].emoji + ' Elementkracht!' + (klaar ? '' : ' (wachten)');
  el.disabled = !klaar;
  el.addEventListener('click', function () { doeZet(held, speler, 'element'); });
  bak.appendChild(el);

  if (maatje && levend(maatje) && !strijd.helpGebruikt[speler.id] && maatje.levens < maxLevens(maatje)) {
    var help = document.createElement('button');
    help.className = 'knop rustig';
    help.textContent = '\u{1F91D} Help ' + (maatje.naam || 'je vriend');
    help.addEventListener('click', function () { doeZet(held, speler, 'help'); });
    bak.appendChild(help);
  }
}

function doeZet(held, speler, soort) {
  document.getElementById('acties').innerHTML = '';
  if (soort === 'help') {
    var maatje = strijd.helden.filter(function (w) { return w !== held; })[0];
    var terug = Math.round(maxLevens(maatje) * 0.3);
    maatje.levens = Math.min(maxLevens(maatje), maatje.levens + terug);
    strijd.helpGebruikt[speler.id] = true;
    meld('&#129309; ' + held.naam + ' helpt ' + maatje.naam + ' en geeft ' + terug + ' levens terug!',
      held.naam + ' helpt ' + maatje.naam + '.');
    slaAan(held, maatje, 'help');
    return naVolgende();
  }

  var vijanden = levendeVijanden();
  var doel = (gekozenDoel !== null && strijd.vijanden[gekozenDoel] && levend(strijd.vijanden[gekozenDoel]))
    ? strijd.vijanden[gekozenDoel] : vijanden[0];
  gekozenDoel = null;

  var maal = soort === 'element' ? 1.8 : 1;
  if (soort === 'element') strijd.elementKlaar[speler.id] = false;

  strijd.doelwitVan[speler.id] = strijd.vijanden.indexOf(doel);
  var samen = Object.keys(strijd.doelwitVan).length === 2 &&
    strijd.doelwitVan.owen === strijd.doelwitVan.jake;
  if (samen) maal *= 1.4;

  /* Het schild van de Wachter is de reden dat je dit niet alleen kan. Sla je in je
   * eentje, dan houdt het schild het meeste tegen. Slaan jullie allebei op hem in
   * dezelfde ronde, dan breekt het open. */
  var schildHield = false;
  if (doel.schild && !samen) { maal *= 0.45; schildHield = true; }

  var uit = doeSchade(held, doel, maal);
  var regel = (soort === 'element' ? Wezen.ELEMENTEN[held.element].emoji + ' ' : '\u{2694}\u{FE0F} ') +
    held.naam + ' raakt ' + doel.naam + ' voor <strong>' + uit.schade + '</strong>!';
  if (uit.factor > 1) regel += ' Heel effectief!';
  if (uit.factor < 1) regel += ' Maar niet zo sterk...';
  if (samen) regel += ' <strong>Supervrienden-bonus!</strong>';
  if (schildHield) regel += ' Maar het <strong>schild</strong> houdt bijna alles tegen.';
  else if (samen && doel.schild) regel += ' <strong>Het schild breekt open!</strong>';
  meld(regel, held.naam + ' raakt ' + doel.naam + (uit.factor > 1 ? '. Heel effectief!' : '.'));
  if (!levend(doel)) meld('&#128165; ' + doel.naam + ' is verslagen!', doel.naam + ' is verslagen!');
  slaAan(held, doel);
  naVolgende();
}

function naVolgende() {
  tekenArena();
  strijd.aanDeBeurt++;
  setTimeout(function () {
    if (!levendeVijanden().length) return klaarGevecht(true);
    if (strijd.aanDeBeurt >= strijd.helden.length) vijandenAanZet();
    else volgendeBeurt();
  }, 700);
}

function vijandenAanZet() {
  document.getElementById('t-beurt').textContent = '\u{1F43E} De wilde wezens';
  var beurten = levendeVijanden().slice();
  var i = 0;
  (function volgende() {
    if (i >= beurten.length) return nieuweRonde();
    var v = beurten[i++];
    if (!levend(v)) return volgende();
    var doelen = levendeHelden();
    if (!doelen.length) return klaarGevecht(false);
    /* De Wachter vecht anders dan een wild beest: hij laadt eerst zichtbaar op en slaat
     * dan iedereen tegelijk. Dat geeft de jongens een ronde om te genezen. */
    if (v.wachter || v.sprite) {
      if (strijd.baasLaadt) {
        strijd.baasLaadt = false;
        meld('\u{1F4A5} <strong>' + v.naam + ' slaat met beide vuisten op de grond!</strong>',
          'De Wachter slaat met beide vuisten op de grond!');
        levendeHelden().forEach(function (h) {
          var u = doeSchade(v, h, 1.35);
          meld('&#128165; ' + h.naam + ' krijgt <strong>' + u.schade + '</strong>!');
          if (!levend(h)) meld('&#128561; ' + h.naam + ' kan niet meer!');
        });
        slaAan(v, null);           // null betekent: iedereen tegelijk
      } else if (strijd.ronde % 3 === 0) {
        strijd.baasLaadt = true;
        meld('\u{1F4A8} ' + v.naam + ' haalt diep adem... <strong>pas op, de volgende ronde slaat hij hard!</strong>',
          'Pas op! De Wachter haalt diep adem.');
      } else {
        var dw = doelen[Math.floor(Math.random() * doelen.length)];
        var ub = doeSchade(v, dw, 1);
        meld('\u{1FAA8} ' + v.naam + ' veegt ' + dw.naam + ' opzij voor <strong>' + ub.schade + '</strong>!');
        if (!levend(dw)) meld('&#128561; ' + dw.naam + ' kan niet meer!');
        slaAan(v, dw);
      }
      tekenArena();
      return setTimeout(volgende, 1100);
    }

    var doel = doelen[Math.floor(Math.random() * doelen.length)];
    var uit = doeSchade(v, doel, 1);
    var regel = '\u{1F43E} ' + v.naam + ' bijt ' + doel.naam + ' voor <strong>' + uit.schade + '</strong>!';
    if (uit.factor > 1) regel += ' Au, heel effectief!';
    meld(regel);
    if (!levend(doel)) meld('&#128561; ' + doel.naam + ' kan niet meer!');
    slaAan(v, doel);
    tekenArena();
    setTimeout(volgende, 800);
  })();
}

function nieuweRonde() {
  if (!levendeHelden().length) return klaarGevecht(false);
  strijd.ronde++;
  strijd.aanDeBeurt = 0;
  strijd.doelwitVan = {};
  SPELERS.forEach(function (s) {
    if (!strijd.elementKlaar[s.id] && strijd.ronde % 2 === 1) strijd.elementKlaar[s.id] = true;
  });
  volgendeBeurt();
}

function klaarGevecht(gewonnen) {
  document.getElementById('t-beurt').textContent = '';
  var bak = document.getElementById('acties');
  bak.innerHTML = '';
  var verslag = document.getElementById('verslag');

  // het bazengevecht heeft zijn eigen beloning en zijn eigen weg terug
  if (strijd.baasNiveau) return klaarBaas(gewonnen);

  if (strijd.eersteGevecht) {
    if (!gewonnen) {
      // dit gevecht mag je niet verliezen; het is de start van het verhaal
      strijd.helden.forEach(function (h) { h.levens = maxLevens(h); });
      strijd.vijanden[0].levens = Math.max(1, strijd.vijanden[0].levens);
      verslag.innerHTML = '<div>Even uitblazen... en dan weer!</div>';
      var opnieuw = document.createElement('button');
      opnieuw.className = 'knop';
      opnieuw.textContent = 'Doorvechten!';
      // alles terugzetten, niet alleen de ronde: anders telde de eerste klap al als "samen"
      opnieuw.addEventListener('click', function () {
        strijd.ronde = 1;
        strijd.aanDeBeurt = 0;
        strijd.doelwitVan = {};
        strijd.elementKlaar = { owen: true, jake: true };
        strijd.helpGebruikt = { owen: false, jake: false };
        volgendeBeurt();
      });
      bak.appendChild(opnieuw);
      return;
    }
    spel.glim += 10;
    spel.gewonnen++;
    spel.verhaal = 'tent';
    onthoudSchade();
    verslag.innerHTML = '<div>&#127881; <strong>Verjaagd!</strong> Hij liet ' + ic('icoon-glim') +
      ' <strong>10 glimstenen</strong> vallen.</div><div>Daar kunnen jullie een <strong>tentje</strong> van zetten. Dat is het begin van jullie dorp.</div>';
    spreek('Verjaagd! Hij liet tien glimstenen vallen. Daar kunnen jullie een tentje van zetten.', 'vecht-tentje');
    var naarBouw = document.createElement('button');
    naarBouw.className = 'knop';
    naarBouw.textContent = 'Tentje bouwen';
    naarBouw.addEventListener('click', function () { toon('s-bouwen'); tekenBouwen(); });
    bak.appendChild(naarBouw);
    return;
  }

  if (gewonnen) {
    spel.gewonnen++;
    var buit = 3 + spel.zone * 3 + Math.floor(Math.random() * 3);
    spel.glim += buit;
    var ei = null;
    if (!tasVol() && Math.random() < 0.6) {
      ei = trekEisoort();
      if (Math.random() < 0.5 && ei === 'gewoon') ei = 'zeldzaam';  // winnen loont
      spel.tas.push(ei);
    }
    onthoudSchade();
    verslag.innerHTML = '<div>&#127881; <strong>Gewonnen!</strong> &#128142; ' + buit + ' glimstenen' +
      (ei ? ' en ' + eiPlaatje(ei) + ' een ' + EISOORTEN[ei].naam.toLowerCase() : '') + '.</div>' +
      (tasVol() ? '<div>Je tas zit nu vol. Tijd om naar huis te gaan.</div>' : '');
    spreek('Gewonnen!' + (ei ? ' En een ei erbij.' : ''),
      ei ? ['vecht-gewonnen', 'vecht-ei-erbij'] : 'vecht-gewonnen');
    var door = document.createElement('button');
    door.className = 'knop';
    door.textContent = '\u{1F33F} Verder zoeken';
    door.addEventListener('click', function () { toon('s-jungle'); tekenJungle(); });
    bak.appendChild(door);
    var huis = document.createElement('button');
    huis.className = 'knop rustig';
    huis.textContent = '\u{1F3E0} Naar huis';
    huis.addEventListener('click', naarHuis);
    bak.appendChild(huis);
    bewaar();
  } else {
    onthoudSchade();
    verslag.innerHTML = '<div>&#128148; <strong>Jullie zijn allebei moe.</strong> ' +
      'Terug naar het dorp om uit te rusten. Je verliest niks, hoor.</div>' +
      (spel.dorp.rust < 1 ? '<div>Met een vuurplaats worden jullie thuis weer helemaal beter.</div>' : '');
    spreek('Jullie zijn moe. Terug naar het dorp.', 'vecht-moe');
    var terug = document.createElement('button');
    terug.className = 'knop';
    terug.textContent = '\u{1F3E0} Naar het dorp';
    terug.addEventListener('click', naarHuis);
    bak.appendChild(terug);
  }
}

/* ---------- je eerste wezen kiezen ----------
 * Alleen gewone onderdelen, drie per sleuf, plus precies één onderdeel dat beter mag
 * zijn. Kies je een tweede gouden, dan springt de vorige terug naar gewoon. Eén regel,
 * zichtbaar, en hij corrigeert zichzelf. */

var kiesSpeler = 0;
var kiesWezen = null;
var kiesBeter = null;      // welke sleuf nu de ongewone keuze heeft

var KIES_SLEUVEN = [
  { sleuf: 'kop',   titel: 'Kop' },
  { sleuf: 'lijf',  titel: 'Lijf' },
  { sleuf: 'poten', titel: 'Armen en poten' },
  { sleuf: 'extra', titel: 'Iets extra’s' }
];

function delenMetRang(sleuf, rang) {
  return Object.keys(Wezen.SLEUVEN[sleuf]).filter(function (k) {
    return Wezen.rangVan(sleuf, k) === rang;
  });
}

function startKiezen() {
  kiesSpeler = 0;
  nieuwKiesWezen();
  toon('s-kies');
  tekenKies();
}

function nieuwKiesWezen() {
  kiesBeter = null;
  // leegmaken, anders houdt de tweede speler de naam die de eerste bedacht heeft
  var naamvak = document.getElementById('kies-naam');
  if (naamvak) naamvak.value = '';
  kiesWezen = maakWezen({
    kop: delenMetRang('kop', 'gewoon')[0],
    lijf: delenMetRang('lijf', 'gewoon')[0],
    poten: delenMetRang('poten', 'gewoon')[0],
    extra: delenMetRang('extra', 'gewoon')[0],
    element: kies(Object.keys(Wezen.ELEMENTEN)),
    naam: ''
  });
}

function tekenKies() {
  var speler = spelerVan(spelerVolgorde()[kiesSpeler]);
  document.getElementById('kies-beurt').textContent = samenSpelen()
    ? speler.emoji + '  ' + speler.naam + ', dit wordt jouw wezen'
    : heeftMaatje()
      ? speler.emoji + '  ' + speler.naam + ', dit wordt jouw wezen'
      : speler.emoji + '  Dit wordt je ' + (kiesSpeler === 0 ? 'eerste' : 'tweede') + ' wezen';
  document.getElementById('kies-regel').innerHTML =
    'Eentje mag <strong style="color:#5fd98a">beter</strong> zijn (die met het sterretje). ' +
    'Kies je een tweede, dan gaat de vorige terug naar gewoon.';

  var bak = document.getElementById('kies-sleuven');
  bak.innerHTML = '';
  KIES_SLEUVEN.forEach(function (rij) {
    var vak = document.createElement('div');
    vak.className = 'kiesrij';
    var kop = document.createElement('h3');
    kop.textContent = rij.titel;
    vak.appendChild(kop);
    var opties = document.createElement('div');
    opties.className = 'kiesopties';

    delenMetRang(rij.sleuf, 'gewoon').concat(delenMetRang(rij.sleuf, 'ongewoon'))
      .forEach(function (sleutel) {
        var beter = Wezen.rangVan(rij.sleuf, sleutel) === 'ongewoon';
        var knop = document.createElement('button');
        knop.className = 'kiesoptie' + (kiesWezen[rij.sleuf] === sleutel ? ' aan' : '') + (beter ? ' beter' : '');
        knop.innerHTML = '<img src="' + Wezen.bestandVan(rij.sleuf, sleutel) + '" alt="">' +
          Wezen.SLEUVEN[rij.sleuf][sleutel].naam + (beter ? '<span class="ster">⭐</span>' : '');
        knop.addEventListener('click', function () {
          if (beter && kiesBeter && kiesBeter !== rij.sleuf) {
            // de vorige gouden keuze valt terug naar het eerste gewone deel
            kiesWezen[kiesBeter] = delenMetRang(kiesBeter, 'gewoon')[0];
          }
          kiesWezen[rij.sleuf] = sleutel;
          kiesBeter = beter ? rij.sleuf : (kiesBeter === rij.sleuf ? null : kiesBeter);
          tekenKies();
        });
        opties.appendChild(knop);
      });
    vak.appendChild(opties);
    bak.appendChild(vak);
  });

  // element als laatste rij
  var evak = document.createElement('div');
  evak.className = 'kiesrij';
  evak.innerHTML = '<h3>Element</h3>';
  var eopties = document.createElement('div');
  eopties.className = 'kiesopties';
  Object.keys(Wezen.ELEMENTEN).forEach(function (sleutel) {
    var knop = document.createElement('button');
    knop.className = 'kiesoptie' + (kiesWezen.element === sleutel ? ' aan' : '');
    knop.innerHTML = '<div style="font-size:38px;line-height:54px">' +
      Wezen.ELEMENTEN[sleutel].emoji + '</div>' + Wezen.ELEMENTEN[sleutel].naam;
    knop.addEventListener('click', function () { kiesWezen.element = sleutel; tekenKies(); });
    eopties.appendChild(knop);
  });
  evak.appendChild(eopties);
  bak.appendChild(evak);

  /* Het naamveld staat altijd al vol met een voorstel dat bij dit wezen past. Overal
   * anders in het spel is dat ook zo, en hier was het de enige plek waar je niet verder
   * kon zonder te typen. Jake typt niet, en dan komt hij het spel niet eens in. */
  var naamvak = document.getElementById('kies-naam');
  if (!naamvak.value.trim()) naamvak.value = verzinNaam(kiesWezen);
  tekenIn(document.getElementById('kies-podium'), kiesWezen, 280, 360);
}

function kiesKlaar() {
  var naam = document.getElementById('kies-naam').value.trim() || verzinNaam(kiesWezen);
  kiesWezen.naam = naam;
  var volgorde = spelerVolgorde();
  var speler = spelerVan(volgorde[kiesSpeler]);
  // beide startwezens komen in dezelfde stal; `van` houdt alleen bij wie hem bedacht heeft
  var nieuw = maakWezen(kiesWezen);
  nieuw.van = speler.id;
  nieuw.schade = 0;
  spel.wezens.push(nieuw);
  spel.mee[speler.id] = spel.wezens.length - 1;
  boekBij(kiesWezen);
  bewaar();

  if (kiesSpeler === 0) {
    /* Een supervriend komt niet met lege handen: hij brengt zijn eigen wezen mee. Dat is
     * leuker dan in je eentje twee wezens samenstellen, en het scheelt de helft van het
     * klikwerk voordat het spel begint. */
    if (heeftMaatje()) {
      var vriend = spelerVan(volgorde[1]);
      var zijne = wezenUitRangen({ gewoon: 70, ongewoon: 30 }, '', null);
      zijne.naam = verzinNaam(zijne, [nieuw.naam]);
      zijne.van = vriend.id;
      zijne.schade = 0;
      spel.wezens.push(zijne);
      spel.mee[vriend.id] = spel.wezens.length - 1;
      boekBij(zijne);
      bewaar();
      spreek('Je supervriend komt eraan met zijn eigen wezen!', 'maatje-komt');
    } else {
      kiesSpeler = 1;
      nieuwKiesWezen();
      tekenKies();
      spreek('Mooi! Nu je tweede wezen.', samenSpelen() ? null : 'kies-tweede');
      return;
    }
  }
  // allebei klaar: eerst het stripje, daarna pas het gevecht
  spel.verhaal = 'eerstegevecht';
  bewaar();
  startIntro();
}

/* ---------- het stripje tussen de keuze en het eerste gevecht ----------
 *
 * Drie geschilderde plaatjes met hun eigen wezens erin getekend. Bewust geen filmpje: zo
 * staan precies de wezens in beeld die ze net zelf gemaakt hebben, en dat kan met een echte
 * animatie niet zonder voor elke combinatie beelden te maken. De vijand die in beeld 3 uit
 * de struiken springt is hetzelfde wezen waar ze daarna tegen vechten. */
var introStap = 0;
var introVijand = null;

var INTRO = [
  { beeld: 'intro-1-landing.webp',
    tekst: 'Jullie ruimteschip landt op een vreemde planeet.',
    knop: 'Kijken \u{1F440}', wezens: [] },
  { beeld: 'intro-2-uitstappen.webp',
    tekst: 'Voorzichtig stappen jullie naar buiten. Wat is het hier raar!',
    knop: 'Rondkijken \u{1F33F}',
    /* ruim uit elkaar: op een smal venster stonden ze tegen elkaar aan en leek het één wezen */
    wezens: [{ wie: 'owen', x: 0.33, y: 0.80 }, { wie: 'jake', x: 0.63, y: 0.80 }] },
  { beeld: 'intro-3-hinderlaag.webp',
    tekst: 'Er springt iets uit de struiken!',
    knop: '\u{2694}\u{FE0F} Vecht!',
    wezens: [{ wie: 'owen', x: 0.18, y: 0.82 }, { wie: 'jake', x: 0.44, y: 0.82 },
             { wie: 'vijand', x: 0.79, y: 0.82 }] }
];

function startIntro() {
  introStap = 0;
  introVijand = wezenUitRangen({ gewoon: 100 }, 'Knauw');

  /* In het allereerste gevecht mag de vijand geen elementvoordeel hebben. Zonder deze regel
   * kon het element toevallig sterk zijn tegen het wezen dat een van de twee net met zorg
   * gemaakt had: dat wezen deed dan "niet zo sterk" bij elke klap, kreeg dubbele klappen
   * terug en ging in ronde vijf neer. Je eerste gevecht hoort geen les in pech te zijn.
   * Alles daarna blijft gewoon toeval. */
  var onzeWezens = SPELERS.map(function (s) { return meeWezen(s.id); });
  var onsElement = onzeWezens.map(function (w) { return w && w.element; });
  var veilig = Object.keys(Wezen.ELEMENTEN).filter(function (e) {
    return onsElement.indexOf(STERK[e]) < 0;
  });
  if (veilig.length && veilig.indexOf(introVijand.element) < 0) {
    introVijand.element = veilig[Math.floor(Math.random() * veilig.length)];
  }

  /* En hij mag er niet uitzien als een kopie van henzelf. De vijand wordt uit gewone
   * onderdelen getrokken, net als een startwezen, dus hij kon met dezelfde kop en hetzelfde
   * lijf uit de struiken springen. "Er springt iets uit de struiken" werkt niet als dat iets
   * je eigen tweelingbroer is. */
  ['kop', 'lijf'].forEach(function (sleuf) {
    var vanHen = onzeWezens.map(function (w) { return w && w[sleuf]; });
    if (vanHen.indexOf(introVijand[sleuf]) < 0) return;
    var anders = Object.keys(Wezen.SLEUVEN[sleuf]).filter(function (k) {
      return vanHen.indexOf(k) < 0 && Wezen.SLEUVEN[sleuf][k].rang === 'gewoon';
    });
    if (anders.length) introVijand[sleuf] = anders[Math.floor(Math.random() * anders.length)];
  });

  toon('s-intro');
  tekenIntro();
}

function tekenIntro() {
  var s = INTRO[introStap];
  var achter = document.getElementById('intro-achter');
  var wil = '../art/achtergronden/' + s.beeld;
  if (achter.getAttribute('src') !== wil) achter.src = wil;

  document.getElementById('intro-tekst').textContent = s.tekst;
  document.getElementById('k-intro-door').textContent = s.knop;
  document.getElementById('zeg-intro').onclick = function () {
    spreek(s.tekst, 'intro-' + (introStap + 1));
  };

  var bak = document.getElementById('intro-wezens');
  bak.innerHTML = '';
  var hoog = Math.round((window.innerHeight || 600) * 0.30);
  s.wezens.forEach(function (plek) {
    var w = plek.wie === 'vijand' ? introVijand : meeWezen(plek.wie);
    if (!w) return;
    var vak = document.createElement('div');
    vak.className = 'introwezen' + (plek.wie === 'vijand' ? ' springt' : '');
    vak.style.left = (plek.x * 100) + '%';
    vak.style.top = (plek.y * 100) + '%';
    var c = document.createElement('canvas');
    vak.appendChild(c);
    bak.appendChild(vak);
    tekenIn(c, w, Math.round(hoog * 0.78), hoog);
  });
  spreek(s.tekst, 'intro-' + (introStap + 1));
}

function introVerder() {
  introStap++;
  if (introStap < INTRO.length) return tekenIntro();
  eersteAanval(introVijand);
}

/* Het allereerste gevecht is geen toeval maar een scène: je wordt aangevallen zodra je
 * geland bent, en daarmee verdien je de kristallen voor je eerste tentje. */
function eersteAanval(meegegeven) {
  // hetzelfde wezen dat in het stripje uit de struiken sprong, anders klopt het verhaal niet
  var vijand = meegegeven || wezenUitRangen({ gewoon: 100 }, 'Knauw');
  vijand.kant = 'wild';
  vijand.levens = maxLevens(vijand);

  var helden = spelerVolgorde().map(function (id) {
    var s = { id: id };
    var w = meeWezen(s.id);
    w.kant = s.id; w.schade = 0;
    w.levens = maxLevens(w);
    return w;
  });

  strijd = {
    helden: helden, vijanden: [vijand],
    ronde: 1, aanDeBeurt: 0,
    elementKlaar: { owen: true, jake: true },
    helpGebruikt: { owen: false, jake: false },
    doelwitVan: {}, verslag: [], eersteGevecht: true
  };
  gekozenDoel = null;
  toon('s-arena');
  tekenArena();
  meld('Er springt iets uit de struiken! <strong>Verjaag het samen.</strong>', 'Er springt iets uit de struiken. Verjaag het samen!', 'vecht-begin');
  volgendeBeurt();
}

/* ---------- de diepte ---------- */

function deurOpen() { return spel.geheimen >= HINTS.length; }

function tekenDiepte() {
  tekenBalken();
  var bak = document.getElementById('dieptelijst');
  bak.innerHTML = '';
  var gehaald = spel.diepte || 0;
  var tonen = gehaald + 4;
  for (var n = 1; n <= tonen; n++) {
    var klaar = n <= gehaald;
    var nu = n === gehaald + 1;
    var baas = baasVan(n);
    var buit = baasBuit(n);
    var nodig = sleutelsVoor(n);
    var heeft = spel.sleutels || 0;
    var mag = nu && magNaarVerdieping(n);

    var vak = document.createElement('div');
    vak.className = 'verdieping' + (klaar ? ' gehaald' : mag ? ' nu' : ' op-slot');
    vak.innerHTML = '<span class="nr">' + n + '</span>' +
      '<span class="el">' + Wezen.ELEMENTEN[baas.element].emoji + '</span>' +
      (klaar ? 'Gehaald ✓' : mag ? 'Ga naar beneden' : nu ? 'Op slot' : 'Nog op slot') +
      '<div class="wat">' + (klaar || nu
        ? baas.naam + '<br>Schat: ' + buit.glim + ' glim en een ' +
          EISOORTEN[buit.ei].naam.toLowerCase()
        : 'Haal eerst verdieping ' + (n - 1)) + '</div>' +
      /* De eis staat er alleen als je er bent: eerder is het ruis, en bij een verdieping
         die je nog niet kan bereiken zegt een sleutelaantal niets. */
      (nu && nodig ? '<div class="slot">' + ic('icoon-sleutel') + ' <strong>' +
        Math.min(heeft, nodig) + ' / ' + nodig + '</strong> Wachterssleutels' +
        (mag ? '' : '<br><span>Zoek er nog ' + (nodig - heeft) +
          ' in de jungle. Elke tocht ligt er eentje.</span>') + '</div>' : '');

    /* Een voorproefje van wie daar staat. Elke Wachter is nu een eigen beest, dus je kan
       zien wat je te wachten staat en daar je team op uitzoeken. */
    if (klaar || nu) {
      var doek = document.createElement('canvas');
      doek.className = 'wachterkijk';
      vak.appendChild(doek);
      tekenIn(doek, baas, 96, 128);
    }

    if (mag) {
      (function (niveau) {
        vak.addEventListener('click', function () { naarBaas(niveau); });
      })(n);
    }
    bak.appendChild(vak);
  }
}

function naarBaas(niveau) {
  var baas = baasVan(niveau);
  baas.levens = maxLevens(baas);

  var helden = spelerVolgorde().map(function (id) {
    var s = { id: id };
    var w = meeWezen(s.id);
    w.kant = s.id;
    if (typeof w.schade !== 'number') w.schade = 0;
    w.levens = Math.max(1, maxLevens(w) - w.schade);
    return w;
  });

  strijd = {
    helden: helden, vijanden: [baas],
    ronde: 1, aanDeBeurt: 0,
    elementKlaar: { owen: true, jake: true },
    helpGebruikt: { owen: false, jake: false },
    doelwitVan: {}, verslag: [],
    baasNiveau: niveau, baasLaadt: false
  };
  gekozenDoel = null;
  toon('s-arena');
  zetAchtergrond('grot.webp');
  tekenArena();
  meld('De grond trilt. <strong>' + baas.naam + ' wordt wakker.</strong>', baas.naam + ' wordt wakker.');
  volgendeBeurt();
}

function klaarBaas(gewonnen) {
  var niveau = strijd.baasNiveau;
  var bak = document.getElementById('acties');
  bak.innerHTML = '';
  var verslag = document.getElementById('verslag');
  document.getElementById('t-beurt').textContent = '';
  onthoudSchade();

  if (gewonnen) {
    var buit = baasBuit(niveau);
    spel.glim += buit.glim;
    /* De sleutels gaan er pas af als je wint, zodat opnieuw proberen gratis is. */
    if (niveau > (spel.diepte || 0)) {
      spel.sleutels = Math.max(0, (spel.sleutels || 0) - sleutelsVoor(niveau));
      spel.diepte = niveau;
    }
    var ei = null;
    if (!tasVol()) { ei = buit.ei; spel.tas.push(ei); }
    bewaar();
    verslag.innerHTML = '<div>&#127881; <strong>' + strijd.vijanden[0].naam +
      ' buigt zijn hoofd en wordt weer stil.</strong></div>' +
      '<div>Schat: ' + ic('icoon-glim') + ' <strong>' + buit.glim + '</strong>' +
      (ei ? ' en ' + eiPlaatje(ei) + ' een <strong>' + EISOORTEN[ei].naam.toLowerCase() + '</strong>' +
            (EISOORTEN[ei].minimaal ? ' (daar zit gegarandeerd iets zeldzaams in)' : '')
          : ' (je tas zat vol, dus geen ei)') + '.</div>' +
      '<div>Er gaat een trap verder naar beneden. Daar staat een andere Wachter, en die is sterker. ' +
      'De deur daarheen kost ' + sleutelsVoor(niveau + 1) + ' Wachterssleutels; die liggen in de jungle, ' +
      'eentje per tocht.</div>';
    spreek('Gewonnen! De Wachter wordt weer stil. Jullie krijgen een schat.', 'baas-gewonnen');
  } else {
    verslag.innerHTML = '<div>&#128148; <strong>De Wachter is te sterk.</strong> Jullie klimmen ' +
      'terug naar boven. Er is niks kapot, hoor.</div>' +
      '<div>Tip: sla allebei op hem in dezelfde ronde, dan breekt zijn schild.</div>';
    spreek('De Wachter is te sterk. Probeer het nog eens, en sla allebei op hem in dezelfde ronde.', 'baas-testerk');
  }

  var terug = document.createElement('button');
  terug.className = 'knop';
  terug.textContent = gewonnen ? '\u{1F6B6} Verder de diepte in' : '\u{1F501} Nog een keer proberen';
  terug.addEventListener('click', function () { toon('s-diepte'); tekenDiepte(); });
  bak.appendChild(terug);

  var huis = document.createElement('button');
  huis.className = 'knop rustig';
  huis.textContent = '\u{1F3E0} Naar het dorp';
  huis.addEventListener('click', naarHuis);
  bak.appendChild(huis);
}

/* ---------- kruisen ---------- */

var kruisKeuze = [];

function tekenKruisStal() {
  tekenBalken();
  // de prijs hangt af van wie je gekozen hebt, dus die kan pas berekend worden bij twee
  var ka = spel.wezens[kruisKeuze[0]], kb = spel.wezens[kruisKeuze[1]];
  var prijs = (kruisKeuze.length === 2) ? kruisKosten(ka, kb) : null;
  document.getElementById('kruis-uitleg').innerHTML =
    'Kies <strong>twee</strong> wezens. Het kind krijgt <strong>één onderdeel van elk</strong>, ' +
    'en de andere twee zijn een verrassing.<br>' +
    'Hoe zeldzamer de ouders, hoe groter de kans dat die verrassing ook zeldzaam is.<br>' +
    'Kies er eentje die <strong>Owen</strong> een naam gaf en eentje van <strong>Jake</strong>, ' +
    'dan wordt het kind <strong>extra sterk</strong>.<br>' +
    (prijs !== null
      ? 'Deze kruising kost &#128142; <strong>' + prijs + '</strong> glimstenen.'
      : 'Een kruising kost &#128142; 6 tot 14 glimstenen; zeldzame ouders kosten meer.') +
    (spel.dorp.lab >= 2 ? '<br>Jullie grote kruishut maakt de verrassing vaker iets zeldzaams.' : '');
  var bak = document.getElementById('kruis-stal');
  bak.innerHTML = '';
  var rij = document.createElement('div');
  rij.className = 'stal';
  spel.wezens.forEach(function (w, i) {
    rij.appendChild(maakKaartje(w, w.van || 'owen', kruisKeuze.indexOf(i) >= 0, function () {
      var p = kruisKeuze.indexOf(i);
      if (p >= 0) kruisKeuze.splice(p, 1);
      else { kruisKeuze.push(i); if (kruisKeuze.length > 2) kruisKeuze.shift(); }
      tekenKruisStal();
    }));
  });
  bak.appendChild(rij);
  document.getElementById('k-kruis-doe').disabled =
    kruisKeuze.length !== 2 || spel.glim < prijs;
}

function doeKruising() {
  if (kruisKeuze.length !== 2) return;
  var oa = spel.wezens[kruisKeuze[0]], ob = spel.wezens[kruisKeuze[1]];
  if (spel.glim < kruisKosten(oa, ob)) return;
  // dubbelklik kostte twee keer glimstenen en gooide het eerste kind weg
  var doeKnop = document.getElementById('k-kruis-doe');
  if (doeKnop.disabled) return;
  doeKnop.disabled = true;
  spel.glim -= kruisKosten(oa, ob);
  tekenBalken();   // anders blijft de bovenbalk het oude aantal glimstenen tonen
  var a = spel.wezens[kruisKeuze[0]], b = spel.wezens[kruisKeuze[1]];
  /* De supervriendenbonus hangt nu aan wie de ouders bedacht heeft, niet aan wie ze bezit.
   * Kruis je een wezen van Owen met een van Jake, dan is dat nog steeds samenwerken. */
  var vanTwee = !!(a.van && b.van && a.van !== b.van);
  var uit = kruis(a, b, vanTwee);
  var kind = uit.wezen;

  var vak = document.getElementById('kruis-uit');
  vak.innerHTML = '';
  var kaart = document.createElement('div');
  kaart.className = 'paneel';
  kaart.style.margin = '0';
  var kop = document.createElement('h3');
  kop.style.margin = '0 0 8px';
  kop.textContent = 'Er komt een nieuw wezen uit!';
  kaart.appendChild(kop);
  var c = document.createElement('canvas');
  c.style.cssText = 'display:block;margin:0 auto';
  kaart.appendChild(c);
  var st = statsVan(kind);
  kaart.appendChild(rangOverzicht(kind));
  var info = document.createElement('p');
  info.innerHTML = Wezen.ELEMENTEN[kind.element].emoji + ' Kracht ' + st.kracht +
    ' &middot; Snelheid ' + st.snelheid + ' &middot; Leven ' + st.leven +
    (uit.mutaties ? '<br>&#10024; Er is iets ontstaan dat geen van de ouders had!' : '') +
    (uit.samen ? '<br>&#129309; <strong>Supervrienden-bonus!</strong> Omdat jullie er samen een maakten is hij extra sterk.' : '');
  if (Wezen.allesLegendarisch(kind)) {
    info.innerHTML += '<br><strong style="color:#ffc94a">&#11088; ALLES LEGENDARISCH! ' +
      'Jullie hebben het ultieme wezen gekweekt.</strong>';
  }
  kaart.appendChild(info);
  var naamvak = document.createElement('input');
  naamvak.type = 'text';
  naamvak.placeholder = 'Hoe heet hij?';
  naamvak.value = kind.naam || '';     // een voorstel dat bij hem past, overschrijven mag
  var beurt = SPELERS.filter(function (s) { return s.id === spel.naamBeurt; })[0] || SPELERS[0];
  var wie = document.createElement('p');
  wie.className = 'zacht';
  wie.style.margin = '10px 0 4px';
  wie.innerHTML = (samenSpelen() || heeftMaatje())
    ? beurt.emoji + ' <strong>' + beurt.naam + '</strong> mag hem een naam geven.'
    : beurt.emoji + ' Geef hem een naam.';
  kaart.appendChild(wie);
  kaart.appendChild(naamvak);

  var rij = document.createElement('div');
  rij.className = 'knoprij';
  rij.style.marginTop = '12px';
  var klaarKnop = document.createElement('button');
  klaarKnop.className = 'knop';
  klaarKnop.textContent = '\u{1F44D} Hij hoort er nu bij!';
  klaarKnop.addEventListener('click', function () {
    if (klaarKnop.disabled) return;      // dubbelklikken mag geen twee kinderen geven
    klaarKnop.disabled = true;
    kind.naam = naamvak.value.trim() || verzinNaam(kind);
    voegWezenToe(kind, beurt.id);
    kruisKeuze = [];
    vak.innerHTML = '<div class="paneel" style="margin:0"><p>&#129516; <strong>' + kind.naam +
      '</strong> staat nu in jullie stal!</p></div>';
    tekenKruisStal();
  });
  rij.appendChild(klaarKnop);
  kaart.appendChild(rij);
  vak.appendChild(kaart);
  tekenIn(c, kind, 170, 230);
  spreek(uit.samen ? 'Een nieuw wezen, met de supervriendenbonus!' : 'Er komt een nieuw wezen uit!',
    uit.samen ? 'kruis-bonus' : 'kruis-nieuw');
}

/* ---------- boek ---------- */

function tekenBoek() {
  tekenBalken();
  var bak = document.getElementById('boekvakken');
  bak.innerHTML = '';
  var groepen = [
    { sleuf: 'kop', titel: 'Koppen' },
    { sleuf: 'lijf', titel: 'Lijven' },
    { sleuf: 'poten', titel: 'Armen en poten' },
    { sleuf: 'extra', titel: 'Extra’s' }
  ];
  groepen.forEach(function (g) {
    var kop = document.createElement('h3');
    kop.style.margin = '12px 0 6px';
    kop.textContent = g.titel;
    bak.appendChild(kop);
    var rij = document.createElement('div');
    rij.className = 'boekrij';
    Object.keys(Wezen.SLEUVEN[g.sleuf]).forEach(function (sleutel) {
      var gezien = !!spel.boek[g.sleuf][sleutel];
      var rang = Wezen.rangVan(g.sleuf, sleutel);
      var r = Wezen.RANGEN[rang];
      var vak = document.createElement('div');
      vak.className = 'boekvak' + (gezien ? '' : ' onbekend');
      if (gezien) {
        vak.style.borderColor = r.kleur;
        if (rang !== 'gewoon') vak.style.boxShadow = '0 0 14px ' + r.kleur + '44';
        var img = document.createElement('img');
        img.src = Wezen.bestandVan(g.sleuf, sleutel);
        vak.appendChild(img);
        var n = document.createElement('div');
        n.textContent = Wezen.SLEUVEN[g.sleuf][sleutel].naam;
        vak.appendChild(n);
      } else {
        vak.innerHTML = '<div class="vraag">?</div>';
      }
      // de rang staat er altijd bij, ook als je het deel nog niet hebt: dat is het doel
      var rl = document.createElement('div');
      rl.className = 'brang';
      rl.style.color = r.kleur;
      rl.textContent = r.naam;
      vak.appendChild(rl);
      rij.appendChild(vak);
    });
    bak.appendChild(rij);
  });

  var ekop = document.createElement('h3');
  ekop.style.margin = '12px 0 6px';
  ekop.textContent = 'Elementen';
  bak.appendChild(ekop);
  var erij = document.createElement('div');
  erij.className = 'boekrij';
  Object.keys(Wezen.ELEMENTEN).forEach(function (sleutel) {
    var gezien = !!spel.boek.element[sleutel];
    var vak = document.createElement('div');
    vak.className = 'boekvak' + (gezien ? '' : ' onbekend');
    vak.innerHTML = gezien
      ? '<div class="vraag">' + Wezen.ELEMENTEN[sleutel].emoji + '</div>' + Wezen.ELEMENTEN[sleutel].naam
      : '<div class="vraag">?</div>nog niet gezien';
    erij.appendChild(vak);
  });
  bak.appendChild(erij);

  var tel = document.createElement('p');
  tel.innerHTML = '<strong>' + spel.boek.uitgekomen + '</strong> wezens erbij gekregen sinds het begin.';
  bak.appendChild(tel);
}

/* ---------- geheim ---------- */

function tekenGeheim() {
  var open = spel.geheimen >= HINTS.length;
  var deur = document.getElementById('deur');
  deur.className = 'deur' + (open ? ' open' : '');
  deur.innerHTML = '<img src="../onderdelen/icoon-sleutel.webp" alt="">';
  var tekst = open
    ? 'De deur gaat open. Daarachter gaat een trap naar beneden, het donker in. Heel diep hoor je iets ademen. Dat is de Oude Wachter. En onder hem is nog een verdieping, en daaronder nog een. Ga maar kijken hoe diep jullie durven.'
    : 'De deur zit op slot. Er zitten zes gaatjes in. Voor elk geheim dat jullie vinden gaat er eentje open. Jullie hebben er ' + spel.geheimen + ' van de ' + HINTS.length + '.';
  document.getElementById('deurtekst').textContent = tekst;
  /* De dichte deur noemt in beeld hoeveel geheimen je hebt; ingesproken laten we dat weg,
     want een getal is niet in te spreken en staat er toch al. */
  document.getElementById('zeg-geheim').onclick = function () {
    spreek(tekst, open ? 'deur-open' : 'deur-dicht');
  };
  var lijst = document.getElementById('hints');
  lijst.innerHTML = '';
  for (var i = 0; i < HINTS.length; i++) {
    var li = document.createElement('li');
    if (i < spel.geheimen) li.textContent = '\u{1F50D} ' + HINTS[i];
    else { li.className = 'leeg'; li.textContent = 'Nog niet gevonden'; }
    lijst.appendChild(li);
  }
  var naarBeneden = document.getElementById('k-geheim-diepte');
  naarBeneden.classList.toggle('verborgen', !open);
}

/* ---------- knoppen ---------- */

function zetStand(stand) {
  spel.stand = stand;
  document.getElementById('k-gewoon').className = 'knop' + (stand === 'gewoon' ? '' : ' rustig');
  document.getElementById('k-moeilijk').className = 'knop' + (stand === 'moeilijk' ? '' : ' rustig');
  bewaar();
}

document.getElementById('k-gewoon').addEventListener('click', function () { zetStand('gewoon'); });
document.getElementById('k-moeilijk').addEventListener('click', function () { zetStand('moeilijk'); });
document.getElementById('k-begin').addEventListener('click', function () {
  spel.intro = true; bewaar();
  if (!spel.wezens.length) startKiezen();
  else { toon('s-dorp'); tekenDorp(); }
});
document.getElementById('k-wezens').addEventListener('click', function () { wisselLade('wezens'); });
document.getElementById('k-intro-door').addEventListener('click', introVerder);
document.getElementById('k-vrijlaten').addEventListener('click', function () {
  vrijlaatModus = !vrijlaatModus;
  vrijlaatVraag = -1;
  tekenDorp();
});
document.getElementById('k-tas').addEventListener('click', function () { wisselLade('tas'); });
document.getElementById('k-plekken').addEventListener('click', naarPlekken);
/* Een spel dat nog niet begonnen is mag je laten staan; het staat al in de plek. */
document.getElementById('k-start-terug').addEventListener('click', naarPlekken);
document.getElementById('k-lade-dicht').addEventListener('click', sluitLade);
document.getElementById('k-leggen').addEventListener('click', function () {
  var n = legInNesten();
  tekenDorp();
  spreek('Het ei ligt nu warm.', n === 1 ? 'ei-warm' : null);
});
document.getElementById('k-ei-weg').addEventListener('click', function () {
  eiWegModus = !eiWegModus;
  eiWegVraag = -1;
  tekenDorp();
});
document.getElementById('k-opruimen').addEventListener('click', function () {
  weghaalModus = !weghaalModus;
  this.textContent = weghaalModus ? '✓ Klaar met weghalen' : '✖ Versiering weghalen';
  document.getElementById('veldtip').textContent = weghaalModus
    ? 'Klik op het rode kruisje om versiering weg te halen.'
    : 'Sleep alles naar de plek die je het mooist vindt.';
  /* De lade niet sluiten: de knop om er weer uit te komen zit erin, en zonder die knop
   * zat je vast in een stand waarin elke tik iets wist. */
  tekenVeld();
});
/* Het veld is zo groot als het venster, dus bij een ander formaat verschuift de uitsnede
 * en moet alles opnieuw op zijn plek. */
window.addEventListener('resize', function () {
  if (!document.getElementById('s-dorp').classList.contains('verborgen')) tekenVeld();
  if (!document.getElementById('s-arena').classList.contains('verborgen')) zetStrijdvloer();
  if (!document.getElementById('s-jungle').classList.contains('verborgen')) plaatsZoekplekken();
});
/* Elk paneel met een terugknop onderaan krijgt er een kruisje bovenin bij, dat precies
 * hetzelfde doet. In het bouwmenu moest je anders eerst door de hele lijst met gebouwen en
 * versiering heen scrollen voordat je weer naar het dorp kon. Hier in één keer voor alle
 * schermen geregeld, zodat een nieuw scherm met een terugknop het vanzelf ook heeft. */
Array.prototype.forEach.call(document.querySelectorAll('.paneel'), function (paneel) {
  var kop = paneel.querySelector('.paneelkop');
  var terug = paneel.querySelector('.knoprij .knop.rustig[id$="-terug"]');
  if (!kop || !terug) return;
  var kruis = document.createElement('button');
  kruis.className = 'sluitknop';
  kruis.innerHTML = '&#10005;';
  kruis.title = terug.textContent.replace(/^\s*←\s*/, '').trim() || 'Sluiten';
  kruis.addEventListener('click', function () { terug.click(); });
  kop.appendChild(kruis);
});

/* Elke zwevende knoppenbalk krijgt een tabje om hem dicht te klappen. Op een tablet of
 * telefoon is het dorp het halve beeld en de balk de andere helft; soms wil je gewoon
 * kijken naar wat je gebouwd hebt. De stand geldt voor alle balken tegelijk en wordt
 * onthouden, want anders moet je hem elke keer opnieuw dichtdoen. */
var BALK_DICHT = 'supervrienden-balk-dicht';

function zetBalkStand(dicht) {
  Array.prototype.forEach.call(document.querySelectorAll('.balk'), function (balk) {
    balk.classList.toggle('dicht', dicht);
    var tab = balk.querySelector('.klapknop');
    if (tab) {
      tab.innerHTML = dicht ? '&#9650;' : '&#9660;';
      tab.title = dicht ? 'Knoppen laten zien' : 'Knoppen opzij';
    }
  });
  try { localStorage.setItem(BALK_DICHT, dicht ? '1' : '0'); } catch (e) {}
}

Array.prototype.forEach.call(document.querySelectorAll('.balk'), function (balk) {
  var tab = document.createElement('button');
  tab.className = 'klapknop';
  tab.addEventListener('click', function () {
    zetBalkStand(!balk.classList.contains('dicht'));
  });
  balk.appendChild(tab);
});
try { zetBalkStand(localStorage.getItem(BALK_DICHT) === '1'); } catch (e) { zetBalkStand(false); }

zetMisrimpel();
/* Het veld kan ook van maat veranderen zonder dat het venster dat doet: als het scherm
 * verborgen was, is het nul breed en staan de rondjes nergens. */
if (window.ResizeObserver) {
  new ResizeObserver(function () { plaatsZoekplekken(); })
    .observe(document.getElementById('jungle-veld'));
}
document.getElementById('k-jungle').addEventListener('click', function () {
  if (zonesOpen() > 1) { toon('s-zone'); tekenZones(); }
  else {
    if (spel.plekken.every(function (p) { return p.gezocht; })) spel.plekken = nieuwePlekken();
    bewaar();
    sluitVondst();
    toon('s-jungle'); tekenJungle();
  }
});
document.getElementById('k-terug-dorp').addEventListener('click', naarHuis);
document.getElementById('k-bouwen').addEventListener('click', function () { toon('s-bouwen'); tekenBouwen(); });
document.getElementById('k-bouw-terug').addEventListener('click', function () { toon('s-dorp'); tekenDorp(); });
document.getElementById('k-zone-terug').addEventListener('click', function () { toon('s-dorp'); tekenDorp(); });
document.getElementById('k-kruisen').addEventListener('click', function () {
  kruisKeuze = [];
  document.getElementById('kruis-uit').innerHTML = '';
  toon('s-kruisen'); tekenKruisStal();
});
document.getElementById('k-kies-klaar').addEventListener('click', kiesKlaar);
document.getElementById('k-kruis-doe').addEventListener('click', doeKruising);
document.getElementById('k-kruis-terug').addEventListener('click', function () { toon('s-dorp'); tekenDorp(); });
document.getElementById('k-boek').addEventListener('click', function () { toon('s-boek'); tekenBoek(); });
document.getElementById('k-boek-terug').addEventListener('click', function () { toon('s-dorp'); tekenDorp(); });
document.getElementById('k-geheim').addEventListener('click', function () { toon('s-geheim'); tekenGeheim(); });
document.getElementById('k-diepte').addEventListener('click', function () { toon('s-diepte'); tekenDiepte(); });
document.getElementById('k-geheim-diepte').addEventListener('click', function () { toon('s-diepte'); tekenDiepte(); });
document.getElementById('k-diepte-terug').addEventListener('click', function () { toon('s-dorp'); tekenDorp(); });
document.getElementById('k-geheim-terug').addEventListener('click', function () { toon('s-dorp'); tekenDorp(); });

/* ---------- opstarten ---------- */




/* Open je het spel als index.html?nieuw, dan begint het van voren af aan. Bedoeld om te
 * testen: zo zie je het keuzescherm en het eerste gevecht opnieuw zonder je opslag met de
 * hand te wissen. Geen knop in beeld, want de jongens moeten hun dorp niet per ongeluk
 * kunnen weggooien. */
/* `?nieuw` wist het echte dorp, want dat is wat het betekent: helemaal opnieuw beginnen.
 * `?opnieuwtest` doet hetzelfde maar in de testwereld, zodat papa een hele eerste beurt
 * kan naspelen zonder dat de jongens hun dorp kwijt zijn. Er gaat altijd eerst een kopie
 * opzij. */
if (/[?&]nieuw/.test(location.search)) {
  legOpzij('?nieuw');
  try { localStorage.removeItem(ECHTE_OPSLAG); } catch (e) {}
}
if (/[?&]opnieuwtest/.test(location.search)) {
  try { localStorage.removeItem(TEST_OPSLAG); } catch (e) {}
}

/* ---------- meegaan tussen huizen ----------
 *
 * Zie de toelichting bij WOLK in spel.js. Hier staat alleen het heen en weer praten.
 * Alles is zo gebouwd dat het spel het zonder kan: mislukt er iets, dan merkt een kind er
 * niets van en wordt het de volgende keer vanzelf opgepakt.
 */
var wolkBezig = false;
var wolkKlok = null;
var wolkStand = 'uit';      // uit, bijgewerkt, bezig, wacht (nog niet verstuurd), botsing

function wolkAan() { return !!(spel && spel.wolkCode) && !IN_TESTWERELD; }

function wolkMelding(stand) {
  wolkStand = stand;
  var el = document.getElementById('wolkstand');
  if (!el) return;
  var tekst = { bezig: '☁ bezig…', bijgewerkt: '☁ bijgewerkt',
                wacht: '☁ wacht op internet', botsing: '⚠ twee dorpen' }[stand];
  el.textContent = tekst || '';
  el.className = 'wolkstand' + (stand === 'botsing' ? ' let-op' : '');
}

/* Opslaan wordt uitgesteld en samengevoegd: tijdens een gevecht wordt er tien keer per
 * minuut bewaard, en dat hoeft niet tien keer de deur uit. */
function wolkWilOpslaan() {
  if (!wolkAan()) return;
  spel.lokaalStap = (spel.lokaalStap || 0) + 1;
  if (wolkKlok) clearTimeout(wolkKlok);
  wolkKlok = setTimeout(wolkOpslaan, 2500);
}

function wolkOpslaan(forceer) {
  if (!wolkAan() || wolkBezig) return Promise.resolve(false);
  wolkBezig = true;
  wolkMelding('bezig');
  var code = spel.wolkCode;
  var versie = spel.wolkVersie || 0;
  var watWeSturen = JSON.stringify(spel);
  return fetch(WOLK + '?code=' + encodeURIComponent(code) + (forceer ? '&forceer=1' : ''), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ versie: versie, spel: JSON.parse(watWeSturen) })
  }).then(function (r) {
    if (r.status === 409) {
      /* Iemand anders heeft gespeeld. Niet overschrijven; het keuzescherm beslist. */
      return r.json().then(function (d) { wolkMelding('botsing'); wolkBotsing = d.hunne; return false; });
    }
    if (!r.ok) throw new Error('mislukt');
    return r.json().then(function (d) {
      spel.wolkVersie = d.versie;
      spel.lokaalStapBijWolk = spel.lokaalStap || 0;   // vanaf hier lopen we weer gelijk
      try { localStorage.setItem(OPSLAG, JSON.stringify(spel)); } catch (e) {}
      wolkMelding('bijgewerkt');
      return true;
    });
  }).catch(function () {
    // geen internet of de server ligt eruit: gewoon doorspelen, later opnieuw
    wolkMelding('wacht');
    return false;
  }).then(function (r) { wolkBezig = false; return r; });
}

var wolkBotsing = null;

function wolkOphalen(code) {
  return fetch(WOLK + '?code=' + encodeURIComponent(code))
    .then(function (r) { return r.ok ? r.json() : null; })
    .catch(function () { return null; });
}

/* ---------- de drie opslagplekken ---------- */

/* Het eerste scherm. Per plek zie je wie er speelt, hoe ver ze zijn en hun twee wezens,
 * zodat je zonder lezen herkent welk spel van jou is. Een lege plek vraagt eerst wie er
 * gaat spelen; daarna begint het gewone verhaal. */
function tekenPlekken() {
  var bak = document.getElementById('plekkenlijst');
  bak.innerHTML = '';
  for (var nr = 1; nr <= AANTAL_SLOTS; nr++) {
    bak.appendChild(maakPlekkaart(nr, leesSlot(nr)));
  }
}

function maakPlekkaart(nr, s) {
  var kaart = document.createElement('div');
  kaart.className = 'plek ' + (s ? (s.wie || 'samen') : 'leeg');
  kaart.innerHTML = '<span class="nr">PLEK ' + nr + '</span>';

  if (!s) {
    /* Twee knoppen, en geen van beide start al iets. Hiervoor stonden hier drie knoppen
     * die ieder meteen het spel begonnen; dan beantwoordt één tik twee vragen tegelijk
     * (welke plek én wie speelt er) en kan je nergens meer terug.
     *
     * "Spel ophalen" staat hier en niet in een menu. Owen en Jake spelen bij hun moeder en
     * bij hun vader, en dan moet doorspelen op een ander apparaat het eerste zijn wat je
     * ziet, niet iets wat je moet gaan zoeken. */
    kaart.innerHTML += '<h3>Leeg</h3>' +
      '<p class="zacht" style="margin:0 0 14px">Hier is nog geen spel.</p>';
    var start = document.createElement('button');
    start.className = 'knop';
    start.textContent = '✨ Nieuw spel';
    start.addEventListener('click', function () { vraagWie(nr); });
    kaart.appendChild(start);

    var haal = document.createElement('button');
    haal.className = 'knop rustig';
    haal.style.marginTop = '8px';
    haal.innerHTML = '☁ Spel ophalen';
    haal.title = 'Een spel dat je ergens anders bent begonnen';
    haal.addEventListener('click', function () { vraagOphalen(nr); });
    kaart.appendChild(haal);
    return kaart;
  }

  var b = s.boek || {};
  var gezien = 0;
  ['kop', 'lijf', 'poten', 'extra', 'element'].forEach(function (sleuf) {
    if (b[sleuf]) gezien += Object.keys(b[sleuf]).filter(function (k) { return b[sleuf][k]; }).length;
  });
  kaart.innerHTML += '<div class="wiezijn">' +
    (s.wie === 'owen' ? '\u{1F49A}' : s.wie === 'jake' ? '\u{1F9E1}' : '\u{1F49A}\u{1F9E1}') +
    '</div><h3>' + plekOmschrijving(s) + '</h3>';

  // de twee wezens die ze meenemen, zodat je je eigen spel herkent aan het plaatje
  var team = document.createElement('div');
  team.className = 'teampje';
  kaart.appendChild(team);
  (s.wezens || []).slice(0, 2).forEach(function (w) {
    try {
      var c = document.createElement('canvas');
      team.appendChild(c);
      tekenIn(c, lapWezenOp(w), 54, 72);
    } catch (e) {}
  });

  var cijfers = document.createElement('div');
  cijfers.className = 'cijfers';
  cijfers.innerHTML =
    '<b>' + (s.wezens || []).length + '</b> wezens &middot; <b>' + (s.glim || 0) + '</b> glimstenen<br>' +
    'Boek <b>' + gezien + '/64</b> &middot; Diepte <b>' + (s.diepte || 0) + '</b>';
  kaart.appendChild(cijfers);

  var spelen = document.createElement('button');
  spelen.className = 'knop';
  spelen.textContent = '▶ Verder spelen';
  spelen.addEventListener('click', function () { speelPlek(nr); });
  kaart.appendChild(spelen);

  /* Gaat deze plek mee naar het andere huis? Dat staat er gewoon bij, zonder menu. */
  var mee = document.createElement('button');
  mee.className = 'meeneem' + (s.wolkCode ? ' aan' : '');
  mee.innerHTML = s.wolkCode
    ? '☁ Gaat met je mee'
    : '☁ Dit spel meenemen';
  mee.title = s.wolkCode
    ? 'Laat de link zien om dit spel op een ander apparaat te openen'
    : 'Zodat je er ook op een ander apparaat mee verder kan';
  mee.addEventListener('click', function () { toonMeenemen(nr); });
  kaart.appendChild(mee);

  /* Wissen zit achter twee tikken en staat er klein onder. Een spel van weken mag niet
   * verdwijnen door één misklik, en er gaat ook nog een kopie opzij. */
  var wis = document.createElement('button');
  wis.className = 'wissen';
  wis.textContent = 'Deze plek leegmaken';
  wis.addEventListener('click', function () {
    if (wis.dataset.zeker) {
      legOpzij('plek ' + nr + ' leeggemaakt', localStorage.getItem(slotSleutel(nr)));
      wisSlot(nr);
      tekenPlekken();
      return;
    }
    wis.dataset.zeker = '1';
    wis.textContent = 'Zeker weten? Tik nog een keer';
    wis.style.color = '#ff9a7a';
  });
  kaart.appendChild(wis);
  return kaart;
}

/* Een spel ophalen dat ergens anders begonnen is. Je komt hier met een code, of met een
 * link waar de code al in zit; dan is dit scherm al voor je ingevuld. */
function vraagOphalen(nr) {
  nieuwePlek = nr;
  document.getElementById('wie-kop').textContent = 'Een spel ophalen';
  document.getElementById('wie-uitleg').innerHTML =
    'Ben je ergens anders al begonnen? Vul dan de code van dat spel in. ' +
    'Daarna gaat dit dorp vanzelf met je mee, waar je ook speelt.';
  document.getElementById('zeg-wie').dataset.zeg =
    'Een spel ophalen. Vul de code in van een spel dat je ergens anders bent begonnen.';

  var bak = document.getElementById('wie-keuzes');
  bak.innerHTML = '';
  var veld = document.createElement('input');
  veld.type = 'text';
  veld.className = 'maatjenaam';
  veld.placeholder = 'bijvoorbeeld vlamklauw-k3m7qp';
  veld.autocapitalize = 'off';
  veld.spellcheck = false;
  bak.appendChild(veld);

  var melding = document.createElement('p');
  melding.className = 'zacht';
  melding.style.margin = '10px 0 0';
  bak.appendChild(melding);

  var knop = document.createElement('button');
  knop.className = 'knop';
  knop.style.marginTop = '10px';
  knop.textContent = 'Ophalen';
  knop.addEventListener('click', function () {
    var code = veld.value.trim().toLowerCase();
    if (code.length < 8) { melding.textContent = 'Die code klopt niet. Kijk hem nog eens na.'; return; }
    knop.disabled = true;
    melding.textContent = 'Even zoeken…';
    wolkOphalen(code).then(function (d) {
      knop.disabled = false;
      if (!d || !d.spel) {
        melding.textContent = 'Bij die code staat geen spel. Kijk de code nog eens na, ' +
          'of controleer of je internet hebt.';
        return;
      }
      zetOpgehaaldSpel(nr, code, d);
    });
  });
  bak.insertBefore(knop, melding);
  veld.addEventListener('keydown', function (e) { if (e.key === 'Enter') knop.click(); });

  document.getElementById('k-wie-terug').onclick = function () {
    toon('s-plekken'); tekenPlekken();
  };
  toon('s-wie');
  veld.focus();
}

/* Het opgehaalde dorp wordt de inhoud van deze plek, en de plek blijft eraan gekoppeld. */
function zetOpgehaaldSpel(nr, code, d) {
  kiesSlot(nr);
  spel = d.spel;
  herstelSpel();
  spel.wolkCode = code;
  spel.wolkVersie = d.versie || 0;
  try { localStorage.setItem(OPSLAG, JSON.stringify(spel)); } catch (e) {}
  zetStand(spel.stand || 'gewoon');
  if (spel.intro && !spel.wezens.length) startKiezen();
  else if (spel.intro) { toon('s-dorp'); tekenDorp(); }
  else toon('s-start');
}

/* De link om dit spel op een ander apparaat te openen. Eén keer openen daar is genoeg;
 * daarna onthoudt dat apparaat het en hoeft niemand er nog iets voor te doen. */
function toonMeenemen(nr) {
  var s = leesSlot(nr);
  if (!s) return;
  if (!s.wolkCode) {
    s.wolkCode = verzinWolkCode();
    s.wolkVersie = 0;
    try { localStorage.setItem(slotSleutel(nr), JSON.stringify(s)); } catch (e) {}
    // meteen naar boven, anders staat er bij de ander nog niets
    if (huidigSlot === nr && spel) { spel.wolkCode = s.wolkCode; spel.wolkVersie = 0; }
    var bewaarSlot = huidigSlot, bewaarOpslag = OPSLAG, bewaarSpel = spel;
    huidigSlot = nr; OPSLAG = slotSleutel(nr); spel = s;
    wolkOpslaan().then(function () {
      huidigSlot = bewaarSlot; OPSLAG = bewaarOpslag; spel = bewaarSpel;
      tekenMeenemen(nr);
    });
  }
  tekenMeenemen(nr);
}

function tekenMeenemen(nr) {
  var s = leesSlot(nr);
  if (!s || !s.wolkCode) return;
  var link = location.origin + location.pathname + '?spel=' + s.wolkCode;

  document.getElementById('wie-kop').textContent = 'Dit spel gaat met je mee';
  document.getElementById('wie-uitleg').innerHTML =
    'Open deze link één keer op het andere apparaat. Daarna onthoudt dat apparaat het en ' +
    'speel je gewoon verder waar je was, waar je ook bent.';
  document.getElementById('zeg-wie').dataset.zeg =
    'Dit spel gaat met je mee. Open de link één keer op het andere apparaat, daarna hoef ' +
    'je er nooit meer iets voor te doen.';

  var bak = document.getElementById('wie-keuzes');
  bak.innerHTML = '';

  var vak = document.createElement('div');
  vak.className = 'meeneemvak';
  vak.innerHTML = '<span class="watis">De link</span><code>' + link + '</code>' +
    '<span class="watis" style="margin-top:12px">Of de code, om in te tikken</span>' +
    '<code class="groot">' + s.wolkCode + '</code>';
  bak.appendChild(vak);

  var kopieer = document.createElement('button');
  kopieer.className = 'knop';
  kopieer.style.marginTop = '12px';
  kopieer.textContent = '\u{1F4CB} Link kopiëren';
  kopieer.addEventListener('click', function () {
    navigator.clipboard.writeText(link).then(function () {
      kopieer.textContent = '✓ Gekopieerd';
      setTimeout(function () { kopieer.textContent = '\u{1F4CB} Link kopiëren'; }, 2000);
    }).catch(function () { kopieer.textContent = 'Kopiëren lukt niet, tik hem over'; });
  });
  bak.appendChild(kopieer);

  document.getElementById('k-wie-terug').onclick = function () {
    toon('s-plekken'); tekenPlekken();
  };
  toon('s-wie');
}

/* Een plek openen die al een spel heeft. Gaat die plek mee tussen huizen, dan wordt eerst
 * gekeken of er elders gespeeld is. Dat wachten duurt even, maar het is precies het moment
 * waarop het ertoe doet: je komt thuis van de andere ouder en wil verder waar je was. */
function speelPlek(nr) {
  kiesSlot(nr);
  if (!laadSpel()) return tekenPlekken();
  if (!wolkAan()) return openSpel();

  wolkMelding('bezig');
  wolkOphalen(spel.wolkCode).then(function (d) {
    if (!d || !d.spel) return openSpel();          // geen internet: speel gewoon lokaal
    var hunVersie = d.versie || 0;
    var onzeVersie = spel.wolkVersie || 0;
    if (hunVersie <= onzeVersie) { wolkMelding('bijgewerkt'); return openSpel(); }

    /* Daar is gespeeld sinds wij voor het laatst bijwerkten. Hebben wij ondertussen zelf
     * ook gespeeld, dan zijn er twee dorpen en kiezen zij. Zo niet, dan nemen we het hunne
     * gewoon over; dat is wat ze verwachten. */
    if (wijLiepenVooruit()) return toonTweeDorpen(nr, d);
    spel = d.spel;
    herstelSpel();
    spel.wolkVersie = hunVersie;
    try { localStorage.setItem(OPSLAG, JSON.stringify(spel)); } catch (e) {}
    wolkMelding('bijgewerkt');
    openSpel();
  });
}

/* Hebben wij sinds de laatste keer bijwerken zelf nog gespeeld? Dat houden we bij met een
 * tellertje dat bij elke opslag omhoog gaat. */
function wijLiepenVooruit() {
  return (spel.lokaalStap || 0) > (spel.lokaalStapBijWolk || 0);
}

function openSpel() {
  zetStand(spel.stand || 'gewoon');
  if (spel.intro && !spel.wezens.length) startKiezen();
  else if (spel.intro) { toon('s-dorp'); tekenDorp(); }
  else toon('s-start');
}

/* Twee dorpen, en het spel kiest niet zelf. Je ziet ze naast elkaar met hun wezens erbij,
 * zodat je ook zonder te lezen herkent welke van jou is. */
function toonTweeDorpen(nr, daar) {
  document.getElementById('wie-kop').textContent = 'Er zijn twee dorpen';
  document.getElementById('wie-uitleg').textContent =
    'Er is op twee plekken gespeeld zonder internet. Welk dorp wil je verder spelen? ' +
    'Het andere verdwijnt dan.';
  document.getElementById('zeg-wie').dataset.zeg =
    'Er zijn twee dorpen. Er is op twee plekken gespeeld zonder internet. ' +
    'Welk dorp wil je verder spelen?';

  var bak = document.getElementById('wie-keuzes');
  bak.innerHTML = '';

  function kaartje(titel, s, wat) {
    var b = s.boek || {};
    var gezien = 0;
    ['kop', 'lijf', 'poten', 'extra', 'element'].forEach(function (sl) {
      if (b[sl]) gezien += Object.keys(b[sl]).filter(function (k) { return b[sl][k]; }).length;
    });
    var knop = document.createElement('button');
    knop.className = 'wiekeuze';
    knop.innerHTML = '<span class="em">\u{1F3D5}</span><span><b>' + titel + '</b><span>' +
      (s.wezens || []).length + ' wezens &middot; ' + (s.glim || 0) + ' glimstenen &middot; ' +
      'boek ' + gezien + '/64 &middot; diepte ' + (s.diepte || 0) + '</span></span>';
    knop.addEventListener('click', wat);
    return knop;
  }

  bak.appendChild(kaartje('Het dorp op dit apparaat', spel, function () {
    wolkOpslaan(true).then(function () { openSpel(); });   // het onze wint
  }));
  bak.appendChild(kaartje('Het dorp van het andere apparaat', daar.spel, function () {
    spel = daar.spel;
    herstelSpel();
    spel.wolkVersie = daar.versie || 0;
    spel.lokaalStap = spel.lokaalStapBijWolk = 0;
    try { localStorage.setItem(OPSLAG, JSON.stringify(spel)); } catch (e) {}
    wolkMelding('bijgewerkt');
    openSpel();
  }));

  document.getElementById('k-wie-terug').onclick = function () {
    toon('s-plekken'); tekenPlekken();
  };
  toon('s-wie');
}

/* Terug naar het keuzescherm, zonder herladen: zo blijft het ook op file:// werken en
 * ben je nooit iets kwijt wat nog niet bewaard was. */
function naarPlekken() {
  if (spel) bewaar();
  sluitLade();
  toon('s-plekken');
  tekenPlekken();
}

/* Stap 2 en 3 van de start. Pas aan het eind hiervan bestaat er een spel. */
var nieuwePlek = null;

function maakWieKeuze(em, titel, uitleg, wat) {
  var knop = document.createElement('button');
  knop.className = 'wiekeuze';
  knop.innerHTML = '<span class="em">' + em + '</span><span><b>' + titel + '</b>' +
    '<span>' + uitleg + '</span></span>';
  knop.addEventListener('click', wat);
  return knop;
}

function vraagWie(nr) {
  nieuwePlek = nr;
  document.getElementById('wie-kop').textContent = 'Wie gaat er spelen?';
  document.getElementById('wie-uitleg').textContent =
    'Dit wordt plek ' + nr + '. Je kan hierna nog terug.';
  document.getElementById('zeg-wie').dataset.zeg =
    'Wie gaat er spelen? Owen alleen, Jake alleen, of Owen en Jake samen.';
  var bak = document.getElementById('wie-keuzes');
  bak.innerHTML = '';
  bak.appendChild(maakWieKeuze('\u{1F49A}', 'Owen alleen',
    'Een spel helemaal voor Owen.', function () { vraagMaatje('owen'); }));
  bak.appendChild(maakWieKeuze('\u{1F9E1}', 'Jake alleen',
    'Een spel helemaal voor Jake.', function () { vraagMaatje('jake'); }));
  bak.appendChild(maakWieKeuze('\u{1F49A}\u{1F9E1}', 'Owen en Jake samen',
    'Om de beurt een wezen maken en samen vechten.', function () { beginSpel('samen', null); }));
  document.getElementById('k-wie-terug').onclick = function () {
    toon('s-plekken'); tekenPlekken();
  };
  toon('s-wie');
}

/* Alleen spelen gaat nog steeds met twee wezens, want daar hangt het halve gevecht aan:
 * het schild van een Wachter breekt alleen als er twee in dezelfde ronde slaan. De vraag
 * is dus niet óf er een tweede is, maar van wie hij is. Een supervriend met een eigen naam
 * is leuker dan een tweede plek van jezelf, en die brengt zijn eigen wezen mee — dat
 * scheelt ook de helft van het klikwerk voor je begint. */
var MAATJE_NAMEN = ['Vonk', 'Pluis', 'Tika', 'Bram', 'Zara', 'Nox', 'Juul', 'Pepe'];

function vraagMaatje(wie) {
  var kind = SPELERS.filter(function (s) { return s.id === wie; })[0];
  document.getElementById('wie-kop').textContent = kind.naam + ', speel je met een supervriend?';
  document.getElementById('wie-uitleg').textContent =
    'Je gaat altijd met twee wezens op pad. Je kan ze allebei zelf maken, of een ' +
    'supervriend meenemen die zijn eigen wezen meebrengt.';
  document.getElementById('zeg-wie').dataset.zeg =
    kind.naam + ', speel je met een supervriend? Je gaat altijd met twee wezens op pad. ' +
    'Je kan ze allebei zelf maken, of een supervriend meenemen die zijn eigen wezen meebrengt.';

  var bak = document.getElementById('wie-keuzes');
  bak.innerHTML = '';

  var metKnop = maakWieKeuze('\u{1F49C}', 'Met een supervriend',
    'Jij maakt één wezen, je supervriend brengt er zelf een mee. Je mag hem een naam geven.',
    function () { toonNaamveld(); });
  bak.appendChild(metKnop);

  var zonder = maakWieKeuze('\u{1F464}', 'Alleen ik',
    'Jij maakt allebei de wezens, en ze zijn allebei van jou.',
    function () { beginSpel(wie, null); });
  bak.appendChild(zonder);

  function toonNaamveld() {
    bak.innerHTML = '';
    var vak = document.createElement('div');
    vak.className = 'wiekeuze';
    vak.style.cursor = 'default';
    vak.innerHTML = '<span class="em">\u{1F49C}</span><span style="flex:1"><b>Hoe heet je supervriend?</b></span>';
    bak.appendChild(vak);
    var veld = document.createElement('input');
    veld.type = 'text';
    veld.className = 'maatjenaam';
    veld.maxLength = 14;
    veld.value = kies(MAATJE_NAMEN);     // alvast iets, want een leeg veld is een drempel
    bak.appendChild(veld);
    var klaar = document.createElement('button');
    klaar.className = 'knop';
    klaar.style.marginTop = '10px';
    klaar.textContent = 'Dat is hem!';
    klaar.addEventListener('click', function () {
      beginSpel(wie, { naam: veld.value.trim() || kies(MAATJE_NAMEN) });
    });
    bak.appendChild(klaar);
    veld.addEventListener('keydown', function (e) { if (e.key === 'Enter') klaar.click(); });
    veld.focus(); veld.select();
    document.getElementById('k-wie-terug').onclick = function () { vraagMaatje(wie); };
  }

  document.getElementById('k-wie-terug').onclick = function () { vraagWie(nieuwePlek); };
  toon('s-wie');
}

/* Hier bestaat het spel pas. Alles daarvoor was nog terug te draaien. */
function beginSpel(wie, maatje) {
  kiesSlot(nieuwePlek);
  nieuwSpel(wie);
  spel.maatje = maatje;
  spel.plekken = nieuwePlekken();
  bewaar();
  zetStand('gewoon');
  toon('s-start');
}

/* Voor de testopstellingen, die geen keuzescherm doorlopen. */
function startOpPlek(nr, wie) {
  nieuwePlek = nr;
  beginSpel(wie, null);
}

/* ---------- bewaren en terugzetten (alleen voor papa, via ?opslag) ---------- */

function leesOpslag(sleutel) {
  try {
    var rauw = localStorage.getItem(sleutel);
    return rauw ? JSON.parse(rauw) : null;
  } catch (e) { return null; }
}

/* Een korte beschrijving van een opgeslagen spel, zodat je ziet of je het goede bestand
 * voor je hebt voordat je iets overschrijft. */
function beschrijfSpel(s) {
  if (!s) return '<b>Leeg.</b> Er staat nog geen spel in deze browser.';
  var b = s.boek || {};
  var gezien = 0;
  ['kop', 'lijf', 'poten', 'extra', 'element'].forEach(function (sleuf) {
    if (b[sleuf]) gezien += Object.keys(b[sleuf]).filter(function (k) { return b[sleuf][k]; }).length;
  });
  return '<b>' + (s.wezens || []).length + ' wezens</b> in de stal' +
    (s.wezens && s.wezens.length
      ? ' (' + s.wezens.slice(0, 4).map(function (w) { return w.naam || 'naamloos'; }).join(', ') +
        (s.wezens.length > 4 ? ', …' : '') + ')' : '') + '<br>' +
    '<b>' + (s.glim || 0) + '</b> glimstenen &middot; ' +
    '<b>' + (s.boek && s.boek.uitgekomen || 0) + '</b> eieren uitgekomen &middot; ' +
    '<b>' + gezien + '</b> dingen in het boek<br>' +
    'Geheimen: <b>' + (s.geheimen || 0) + '</b> &middot; Diepte: <b>' + (s.diepte || 0) + '</b>' +
    ' &middot; Gewonnen gevechten: <b>' + (s.gewonnen || 0) + '</b>';
}

function tekenOpslag() {
  document.getElementById('opslag-nu').innerHTML =
    '<p style="margin:0 0 6px"><strong>Het dorp van Owen en Jake</strong></p>' +
    beschrijfSpel(leesOpslag(ECHTE_OPSLAG));

  var bak = document.getElementById('opslag-kopieen');
  bak.innerHTML = '';
  var sleutels = [];
  try {
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf(VEILIG_VOOR) === 0) sleutels.push(k);
    }
  } catch (e) {}
  sleutels.sort().reverse();
  if (!sleutels.length) {
    bak.innerHTML = '<p class="zacht">Nog geen kopieën. Die komen er pas als er iets gewist wordt.</p>';
    return;
  }
  sleutels.forEach(function (sleutel) {
    var k = leesOpslag(sleutel) || {};
    var wanneer = k.wanneer ? new Date(k.wanneer) : null;
    var rij = document.createElement('div');
    rij.className = 'kopierij';
    rij.innerHTML = '<span>' +
      (wanneer ? wanneer.toLocaleString('nl-NL') : 'onbekend wanneer') +
      ' &middot; voor <code>' + (k.reden || '?') + '</code></span>';
    var knop = document.createElement('button');
    knop.className = 'knop rustig';
    knop.textContent = 'Terugzetten';
    knop.addEventListener('click', function () {
      if (!k.spel) return;
      zetTerug(k.spel, 'de kopie van ' + (wanneer ? wanneer.toLocaleString('nl-NL') : 'eerder'));
    });
    rij.appendChild(knop);
    bak.appendChild(rij);
  });
}

/* Terugzetten overschrijft het dorp dat er nu staat, dus eerst gaat dát opzij. Zo kan je
 * ook een verkeerde terugzetactie nog ongedaan maken. */
function zetTerug(rauweTekst, waarvandaan) {
  var melding = document.getElementById('opslag-melding');
  var proef;
  try { proef = JSON.parse(rauweTekst); } catch (e) { proef = null; }
  if (!proef || typeof proef !== 'object' || !Array.isArray(proef.wezens)) {
    melding.textContent = 'Dat bestand ziet er niet uit als een opgeslagen spel. Er is niets veranderd.';
    return;
  }
  legOpzij('terugzetten');
  try { localStorage.setItem(ECHTE_OPSLAG, JSON.stringify(proef)); } catch (e) {
    melding.textContent = 'Opslaan lukte niet. Er is niets veranderd.';
    return;
  }
  melding.innerHTML = 'Teruggezet uit ' + waarvandaan + '. ' +
    '<a href="index.html" style="color:#ffc94a">Open het spel</a>.';
  tekenOpslag();
}

function zetOpslagScherm() {
  document.getElementById('k-opslag-download').addEventListener('click', function () {
    var rauw = localStorage.getItem(ECHTE_OPSLAG);
    if (!rauw) {
      document.getElementById('opslag-melding').textContent = 'Er staat nog geen spel om te bewaren.';
      return;
    }
    /* Een Blob met een download-link: dat werkt ook als het spel met een dubbelklik
     * geopend is. Een server aanroepen zou daar niet kunnen. */
    var d = new Date();
    var stempel = d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') +
      '-' + String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([rauw], { type: 'application/json' }));
    a.download = 'supervrienden-owen-jake-' + stempel + '.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    document.getElementById('opslag-melding').textContent =
      'Bewaard als ' + a.download + ' in je downloadmap.';
  });

  document.getElementById('opslag-bestand').addEventListener('change', function () {
    var bestand = this.files && this.files[0];
    if (!bestand) return;
    var lezer = new FileReader();
    lezer.onload = function () { zetTerug(String(lezer.result), bestand.name); };
    lezer.onerror = function () {
      document.getElementById('opslag-melding').textContent = 'Het bestand kon niet gelezen worden.';
    };
    lezer.readAsText(bestand);
    this.value = '';
  });

  document.getElementById('k-opslag-terug').addEventListener('click', function () {
    location.href = 'index.html';
  });
}

/* Testopstellingen voor papa: index.html?test=diepte en zo. Ze zetten een vers spel klaar
 * op precies het punt waar iets nieuws begint, want anders moet je eerst een uur spelen
 * voordat je kan controleren of de Diepte klopt. Alleen via het webadres bereikbaar, dus
 * de jongens komen er niet per ongeluk in. `papa-testopstelling.html` is het menu. */
var TESTOPSTELLINGEN = {
  diepte: function () {
    spel.dorp = { tent: 1, nest: 2, rugzak: 2, rust: 1, lab: 1, toren: 2 };
    spel.glim = 300;
    spel.geheimen = HINTS.length;      // de deur staat open
    spel.sleutels = 2;                 // genoeg voor verdieping 2
    spel.zone = 2;
    voegWezenToe(maakWezen({ kop: 'goud', lijf: 'goud', poten: 'goud',
      extra: 'goudvleugels', element: 'vuur', naam: 'Goudklauw' }), 'owen');
    voegWezenToe(maakWezen({ kop: 'ster', lijf: 'ster', poten: 'ster',
      extra: 'komeetstaart', element: 'water', naam: 'Sterrenstaart' }), 'jake');
  },
  onderdelen: function () {
    spel.dorp = { tent: 1, nest: 2, rugzak: 3, rust: 1, lab: 2, toren: 1 };
    spel.glim = 300;
    // één wezen per nieuw extra-onderdeel, zodat je ze allemaal naast elkaar ziet staan
    [['vis', 'slijm', 'zwemvlies', 'gifstaart', 'water'],
     ['uil', 'koraal', 'krab', 'rugschild', 'plant'],
     ['haai', 'schelp', 'wortel', 'stekels', 'water'],
     ['lava', 'lava', 'lava', 'lavavleugels', 'vuur'],
     ['ijs', 'ijs', 'ijs', 'ijskroon', 'water'],
     ['goud', 'goud', 'goud', 'goudvleugels', 'bliksem'],
     ['ster', 'ster', 'ster', 'komeetstaart', 'plant']]
      .forEach(function (d, i) {
        var w = maakWezen({ kop: d[0], lijf: d[1], poten: d[2], extra: d[3], element: d[4] });
        w.naam = verzinNaam(w);     // zonder naam heet elk wezen in de stal 'Naamloos'
        voegWezenToe(w, i % 2 ? 'jake' : 'owen');
      });
  },
  eieren: function () {
    spel.dorp = { tent: 1, nest: 2, rugzak: 4, rust: 0, lab: 0, toren: 0 };
    spel.glim = 60;
    spel.tas = ['gewoon', 'zeldzaam', 'gewoon', 'bijzonder'];
    voegWezenToe(wezenUitRangen({ gewoon: 100 }, 'Kiezel'), 'owen');
    voegWezenToe(wezenUitRangen({ gewoon: 100 }, 'Takkie'), 'jake');
  }
};

var testNaam = (location.search.match(/[?&]test=(\w+)/) || [])[1];

/* Blijft het laden hangen, dan moet dat op het scherm staan en niet eindeloos "de wezens
 * worden wakker gemaakt". Dat gebeurt bijvoorbeeld als het spel via een webadres zonder
 * slash op het eind geopend wordt: dan wijst ../onderdelen/ naar de verkeerde map, laden
 * alle 99 bestanden niet, en bleef een kind naar een donker scherm kijken. */
var laadGelukt = false;
setTimeout(function () {
  if (laadGelukt) return;
  document.getElementById('laadtekst').innerHTML =
    'Het laden duurt wel erg lang.<br>' +
    'Open het spel door op <strong>index.html</strong> te dubbelklikken, ' +
    'of controleer of het webadres eindigt op <strong>/game/</strong> (met streepje op het eind).';
}, 20000);

/* Het bewaarscherm heeft de onderdelen niet nodig, dus het hoeft niet te wachten op het
 * laden van honderdvijftig plaatjes. Handig ook als er iets mis is met die plaatjes: dan
 * kan je de voortgang nog steeds veiligstellen. */
if (/[?&]opslag/.test(location.search)) {
  zetOpslagScherm();
  tekenOpslag();
  toon('s-opslag');
}

if (IN_TESTWERELD) {
  var vlag = document.createElement('div');
  vlag.className = 'testvlag';
  vlag.textContent = 'TESTWERELD · niet het dorp van de jongens';
  document.body.appendChild(vlag);
}

Wezen.laadAlles(function () {
  if (/[?&]opslag/.test(location.search)) { laadGelukt = true; return; }
  laadGelukt = true;

  /* De testwereld houdt één plek: daar hoeft niets bewaard te blijven, en een
   * testopstelling begint sowieso met een vers spel. */
  if (IN_TESTWERELD) {
    if (!laadSpel()) nieuwSpel();
    if (TESTOPSTELLINGEN[testNaam]) {
      nieuwSpel();
      spel.intro = true;
      spel.verhaal = 'vrij';
      TESTOPSTELLINGEN[testNaam]();
      spel.plekken = nieuwePlekken();
      bewaar();
    }
    if (!spel.plekken) { spel.plekken = nieuwePlekken(); bewaar(); }
    zetStand(spel.stand || 'gewoon');
    if (spel.intro && !spel.wezens.length) startKiezen();
    else if (spel.intro) { toon('s-dorp'); tekenDorp(); }
    else toon('s-start');
    return;
  }

  /* Hun bestaande dorp stond nog onder de oude sleutel. Dat wordt plek 1. */
  verhuisOudSpel();

  /* Een link met een spel erin: ?spel=vlamklauw-k3m7qp. Zo koppel je een apparaat bij de
   * andere ouder in één keer, zonder iets over te tikken. Staat het spel er al, dan ga je
   * daar gewoon verder; anders komt het in de eerste vrije plek. */
  var uitLink = (location.search.match(/[?&]spel=([a-z0-9-]+)/i) || [])[1];
  if (uitLink) {
    uitLink = uitLink.toLowerCase();
    for (var p = 1; p <= AANTAL_SLOTS; p++) {
      var bestaand = leesSlot(p);
      if (bestaand && bestaand.wolkCode === uitLink) return speelPlek(p);
    }
    var vrij = 0;
    for (var q = 1; q <= AANTAL_SLOTS; q++) if (!leesSlot(q)) { vrij = q; break; }
    toon('s-plekken');
    tekenPlekken();
    if (!vrij) return vraagOphalen(1);   // alles vol: laat zelf kiezen waar het heen gaat
    return wolkOphalen(uitLink).then(function (d) {
      if (d && d.spel) zetOpgehaaldSpel(vrij, uitLink, d);
      else vraagOphalen(vrij);
    });
  }

  /* Open je het spel opnieuw, dan ga je verder waar je was. Alleen als er nog nergens
   * iets staat, of je komt net van het plekkenscherm, kies je eerst. */
  var laatste = parseInt(localStorage.getItem(LAATSTE_SLOT) || '0', 10);
  if (!/[?&]plekken/.test(location.search) && laatste >= 1 && laatste <= AANTAL_SLOTS &&
      leesSlot(laatste)) {
    return speelPlek(laatste);
  }
  toon('s-plekken');
  tekenPlekken();
}, function (fouten) {
  laadGelukt = true;
  document.getElementById('laadtekst').textContent =
    'De onderdelen konden niet geladen worden (' + fouten.length +
    ' bestanden). Draai eerst: node tools/bak-onderdelen.mjs';
});
