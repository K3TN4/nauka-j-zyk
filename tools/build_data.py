#!/usr/bin/env python3
"""Buduje data/slowka.js i data/slowka.json z talii Anki (plik collection.anki2).

Użycie:
    python3 tools/build_data.py /ścieżka/do/collection.anki2

Kolejność słów = ranking częstości (sortowanie po polu `due` karty).
Słowa dzielone są na 8 zestawów o kolejnych numerach rankingu:
zestaw 1 = najczęstsze, zestaw 8 = najrzadsze.
"""
import html
import json
import re
import sqlite3
import sys
from pathlib import Path

N_SETS = 8
EXPECTED = 900
ROOT = Path(__file__).resolve().parent.parent


def clean(text: str) -> str:
    text = html.unescape(re.sub(r"<[^>]+>", "", text)).replace("\xa0", " ")
    text = re.sub(r"\s*\(\d\)", "", text)  # oznaczenia znaczeń, np. "w (1)"
    return re.sub(r"\s+", " ", text).strip()


def main(argv: list[str]) -> None:
    if len(argv) != 2:
        sys.exit(__doc__)
    db = sqlite3.connect(argv[1])
    rows = db.execute(
        "select n.flds, c.due from notes n join cards c on c.nid = n.id order by c.due, n.id"
    ).fetchall()
    if len(rows) != EXPECTED:
        sys.exit(f"Oczekiwano {EXPECTED} notatek, jest {len(rows)}")

    words = []
    for flds, _due in rows:
        pl_raw, ru_raw = flds.split("\x1f")[:2]
        pl, ru = clean(pl_raw), clean(ru_raw)
        if not pl or not ru:
            sys.exit(f"Pusta pozycja: {pl_raw!r} / {ru_raw!r}")
        words.append({"pl": pl, "ru": ru})

    base, extra = divmod(len(words), N_SETS)
    sets = []
    start = 0
    for nr in range(1, N_SETS + 1):
        size = base + (1 if nr <= extra else 0)
        sets.append({"nr": nr, "od": start + 1, "do": start + size, "liczba": size})
        start += size

    for i, w in enumerate(words, 1):
        w["id"] = i
        w["set"] = next(s["nr"] for s in sets if s["od"] <= i <= s["do"])

    data = {
        "zrodlo": "Talia Anki: 900 najczęściej używanych słówek PL-RU",
        "zestawy": sets,
        "slowka": words,
    }
    out = ROOT / "data"
    out.mkdir(exist_ok=True)
    (out / "slowka.json").write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    (out / "slowka.js").write_text(
        "/* Wygenerowane przez tools/build_data.py - nie edytuj ręcznie. */\n"
        "window.SLOWKA = " + json.dumps(data, ensure_ascii=False) + ";\n",
        encoding="utf-8",
    )
    print(f"OK: {len(words)} słów, {len(sets)} zestawów: " + ", ".join(f"{s['nr']}={s['liczba']}" for s in sets))


if __name__ == "__main__":
    main(sys.argv)
