# Plan wdrożenia: Gwiazdki docenienia (Sparkle) oraz Jednorazowe udostępnianie wpisu z kodem PIN

Rozbudowa aplikacji **Momenty** o dwie funkcje towarzyszące zamknięciu dnia: **Gwiazdki docenienia (Sparkle)** — niedeterministycznego „dobrego kumpla”, który co 1–4 zamknięte dni czeka obok Dziennika z ciepłym, konkretnym podsumowaniem ostatnich wpisów i zapisuje je jako Kartę Docenienia — oraz **Jednorazowe udostępnianie wiadomości z kodem PIN** i automatycznym tłumaczeniem na język odbiorcy, które ulega bezpowrotnemu zaszyfrowaniu i zniszczeniu natychmiast po pierwszym odczytaniu.

---

## User Review & Critical Decisions

Poniższe decyzje zostały uzgodnione i stanowią fundament architektury rozwiązania:

- **Miejsce udostępniania wpisu**: Przycisk do jednorazowego udostępnienia wiadomości jest dostępny **wyłącznie zaraz po zamknięciu dzisiejszego dnia** (na ekranie pieczęci zamkniętego dnia), podkreślając ulotny, tu-i-teraz charakter dzielenia się myślą.
- **Reguła wygasania linku z PIN-em**: Link wygasa **natychmiast po pierwszym poprawnym wpisaniu kodu PIN i wyświetleniu wiadomości**. Odświeżenie strony lub ponowne otwarcie linku blokuje dostęp na stałe — treść zostaje bezpowrotnie usunięta z serwera po odczycie.
- **Trwałość podsumowań Sparkle**: Po kliknięciu w gwiazdki i odczytaniu wiadomości od „kumpla”, podsumowanie **zostaje zapisane w Dzienniku jako wyróżniona Karta Docenienia**, do której można wracać między historycznymi wpisami.
- **Niedeterministyczny rytm Sparkle (1–4 dni)**: Po każdym odebraniu podsumowania Sparkle system losuje kolejny próg w przedziale **od 1 do 4 zamkniętych dni** (`Math.floor(Math.random() * 4) + 1`). Gdy licznik zamkniętych dni osiągnie wylosowany próg, w momencie zamknięcia dnia obok przycisku Dziennika rozbłyskują gwiazdki sygnalizujące, że czeka nowe podsumowanie.

---

## 1. Overview & Core Concept

Aplikacja **Momenty** zachowuje swój intymny, literacki charakter, wzbogacając moment zamknięcia dnia o dwa doświadczenia:

1. **Sparkle („Kumpel doceniający Twoje ostatnie dni”)**:
   - Zamiast sztywnych, mechanicznych statystyk, w losowym rytmie od **1 do 4 zamkniętych dni** zaraz po zapieczętowaniu dzisiejszego wpisu koło Dziennika pojawia się pulsująca ikona gwiazdek (`Sparkles`) z subtelnym komunikatem, że czeka na Ciebie osobiste podsumowanie.
   - Po kliknięciu w gwiazdki szybki i niskokosztowy model (`gemini-3.1-flash-lite` z automatycznym fallbackiem) analizuje wpisy z ostatnich kilku dni (do 7 dni wstecz) i zwraca się do użytkownika bezpośrednim, ciepłym tonem dobrego znajomego (*„Hej stary, dobrze zrobiłeś, bo…”*), wskazując, co było najważniejsze i dlaczego warto to docenić.
   - Odczytane podsumowanie zapisuje się na stałe w Dzienniku jako **Karta Docenienia**.

2. **Jednorazowe udostępnianie wiadomości z kodem PIN i wyborem języka**:
   - Na ekranie zamkniętego dzisiejszego dnia pojawia się akcja **„Udostępnij jednorazowo”**.
   - Użytkownik wybiera język docelowy wiadomości (np. pisze po polsku, ale wybiera angielski, hiszpański lub francuski dla odbiorcy) oraz otrzymuje wygenerowany (lub własny) 4-cyfrowy kod PIN.
   - Przed wysłaniem na serwer treść (opcjonalnie przetłumaczona w locie przez lekki model językowy) jest szyfrowana po stronie klienta algorytmem **AES-GCM (256-bit)** z kluczem wyprowadzonym z kodu PIN (`PBKDF2`).
   - Użytkownik kopiuje jednorazowy link wraz z kodem PIN. Gdy odbiorca otworzy link i wpisze poprawny PIN, serwer wydaje szyfrogram **tylko jeden raz** i natychmiast bezpowrotnie go niszczy. Odbiorca widzi wiadomość na ekranie, a każde odświeżenie lub ponowne wejście pokazuje informację, że wiadomość została już odczytana i uległa samozniszczeniu.

