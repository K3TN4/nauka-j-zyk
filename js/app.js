/*
 * Interfejs: menu, wybór trybu, runda sprawdzania i ocena znajomości.
 * Stan trzymany w localStorage (klucz KLUCZ). Bez serwera i bez zewnętrznych usług.
 */
(function () {
  'use strict';

  const L = window.Logika;
  const DANE = window.SLOWKA;
  const KLUCZ = 'nauka-slowek-ru:v1';
  const app = document.getElementById('app');

  let stan = wczytaj();
  let widok = { typ: 'menu' };

  // ---------- Pamięć (localStorage) ----------

  function wczytaj() {
    try {
      const s = JSON.parse(localStorage.getItem(KLUCZ));
      if (s && s.wersja === 1) return s;
    } catch (e) {
      /* brak lub uszkodzony zapis - zaczynamy od czystego stanu */
    }
    return L.nowyStan();
  }

  function zapisz() {
    try {
      localStorage.setItem(KLUCZ, JSON.stringify(stan));
      return true;
    } catch (e) {
      alert('Nie udało się zapisać postępu w przeglądarce (localStorage). Sprawdź ustawienia prywatności.');
      return false;
    }
  }

  // ---------- Pomocnicze DOM ----------

  function el(tag, attrs, dzieci) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else if (v !== false && v !== null && v !== undefined) n.setAttribute(k, v === true ? '' : v);
    }
    for (const d of [].concat(dzieci || [])) {
      if (d === null || d === undefined || d === false) continue;
      n.append(typeof d === 'string' ? document.createTextNode(d) : d);
    }
    return n;
  }

  function widokDo(nowy) {
    widok = nowy;
    render();
  }

  function render() {
    app.replaceChildren();
    if (widok.typ === 'menu') app.append(menu());
    else if (widok.typ === 'setup') app.append(ekranWyboru());
    else if (widok.typ === 'runda') app.append(runda());
  }

  function slowaZestawu(nr) {
    return DANE.slowka.filter((s) => s.set === nr);
  }

  function opisKierunku(k) {
    return k === 'RU-PL' ? 'rosyjski → polski' : 'polski → rosyjski';
  }

  // ---------- Menu główne ----------

  function menu() {
    const karty = DANE.zestawy.map((z) => {
      const st = L.statystykiZestawu(stan, slowaZestawu(z.nr), z.nr);
      return el('section', { class: 'karta' }, [
        el('h2', { text: `Zestaw ${z.nr} · słowa ${z.od}–${z.do}` }),
        el('p', { class: 'statystyki', text: `Słów w zestawie: ${st.liczba}` }),
        el('p', {
          class: 'statystyki',
          text: `Znane (według Twoich ocen): ${st.procentZnanych}% (${st.znane} z ${st.liczba}; ocenionych: ${st.ocenione})`,
        }),
        el('p', {
          class: 'statystyki',
          text: `Ćwiczeń: ${st.rundy} · poprawne sprawdzenia: ${st.poprawne}/${st.sprawdzenia}` +
            (st.sprawdzenia ? ` (${st.procentPoprawnych}%)` : ''),
        }),
        el('p', {
          class: 'statystyki',
          text: st.samoocenyTabel.length
            ? `Samoocena tabel (ile znasz z 10): ${st.samoocenyTabel.join(', ')}`
            : 'Samoocena tabel: jeszcze brak',
        }),
        el('div', { class: 'pasek' }, [
          el('button', { class: 'glowny', onclick: () => widokDo({ typ: 'setup', nr: z.nr, tryb: 'wszystkie', kierunek: 'PL-RU', komunikat: null }), text: 'Ćwicz' }),
          el('button', { class: 'ostrzezenie', onclick: () => resetZestawu(z.nr), text: 'Resetuj statystyki' }),
        ]),
      ]);
    });

    return el('div', {}, [
      el('h1', { text: 'Słówka rosyjskie' }),
      el('p', {
        class: 'statystyki',
        text: 'Zestaw 1 = najczęstsze słowa, zestaw 8 = najrzadsze. Postęp zapisuje się w tej przeglądarce.',
      }),
      ...karty,
    ]);
  }

  function resetZestawu(nr) {
    if (!confirm(`Na pewno zresetować statystyki zestawu ${nr}? Oceny słów i historia ćwiczeń tego zestawu zostaną usunięte.`)) return;
    const ids = new Set(slowaZestawu(nr).map((s) => String(s.id)));
    for (const id of ids) delete stan.slowa[id];
    stan.rundy = stan.rundy.filter((r) => r.zestaw !== nr);
    zapisz();
    render();
  }

  // ---------- Wybór trybu przed startem ----------

  function ekranWyboru() {
    const { nr } = widok;
    const grupa = (nazwa, wartosci, aktywna, zmiana) => el('fieldset', {}, [
      el('legend', { text: nazwa }),
      ...wartosci.map(([wartosc, etykieta]) => el('label', { class: 'opcja' }, [
        el('input', {
          type: 'radio',
          name: nazwa,
          value: wartosc,
          ...(aktywna === wartosc ? { checked: true } : {}),
          onchange: () => { widok[zmiana] = wartosc; render(); },
        }),
        etykieta,
      ])),
    ]);

    const tryby = Object.entries(L.TRYBY).map(([k, v]) => [k, v.etykieta]);
    return el('div', {}, [
      el('h1', { text: `Zestaw ${nr}` }),
      widok.komunikat ? el('p', { class: 'komunikat', text: widok.komunikat }) : null,
      grupa('Kierunek', [['PL-RU', 'polski → rosyjski'], ['RU-PL', 'rosyjski → polski']], widok.kierunek, 'kierunek'),
      grupa('Słowa do rundy', tryby, widok.tryb, 'tryb'),
      el('div', { class: 'pasek' }, [
        el('button', { class: 'glowny', onclick: () => start(), text: 'Start (10 słów)' }),
        el('button', { onclick: () => widokDo({ typ: 'menu' }), text: 'Wróć' }),
      ]),
    ]);
  }

  function start() {
    const { nr, tryb, kierunek } = widok;
    const wybrane = L.wybierzDoRundy({ slowka: slowaZestawu(nr), stan, tryb });
    if (!wybrane.length) {
      widok.komunikat = 'W tym trybie nie ma słów do ćwiczenia. Wybierz inny tryb albo wróć do menu.';
      render();
      return;
    }
    widokDo({
      typ: 'runda', nr, tryb, kierunek,
      slowa: wybrane,
      odpowiedzi: wybrane.map(() => ''),
      sprawdzone: false,
      wyniki: null,
      dobre: 0,
      oceny: {},
      samoocena: null,
      blad: null,
    });
  }

  // ---------- Runda: tłumaczenie, sprawdzenie, ocena ----------

  function runda() {
    const r = widok;
    const pokazany = (s) => L.strony(s, r.kierunek).pokazany;
    const naglowekSlowa = r.kierunek === 'RU-PL' ? 'Słowo (rosyjskie)' : 'Słowo (polskie)';
    const naglowekTlum = r.kierunek === 'RU-PL' ? 'Twoje tłumaczenie (PL)' : 'Twoje tłumaczenie (RU)';

    const wiersze = r.slowa.map((s, i) => {
      const poprawny = L.strony(s, r.kierunek).poprawny;
      const klasa = r.sprawdzone ? (r.wyniki[i].ok ? 'wiersz-ok' : 'wiersz-zle') : '';
      const pole = el('input', {
        type: 'text',
        value: r.odpowiedzi[i],
        autocomplete: 'off',
        autocapitalize: 'off',
        spellcheck: 'false',
        'aria-label': `Tłumaczenie: ${pokazany(s)}`,
        disabled: r.sprawdzone,
        oninput: (e) => { r.odpowiedzi[i] = e.target.value; },
      });
      let wynik = null;
      if (r.sprawdzone) {
        const ok = r.wyniki[i].ok;
        wynik = el('td', { class: 'kol-wynik' }, [
          el('span', { class: ok ? 'wynik-ok' : 'wynik-zle', text: ok ? '✓ dobrze' : '✗ źle' }),
          el('div', { class: 'statystyki', text: `poprawnie: ${poprawny}` }),
        ]);
      }
      return el('tr', { class: klasa }, [
        el('td', { text: String(i + 1) }),
        el('td', { text: pokazany(s) }),
        el('td', {}, [pole]),
        wynik,
      ].filter(Boolean));
    });

    const tabela = el('table', { class: 'tabela' }, [
      el('thead', {}, [el('tr', {}, [
        el('th', { text: '#' }),
        el('th', { text: naglowekSlowa }),
        el('th', { text: naglowekTlum }),
        r.sprawdzone ? el('th', { class: 'kol-wynik', text: 'Wynik' }) : null,
      ].filter(Boolean))]),
      el('tbody', {}, wiersze),
    ]);

    const przyciskSprawdz = el('button', {
      class: 'glowny',
      text: 'Sprawdź',
      disabled: r.sprawdzone,
      onclick: () => sprawdz(),
    });

    const blok = [
      el('h1', { text: `Zestaw ${r.nr} · ${opisKierunku(r.kierunek)}` }),
      el('p', { class: 'statystyki', text: `Tryb: ${L.TRYBY[r.tryb].etykieta}` }),
      r.blad ? el('p', { class: 'komunikat', text: r.blad }) : null,
      tabela,
    ];

    if (!r.sprawdzone) {
      blok.push(el('div', { class: 'pasek' }, [
        przyciskSprawdz,
        el('button', { onclick: () => widokDo({ typ: 'menu' }), text: 'Porzuć rundę' }),
      ]));
    } else {
      blok.push(el('p', { class: 'statystyki', text: `Dobrze: ${r.dobre} z ${r.slowa.length}. Teraz oceń każde słowo i całą tabelę.` }));
      blok.push(ocenaSlow(r));
      blok.push(el('div', { class: 'pasek' }, [
        el('button', { class: 'glowny', onclick: () => zapiszOcene(), text: 'Zapisz ocenę i wróć do menu' }),
      ]));
    }
    return el('div', {}, blok);
  }

  function sprawdz() {
    const r = widok;
    const wyniki = r.slowa.map((s, i) => {
      const dopuszczalne = L.akceptowane(s, r.kierunek);
      return L.sprawdz(r.odpowiedzi[i], dopuszczalne);
    });
    widok = { ...r, sprawdzone: true, wyniki, dobre: wyniki.filter((w) => w.ok).length, blad: null };
    render();
  }

  function ocenaSlow(r) {
    const opcje = [{ id: '', etykieta: '— wybierz —' }, ...L.OCENY.map((o) => ({ id: o.id, etykieta: o.etykieta }))];
    const wiersze = r.slowa.map((s, i) => {
      const select = el('select', {
        'aria-label': `Ocena: ${L.strony(s, r.kierunek).pokazany}`,
        onchange: (e) => { r.oceny[s.id] = e.target.value; },
      }, opcje.map((o) => el('option', { value: o.id, text: o.etykieta, ...(r.oceny[s.id] === o.id ? { selected: true } : {}) })));
      return el('tr', {}, [
        el('td', { text: L.strony(s, r.kierunek).pokazany }),
        el('td', {}, [select]),
      ]);
    });
    return el('section', { class: 'karta' }, [
      el('h2', { text: 'Ocena znajomości słów' }),
      el('table', { class: 'tabela' }, [el('tbody', {}, wiersze)]),
      el('label', { class: 'opcja' }, [
        'Ile słów z tej tabeli znam (0–10): ',
        el('input', {
          type: 'number', min: '0', max: '10', step: '1', inputmode: 'numeric', style: 'width:5rem',
          value: r.samoocena ?? '',
          oninput: (e) => { r.samoocena = e.target.value === '' ? null : Number(e.target.value); },
        }),
      ]),
    ]);
  }

  function zapiszOcene() {
    const r = widok;
    const brakOcen = r.slowa.filter((s) => !r.oceny[s.id]);
    if (brakOcen.length) {
      widokDo({ ...r, blad: `Oceń jeszcze ${brakOcen.length} słów (znam / jest ok / zapominam / nie znam).` });
      return;
    }
    const sam = r.samoocena;
    if (!Number.isInteger(sam) || sam < 0 || sam > r.slowa.length) {
      widokDo({ ...r, blad: `Wpisz, ile słów z tej tabeli znasz (liczba od 0 do ${r.slowa.length}).` });
      return;
    }
    try {
      L.zapiszRunde(stan, {
        zestaw: r.nr,
        tryb: r.tryb,
        kierunek: r.kierunek,
        dobre: r.dobre,
        razem: r.slowa.length,
        samoocena: sam,
        oceny: r.oceny,
        dataIso: new Date().toISOString(),
      });
    } catch (e) {
      widokDo({ ...r, blad: e.message });
      return;
    }
    zapisz();
    widokDo({ typ: 'menu' });
  }

  // ---------- Start ----------

  if (!DANE || !DANE.slowka) {
    app.textContent = 'Brak danych słówek (data/slowka.js). Uruchom tools/build_data.py.';
  } else {
    render();
  }
})();
