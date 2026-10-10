# Słówka rosyjskie — 900 najczęstszych słów, 8 zestawów

Strona do nauki słówek PL↔RU. Działa w przeglądarce na komputerze i telefonie.
Bez logowania, bez serwera, bez zewnętrznych usług. Postęp zapisuje się lokalnie
w przeglądarce (`localStorage`).

## Uruchomienie

Najprościej: otwórz plik `index.html` w przeglądarce (dwuklik).

Jeśli wolisz lokalny serwer:

    python3 -m http.server 8000

i wejdź na http://localhost:8000.

## Struktura

    index.html          strona główna (ładuje dane, logikę i interfejs)
    css/style.css       wygląd, responsywny układ
    js/logic.js         ocenianie odpowiedzi, losowanie, wagi, statystyki (bez DOM)
    js/app.js           interfejs i zapis do localStorage
    data/slowka.js      dane dla przeglądarki (generowane)
    data/slowka.json    te same dane w JSON (generowane)
    tools/build_data.py generator danych z talii Anki
    tests/              testy logiki i danych (node:test)
    package.json        skrypty: test, build-data

## Źródło słów

Słowa pochodzą z talii Anki „900 najczęściej używanych słówek rosyjskich PL-RU”
(plik `.apkg`). Kolejność = ranking częstości (pole `due` karty).
Słowa dzielone są na **8 zestawów**: zestaw 1 = najczęstsze, zestaw 8 = najrzadsze.
Każdy zestaw ma 112–113 słów.

Aby przebudować dane z nowej talii:

    python3 tools/build_data.py /ścieżka/do/collection.anki2

(`.apkg` to archiwum ZIP — wystarczy go rozpakować i wskazać `collection.anki2`.)

## Jak działa ćwiczenie

1. Wybierasz zestaw, kierunek (PL→RU lub RU→PL) i tryb:
   - wszystkie słowa,
   - tylko słowa, których nie znasz na 100% (jest ok, zapominam, nie znam, nieocenione),
   - tylko słowa, których nie znasz zupełnie albo zapominasz.
2. Losowanych jest 10 słów. Wpisujesz tłumaczenia.
3. „Sprawdź” pokazuje poprawne tłumaczenia; każde pole jest oznaczone ✓ (dobrze) albo ✗ (źle).
4. Oceniasz każde słowo: *znam na pamięć*, *jest ok*, *zapominam*, *nie znam zupełnie*.
5. Wpisujesz, ile słów z tabeli znasz (0–10). Zapis trafia do localStorage.

### Zasady sprawdzania odpowiedzi

- Ignorowana jest wielkość liter, interpunkcja i nadmiarowe spacje.
- Polskie znaki są porównywane bez diakrytyki (ą→a, ł→l itd.).
- Rosyjskie „ё” traktowane jak „е”.
- Pojedyncza literówka (różnica o jeden znak) jest przepuszczana tylko w wariantach
  dłuższych niż 4 litery.
- Przy kilku tłumaczeniach po „/”, „,” lub „;” akceptowany jest każdy wariant.
  Treść w nawiasach (np. „(waluta ros.)”) jest opisem i nie jest sprawdzana.

### Wagi częstotliwości

Słowo wraca tym częściej, im gorzej je znasz. Losowanie jest ważone wagą:

| ocena            | waga | dlaczego                                                   |
|------------------|------|------------------------------------------------------------|
| znam na pamięć   | 1    | już opanowane — wraca rzadko, żeby nie tracić czasu        |
| jest ok          | 2    | prawie znane — wraca co jakiś czas                         |
| nieocenione      | 5    | nie wiadomo, jak dobrze je znasz — wraca mocno             |
| zapominam        | 4    | wiedza się ulatnia — wraca często                          |
| nie znam zupełnie| 6    | najsłabsze — wraca najczęściej                             |

Wagi są w `js/logic.js` (`WAGI`), więc łatwo je zmienić.

### Statystyki w menu

Dla każdego zestawu: liczba słów, procent znanych (według Twoich ocen),
liczba ćwiczeń, poprawne sprawdzenia (w procentach), historia samoocen tabel.
Przycisk „Resetuj statystyki” usuwa dane zestawu po potwierdzeniu.

## Testy

    npm test

(lub `node --test tests/logic.test.js tests/data.test.js`). Testy sprawdzają:
normalizację, akceptację wariantów, tolerancję literówek, wagi losowania,
tryby rundy, walidację samooceny, statystyki oraz poprawność danych
(900 słów, 8 zestawów bez luk, przypisanie do zestawów).

## Wgrywanie na GitHub (GitHub Desktop)

1. W GitHub Desktop wybierz *File → Add local repository* i wskaż folder `nauka-slowek-ru`.
2. Jeśli repozytorium nie jest jeszcze git-em: *Create a repository here*.
3. Zatwierdź pliki (*Commit to main*) i kliknij *Publish repository*.

Pliki do dodania: wszystkie z tego folderu. `.gitignore` już jest — wyklucza m.in. `node_modules/`.

## Prywatność

Strona nie wysyła żadnych danych: ani słów, ani Twoich odpowiedzi.
Wszystko zostaje w localStorage tej przeglądarki.
