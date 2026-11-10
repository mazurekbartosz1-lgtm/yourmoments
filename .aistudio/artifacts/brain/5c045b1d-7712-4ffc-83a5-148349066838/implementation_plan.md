# Plan przebudowy Landing Page (PLG + Czysty, spokojny układ w stylu Karrot)

## 1. Cel zmian
Obecna strona startowa posiada pod obszarem pisania aż **7 rozbudowanych sekcji** z wielozakładkowymi symulatorami, przez co przytłacza odwiedzających ilością tekstu i kontrolek.

Inspirowani czystością, oddechem i rytmem **heykarrot.com** (ale **bez** chaotycznych żółtych karteczek *„Sound familiar?”* oraz rzędów pigułek z nazwami narzędzi), odchudzimy stronę do **3 przejrzystych, spokojnych sekcji** pod edytorem oraz wzmocnimy ścieżkę **Product-Led Growth (PLG)** na samej górze strony, aby jak najwięcej osób zakładało konto od razu po napisaniu pierwszych słów.

---

## 2. Co zostaje i jak wzmocnimy konwersję PLG na górze strony (Above the Fold)

Górna część strony (żywa kartka papieru z lisem przy biurku) pozostaje sercem strony, ale dopracujemy ją pod kątem natychmiastowej rejestracji:

1. **Natychmiastowy start z lisem i ciepłym pytaniem dnia**
   - Zawsze startujemy od **Lisa** (`#C96839`) oraz pytania: *„Jaka jedna spokojna chwila, rozmowa lub drobiazg sprawiły, że warto było przejść przez ten dzień?”* wraz ze spójnym pytaniem pomocniczym na marginesie.
2. **Subtelny pasek zapisu PLG po wpisaniu pierwszych słów + 1-Click Google CTA**
   - Gdy użytkownik zacznie pisać (np. wpisze min. 15–20 znaków lub kliknie odpowiedź na marginesie), tuż pod obszarem pisania (nad biurkiem ze zwierzakiem) płynnie pojawi się spokojny, ciepły pasek zachęcający do zachowania wpisu:
     - Krótki komunikat: *„Twój pierwszy wpis jest gotowy do zapieczętowania. Załóż darmowe konto w 5 sekund, aby zachować ten dzień.”*
     - Bezpośredni przycisk **„Zapisz wpis przez Google”** (1-click OAuth, który automatycznie przenosi napisany tekst do nowego konta) oraz przycisk **„Zamknij dzień i załóż konto”** (otwierający modal z wyborem Google lub e-maila).
3. **Czystsza przestrzeń wokół kartki**
   - Zwiększymy pionowy oddech (`padding` i `whitespace`) wokół pierwszej sekcji, usuwając zbędne dopiski techniczne, tak aby wzrok skupiał się wyłącznie na pytaniu dnia, pisaniu i towarzyszu.

---

## 3. Odchudzenie dołu strony: z 7 sekcji do 3 czystych sekcji

Zamiast 7 rozbudowanych bloków zostawimy tylko **3 klarowne sekcje** o dużej ilości światła i krótkich, konkretnych opisach:

### Sekcja 01 · Jak to działa (`Cztery chwile codziennego rytuału.`)
- **Co zostaje**: To jedyna sekcja z interaktywnym przełącznikiem 4 kroków (`01. Margines`, `02. Maszyna`, `03. Zamknięty dzień`, `04. Dziennik`).
- **Uproszczenie wizualne**:
  - Nagłówek w jednej linii z wiszącą żarówką po prawej stronie oraz ikonką otwartego dziennika przed `01 · Jak to działa`.
  - Prawa karta podglądu ma zawsze dokładnie taką samą wysokość jak 4 kroki po lewej stronie (`items-stretch` + `h-full`), a aktywne zakładki i akcenty przyjmują kolor wybranego zwierzaka (domyślnie kolor lisa `#C96839`).
  - Krótsze, jednozdaniowe opisy każdego z 4 kroków po lewej stronie, bez ścian tekstu.

### Sekcja 02 · Prywatność E2EE (`Twoje myśli należą wyłącznie do Ciebie.`)
- **Zamiast wieloetapowego symulatora szyfrowania**: Czysta, statyczna wizualizacja w układzie 2-kolumnowym (lub przejrzystym Bento):
  - **Po lewej**: Zwięzłe wyjaśnienie w 2 zdaniach, że każdy wpis jest szyfrowany kluczem **AES-256-GCM** bezpośrednio w przeglądarce przed wysłaniem do chmury.
  - **Po prawej**: Elegancka, statyczna karta porównawcza *„Na Twoim urządzeniu (czytelny wpis)”* vs *„W bazie danych (zaszyfrowany szyfrogram)”* — bez przeklikiwania zakładek i bez nadmiaru technicznego żargonu.

### Sekcja 03 · Telefon, Gwiazdki i Rytuał w kieszeni (`Zawsze pod ręką, gdy kończy się dzień.`)
- **Połączenie najważniejszych korzyści w jedną lekką, statyczną sekcję**:
  - Zamiast osobnych, ciężkich sekcji o ciepłym spojrzeniu (`03`), dzieleniu się (`04`), wykresach (`05`) i instalacji PWA (`06`), pokażemy **3 czyste karty wizualne w jednym rzędzie**:
    1. **Telefon i aplikacja PWA**: Widok czystej kartki na telefonie — dodaj do ekranu głównego i pisz lub dyktuj głosem przed snem.
    2. **Gwiazdki i ciche podsumowania**: Po zamknięciu kilku dni zwierzak podkreśla ważne chwile i pomaga dostrzec to, co dobre, bez oceniania.
    3. **Listy i statystyki rytmu**: Możliwość wydrukowania lub wysłania bliskiej osobie jednego wybranego wspomnienia w formie papierowego listu oraz spokojny kalendarz Twojej regularności.

---

## 4. Domknięcie strony (Finalny CTA do rejestracji)
- Pod sekcją `03` dodamy spokojne, wyśrodkowane domknięcie w stylu **heykarrot.com**:
  - Ilustracja wybranego zwierzaka (domyślnie Lis) + nagłówek: *„Gotowy na pierwszy spokojny wieczór z dziennikiem?”*
  - Główny przycisk w kolorze zwierzaka: **„Załóż darmowe konto i zachowaj dzisiejszy wpis”** + bezpośredni przycisk **„Kontynuuj z Google”**.

---

## 5. Zakres plików do modyfikacji po zatwierdzeniu planu
- `src/components/LandingPage.tsx`:
  - Dodanie delikatnego paska konwersji PLG po rozpoczęciu pisania (z bezpośrednim logowaniem Google 1-click oraz przeniesieniem wpisanego tekstu do konta).
  - Usunięcie rozbudowanych symulatorów z sekcji `02`, `03`, `04`, `05`, `06`, `07` i zastąpienie ich dwiema czystymi, statycznymi sekcjami (`02 · Prywatność E2EE` oraz `03 · W kieszeni i na co dzień`) + końcowym blokiem CTA.
  - Zachowanie pełnego wsparcia językowego (`PL` / `EN` wykrywanego automatycznie z przeglądarki i systemu) dla nowej, odchudzonej struktury.