---

## 2. User Experience & Visual Design

Projekt wizualny jest w pełni spójny z dotychczasowym kierunkiem artystycznym **Momenty** (ciepły papier `#F7F5F0`, głęboki atrament `#1C1A18`, lakowa czerwień `#8B2635`, pudrowy róż `#EBC5CF`, szeryfowa `Lora` oraz techniczny `JetBrains Mono`):

- **Wskaźnik Sparkle obok Dziennika**:
  - Gdy dzisiaj zamknięto dzień i licznik osiągnął wylosowany próg (1–4 dni), obok przycisku otwierającego **Dziennik** (zarówno na banerze zamkniętego dnia, jak i przy dolnym uchwycie Dziennika) pojawia się złocisto-różowy znaczek z animacją gwiazdek (`Sparkles`) oraz napisem *„Czeka na Ciebie Sparkle”*.
- **Modal i Karta Docenienia (Sparkle)**:
  - Kliknięcie w gwiazdki otwiera kartę stylizowaną na odręczny list / notatkę na ciepłym kremowym papierze z delikatnym złotym i różowym akcentem (`#D4AF37` / `#EBC5CF`).
  - Nagłówek zawiera zakres dat ostatnich wpisów oraz bezpośredni zwrot, a pod treścią wyróżnione są 2–3 kluczowe momenty, za które warto siebie docenić.
  - W widoku archiwum **Dziennika** zapisane podsumowania wyświetlają się na osi czasu jako wyróżnione **Karty Docenienia** (z ikoną gwiazdek i odznaką *„Karta docenienia”*).
- **Modal tworzenia jednorazowego linku (po zamknięciu dnia)**:
  - Dostępny z poziomu ekranu zamkniętego dzisiejszego dnia obok przycisku podglądu wpisu.
  - Pozwala jednym kliknięciem wybrać język odbiorcy (`Polski`, `English`, `Español`, `Français`), wyświetla wygenerowany 4-cyfrowy kod PIN (z opcją zmiany) i generuje jednorazowy link (`?share=<id>`).
  - Zawiera dwa wygodne przyciski: **„Kopiuj sam link”** oraz **„Kopiuj link z kodem PIN”**, a także ostrzeżenie, że po pierwszym odczytaniu przez odbiorcę wiadomość zniknie na zawsze.
- **Ekran odbiorcy jednorazowej wiadomości (`?share=<id>`)**:
  - Otwarcie linku prezentuje minimalistyczny ekran z pieczęcią lakową i 4-polowym wejściem na kod PIN.
  - Po wpisaniu poprawnego PIN-u pieczęć się otwiera, wiadomość zostaje odszyfrowana w przeglądarce i wyświetlona w wybranym języku wraz z informacją *„Wiadomość jednorazowa — po zamknięciu lub odświeżeniu tej karty treść bezpowrotnie wygaśnie”*.
  - Przy próbie odświeżenia strony lub ponownego użycia linku wyświetlana jest karta *„Ta wiadomość została już odczytana i uległa zaszyfrowaniu”*.

---

## 3. Key Product Decisions & Trade-Offs

- **Model AI dla Sparkle i tłumaczenia (`gemini-3.1-flash-lite`)**:
  - Wykorzystujemy szybki, bardzo ekonomiczny model `gemini-3.1-flash-lite` (z kaskadowym fallbackiem do `gemini-3.8-flash` skonfigurowanym na serwerze). Zapewnia on niskie opóźnienie, znikomy koszt oraz naturalny, empatyczny styl wypowiedzi w języku użytkownika.
- **Szyfrowanie PIN-em po stronie klienta + atomowe spalenie na serwerze**:
  - Nawet zanim wiadomość trafi do bazy tymczasowej, jest szyfrowana kluczem wyprowadzonym z PIN-u (`PBKDF2` + `AES-GCM`). Dodatkowo dołączany jest skrót weryfikacyjny PIN-u (`SHA-256`), dzięki czemu błędnie wpisany PIN nie niszczy wiadomości (odbiorca może poprawić literówkę do 5 prób), natomiast pierwsze poprawne podanie PIN-u zwraca szyfrogram i **w tej samej operacji atomowo usuwa go z serwera i bazy**.
