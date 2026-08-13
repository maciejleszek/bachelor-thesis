# Dokumentacja techniczna — Health Monitor

Techniczny opis referencyjny całego systemu: architektury, modelu danych,
API backendu, frontendu webowego, aplikacji mobilnej, synchronizacji danych
i infrastruktury. Materiał narracyjny do pracy inżynierskiej (metodologia,
wyniki korelacji, napotkane problemy) jest osobno w
[raport_aplikacja_health_monitor.md](raport_aplikacja_health_monitor.md) —
ten dokument jest referencją "jak to działa", nie opisem procesu badawczego.

## Spis treści

1. [Przegląd systemu](#1-przegląd-systemu)
2. [Architektura i usługi](#2-architektura-i-usługi)
3. [Model danych (PostgreSQL)](#3-model-danych-postgresql)
4. [Backend — referencja API (FastAPI)](#4-backend--referencja-api-fastapi)
5. [Synchronizacja danych (sync)](#5-synchronizacja-danych-sync)
6. [Frontend webowy (React)](#6-frontend-webowy-react)
7. [Aplikacja mobilna (Flutter)](#7-aplikacja-mobilna-flutter)
8. [Infrastruktura i wdrożenie](#8-infrastruktura-i-wdrożenie)
9. [Bezpieczeństwo i znane ograniczenia](#9-bezpieczeństwo-i-znane-ograniczenia)
10. [Uruchomienie od zera — skrócony przewodnik](#10-uruchomienie-od-zera--skrócony-przewodnik)

---

## 1. Przegląd systemu

Health Monitor gromadzi i wizualizuje dane zdrowotne z opasek/zegarków
sportowych (Garmin Connect, Xiaomi Mi Band) oraz subiektywne oceny
nastroju/stresu (ankiety SAM i VAS), a następnie liczy korelacje między
nimi. System składa się z pięciu kontenerów Docker (baza danych, backend,
frontend webowy, usługa synchronizacji, reverse proxy) oraz osobnego,
niekonteneryzowanego klienta mobilnego (Flutter), który łączy się z tym
samym backendem przez sieć lokalną lub internet.

```
                              ┌──────────────────────────┐
Garmin Connect API ──────────►│                          │
                              │   sync (Python/          │
Mi Fitness (eksport JSON) ───►│   APScheduler)           │──► PostgreSQL
                              │                          │        │
survey_imports/*.csv ────────►│                          │        │
                              └──────────────────────────┘        ▼
                                                            FastAPI (backend)
                                                                    │
                                                     ┌──────────────┴──────────────┐
                                                     ▼                             ▼
                                            React (frontend, web)        Flutter (mobile, Android/iOS)
                                                     │
                                        nginx (jedyny publiczny port 80)
                                        `/` → frontend · `/api/` → backend
```

## 2. Architektura i usługi

Zdefiniowane w `docker-compose.yml`:

| Usługa | Obraz / build | Rola | Porty |
|---|---|---|---|
| `db` | `postgres:16-alpine` | przechowywanie danych, inicjalizacja schematu z `backend/init.sql` | tylko wewnętrzny (5432) |
| `backend` | `./backend` (Python/FastAPI) | REST API | tylko wewnętrzny (8000) |
| `frontend` | `./frontend` (Node/React dev server) | SPA webowa | tylko wewnętrzny (3000) |
| `nginx` | `nginx:alpine` | reverse proxy — jedyny publiczny port | **80** |
| `sync` | `./sync` (Python/APScheduler) | harmonogram pobierania danych z Garmin/Mi Band, bez własnego portu | — |

Wolumeny: `postgres_data` (dane bazy), `sync_data` (tokeny sesji Garmina,
stan wznawiania backfillu). Zależności startowe: `backend`/`sync` czekają na
`db` (`condition: service_healthy`), `nginx` czeka na `frontend`+`backend`.

Klient mobilny (`mobile/`, Flutter) **nie jest częścią `docker-compose.yml`**
— to osobna aplikacja budowana/uruchamiana lokalnie (lub przez sklepy
Google Play / App Store), która komunikuje się z backendem przez adres
skonfigurowany w ustawieniach aplikacji (domyślnie `http://localhost/api`,
czyli przez ten sam nginx co frontend webowy).

## 3. Model danych (PostgreSQL)

Schemat inicjalizowany z `backend/init.sql` przy pierwszym starcie
kontenera `db`. Cztery główne tabele (plus nieużywana obecnie `environment`,
pozostałość po prototypie z Raspberry Pi):

### `daily_metrics` — dzienne agregaty per urządzenie
Unikalność `(date, source)` — `source` to `'garmin'` albo `'miband'`, więc
jeden dzień może mieć do dwóch wierszy (po jednym z każdego urządzenia).

| Kolumna | Typ | Opis |
|---|---|---|
| `date` | DATE | dzień pomiaru |
| `source` | VARCHAR | `garmin` / `miband` |
| `avg_hr`, `max_hr`, `resting_hr` | NUMERIC(5,1) | tętno: średnie, maks., spoczynkowe |
| `hrv` | NUMERIC(6,2) | zmienność rytmu zatokowego |
| `spo2` | NUMERIC(4,1) | saturacja krwi tlenem (%) |
| `steps` | INTEGER | liczba kroków |
| `avg_stress`, `max_stress` | NUMERIC(5,1) | stres wg algorytmu urządzenia (0–100) |
| `sleep_total_min`, `sleep_deep_min`, `sleep_light_min`, `sleep_rem_min` | INTEGER | fazy snu w minutach |
| `sleep_score` | NUMERIC(4,1) | wynik jakości snu wg urządzenia |

### `surveys` — ankiety SAM + VAS
| Kolumna | Typ | Opis |
|---|---|---|
| `date` | DATE | dzień, którego dotyczy ankieta |
| `sam_valence`, `sam_arousal`, `sam_dominance` | SMALLINT (0–9) | Self-Assessment Manikin: nastrój, pobudzenie, dominacja |
| `vas_stress` | SMALLINT (0–100) | Visual Analogue Scale — subiektywny stres |
| `notes` | TEXT | opcjonalna notatka |

### `blood_pressure` — ręczne pomiary ciśnienia
`sys`/`dia`/`pulse` (SMALLINT), `measured_at` (TIMESTAMPTZ), `notes`.

### `activities` — treningi z obu urządzeń
`garmin_activity_id` (unikalny; dla Mi Band generowane jest syntetyczne
ujemne ID), `source`, `sport_type`, `start_time`, `duration_sec`,
`distance_m`, `calories`, `avg_hr`/`max_hr`, `avg_speed_mps`/`max_speed_mps`,
`elevation_gain_m`, `aerobic_te`/`anaerobic_te` (training effect),
`training_load`, plus surowe payloady JSONB: `raw` (pełna odpowiedź API),
`splits_raw` (podział na odcinki), `hr_zones_raw` (strefy tętna) — parsowane
dopiero na żądanie przez `/activities/{id}/details`. Indeksy na
`sport_type` i `start_time`.

## 4. Backend — referencja API (FastAPI)

`backend/main.py`, uruchamiane przez `uvicorn`. CORS otwarty na wszystkie
originy (`allow_origins=["*"]`) — patrz [sekcja 9](#9-bezpieczeństwo-i-znane-ograniczenia).
Baza danych: `databases` (async wrapper nad `asyncpg`), połączenie z
`DATABASE_URL` (env var).

| Metoda i ścieżka | Parametry | Opis |
|---|---|---|
| `GET /health` | — | healthcheck (`{"status": "ok"}`) |
| `GET /summary` | — | ostatnie 7 dni: `metrics`, `surveys`, `blood_pressure` — zasila karty Dashboardu (web i mobile) |
| `GET /surveys` | `limit` (≤365, domyślnie 30) | lista ankiet, najnowsze pierwsze |
| `POST /surveys` | body: `date?`, `sam_valence?`, `sam_arousal?`, `sam_dominance?`, `vas_stress?`, `notes?` | nowa ankieta (201) |
| `DELETE /surveys/{id}` | — | usunięcie ankiety (204) |
| `GET /metrics` | `source?`, `days` (≤3650, domyślnie 30) | dzienne metryki; bez `source` łączy oba urządzenia w jeden wiersz na dzień (Garmin preferowany) |
| `POST /metrics` | body: `MetricsIn` (patrz niżej) | upsert (`ON CONFLICT (date, source) DO UPDATE`), używane przez `sync` i ręczny wpis w zakładce „Dane” |
| `GET /blood-pressure` | `days` (≤365, domyślnie 30) | historia ciśnienia |
| `POST /blood-pressure` | body: `sys`, `dia`, `pulse?`, `notes?` | nowy pomiar (201) |
| `GET /activities` | `sport_type?`, `days?` (≤3650), `limit` (≤2000, domyślnie 200) | lista treningów |
| `GET /activities/sport-types` | — | unikalne dyscypliny obecne w bazie |
| `GET /activities/summary` | `days?` (≤3650) | agregaty per dyscyplina (`by_sport`) i tygodniowo (`weekly`) |
| `GET /activities/records` | `sport_type?` | rekordy życiowe (dystans, czas, kalorie, tempo) — po całej historii, niezależnie od filtra dni |
| `GET /activities/{id}/details` | — | splity i strefy tętna dla treningu (parsowane z surowego JSONB Garmina), 404 jeśli nie istnieje |
| `GET /analysis/correlation` | `days?` (≤3650) | korelacja Pearsona VAS-stresu z `hrv`, `resting_hr`, `sleep_score`, `sleep_total_min`, `spo2`, `avg_stress` — zwraca sparowane dni (`pairs`) i współczynniki (`correlations: {metryka: {r, n}}`) |
| `GET /analysis/training-recovery` | `days?` (≤3650) | korelacja dziennego obciążenia treningowego (`training_load`) z regeneracją **następnego** dnia (sleep score, tętno spoczynkowe, HRV, VAS stres) |

`MetricsIn` (ciało `POST /metrics`): `date`, `source`, oraz wszystkie
kolumny numeryczne z `daily_metrics` jako opcjonalne.

Metodologia korelacji: `statistics.correlation` (biblioteka standardowa
Pythona), liczona tylko gdy ≥3 sparowane obserwacje i wariancja w obu
zmiennych > 0; w przeciwnym razie `r: null`. Szczegóły metodologiczne i
interpretacja wyników — patrz raport, rozdział 6.

## 5. Synchronizacja danych (sync)

Kontener `sync` (`sync/scheduler.py`, APScheduler, strefa `Europe/Warsaw`)
uruchamia cyklicznie:

| Zadanie | Harmonogram | Skrypt |
|---|---|---|
| Garmin — metryki dnia | codziennie 23:45 (ostatnie 2 dni) | `garmin_sync.py` |
| Garmin — aktywności | codziennie 23:47 (ostatnie 20 treningów) | `garmin_activities_sync.py` |
| Mi Band — import plików | co 2h + codziennie 23:50 | `miband_sync.py` |
| Startup sync | raz przy starcie kontenera (ostatnie 7 dni, Garmin + Mi Band + aktywności) | wszystkie powyższe |

**Garmin Connect** — logowanie przez nieoficjalną bibliotekę
`garminconnect` (`GARMIN_EMAIL`/`GARMIN_PASSWORD` z `.env`), tokeny sesji
cache'owane w wolumenie `sync_data` (`garmin_login.py`). Backfill pełnej
historii (`garmin_backfill.py`, uruchamiany ręcznie —
`docker compose run --rm sync python garmin_backfill.py`) skanuje wstecz
dzień po dniu i zatrzymuje się po 90 kolejnych dniach bez danych; postęp
zapisywany na dysku, więc przerwanie (Ctrl+C) i ponowne uruchomienie wznawia
zamiast zaczynać od nowa. Analogicznie `garmin_activities_sync.py --full`
dla pełnej historii treningów i `--details-backfill` dla splitów/stref
tętna.

**Xiaomi Mi Band** — brak oficjalnego API historii, więc `miband_sync.py`
parsuje eksport RODO/GDPR z aplikacji Mi Fitness ("Pobierz moje dane"):
pliki CSV wrzucane do `webapp/health-monitor/miband_imports/` są wykrywane
automatycznie (tryb `MIBAND_MODE=file`, domyślny), przetworzone pliki
oznaczane jako gotowe (folder `.processed`) żeby nie importować ich
ponownie. Kluczowy plik:
`hlth_center_aggregated_fitness_data.csv` (dzienne agregaty) oraz
`hlth_center_sport_record.csv` (treningi). Parser filtruje wiersze po polu
`Tag`, odróżniając realne dane (`daily_report`) od pustych znaczników
(`daily_mark`) o tym samym kluczu — bez tego filtra znaczniki nadpisywały
prawdziwe wartości.

**Ankiety historyczne** — `import_survey_csv.py` importuje jednorazowo
wyniki SAM/VAS zebrane poza aplikacją (`survey_imports/sam_vas_history.csv`)
do tabeli `surveys`.

## 6. Frontend webowy (React)

`frontend/` — Create React App, routing przez `react-router-dom`, wykresy
przez `recharts`, komunikacja z API przez własny `src/api.js` (fetch
wrapper, adres API z proxy CRA/nginx — bez potrzeby jawnej konfiguracji jak
w mobile).

| Trasa | Plik | Zawartość |
|---|---|---|
| `/` | `pages/Dashboard.jsx` | karty bieżących metryk (tętno, HRV, SpO2, stres, kroki, sen), wykresy trendu 7-dniowego |
| `/survey` | `pages/Survey.jsx` | formularz SAM (skala emotikon 0–9) + suwak VAS stresu (0–100) |
| `/history` | `pages/History.jsx` | lista wypełnionych ankiet z możliwością usunięcia |
| `/data` | `pages/Data.jsx` | ręczne wprowadzanie metryk z opaski i pomiarów ciśnienia |
| `/sport` | `pages/Sport.jsx` | lista treningów (badge źródła), podsumowania per dyscyplina, wykres trendu dystansu, rozwijane szczegóły (splity, strefy tętna) |
| `/sleep` | `pages/Sleep.jsx` | podsumowanie snu (śr. czas, sleep score, % głębokiego/REM), wykres składu snu, trend sleep score |
| `/analysis` | `pages/Analysis.jsx` | korelacja Pearsona (scatter + linia trendu), wykres czasowy dwuosiowy |

Współdzielone: `components/NavBar.jsx` (nawigacja dolna/górna),
`components/MetricCard.jsx` (karta metryki — odpowiednik `MetricCard` w
mobile), `hooks/useToast.js` (powiadomienia). W dev/prod frontend jest
serwowany przez node (`react-scripts start`) i wystawiany przez nginx pod
`/`; backend jest wystawiony pod `/api/` (patrz [sekcja 8](#8-infrastruktura-i-wdrożenie)).

## 7. Aplikacja mobilna (Flutter)

`mobile/` — natywny klient Android/iOS w Flutterze (Dart), zastępujący
wcześniejszą wersję React Native/Expo. Ekrany 1:1 do stron webowych
(bez `/data` i `/history` — te funkcje są dostępne tylko w wersji webowej;
usuwanie ankiet jest zintegrowane bezpośrednio w ekranie Ankieta).

### Struktura

```
mobile/
  lib/
    main.dart                    ← MaterialApp, ciemny motyw (Material 3)
    api/
      client.dart                 ← http wrapper, adres API (domyślny + SharedPreferences override)
      endpoints.dart               ← wywołania REST (odpowiednik frontend/src/api.js)
      types.dart                   ← modele odpowiedzi (DailyMetric, Survey, BloodPressure, Activity, Summary, CorrelationResult)
    navigation/root_navigator.dart ← BottomNavigationBar + IndexedStack (bez zewnętrznego routera)
    screens/                      ← Dashboard, Sleep, Sport, Analysis, Survey, Settings
    widgets/                      ← Screen/AppCard/EmptyState (odpowiednik Screen.tsx), MetricCard
    theme/colors.dart              ← paleta kolorów (współdzielona koncepcyjnie z motywem web)
  assets/                         ← ikony aplikacji
  pubspec.yaml
```

`android/`, `ios/`, `web/`, `build/`, `.dart_tool/` **nie są w repo**
(gitignore) — generowane lokalnie przez `flutter create .` / `flutter pub get`,
analogicznie do wcześniejszego Expo managed workflow.

### Warstwa API i konfiguracja adresu backendu

`lib/api/client.dart` odpowiada za adres bazowy API:
- domyślna wartość wkompilowana w build: `String.fromEnvironment('API_URL', defaultValue: 'http://localhost/api')`
  (nadpisywalna przy buildzie: `flutter run --dart-define=API_URL=...`),
- nadpisanie w czasie działania aplikacji: ekran **Ustawienia** zapisuje
  wpisany adres przez `shared_preferences` (trwałe, przeżywa restart
  aplikacji) — telefon nie ma dostępu do `localhost` hosta z Dockerem, więc
  w praktyce zawsze trzeba tu wpisać albo lokalne IP komputera (`http://192.168.x.x/api`),
  albo `http://10.0.2.2/api` dla emulatora Androida, albo publiczny adres
  produkcyjny.

Wszystkie zapytania idą przez jedną funkcję `apiRequest<T>()` (GET/POST/DELETE,
JSON), z parserem odpowiedzi przekazywanym jawnie per endpoint — brak
zewnętrznej biblioteki typu Retrofit/Dio, celowo (mały zakres API nie
uzasadniał dodatkowej zależności).

### Endpointy używane przez mobile (podzbiór pełnego API)

`lib/api/endpoints.dart` woła: `GET /summary`, `GET /metrics`,
`GET /surveys`, `POST /surveys`, `DELETE /surveys/{id}`, `GET /activities`,
`GET /analysis/correlation`, `GET /health`. Odczyt ciśnienia krwi jest
widoczny na Dashboardzie tylko jako część `/summary` (`blood_pressure`) —
model `BloodPressure` istnieje w `types.dart`, ale nie ma osobnego wywołania
`GET /blood-pressure`. **Nie** są zintegrowane: `POST /metrics`,
`POST /blood-pressure`, `/activities/sport-types`, `/activities/summary`,
`/activities/records`, `/activities/{id}/details`,
`/analysis/training-recovery` — te funkcje istnieją tylko w wersji
webowej.

### UI

Bez zewnętrznego state managera (Provider/Riverpod/Bloc) — każdy ekran to
`StatefulWidget`, który w `initState()` odpytuje API i trzyma wynik w
lokalnym stanie (`setState`), z `RefreshIndicator` (pull-to-refresh) i
prostym stanem ładowania/błędu (`CircularProgressIndicator` / `EmptyState`).
Wykresy liniowe na Dashboardzie przez [`fl_chart`](https://pub.dev/packages/fl_chart)
(`LineChart`), odpowiednik `Recharts`/`react-native-gifted-charts` z
wcześniejszych wersji. Motyw: ciemny, Material 3, kolory zdefiniowane w `lib/theme/colors.dart` —
niezależna paleta, ale w tej samej konwencji co `frontend/src/index.css`
(ciemne tło, akcent niebieski, zielony sukces/accent2, czerwony danger),
żeby web i mobile wyglądały spójnie mimo osobnych implementacji.

### Uruchomienie, build i wdrożenie

Pełna instrukcja (wymagania, `flutter create`, zmienne `--dart-define`,
budowanie `.aab`/`.ipa`, publikacja w Google Play / App Store) —
[mobile/README.md](../mobile/README.md). W skrócie: `flutter run -d chrome`
(web, nie wymaga Android SDK/Xcode) do szybkich testów UI w przeglądarce,
`flutter run` na podłączonym urządzeniu/emulatorze do pełnego testu
natywnego.

## 8. Infrastruktura i wdrożenie

**Docker Compose** (`docker-compose.yml`) buduje i uruchamia wszystkie
usługi webowe jedną komendą: `docker compose up -d --build`. Backend i sync
czytają `DATABASE_URL` (budowany z `DB_PASSWORD` w `.env`); sync dodatkowo
`GARMIN_EMAIL`/`GARMIN_PASSWORD` (opcjonalne — bez nich działa wszystko poza
automatyczną synchronizacją) i `XIAOMI_EMAIL`/`XIAOMI_PASSWORD`/`XIAOMI_REGION`
(opcjonalne, tylko dla trybu `cloud` Mi Banda — domyślny jest `file`, czyli
ręczny import eksportu).

**nginx** (`nginx/nginx.conf`) — jedyny publiczny port (80), reverse proxy:
- `location /` → `http://frontend:3000` (z obsługą WebSocket/HMR przez
  nagłówki `Upgrade`/`Connection` — potrzebne dla `react-scripts start` w
  trybie dev),
- `location /api/` → `http://backend:8000/` (proxy_pass z końcowym `/`
  ucina prefiks `/api`, więc backend widzi ścieżki bez niego).

**Wolumeny**: `postgres_data` (dane bazy, przeżywa `docker compose down`,
kasowane tylko przez `docker compose down -v`), `sync_data` (tokeny sesji
Garmina + stan wznawiania backfillu — kasowanie wymusza ponowne logowanie i
traci postęp backfillu).

**Mobile** nie wchodzi w skład `docker-compose.yml` — buduje się i
dystrybuuje osobno (patrz [sekcja 7](#7-aplikacja-mobilna-flutter) i
[mobile/README.md](../mobile/README.md)). Do publikacji produkcyjnej
wymaga, żeby backend był dostępny pod publicznym, **HTTPS**-owym adresem
(ATS na iOS blokuje/ostrzega przy `http://` bez wyjątku) — czyli backend
musi wisieć za odwrotnym proxy z certyfikatem (własny VPS, Cloudflare
Tunnel, itp.), nie za samym `docker compose up` na komputerze domowym.

## 9. Bezpieczeństwo i znane ograniczenia

- **Brak uwierzytelniania** — każdy, kto ma dostęp sieciowy do portu 80
  (albo do publicznego adresu backendu, jeśli wystawiony), może odczytywać
  i modyfikować wszystkie dane. Akceptowalne dla użytku jednoosobowego w
  sieci domowej; **nie** nadaje się do wdrożenia wieloosobowego/publicznego
  bez dodania warstwy auth.
- **CORS w pełni otwarty** (`allow_origins=["*"]`, `allow_methods=["*"]`,
  `allow_headers=["*"]`) — celowo, żeby klient mobilny (dowolny origin) i
  web działały bez konfiguracji; w środowisku wieloosobowym wymagałoby
  zawężenia.
- **Dane logowania do Garmin/Xiaomi** w `.env` (plain text, niecommitowany
  — `.gitignore`) — wcześniej w historii repo znajdowały się zahardkodowane
  dane logowania; zostały usunięte i zastąpione zmiennymi środowiskowymi
  (patrz raport, rozdział 7, punkt 6).
- **Klient mobilny ma mniejszy zakres funkcji** niż web (patrz
  [sekcja 7](#7-aplikacja-mobilna-flutter)) — brak ręcznego wpisu metryk/ciśnienia,
  brak szczegółów treningu (splity/strefy tętna), brak analizy
  trening-regeneracja.
- **Skalowalność korelacji** — `/analysis/correlation` i
  `/analysis/training-recovery` liczą Pearsona w Pythonie po stronie
  zapytania (nie ma cache'owania wyników) — przy obecnej skali danych
  (rząd setek dni) jest to szybkie, ale nie zoptymalizowane pod dużo
  większe zbiory.

## 10. Uruchomienie od zera — skrócony przewodnik

```bash
# 1. Backend + frontend + baza + sync (Docker)
cd webapp/health-monitor
cp .env.example .env        # uzupełnij DB_PASSWORD, opcjonalnie GARMIN_*
docker compose up -d --build
# → http://localhost

# 2. (opcjonalnie) pełna historia Garmina
docker compose run --rm sync python garmin_backfill.py
docker compose run --rm sync python garmin_activities_sync.py --full

# 3. Mobile (Flutter) — wymaga Flutter SDK, patrz mobile/README.md
cd mobile
flutter create --platforms=android,ios,web --org pl.dekk --project-name health_monitor .
flutter pub get
flutter run -d chrome          # szybki podgląd w przeglądarce, adres API domyślnie http://localhost/api
```

Szczegóły każdego kroku — patrz [README.md](../README.md) głównego
katalogu aplikacji i [mobile/README.md](../mobile/README.md).
