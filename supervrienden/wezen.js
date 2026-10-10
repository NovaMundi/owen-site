/* Tekent een supervriend uit losse onderdelen.
 *
 * Bewust een gewoon script en geen ES-module: de jongens openen de Wezenbouwer als
 * los bestand, en modules worden op file:// door de browser geweigerd.
 * Om dezelfde reden worden de onderdelen als kant-en-klare transparante PNG's
 * getekend; pixels uitlezen mag daar niet.
 *
 * Paren staan als losse links- en rechtsbestanden op schijf. De tussenruimte tussen
 * twee benen of twee armen wordt hier bepaald, niet in het bronplaatje, want de
 * breedte van het lijf verschilt per keuze.
 */
var Wezen = (function () {

  // De onderdelen staan één niveau hoger, zodat zowel de wezenbouwer als het spel
  // ze gebruiken zonder dubbele kopie.
  var MAP = '../onderdelen/';

  /* Zeldzaamheid. Elk onderdeel heeft een rang, en die rang vermenigvuldigt wat het
   * onderdeel bijdraagt. Legendarische klauwen slaan dus echt harder dan gewone.
   * Het doel van het hele spel is een wezen waarvan alle vijf de delen legendarisch zijn. */
  /* Hier staat geen kanspercentage bij. Hoe vaak een rang valt hangt af van waar hij
   * vandaan komt: per eisoort, per gebied en bij een mutatie staat een eigen tabel in
   * game/spel.js. Eén getal hier zou die tabellen tegenspreken. */
  var RANGEN = {
    gewoon:    { naam: 'Gewoon',        kort: 'C',  kleur: '#b9c6d6', factor: 1.00 },
    ongewoon:  { naam: 'Ongewoon',      kort: 'U',  kleur: '#5fd98a', factor: 1.35 },
    zeldzaam:  { naam: 'Zeldzaam',      kort: 'R',  kleur: '#5bb8ff', factor: 1.75 },
    superzeldzaam: { naam: 'Superzeldzaam', kort: 'SR', kleur: '#c57bff', factor: 2.25 },
    legendarisch:  { naam: 'Legendarisch',  kort: 'L',  kleur: '#ffc94a', factor: 3.00 }
  };
  var RANGORDE = ['gewoon', 'ongewoon', 'zeldzaam', 'superzeldzaam', 'legendarisch'];

  var SLEUVEN = {
    kop: {
      kikker:  { naam: 'Kikker',   rang: 'gewoon',        k: 1, s: 2, l: 2 },
      hagedis: { naam: 'Hagedis',  rang: 'gewoon',        k: 1, s: 3, l: 1 },
      schildpad:{ naam: 'Schildpad',rang: 'gewoon',       k: 1, s: 1, l: 3 },
      wolf:    { naam: 'Wolf',     rang: 'ongewoon',      k: 3, s: 1, l: 1 },
      vogel:   { naam: 'Vogel',    rang: 'ongewoon',      k: 2, s: 3, l: 1 },
      vis:     { naam: 'Vis',      rang: 'ongewoon',      k: 1, s: 4, l: 1 },
      kever:   { naam: 'Kever',    rang: 'zeldzaam',      k: 3, s: 1, l: 2 },
      uil:     { naam: 'Uil',      rang: 'zeldzaam',      k: 2, s: 3, l: 2 },
      haai:    { naam: 'Haai',     rang: 'zeldzaam',      k: 4, s: 2, l: 1 },
      robot:   { naam: 'Robot',    rang: 'superzeldzaam', k: 2, s: 1, l: 3 },
      lava:    { naam: 'Lavakop',  rang: 'superzeldzaam', k: 4, s: 2, l: 1 },
      ijs:     { naam: 'IJskop',   rang: 'superzeldzaam', k: 2, s: 2, l: 4 },
      kristal: { naam: 'Kristal',  rang: 'legendarisch',  k: 2, s: 2, l: 3 },
      goud:    { naam: 'Goudkop',  rang: 'legendarisch',  k: 4, s: 1, l: 3 },
      ster:    { naam: 'Sterrenkop', rang: 'legendarisch', k: 2, s: 4, l: 2 }
    },
    lijf: {
      bol:     { naam: 'Dikkerd',  rang: 'gewoon',        k: 1, s: 1, l: 4 },
      harig:   { naam: 'Harig',    rang: 'gewoon',        k: 1, s: 2, l: 3 },
      veren:   { naam: 'Veren',    rang: 'gewoon',        k: 2, s: 2, l: 1 },
      schub:   { naam: 'Schubben', rang: 'ongewoon',      k: 2, s: 2, l: 2 },
      slijm:   { naam: 'Slijm',    rang: 'ongewoon',      k: 1, s: 3, l: 3 },
      mos:     { naam: 'Mos',      rang: 'ongewoon',      k: 1, s: 1, l: 4 },
      chitine: { naam: 'Chitine',  rang: 'zeldzaam',      k: 3, s: 2, l: 2 },
      koraal:  { naam: 'Koraal',   rang: 'zeldzaam',      k: 2, s: 1, l: 4 },
      schelp:  { naam: 'Schelp',   rang: 'zeldzaam',      k: 1, s: 2, l: 5 },
      pantser: { naam: 'Pantser',  rang: 'superzeldzaam', k: 2, s: 0, l: 5 },
      lava:    { naam: 'Lavalijf', rang: 'superzeldzaam', k: 4, s: 1, l: 2 },
      ijs:     { naam: 'IJslijf',  rang: 'superzeldzaam', k: 1, s: 2, l: 4 },
      kristal: { naam: 'Kristal',  rang: 'legendarisch',  k: 2, s: 1, l: 4 },
      goud:    { naam: 'Goudlijf', rang: 'legendarisch',  k: 3, s: 0, l: 5 },
      ster:    { naam: 'Sterrenlijf', rang: 'legendarisch', k: 2, s: 3, l: 3 }
    },
    // armen en poten horen bij elkaar: het zijn de ledematen van hetzelfde beest
    poten: {
      hoef:     { naam: 'Poten',       rang: 'gewoon',        k: 2, s: 3, l: 1 },
      klauw:    { naam: 'Klauwen',     rang: 'gewoon',        k: 3, s: 2, l: 1 },
      stomp:    { naam: 'Stompe poten',rang: 'gewoon',        k: 1, s: 1, l: 3 },
      spring:   { naam: 'Springpoten', rang: 'ongewoon',      k: 1, s: 4, l: 1 },
      zwemvlies:{ naam: 'Zwemvinnen',  rang: 'ongewoon',      k: 1, s: 3, l: 2 },
      insect:   { naam: 'Insectpoten', rang: 'ongewoon',      k: 2, s: 4, l: 1 },
      tentakel: { naam: 'Tentakels',   rang: 'zeldzaam',      k: 3, s: 3, l: 1 },
      krab:     { naam: 'Krabscharen', rang: 'zeldzaam',      k: 5, s: 1, l: 1 },
      wortel:   { naam: 'Wortelpoten', rang: 'zeldzaam',      k: 2, s: 1, l: 4 },
      robot:    { naam: 'Robotdelen',  rang: 'superzeldzaam', k: 2, s: 1, l: 3 },
      lava:     { naam: 'Lavapoten',   rang: 'superzeldzaam', k: 4, s: 2, l: 1 },
      ijs:      { naam: 'IJspoten',    rang: 'superzeldzaam', k: 2, s: 3, l: 2 },
      steen:    { naam: 'Steendelen',  rang: 'legendarisch',  k: 4, s: 1, l: 3 },
      goud:     { naam: 'Gouden poten',rang: 'legendarisch',  k: 3, s: 2, l: 3 },
      ster:     { naam: 'Sterrenpoten',rang: 'legendarisch',  k: 2, s: 5, l: 1 }
    },
    extra: {
      staart:          { naam: 'Staart',        rang: 'gewoon',        k: 1, s: 3, l: 0, plaats: 'staart' },
      hoorns:          { naam: 'Hoorns',        rang: 'gewoon',        k: 4, s: 0, l: 1, plaats: 'kopachter', paar: true },
      oren:            { naam: 'Flaporen',      rang: 'gewoon',        k: 0, s: 2, l: 2, plaats: 'kopachter', paar: true, omlaag: true, maat: 0.78 },
      kam:             { naam: 'Stekelkam',     rang: 'ongewoon',      k: 3, s: 1, l: 1, plaats: 'kopachter', maat: 1.15 },
      rugschild:       { naam: 'Rugschild',     rang: 'ongewoon',      k: 0, s: 0, l: 5, plaats: 'rugmidden', maat: 1.42, rugY: 1.02 },
      antenne:         { naam: 'Antenne',       rang: 'ongewoon',      k: 2, s: 2, l: 2, plaats: 'kopboven' },
      vleugels:        { naam: 'Vleugels',      rang: 'zeldzaam',      k: 0, s: 4, l: 1, plaats: 'rug', paar: true },
      stekels:         { naam: 'Rugstekels',    rang: 'zeldzaam',      k: 4, s: 0, l: 2, plaats: 'rugmidden', maat: 1.45, rugY: 0.52 },
      gifstaart:       { naam: 'Gifstaart',     rang: 'zeldzaam',      k: 5, s: 1, l: 0, plaats: 'staart', maat: 0.62, staartX: 0.74, staartY: 0.82, staartAnker: 1 },
      bol:             { naam: 'Zweefbol',      rang: 'superzeldzaam', k: 2, s: 2, l: 3, plaats: 'kopboven', maat: 0.70 },
      lavavleugels:    { naam: 'Lavavleugels',  rang: 'superzeldzaam', k: 4, s: 3, l: 0, plaats: 'rug', paar: true },
      ijskroon:        { naam: 'IJskroon',      rang: 'superzeldzaam', k: 1, s: 1, l: 5, plaats: 'kopboven', maat: 0.95 },
      kristalvleugels: { naam: 'Kristalvleugels', rang: 'legendarisch', k: 2, s: 4, l: 2, plaats: 'rug', paar: true, maat: 0.85 },
      goudvleugels:    { naam: 'Gouden vleugels', rang: 'legendarisch', k: 3, s: 3, l: 3, plaats: 'rug', paar: true },
      komeetstaart:    { naam: 'Komeetstaart',  rang: 'legendarisch',  k: 4, s: 5, l: 0, plaats: 'staart', maat: 1.05, staartY: 0.72, staartAnker: 0.78 }
    }
  };

  function rangVan(sleuf, sleutel) {
    var d = SLEUVEN[sleuf] && SLEUVEN[sleuf][sleutel];
    return (d && d.rang) || 'gewoon';
  }

  /* Element kleurt het lijf niet in. De onderdelen zijn echte renders, en die
   * overgieten met een kleurwas ziet er goedkoop uit. Het element toont zich als
   * aura, deeltjes en een badge. */
  var ELEMENTEN = {
    // `gloed` is de kleur van de sfeerlaag; deeltjes worden getekend, niet als emoji gezet
    vuur:    { naam: 'Vuur',    emoji: '\u{1F525}', gloed: '#ff7a3d', kracht: 'Slaat het hardst' },
    water:   { naam: 'Water',   emoji: '\u{1F4A7}', gloed: '#46a8e8', kracht: 'Geneest een beetje' },
    plant:   { naam: 'Plant',   emoji: '\u{1F33F}', gloed: '#56b657', kracht: 'Houdt het langst vol' },
    bliksem: { naam: 'Bliksem', emoji: '\u{26A1}',  gloed: '#f5c93a', kracht: 'Is het snelst' }
  };

  // Alle maten als factor van de lijfhoogte (H) of lijfbreedte (B).
  var M = {
    beenHoogte:   0.80,  // H
    beenOffset:   0.21,  // B, vanaf de middenas
    beenHeup:     0.90,  // waar op het lijf de heup zit
    armHoogte:    0.74,  // H
    /* Armen staan schuin, en dat is geen sierkeuze. De lijven zijn bijna even breed als
     * hoog, dus een arm die recht naar beneden hangt verdwijnt er volledig achter. Naar
     * buiten schuiven helpt niet, want dan laat de schouder los van de smallere
     * bovenkant. Schuin zetten lost beide op: schouder naar binnen, hand naar buiten. */
    armOffset:    0.42,  // B, waar de schouder zit
    armSchouder:  0.20,  // waar op het lijf de schouder zit
    armDraai:     0.34,  // radialen naar buiten, ongeveer 20 graden
    kopBreedte:   0.80,  // B
    kopHals:      0.10,  // waar op het lijf de hals zit
    kopAnker:     0.84,  // welk punt van de kop op de hals valt
    staartLengte: 1.20,  // B
    staartX:      0.68,  // op het lijf
    staartY:      0.80,
    vleugelHoogte:0.80,  // H
    vleugelOffset:0.12,  // B
    vleugelY:     0.30,  // op het lijf
    hoornHoogte:  0.62,  // × kophoogte
    hoornOffset:  0.24,  // × kopbreedte
    hoornY:       0.34,  // op de kop
    /* Hangende oren zitten hoog en net binnen de omtrek van de kop, zodat de ronde aanzet
     * achter de schedel wegvalt en alleen het hangende deel te zien is. */
    oorY:         0.17,
    oorOffset:    0.42,  // × kopbreedte
    antenneHoogte:1.10,  // × kophoogte
    antenneY:     0.45   // op de kop
  };

  var beelden = {};

  function bestanden() {
    var lijst = [];
    Object.keys(SLEUVEN.kop).forEach(function (k) { lijst.push('kop-' + k); });
    Object.keys(SLEUVEN.lijf).forEach(function (k) { lijst.push('lijf-' + k); });
    Object.keys(SLEUVEN.poten).forEach(function (k) {
      lijst.push('poten-' + k + '-links', 'poten-' + k + '-rechts');
      lijst.push('armen-' + k + '-links', 'armen-' + k + '-rechts');
    });
    Object.keys(SLEUVEN.extra).forEach(function (k) {
      if (SLEUVEN.extra[k].paar) lijst.push('extra-' + k + '-links', 'extra-' + k + '-rechts');
      else lijst.push('extra-' + k);
    });
    return lijst;
  }

  // Welk plaatje hoort bij een keuzeknop? Paren tonen hun linkerhelft.
  function bestandVan(sleuf, sleutel) {
    if (sleuf === 'poten') return MAP + 'poten-' + sleutel + '-links.webp';
    if (sleuf === 'extra') {
      var d = SLEUVEN.extra[sleutel];
      return MAP + 'extra-' + sleutel + (d && d.paar ? '-links' : '') + '.webp';
    }
    return MAP + sleuf + '-' + sleutel + '.webp';
  }

  function laadAlles(klaar, mislukt) {
    var lijst = bestanden();
    var over = lijst.length, fouten = [];
    lijst.forEach(function (naam) {
      var img = new Image();
      img.onload = function () { beelden[naam] = img; if (--over === 0) af(); };
      img.onerror = function () { fouten.push(naam + '.webp'); if (--over === 0) af(); };
      img.src = MAP + naam + '.webp';
    });
    function af() {
      if (fouten.length && mislukt) mislukt(fouten);
      else klaar();
    }
  }

  /* De rang van een onderdeel vermenigvuldigt wat het bijdraagt. Daarom telt een
   * legendarische kop echt zwaarder dan een gewone, en niet alleen in het boek. */
  function stats(keuze) {
    var delen = [
      SLEUVEN.kop[keuze.kop], SLEUVEN.lijf[keuze.lijf],
      SLEUVEN.poten[keuze.poten], SLEUVEN.extra[keuze.extra]
    ];
    var t = { kracht: 0, snelheid: 0, leven: 0 };
    delen.forEach(function (d) {
      if (!d) return;
      var f = (RANGEN[d.rang] || RANGEN.gewoon).factor;
      t.kracht += d.k * f; t.snelheid += d.s * f; t.leven += d.l * f;
    });
    return {
      kracht: Math.round(t.kracht),
      snelheid: Math.round(t.snelheid),
      leven: Math.round(t.leven)
    };
  }

  // Hoe zeldzaam is dit wezen in totaal? 0 voor helemaal gewoon, 1 voor alles legendarisch.
  function zeldzaamheid(keuze) {
    var sleuven = ['kop', 'lijf', 'poten', 'extra'];
    var som = 0;
    sleuven.forEach(function (s) {
      som += RANGORDE.indexOf(rangVan(s, keuze[s]));
    });
    return som / (sleuven.length * (RANGORDE.length - 1));
  }

  // De hoogste rang die dit wezen bezit, voor de rand om zijn kaartje.
  function topRang(keuze) {
    var beste = 0;
    ['kop', 'lijf', 'poten', 'extra'].forEach(function (s) {
      var i = RANGORDE.indexOf(rangVan(s, keuze[s]));
      if (i > beste) beste = i;
    });
    return RANGORDE[beste];
  }

  function allesLegendarisch(keuze) {
    return ['kop', 'lijf', 'poten', 'extra'].every(function (s) {
      return rangVan(s, keuze[s]) === 'legendarisch';
    });
  }

  /* Berekent waar elk onderdeel komt. Geeft een lijst in tekenvolgorde terug plus de
   * hoogste en laagste y, zodat de aanroeper het wezen precies in beeld kan passen. */
  function layout(keuze, midX, grondY, lijfH) {
    var b = beelden;
    var lijf = b['lijf-' + keuze.lijf];
    var kop = b['kop-' + keuze.kop];
    if (!lijf || !kop) return null;

    var lijfW = lijf.width * (lijfH / lijf.height);
    var lijfX = midX - lijfW / 2;

    // benen bepalen hoe hoog het lijf staat
    var beenL = b['poten-' + keuze.poten + '-links'];
    var beenR = b['poten-' + keuze.poten + '-rechts'];
    var beenH = lijfH * M.beenHoogte;
    var heupY = grondY - beenH;
    var lijfY = heupY - lijfH * M.beenHeup;

    var stukken = [];
    function zet(img, x, y, w, h) { if (img) stukken.push({ img: img, x: x, y: y, w: w, h: h, draai: 0 }); }
    function opHoogte(img, hoogte, midden, top) {
      var w = img.width * (hoogte / img.height);
      zet(img, midden - w / 2, top, w, hoogte);
    }
    // gedraaid om zijn eigen bovenkant, zodat het aanhechtpunt blijft liggen
    function gedraaid(img, hoogte, midden, top, draai) {
      if (!img) return;
      var w = img.width * (hoogte / img.height);
      stukken.push({ img: img, x: midden - w / 2, y: top, w: w, h: hoogte,
                     draai: draai, spilX: midden, spilY: top });
    }

    /* De extra's worden geplaatst op wat er in hun eigen gegevens staat, niet op hun
     * naam. Een nieuwe extra toevoegen is daardoor alleen een regel in SLEUVEN. */
    var extraDef = SLEUVEN.extra[keuze.extra] || {};

    if (extraDef.plaats === 'rug') {
      var vl = b['extra-' + keuze.extra + '-links'], vr = b['extra-' + keuze.extra + '-rechts'];
      var vH = lijfH * (extraDef.maat || M.vleugelHoogte);
      var vY = lijfY + lijfH * M.vleugelY;
      if (vl) { var wl = vl.width * (vH / vl.height); zet(vl, midX - lijfW * M.vleugelOffset - wl, vY - vH * 0.55, wl, vH); }
      if (vr) { var wr = vr.width * (vH / vr.height); zet(vr, midX + lijfW * M.vleugelOffset, vY - vH * 0.55, wr, vH); }
    }

    /* Eén enkel ding achter het lijf, midden op de rug: een schild, een rij stekels.
     * 'rug' tekent alleen een links- en een rechtsbestand, dus een onderdeel dat uit één
     * stuk bestaat werd daar helemaal niet getekend. `maat` is hier de breedte als factor
     * van het lijf en `rugY` waar de onderkant komt, gemeten over de lijfhoogte. Groter
     * dan 1 steekt dus aan alle kanten net buiten het lijf uit, en dat is precies wat je
     * wil: achter het lijf zie je er anders niets van. */
    if (extraDef.plaats === 'rugmidden') {
      var rm = b['extra-' + keuze.extra];
      if (rm) {
        var rW = lijfW * (extraDef.maat || 1.3);
        var rH = rm.height * (rW / rm.width);
        var rOnder = lijfY + lijfH * (extraDef.rugY != null ? extraDef.rugY : 1);
        zet(rm, midX - rW / 2, rOnder - rH, rW, rH);
      }
    }

    /* De staart hing met vaste maten aan het lijf, en dat werkt alleen voor een liggende
     * sliert. Een rechtopstaande staart zoals de gifstaart werd daardoor reusachtig en
     * zweefde los naast het wezen. Daarom nu per staart te regelen: `maat` schaalt hem,
     * `staartAnker` zegt welk punt van het plaatje (0 boven, 1 onder) aan het lijf vast
     * zit, en `staartY` waar op het lijf dat is. */
    if (extraDef.plaats === 'staart') {
      var st = b['extra-' + keuze.extra];
      if (st) {
        var sW = lijfW * M.staartLengte * (extraDef.maat || 1);
        var sH = st.height * (sW / st.width);
        var sX = extraDef.staartX != null ? extraDef.staartX : M.staartX;
        var sY = extraDef.staartY != null ? extraDef.staartY : M.staartY;
        var sAnker = extraDef.staartAnker != null ? extraDef.staartAnker : 0.33;
        zet(st, lijfX + lijfW * sX - sW * 0.03, lijfY + lijfH * sY - sH * sAnker, sW, sH);
      }
    }

    // armen achter het lijf, zodat de schoudersnede wegvalt
    var armL = b['armen-' + keuze.poten + '-links'];
    var armR = b['armen-' + keuze.poten + '-rechts'];
    var armH = lijfH * M.armHoogte;
    var armY = lijfY + lijfH * M.armSchouder;
    // let op de tekens: canvas draait met de klok mee, dus de linkerarm moet positief
    // draaien om zijn hand naar buiten te zwaaien
    gedraaid(armL, armH, midX - lijfW * M.armOffset, armY, M.armDraai);
    gedraaid(armR, armH, midX + lijfW * M.armOffset, armY, -M.armDraai);

    // benen achter het lijf, heup valt binnen het lijf
    if (beenL) opHoogte(beenL, beenH, midX - lijfW * M.beenOffset, heupY);
    if (beenR) opHoogte(beenR, beenH, midX + lijfW * M.beenOffset, heupY);

    zet(lijf, lijfX, lijfY, lijfW, lijfH);

    var kopW = lijfW * M.kopBreedte;
    var kopH = kop.height * (kopW / kop.width);
    var halsY = lijfY + lijfH * M.kopHals;
    var kopTop = halsY - kopH * M.kopAnker;

    if (extraDef.plaats === 'kopachter') {
      /* Hoorns groeien omhoog vanaf een punt op de kop; oren hangen omlaag vanaf de
       * bovenkant van de kop. Dat is hetzelfde ankerpunt maar de tegenovergestelde
       * richting, dus `omlaag` keert om welke kant de sprite op getekend wordt. Zonder dit
       * stonden flaporen als konijnenoren recht overeind, hoe je ze ook tekende. */
      var hY = kopTop + kopH * (extraDef.omlaag ? M.oorY : M.hoornY);
      if (extraDef.paar) {
        var hl = b['extra-' + keuze.extra + '-links'], hr = b['extra-' + keuze.extra + '-rechts'];
        var hH = kopH * (extraDef.maat || M.hoornHoogte);
        var hT = extraDef.omlaag ? hY : hY - hH;
        var hOff = extraDef.omlaag ? M.oorOffset : M.hoornOffset;
        if (hl) { var hwl = hl.width * (hH / hl.height); zet(hl, midX - kopW * hOff - hwl / 2, hT, hwl, hH); }
        if (hr) { var hwr = hr.width * (hH / hr.height); zet(hr, midX + kopW * hOff - hwr / 2, hT, hwr, hH); }
      } else {
        var en = b['extra-' + keuze.extra];
        if (en) {
          var eW = kopW * (extraDef.maat || 1.0);
          var eH = en.height * (eW / en.width);
          zet(en, midX - eW / 2, kopTop + kopH * 0.42 - eH, eW, eH);
        }
      }
    }
    if (extraDef.plaats === 'kopboven') {
      var an = b['extra-' + keuze.extra];
      if (an) {
        var aH = kopH * (extraDef.maat || M.antenneHoogte);
        var aW = an.width * (aH / an.height);
        zet(an, midX - aW / 2, kopTop + kopH * M.antenneY - aH, aW, aH);
      }
    }

    zet(kop, midX - kopW / 2, kopTop, kopW, kopH);

    // grenzen bepalen, met gedraaide stukken meegerekend via hun hoekpunten
    var bovenkant = grondY, onderkant = grondY;
    stukken.forEach(function (s) {
      var ys;
      if (!s.draai) {
        ys = [s.y, s.y + s.h];
      } else {
        var c = Math.cos(s.draai), z = Math.sin(s.draai);
        var dx = s.x - s.spilX, dy = s.y - s.spilY;
        ys = [[dx, dy], [dx + s.w, dy], [dx, dy + s.h], [dx + s.w, dy + s.h]]
          .map(function (p) { return s.spilY + p[0] * z + p[1] * c; });
      }
      ys.forEach(function (y) {
        if (y < bovenkant) bovenkant = y;
        if (y > onderkant) onderkant = y;
      });
    });

    return {
      stukken: stukken, bovenkant: bovenkant, onderkant: onderkant,
      lijfX: lijfX, lijfY: lijfY, lijfW: lijfW, lijfH: lijfH
    };
  }

  /* Meet het wezen op, zodat de aanroeper het exact in beeld kan passen.
   * factor = totale hoogte in lijfhoogtes.
   * onder  = hoeveel het onder de grondlijn uitkomt, bijvoorbeeld bij een staart. */
  function meet(keuze) {
    var proef = layout(keuze, 0, 1000, 1000);
    if (!proef) return { factor: 3, onder: 0 };
    return {
      factor: (proef.onderkant - proef.bovenkant) / 1000,
      onder: Math.max(0, (proef.onderkant - 1000) / 1000)
    };
  }

  /* Hoe het element beweegt. Vuur stijgt en flakkert, water zakt rustig, blaadjes
   * dwarrelen en draaien, bliksem schiet heen en weer en flitst. */
  var SFEER = {
    vuur:    { soort: 'vonken',   puls: 0.14, pulsSnel: 1.5, flits: false },
    water:   { soort: 'druppels', puls: 0.09, pulsSnel: 0.7, flits: false },
    plant:   { soort: 'blaadjes', puls: 0.07, pulsSnel: 0.5, flits: false },
    bliksem: { soort: 'bogen',    puls: 0.11, pulsSnel: 2.2, flits: true }
  };

  // vaste pseudo-willekeur, zodat deeltjes niet springen tussen beeldjes
  function kiem(i, zaad) {
    var x = Math.sin(i * 127.1 + zaad * 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  function hex(v) {
    var s = Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16);
    return s.length < 2 ? '0' + s : s;
  }

  /* Een klein gloeiend puntje, één keer getekend en daarna hergebruikt. Een radiaal verloop
   * per deeltje per beeldje is te duur als er twintig wezenkaartjes tegelijk in beeld staan. */
  var vonkCache = {};
  function vonkje(kleur) {
    if (vonkCache[kleur]) return vonkCache[kleur];
    var c = document.createElement('canvas');
    c.width = c.height = 48;
    var g = c.getContext('2d');
    var v = g.createRadialGradient(24, 24, 0, 24, 24, 24);
    v.addColorStop(0, '#ffffff');
    v.addColorStop(0.22, kleur);
    v.addColorStop(1, kleur + '00');
    g.fillStyle = v;
    g.fillRect(0, 0, 48, 48);
    vonkCache[kleur] = c;
    return c;
  }

  /* De sfeerlaag áchter het wezen: een zachte wolk in de elementkleur die langzaam
   * ademt en drijft, plus een plas licht op de grond. Dat laat het element lezen als
   * de omgeving waar het wezen in staat, in plaats van als plaatjes die eroverheen
   * vliegen. De oude versie tekende emoji-tekens vóór het wezen langs; dat leidde af
   * en het verraadde meteen dat het geen echte game is. */
  /* Hoe groot is het doek in tekeneenheden? Nodig omdat de sfeerwolk vóór de rand moet
   * uitdoven: liep hij door tot buiten het doek, dan zag je op de geschilderde achtergrond
   * een rechthoekige kleurvlek om elk wezen, alsof er een sticker op geplakt was. */
  function doekMaat(ctx) {
    var schaal = 1;
    try { if (ctx.getTransform) schaal = ctx.getTransform().a || 1; } catch (e) {}
    return { b: ctx.canvas.width / schaal, h: ctx.canvas.height / schaal };
  }

  function tekenAura(ctx, plan, el, midX, sterkte, t) {
    var hoog = plan.onderkant - plan.bovenkant;
    var tijd = t || 0;
    var a = Math.max(0, Math.min(1, sterkte));
    var doek = doekMaat(ctx);

    // de wolk drijft op een trage lissajous, zodat hij nooit precies stilstaat
    var midY = (plan.bovenkant + plan.onderkant) / 2 + Math.sin(tijd * 0.5) * hoog * 0.02;
    var driftX = midX + Math.sin(tijd * 0.37) * plan.lijfW * 0.06;
    var straal = Math.min(hoog * 0.66 * (0.94 + sterkte * 0.1), doek.b * 0.46, doek.h * 0.46);

    var gloed = ctx.createRadialGradient(driftX, midY, straal * 0.12, driftX, midY, straal);
    gloed.addColorStop(0, el.gloed + hex(0.34 * a));
    gloed.addColorStop(0.5, el.gloed + hex(0.14 * a));
    gloed.addColorStop(1, el.gloed + '00');
    ctx.fillStyle = gloed;
    ctx.beginPath();
    ctx.arc(driftX, midY, straal, 0, Math.PI * 2);
    ctx.fill();

    // plas licht onder de voeten: dat zet het wezen in zijn element in plaats van ervoor
    ctx.save();
    ctx.translate(midX, plan.onderkant);
    ctx.scale(1, 0.2);
    var plasStraal = Math.min(plan.lijfW * (0.9 + Math.sin(tijd * 0.8) * 0.05), doek.b * 0.46);
    var plas = ctx.createRadialGradient(0, 0, 0, 0, 0, plasStraal);
    plas.addColorStop(0, el.gloed + hex(0.4 * a));
    plas.addColorStop(1, el.gloed + '00');
    ctx.fillStyle = plas;
    ctx.beginPath();
    ctx.arc(0, 0, plasStraal, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /* Echte vormen in plaats van emoji-tekens. Elk element beweegt op zijn eigen manier:
   * vuur stijgt als vonken, water valt als druppels met rimpels op de grond, plant
   * dwarrelt als blaadjes, bliksem slaat in korte schichten. `voor` bepaalt of we de
   * laag vóór of achter het wezen tekenen; het meeste gaat erachter, zodat het gezicht
   * vrij blijft en het element diepte krijgt. */
  function tekenDeeltjes(ctx, plan, el, midX, elementNaam, t, voor) {
    var s = SFEER[elementNaam] || SFEER.vuur;
    var hoog = plan.onderkant - plan.bovenkant;
    var breed = plan.lijfW;
    ctx.save();

    if (s.soort === 'vonken') {
      var vonk = vonkje(el.gloed);
      var aantal = voor ? 4 : 14;
      for (var i = 0; i < aantal; i++) {
        var k = i + (voor ? 40 : 0);
        var fase = (t * (0.26 + kiem(k, 7) * 0.26) + kiem(k, 2)) % 1;
        var zij = (kiem(k, 1) - 0.5) * 1.7 * breed;
        var x = midX + zij + Math.sin(t * 1.6 + k) * breed * 0.09;
        var y = plan.onderkant - fase * hoog * 1.05;
        // klein en ongelijk: grote bollen lezen als ballen, niet als vonken
        var maat = hoog * (0.022 + kiem(k, 3) * 0.032) * (1 - fase * 0.5);
        ctx.globalAlpha = Math.sin(fase * Math.PI) * (voor ? 0.65 : 0.95);
        ctx.drawImage(vonk, x - maat, y - maat, maat * 2, maat * 2);
      }

    } else if (s.soort === 'druppels') {
      var vonkW = vonkje(el.gloed);
      var aantalW = voor ? 2 : 7;
      for (var j = 0; j < aantalW; j++) {
        var kw = j + (voor ? 40 : 0);
        var faseW = (t * (0.2 + kiem(kw, 7) * 0.12) + kiem(kw, 2)) % 1;
        var xw = midX + (kiem(kw, 1) - 0.5) * 1.8 * breed +
                 Math.sin(t * 0.8 + kw) * breed * 0.05;
        var yw = plan.bovenkant - hoog * 0.08 + faseW * hoog * 1.12;
        var mw = hoog * 0.028;
        ctx.globalAlpha = Math.sin(faseW * Math.PI) * (voor ? 0.6 : 0.9);
        // druppelvorm: een bol met een puntje erboven
        ctx.fillStyle = el.gloed;
        ctx.beginPath();
        ctx.moveTo(xw, yw - mw * 2.4);
        ctx.quadraticCurveTo(xw + mw, yw - mw * 0.4, xw + mw, yw);
        ctx.arc(xw, yw, mw, 0, Math.PI);
        ctx.quadraticCurveTo(xw - mw, yw - mw * 0.4, xw, yw - mw * 2.4);
        ctx.fill();
        ctx.globalAlpha *= 0.5;
        ctx.drawImage(vonkW, xw - mw * 2, yw - mw * 2, mw * 4, mw * 4);
      }
      if (!voor) {
        // rimpels waar de druppels neerkomen
        for (var r = 0; r < 2; r++) {
          var faseR = (t * 0.45 + r * 0.5) % 1;
          ctx.globalAlpha = (1 - faseR) * 0.5;
          ctx.strokeStyle = el.gloed;
          ctx.lineWidth = Math.max(1, hoog * 0.008);
          ctx.beginPath();
          ctx.ellipse(midX, plan.onderkant, breed * (0.2 + faseR * 0.85),
                      breed * (0.2 + faseR * 0.85) * 0.22, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

    } else if (s.soort === 'blaadjes') {
      var aantalB = voor ? 2 : 7;
      for (var b = 0; b < aantalB; b++) {
        var kb = b + (voor ? 40 : 0);
        var faseB = (t * (0.13 + kiem(kb, 7) * 0.1) + kiem(kb, 2)) % 1;
        var xb = midX + (kiem(kb, 1) - 0.5) * 1.9 * breed +
                 Math.sin(t * 1.1 + kb * 2) * breed * 0.28;
        var yb = plan.bovenkant - hoog * 0.08 + faseB * hoog * 1.14;
        var mb = hoog * (0.04 + kiem(kb, 3) * 0.022);
        ctx.save();
        ctx.globalAlpha = Math.sin(faseB * Math.PI) * (voor ? 0.6 : 0.92);
        ctx.translate(xb, yb);
        ctx.rotate(t * (0.9 + kiem(kb, 4)) + kb);
        // blaadje: twee bogen die in een punt samenkomen
        ctx.fillStyle = el.gloed;
        ctx.beginPath();
        ctx.moveTo(0, -mb);
        ctx.quadraticCurveTo(mb * 0.9, 0, 0, mb);
        ctx.quadraticCurveTo(-mb * 0.9, 0, 0, -mb);
        ctx.fill();
        ctx.globalAlpha *= 0.55;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(0.6, mb * 0.12);
        ctx.beginPath();
        ctx.moveTo(0, -mb * 0.8); ctx.lineTo(0, mb * 0.8);
        ctx.stroke();
        ctx.restore();
      }

    } else {
      // bliksem: korte schichten die even oplichten, plus wat vonken
      var vonkL = vonkje(el.gloed);
      var aantalL = voor ? 1 : 2;
      for (var L = 0; L < aantalL; L++) {
        var kl = L + (voor ? 40 : 0);
        var slag = Math.floor(t * 1.6 + kiem(kl, 5) * 10);
        var inSlag = (t * 1.6 + kiem(kl, 5) * 10) % 1;
        if (inSlag > 0.18) continue;                 // alleen heel even zichtbaar
        var sterk = (1 - inSlag / 0.18) * (voor ? 0.8 : 1);
        var bx = midX + (kiem(slag + kl, 1) - 0.5) * 1.5 * breed;
        var by = plan.bovenkant + kiem(slag + kl, 2) * hoog * 0.45;
        var stap = hoog * 0.055;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        /* Twee lagen: eerst een brede zachte gloed in de elementkleur, dan een dunne witte
         * kern. Eén dunne lijn leest als een kras; dit leest als een vonk. En de knik gaat
         * om en om, want willekeurige punten geven een slappe bijna-rechte streep. */
        for (var pas = 0; pas < 2; pas++) {
          ctx.strokeStyle = pas ? '#fffbe6' : el.gloed;
          ctx.lineWidth = pas ? Math.max(1, hoog * 0.009) : Math.max(2.5, hoog * 0.028);
          ctx.globalAlpha = sterk * (pas ? 1 : 0.45);
          ctx.beginPath();
          ctx.moveTo(bx, by);
          for (var seg = 1; seg <= 3; seg++) {
            ctx.lineTo(bx + (seg % 2 ? 1 : -1) * breed * (0.09 + kiem(slag + kl + seg, 6) * 0.09),
                       by + seg * stap);
          }
          ctx.stroke();
        }
        ctx.globalAlpha = sterk * 0.7;
        ctx.drawImage(vonkL, bx - hoog * 0.07, by - hoog * 0.07, hoog * 0.14, hoog * 0.14);
      }
      if (!voor) {
        for (var v2 = 0; v2 < 6; v2++) {
          var fv = (t * 0.9 + kiem(v2, 2)) % 1;
          var xv = midX + (kiem(v2, 1) - 0.5) * 1.8 * breed;
          var yv = plan.onderkant - fv * hoog * 1.0;
          var mv = hoog * 0.02;
          ctx.globalAlpha = Math.sin(fv * Math.PI) * 0.8;
          ctx.drawImage(vonkL, xv - mv, yv - mv, mv * 2, mv * 2);
        }
      }
    }

    ctx.restore();
  }

  function teken(ctx, keuze, midX, grondY, lijfH, opties) {
    var plan = layout(keuze, midX, grondY, lijfH);
    if (!plan) return;
    var el = ELEMENTEN[keuze.element] || ELEMENTEN.vuur;
    var geenSfeer = opties && opties.geenSfeer;

    /* Stilstaande weergaven mogen een eigen tijdstip krijgen. Zonder dat staan alle
     * deeltjes in de galerij op exact dezelfde plek en ziet een bladzijde met achtenveertig
     * wezens er machinaal uit. */
    var tijd = (opties && typeof opties.tijd === 'number') ? opties.tijd : 0.25;

    // sfeer achter het wezen: de wolk, de plas licht en het grootste deel van de deeltjes
    if (!geenSfeer) {
      tekenAura(ctx, plan, el, midX, 1, tijd);
      tekenDeeltjes(ctx, plan, el, midX, keuze.element, tijd, false);
    }

    /* Contactschaduw. Zonder dit zweeft een fotorealistisch wezen boven een geschilderde
     * achtergrond; met schaduw staat het er gewoon op. Dit is de goedkoopste en
     * belangrijkste stap om twee tekenstijlen bij elkaar te laten horen. */
    ctx.save();
    ctx.translate(midX, grondY);
    ctx.scale(1, 0.24);
    var straalS = plan.lijfW * 0.68;
    var sg = ctx.createRadialGradient(0, 0, 0, 0, 0, straalS);
    sg.addColorStop(0, 'rgba(0,0,0,.55)');
    sg.addColorStop(0.55, 'rgba(0,0,0,.24)');
    sg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(0, 0, straalS, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    /* Lichte kleurtoon zodat de renders in dezelfde warme sfeer vallen als de
     * geschilderde achtergronden. Een tekenfilter, geen pixelbewerking, dus het mag
     * ook op file://. */
    var filterKan = typeof ctx.filter === 'string';
    if (filterKan) ctx.filter = 'saturate(1.1) contrast(1.04) brightness(1.03)';

    plan.stukken.forEach(function (s) {
      if (!s.draai) { ctx.drawImage(s.img, s.x, s.y, s.w, s.h); return; }
      ctx.save();
      ctx.translate(s.spilX, s.spilY);
      ctx.rotate(s.draai);
      ctx.drawImage(s.img, s.x - s.spilX, s.y - s.spilY, s.w, s.h);
      ctx.restore();
    });
    if (filterKan) ctx.filter = 'none';

    // en een paar deeltjes vóór langs, voor diepte; het gezicht blijft vrij
    if (!geenSfeer) tekenDeeltjes(ctx, plan, el, midX, keuze.element, tijd, true);
  }

  /* ---------- levende weergave ----------
   * Het lichaam wordt één keer in een cache getekend; alleen de aura en de deeltjes
   * bewegen. Eén gedeelde animatielus voor alle canvassen, die vanzelf stopt zodra een
   * canvas uit het document verdwijnt. */
  var lopend = [];
  var lusDraait = false;
  var rustigeBeweging = false;
  try {
    rustigeBeweging = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) {}

  var vorigBeeldje = 0;
  function beeldje(nu) {
    // dertig beeldjes per seconde is ruim genoeg en scheelt werk als er veel
    // wezenkaartjes tegelijk in beeld staan
    if (nu - vorigBeeldje < 32) {
      if (lopend.length) return requestAnimationFrame(beeldje);
      lusDraait = false; return;
    }
    vorigBeeldje = nu;
    var t = nu / 1000;
    for (var i = lopend.length - 1; i >= 0; i--) {
      var a = lopend[i];
      /* Een kaartje wordt getekend vóórdat het in de pagina hangt, dus we mogen niet
       * meteen opruimen bij losse canvassen. Pas weggooien als het ooit verbonden is
       * geweest en nu niet meer, of als het binnen vijf seconden nooit is opgehangen. */
      if (a.canvas.isConnected) a.ooitVerbonden = true;
      else if (a.ooitVerbonden || nu - a.geboren > 5000) { lopend.splice(i, 1); continue; }
      else continue;
      var ctx = a.ctx;
      ctx.setTransform(a.dpr, 0, 0, a.dpr, 0, 0);
      ctx.clearRect(0, 0, a.breedte, a.hoogte);

      var s = SFEER[a.element] || SFEER.vuur;
      var puls = 1 + Math.sin(t * s.pulsSnel * 2) * s.puls;
      if (s.flits && (t * 0.8 % 1) < 0.05) puls += 0.5;
      tekenAura(ctx, a.plan, a.el, a.midX, puls, t);
      tekenDeeltjes(ctx, a.plan, a.el, a.midX, a.element, t, false);

      ctx.drawImage(a.cache, 0, 0, a.breedte, a.hoogte);
      tekenDeeltjes(ctx, a.plan, a.el, a.midX, a.element, t, true);
    }
    if (lopend.length) requestAnimationFrame(beeldje);
    else lusDraait = false;
  }

  function start() {
    if (lusDraait || !lopend.length) return;
    lusDraait = true;
    requestAnimationFrame(beeldje);
  }

  /* Browsers zetten requestAnimationFrame stil op een verborgen pagina. De lus staat dan
   * als draaiend gemarkeerd terwijl er niets gebeurt, en nieuwe wezens zouden blijven
   * stilstaan. Bij terugkeer de lus opnieuw aanzwengelen. */
  try {
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) { lusDraait = false; start(); }
    });
  } catch (e) {}

  /* Tekent een wezen in een canvas en laat zijn element leven.
   * Geeft een functie terug waarmee je het weer stil kan zetten. */
  function animeer(canvas, keuze, breedte, hoogte) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = breedte * dpr;
    canvas.height = hoogte * dpr;
    canvas.style.maxWidth = breedte + 'px';
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, breedte, hoogte);

    var maat = meet(keuze);
    var lijfH = (hoogte - 10) / maat.factor;
    var grondY = hoogte - 5 - maat.onder * lijfH;
    var midX = breedte / 2;

    if (rustigeBeweging) { teken(ctx, keuze, midX, grondY, lijfH); return function () {}; }

    var plan = layout(keuze, midX, grondY, lijfH);
    if (!plan) return function () {};

    var cache = document.createElement('canvas');
    cache.width = breedte * dpr;
    cache.height = hoogte * dpr;
    var cctx = cache.getContext('2d');
    cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    teken(cctx, keuze, midX, grondY, lijfH, { geenSfeer: true });

    var item = {
      canvas: canvas, ctx: ctx, cache: cache, dpr: dpr,
      breedte: breedte, hoogte: hoogte, midX: midX, plan: plan,
      el: ELEMENTEN[keuze.element] || ELEMENTEN.vuur, element: keuze.element,
      geboren: (window.performance && performance.now()) || 0, ooitVerbonden: false
    };
    /* Meteen één stilstaand beeld neerzetten. Zonder dit blijft het doek leeg zolang de
     * animatielus nog niet gelopen heeft, en browsers laten die lus niet lopen als de
     * pagina verborgen is. */
    tekenAura(ctx, plan, item.el, midX, 1, 0.25);
    tekenDeeltjes(ctx, plan, item.el, midX, keuze.element, 0.25, false);
    ctx.drawImage(cache, 0, 0, breedte, hoogte);
    tekenDeeltjes(ctx, plan, item.el, midX, keuze.element, 0.25, true);

    // een canvas dat opnieuw getekend wordt mag niet twee animaties tegelijk krijgen
    for (var i = lopend.length - 1; i >= 0; i--) {
      if (lopend[i].canvas === canvas) lopend.splice(i, 1);
    }
    lopend.push(item);
    start();
    return function () {
      var p = lopend.indexOf(item);
      if (p >= 0) lopend.splice(p, 1);
    };
  }

  return {
    SLEUVEN: SLEUVEN, ELEMENTEN: ELEMENTEN,
    bestandVan: bestandVan, laadAlles: laadAlles,
    RANGEN: RANGEN, RANGORDE: RANGORDE, rangVan: rangVan,
    zeldzaamheid: zeldzaamheid, topRang: topRang, allesLegendarisch: allesLegendarisch,
    stats: stats, teken: teken, animeer: animeer, meet: meet
  };
})();
