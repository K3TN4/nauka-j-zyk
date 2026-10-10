/*
 * Logika nauki słówek (bez DOM, bez localStorage) - testowalna w Node.
 * Używana przez js/app.js w przeglądarce.
 */
(function (global) {
  'use strict';

  // Ocena znajomości słowa (wybór użytkownika po każdej rundzie).
  const OCENY = [
    { id: 'znam', etykieta: 'znam na pamięć' },
    { id: 'ok', etykieta: 'jest ok' },
    { id: 'zapominam', etykieta: 'zapominam' },
    { id: 'nie', etykieta: 'nie znam zupełnie' },
  ];

  // Waga = jak często słowo wraca. Im gorsza ocena, tym większa waga.
  // Nieocenione słowo (null) ma wagę jak "nowe": wysoką, bo jeszcze nie wiadomo, czy je znasz.
  //  - znam (1): rzadko wraca, bo już je masz;
  //  - ok (2): wraca co jakiś czas;
  //  - zapominam (4): wraca często, żeby nie uciekło;
  //  - nie (6): wraca najczęściej;
  //  - nowe (5): między "zapominam" a "nie", bo nie wiadomo, jak dobrze je znasz.
  const WAGI = { znam: 1, ok: 2, zapominam: 4, nie: 6, nowe: 5 };

  // Tryby startu rundy.
  const TRYBY = {
    wszystkie: { etykieta: 'wszystkie słowa', pasuje: () => true },
    nie100: {
      etykieta: 'tylko słowa, których nie znam na 100% (jest ok, zapominam, nie znam, nieocenione)',
      pasuje: (ocena) => ocena !== 'znam',
    },
    slabe: {
      etykieta: 'tylko słowa, których nie znam zupełnie albo zapominam',
      pasuje: (ocena) => ocena === 'zapominam' || ocena === 'nie',
    },
  };

  const DLUGOSC_RUNDY = 10;

  // ---------- Normalizacja i ocena odpowiedzi ----------

  function normalizuj(tekst) {
    return String(tekst)
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/ł/g, 'l')
      .normalize('NFD')
      .replace(/\p{M}/gu, '') // ą→a, ę→e, ś→s, ó→o itd.
      .replace(/[^\p{L}\p{N}]+/gu, ' ') // interpunkcja i nadmiarowe spacje
      .trim()
      .replace(/\s+/g, ' ');
  }

  function odleglosc(a, b) {
    const prev = new Array(b.length + 1);
    const cur = new Array(b.length + 1);
    for (let j = 0; j <= b.length; j++) prev[j] = j;
    for (let i = 1; i <= a.length; i++) {
      cur[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const koszt = a[i - 1] === b[j - 1] ? 0 : 1;
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + koszt);
      }
      for (let j = 0; j <= b.length; j++) prev[j] = cur[j];
    }
    return prev[b.length];
  }

  // Wyrażenia w nawiasach ("(waluta ros.)") są opisem, nie tłumaczeniem.
  // Dzielimy po "/", "," i ";" - każdy wariant jest akceptowany.
  function warianty(tekst) {
    const bezNawiasow = String(tekst).replace(/\([^)]*\)/g, ' ');
    const wszystkie = new Set();
    for (const p of bezNawiasow.split(/[\/,;]/)) {
      const n = normalizuj(p);
      if (n) wszystkie.add(n);
    }
    return [...wszystkie];
  }

  // Strona słowa, której użytkownik ma się nauczyć, i strona, którą ma podać.
  function strony(slowo, kierunek) {
    return kierunek === 'RU-PL'
      ? { pokazany: slowo.ru, poprawny: slowo.pl }
      : { pokazany: slowo.pl, poprawny: slowo.ru };
  }

  function akceptowane(slowo, kierunek) {
    return warianty(strony(slowo, kierunek).poprawny);
  }

  // Sprawdza odpowiedź. Literówka (1 znak) przepuszczana tylko dla wariantów dłuższych niż 4 litery.
  function sprawdz(odpowiedz, dopuszczalne) {
    const wpis = normalizuj(odpowiedz || '');
    if (!wpis) return { ok: false, dokladnie: false };
    for (const wariant of dopuszczalne) {
      if (wpis === wariant) return { ok: true, dokladnie: true };
    }
    for (const wariant of dopuszczalne) {
      if (wariant.length > 4 && odleglosc(wpis, wariant) <= 1) {
        return { ok: true, dokladnie: false };
      }
    }
    return { ok: false, dokladnie: false };
  }

  // ---------- Losowanie ----------

  function wagaOceny(ocena) {
    return WAGI[ocena || 'nowe'];
  }

  // Losowanie ważone bez powtórzeń (kolejne losowania wyciągają z reszty).
  function losujWazone(kandydaci, n, rng) {
    const pula = kandydaci.slice();
    const wynik = [];
    while (pula.length && wynik.length < n) {
      const suma = pula.reduce((s, k) => s + k.waga, 0);
      let r = rng() * suma;
      let idx = 0;
      for (; idx < pula.length - 1; idx++) {
        r -= pula[idx].waga;
        if (r < 0) break;
      }
      wynik.push(pula[idx].slowo);
      pula.splice(idx, 1);
    }
    return wynik;
  }

  // Wybiera słowa do rundy z zestawu wg trybu i ocen z `stan`.
  function wybierzDoRundy({ slowka, stan, tryb, n = DLUGOSC_RUNDY, rng = Math.random }) {
    const przepis = TRYBY[tryb] || TRYBY.wszystkie;
    const kandydaci = slowka
      .filter((s) => przepis.pasuje(ocenaSlowa(stan, s.id)))
      .map((slowo) => ({ slowo, waga: wagaOceny(ocenaSlowa(stan, slowo.id)) }));
    return losujWazone(kandydaci, n, rng);
  }

  // ---------- Stan (localStorage) ----------

  function nowyStan() {
    return {
      wersja: 1,
      slowa: {}, // id -> { ocena, proby, ostatnio }
      rundy: [], // historia rund: { zestaw, tryb, kierunek, data, dobre, razem, samoocena }
    };
  }

  function ocenaSlowa(stan, id) {
    const w = stan.slowa[id];
    return w ? w.ocena : null;
  }

  function zapiszOceny(stan, oceny, dataIso) {
    for (const [id, ocena] of Object.entries(oceny)) {
      const w = stan.slowa[id] || { ocena: null, proby: 0, ostatnio: null };
      w.ocena = ocena;
      w.proby += 1;
      w.ostatnio = dataIso;
      stan.slowa[id] = w;
    }
    return stan;
  }

  // Zapisuje wynik rundy: sprawdzenia, oceny słów i samoocenę tabeli (0-10).
  function zapiszRunde(stan, { zestaw, tryb, kierunek, dobre, razem, samoocena, oceny, dataIso }) {
    if (!Number.isInteger(samoocena) || samoocena < 0 || samoocena > razem) {
      throw new Error('Samoocena tabeli musi być liczbą od 0 do ' + razem);
    }
    zapiszOceny(stan, oceny, dataIso);
    stan.rundy.push({ zestaw, tryb, kierunek, data: dataIso, dobre, razem, samoocena });
    return stan;
  }

  // ---------- Statystyki ----------

  // Procent znanych = udział słów ocenionych "znam na pamięć" w zestawie.
  function statystykiZestawu(stan, slowka, zestaw) {
    const liczba = slowka.length;
    let znane = 0;
    let ocenione = 0;
    for (const s of slowka) {
      const o = ocenaSlowa(stan, s.id);
      if (o) ocenione += 1;
      if (o === 'znam') znane += 1;
    }
    const rundy = stan.rundy.filter((r) => r.zestaw === zestaw);
    const dobre = rundy.reduce((s, r) => s + r.dobre, 0);
    const razem = rundy.reduce((s, r) => s + r.razem, 0);
    return {
      zestaw,
      liczba,
      ocenione,
      znane,
      procentZnanych: liczba ? Math.round((znane / liczba) * 100) : 0,
      rundy: rundy.length,
      sprawdzenia: razem,
      poprawne: dobre,
      procentPoprawnych: razem ? Math.round((dobre / razem) * 100) : 0,
      samoocenyTabel: rundy.map((r) => r.samoocena),
    };
  }

  const api = {
    OCENY,
    WAGI,
    TRYBY,
    DLUGOSC_RUNDY,
    normalizuj,
    odleglosc,
    warianty,
    strony,
    akceptowane,
    sprawdz,
    losujWazone,
    wybierzDoRundy,
    nowyStan,
    ocenaSlowa,
    zapiszOceny,
    zapiszRunde,
    statystykiZestawu,
    wagaOceny,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.Logika = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
