const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../js/logic.js');

test('normalizacja: wielkość liter, znaki polskie, interpunkcja, spacje', () => {
  assert.equal(L.normalizuj('  Dzień,  DOBRY! '), 'dzien dobry');
  assert.equal(L.normalizuj('żółw'), 'zolw');
  assert.equal(L.normalizuj('ł'), 'l');
});

test('warianty: rozbijają po / , ; i pomijają nawiasy', () => {
  assert.deepEqual(L.warianty('co/że'), ['co', 'ze']);
  assert.deepEqual(L.warianty('tylko/zaledwie/jedynie'), ['tylko', 'zaledwie', 'jedynie']);
  assert.deepEqual(L.warianty('rubel (waluta ros.)'), ['rubel']);
  assert.deepEqual(L.warianty('nijak, w żaden sposób'), ['nijak', 'w zaden sposob']);
});

test('sprawdz: akceptuje każdy wariant z PDF-a', () => {
  const dop = L.warianty('co/że');
  assert.equal(L.sprawdz('co', dop).ok, true);
  assert.equal(L.sprawdz('Że', dop).ok, true);
  assert.equal(L.sprawdz('kot', dop).ok, false);
});

test('sprawdz: ignoruje wielkość liter, interpunkcję i polskie znaki', () => {
  const dop = L.warianty('zdarzyć się');
  assert.equal(L.sprawdz('  ZDARZYC   SIE!', dop).ok, true);
  assert.equal(L.sprawdz('zdarzyc sie', dop).ok, true);
});

test('sprawdz: pojedyncza literówka tylko w słowach dłuższych niż 4 litery', () => {
  assert.equal(L.sprawdz('zdarzyc sie', L.warianty('zdarzyć się')).ok, true);
  assert.equal(L.sprawdz('zdrzyc sie', L.warianty('zdarzyć się')).ok, true); // jedna różnica (brak 'a')
  assert.equal(L.sprawdz('zdrzyc se', L.warianty('zdarzyć się')).ok, false); // dwie różnice
  assert.equal(L.sprawdz('dom', L.warianty('dym')).ok, false); // krótkie słowo: bez tolerancji
  assert.equal(L.sprawdz('stol', L.warianty('stół')).ok, true); // ó→o, to nie literówka
});

test('sprawdz: pusta odpowiedź jest błędna', () => {
  assert.equal(L.sprawdz('   ', L.warianty('dom')).ok, false);
});

test('akceptowane: kierunek PL-RU bierze rosyjski, RU-PL polski', () => {
  const s = { pl: 'co/że', ru: 'что' };
  assert.deepEqual(L.akceptowane(s, 'PL-RU'), ['что']);
  assert.deepEqual(L.akceptowane(s, 'RU-PL'), ['co', 'ze']);
});

test('wagi: gorsza ocena = większa waga; nowe między zapominam a nie znam', () => {
  const w = L.WAGI;
  assert.ok(w.znam < w.ok && w.ok < w.zapominam && w.zapominam < w.nie);
  assert.ok(w.zapominam < w.nowe && w.nowe < w.nie);
  assert.equal(L.wagaOceny(null), w.nowe);
});

test('losujWazone: bez powtórzeń i zwraca n elementów', () => {
  const k = Array.from({ length: 20 }, (_, i) => ({ slowo: i, waga: 1 + (i % 3) }));
  const wynik = L.losujWazone(k, 10, () => 0.5);
  assert.equal(wynik.length, 10);
  assert.equal(new Set(wynik).size, 10);
});

test('wybierzDoRundy: tryb "slabe" nie zwraca słów znanych', () => {
  const slowka = Array.from({ length: 30 }, (_, i) => ({ id: i + 1, pl: 'p' + i, ru: 'r' + i }));
  const stan = L.nowyStan();
  for (let i = 1; i <= 10; i++) stan.slowa[i] = { ocena: 'znam', proby: 1, ostatnio: null };
  for (let i = 11; i <= 15; i++) stan.slowa[i] = { ocena: 'nie', proby: 1, ostatnio: null };
  const wybrane = L.wybierzDoRundy({ slowka, stan, tryb: 'slabe', n: 10, rng: () => 0.3 });
  assert.ok(wybrane.every((s) => s.id >= 11 && s.id <= 15));
  assert.equal(wybrane.length, 5);
});

test('wybierzDoRundy: tryb "nie100" pomija słowa oznaczone jako znam', () => {
  const slowka = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, pl: 'p' + i, ru: 'r' + i }));
  const stan = L.nowyStan();
  for (let i = 1; i <= 6; i++) stan.slowa[i] = { ocena: 'znam', proby: 1, ostatnio: null };
  const wybrane = L.wybierzDoRundy({ slowka, stan, tryb: 'nie100', n: 10, rng: () => 0.1 });
  assert.ok(wybrane.every((s) => s.id > 6));
});

test('zapiszRunde: odrzuca samoocenę spoza zakresu', () => {
  const stan = L.nowyStan();
  assert.throws(() => L.zapiszRunde(stan, { zestaw: 1, tryb: 'wszystkie', kierunek: 'PL-RU', dobre: 3, razem: 10, samoocena: 11, oceny: {}, dataIso: 'x' }));
  assert.throws(() => L.zapiszRunde(stan, { zestaw: 1, tryb: 'wszystkie', kierunek: 'PL-RU', dobre: 3, razem: 10, samoocena: -1, oceny: {}, dataIso: 'x' }));
});

test('zapiszRunde + statystyki: procent znanych i poprawnych', () => {
  const stan = L.nowyStan();
  const slowka = [1, 2, 3, 4].map((id) => ({ id, pl: 'p', ru: 'r' }));
  L.zapiszRunde(stan, {
    zestaw: 1, tryb: 'wszystkie', kierunek: 'PL-RU', dobre: 3, razem: 4, samoocena: 2,
    oceny: { 1: 'znam', 2: 'znam', 3: 'nie', 4: 'ok' }, dataIso: '2026-10-09T10:00:00Z',
  });
  const st = L.statystykiZestawu(stan, slowka, 1);
  assert.equal(st.procentZnanych, 50);
  assert.equal(st.ocenione, 4);
  assert.equal(st.rundy, 1);
  assert.equal(st.procentPoprawnych, 75);
  assert.deepEqual(st.samoocenyTabel, [2]);
});