- **Dostępność dla odbiorców bez konta**:
  - Odbiorca jednorazowego linku nie musi zakładać konta ani logować się do aplikacji — dedykowany endpoint serwerowy obsługuje weryfikację PIN-u i jednorazowe wydanie zaszyfrowanego ładunku dla każdego, kto posiada link i kod PIN.

---

## 4. Technical Architecture & Data Strategy

### Przepływ komponentów i architektura systemu

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        EKRAN ZAMKNIĘTEGO DNIA (Klient)                       │
├──────────────────────────────────────┬───────────────────────────────────────┤
│ 1. Gwiazdki Sparkle (1–4 dni)        │ 2. Jednorazowe Udostępnianie + PIN    │
│  ├─ Losowy licznik (1..4 zamknięcia) │  ├─ Wybór języka docelowego           │
│  ├─ Przycisk ✨ obok "Dziennik"      │  ├─ Generowanie 4-cyfrowego PIN-u     │
│  └─ Kliknięcie → żądanie podsumowania│  └─ Szyfrowanie AES-GCM (klucz z PIN) │
└──────────────────┬───────────────────┴───────────────────┬───────────────────┘
                   │                                       │
                   ▼                                       ▼
┌──────────────────────────────────────┐ ┌─────────────────────────────────────┐
│   POST /api/sparkle-summary          │ │  POST /api/translate-share          │
│   (gemini-3.1-flash-lite)            │ │  POST /api/shares                   │
│  ├─ Analiza wpisów z ostatnich dni   │ │  POST /api/shares/:id/consume       │
│  └─ Ton: "Hej stary, dobrze zrobiłeś"│ │  └─ Atomowe wydanie + spalenie      │
└──────────────────┬───────────────────┘ └─────────────────┬───────────────────┘
                   │                                       │
                   ▼                                       ▼
┌──────────────────────────────────────┐ ┌─────────────────────────────────────┐
│      DZIENNIK (Karta Docenienia)     │ │    WIDOK ODBIORCY (?share=<id>)     │
│  ├─ Zapis w kolekcji użytkownika     │ │  ├─ Ekran wprowadzania kodu PIN     │
│  │  oraz pamięci lokalnej            │ │  ├─ Odszyfrowanie AES-GCM w pamięci │
│  └─ Wyświetlanie między wpisami      │ │  └─ Odświeżenie = Dostęp zablokowany│
└──────────────────────────────────────┘ └─────────────────────────────────────┘
```

### Modele danych

1. **Karta Docenienia Sparkle (`SparkleSummary`)**:
   - `id`: unikalny identyfikator karty
   - `date`: data wygenerowania (`YYYY-MM-DD`)
   - `createdAt`: znacznik czasu utworzenia
   - `periodLabel`: zakres dat podsumowanych wpisów
   - `greeting`: bezpośredni zwrot otwierający
   - `content`: główne kumplowskie podsumowanie (zaszyfrowane w chmurze kluczem użytkownika, analogicznie do wpisów)
   - `highlights`: lista 2–3 konkretnych rzeczy, które użytkownik zrobił dobrze

2. **Stan licznika Sparkle (`SparkleState`)**:
   - `sealedDaysSinceLastSparkle`: liczba zamkniętych dni od ostatniego podsumowania
   - `targetDaysForNextSparkle`: wylosowana liczba dni w przedziale `1..4`
   - `hasPendingSparkle`: flaga informująca, że gwiazdki czekają na kliknięcie obok Dziennika
   - `lastTriggeredDate`: data ostatniego wyzwolenia gwiazdek

3. **Jednorazowa Zaszyfrowana Wiadomość (`OneTimeShare`)**:
   - `shareId`: losowy, nieodgadnionym identyfikator linku (128-bit hex)
   - `encryptedPayload`: zaszyfrowana algorytmem AES-GCM treść wiadomości oraz pytania dnia (w wybranym języku docelowym)
   - `iv` oraz `salt`: parametry kryptograficzne dla `PBKDF2` + `AES-GCM`
   - `pinVerifierHash`: skrót kryptograficzny z `PIN + salt` pozwalający serwerowi zweryfikować poprawność PIN-u przed atomowym skasowaniem ładunku
   - `targetLang`: język docelowy (`pl`, `en`, `es`, `fr`)
   - `failedAttempts`: licznik błędnych prób PIN (blokada i usunięcie po 5 nieudanych próbach)
   - `burned`: flaga oznaczająca, że wiadomość została już odczytana, a jej szyfrogram bezpowrotnie wyczyszczony (`encryptedPayload = null`)
