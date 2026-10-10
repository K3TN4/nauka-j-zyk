const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const dane = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'slowka.json'), 'utf8'));

test('dane: 900 słów, id 1..900 bez luk', () => {
  assert.equal(dane.slowka.length, 900);
  assert.deepEqual(dane.slowka.map((s) => s.id), Array.from({ length: 900 }, (_, i) => i + 1));
});

test('dane: 8 zestawów, ciągłe zakresy, suma = 900', () => {
  assert.equal(dane.zestawy.length, 8);
  assert.equal(dane.zestawy.reduce((s, z) => s + z.liczba, 0), 900);
  dane.zestawy.forEach((z, i) => {
    if (i > 0) assert.equal(z.od, dane.zestawy[i - 1].do + 1);
    assert.equal(z.do - z.od + 1, z.liczba);
  });
});

test('dane: każde słowo ma polski i rosyjski, bez pustych pól', () => {
  for (const s of dane.slowka) {
    assert.ok(s.pl && s.ru, `pusta pozycja id=${s.id}`);
  }
});

test('dane: przypisanie do zestawu zgadza się z zakresem', () => {
  for (const s of dane.slowka) {
    const z = dane.zestawy.find((x) => s.id >= x.od && s.id <= x.do);
    assert.equal(s.set, z.nr, `id=${s.id}`);
  }
});

test('dane: pierwsze słowa to najczęstsze z talii', () => {
  assert.deepEqual(dane.slowka.slice(0, 3).map((s) => s.ru), ['и', 'в', 'не']);
});
