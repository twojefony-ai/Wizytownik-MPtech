# Wizytownik mPTech DTP — Wersja v2.0.0 (Fork Produkcyjny)

Kompletny system DTP do personalizacji, weryfikacji i generowania produkcyjnych wizytówek firmowych mPTech z kodami QR vCard 3.0 oraz wybiórczą warstwą lakieru UV (Magenta 100%).

Aplikacja przystosowana do bezproblemowego wdrożenia na **Vercel**, **GitHub Pages** oraz środowisku lokalnym.

---

## 📦 Zawartość paczki (Repozytorium GitHub & Vercel)

Wszystkie zasoby produkcyjne zostały umieszczone bezpośrednio w katalogu `/public`, dzięki czemu Vite i Vercel automatycznie pakują je do dystrybucji statycznej:

```text
├── public/
│   ├── assets/
│   │   ├── Wizytowki-MP_2026_09-template1.pdf   # Aktualny, 4-stronicowy szablon produkcyjny Master PDF
│   │   ├── logo/
│   │   │   ├── mptech-logo.svg                 # Oficjalne logo wektorowe mPTech (kolor)
│   │   │   ├── mptech-logo-white.svg           # Logo wektorowe mPTech (białe na ciemne tło)
│   │   │   └── mptech-mark.svg                 # Sygnet firmowy mPTech
│   │   ├── icons/
│   │   │   ├── mail.svg                        # Ikona poczty e-mail
│   │   │   ├── phone.svg                       # Ikona telefonu
│   │   │   ├── mobile.svg                      # Ikona telefonu komórkowego
│   │   │   ├── location.svg                    # Ikona lokalizacji / biura
│   │   │   ├── nip.svg                         # Ikona identyfikatora podatkowego NIP
│   │   │   ├── website.svg                     # Ikona adresu strony WWW
│   │   │   ├── qr-code.svg                     # Ikona kodu QR
│   │   │   ├── uv-layer.svg                    # Ikona lakieru wybiórczego UV
│   │   │   ├── download.svg                    # Ikona pobierania plików
│   │   │   └── index.json                      # Indeks metadanych ikon
│   │   └── previews/                           # Wysokorozdzielcze podglądy stron szablonu:
│   │       ├── Wizytowki-MP_2026_09-template1_page_1.png  # Awers (CMYK z logo i ikonami)
│   │       ├── Wizytowki-MP_2026_09-template1_page_2.png  # Maska lakieru UV awersu (M=100)
│   │       ├── Wizytowki-MP_2026_09-template1_page_3.png  # Rewers (myPhone, HAMMER, techbite)
│   │       └── Wizytowki-MP_2026_09-template1_page_4.png  # Maska lakieru UV rewersu
│   ├── uploads/previews/                       # Symetryczne kopie dla zachowania kompatybilności wstecznej
│   ├── fonts/                                  # Właściwe fonty z pełnym wsparciem polskich znaków
│   │   ├── Rajdhani-Regular.ttf                # Krój Rajdhani Regular (wsparcie ąćęłńóśźż ĄĆĘŁŃÓŚŹŻ)
│   │   ├── Rajdhani-Medium.ttf
│   │   ├── Rajdhani-SemiBold.ttf
│   │   ├── Rajdhani-Bold.ttf
│   │   └── Montserrat-Variable.ttf
│   ├── favicon.svg                             # Ikona ulubionych (Favicon)
│   ├── sample_batch.csv                        # Przykładowy plik wsadowy CSV
│   └── sample_indesign.csv                     # Przykładowy plik dla Adobe InDesign Data Merge
```

---

## 🇵🇱 Pełna obsługa polskich znaków diakrytycznych

1. **Osadzenie fontów w `@font-face`**:
   W pliku `src/index.css` zarejestrowano lokalne fonty TTF (`Rajdhani` oraz `Montserrat`) z parametrem `unicode-range: U+0000-00FF, U+0100-017F, U+0180-024F;`. Polskie znaki (w tym „ż”, „ź”, „ą”, „ę”, „ł”, „ó”, „ś”, „ć”, „ń”) renderują się ostro i poprawnie bez zależności od zewnętrznych CDN.

2. **Inteligentny dekoder plików CSV (Windows-1250 vs UTF-8)**:
   Polski Microsoft Excel domyślnie zapisuje pliki CSV w standardzie **Windows-1250 (ANSI)**. Aplikacja automatycznie wykrywa kodowanie:
   - Sprawdza nagłówek UTF-8 BOM.
   - Weryfikuje poprawność sekwencji bajtów UTF-8.
   - W przypadku wykrycia standardu Windows-1250 dekoduje plik właściwym zestawem znaków.
   - Naprawia ewentualne artefakty mojibake (np. podwójnie kodowane `Å¼` zamienia automatycznie na `ż`).
   - W interfejsie procesora wsadowego dostępny jest przełącznik wyboru zestawu znaków (*Auto-wykrywanie*, *Windows-1250 Excel PL*, *UTF-8*).

---

## 🚀 Wdrożenie na Vercel z GitHub

1. Utwórz repozytorium na GitHub i wypchnij zawartość projektu:
   ```bash
   git init
   git add .
   git commit -m "feat: v2.0.0 DTP Fork - kompletne ikony, logo, fonty i obsługa polskich znaków"
   git remote add origin https://github.com/twoja-organizacja/kreator-wizytowek-mptech.git
   git push -u origin main
   ```
2. Zaloguj się na **Vercel**, wybierz **Add New Project** i wskaż repozytorium z GitHuba.
3. Vercel automatycznie wykryje projekt Vite:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Kliknij **Deploy**. Wszystkie podglądy, logo, ikony i szablon Master PDF będą działać od razu.

---

## 📄 Pobieranie szablonu produkcyjnego Master PDF

W prawym górnym rogu aplikacji znajduje się przycisk **`Szablon PDF`**, który pozwala każdemu użytkownikowi oraz operatorowi DTP pobrać oryginalny plik PDF:
- **Format netto**: 90 × 50 mm
- **Spady**: 3 mm (brutto 96 × 56 mm)
- **Rozdzielczość**: Wektor DTP / 300 DPI
- **Strony**: 4 strony (Przód CMYK, Przód UV, Tył CMYK, Tył UV)
