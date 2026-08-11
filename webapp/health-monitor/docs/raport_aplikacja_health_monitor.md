# Raport: Health Monitor — aplikacja do monitorowania stresu i danych zdrowotnych

*Materiał roboczy do pracy inżynierskiej — do skopiowania i przeredagowania w Wordzie.*

## 1. Cel aplikacji

Health Monitor to aplikacja webowa do gromadzenia i analizowania danych zdrowotnych
(tętno, HRV, sen, SpO2, stres, aktywność fizyczna) z opasek/zegarków sportowych
(Garmin, Xiaomi Mi Band) w połączeniu z subiektywną oceną nastroju i stresu
zbieraną przez ankiety SAM (Self-Assessment Manikin) i VAS (Visual Analogue
Scale). Głównym celem jest sprawdzenie, czy i jak subiektywnie odczuwany stres
koreluje z obiektywnymi metrykami fizjologicznymi rejestrowanymi automatycznie
przez urządzenia ubieralne.

## 2. Architektura systemu

Aplikacja jest w pełni skonteneryzowana (Docker Compose), złożona z pięciu
usług:

| Usługa | Technologia | Rola |
|---|---|---|
| `frontend` | React (Create React App), Recharts | interfejs użytkownika (SPA) |
| `backend` | FastAPI (Python), asyncpg/`databases` | REST API |
| `db` | PostgreSQL 16 | przechowywanie danych |
| `sync` | Python (asyncio, APScheduler) | automatyczne i ręczne pobieranie danych z urządzeń |
| `nginx` | nginx | reverse proxy — jedyny publiczny port (80), routing `/` → frontend, `/api/` → backend |

Całość uruchamia się jedną komendą (`docker compose up -d --build`) po
uzupełnieniu pliku `.env` z danymi logowania do Garmin Connect.

**Diagram przepływu danych:**

```
Garmin Connect API ─┐
                     ├─► sync (Python) ─► PostgreSQL ─► backend (FastAPI) ─► frontend (React)
Mi Fitness (eksport)─┘         ▲
                                │
                        harmonogram (APScheduler):
                        - codziennie: nowe dane, aktywności
                        - ręcznie: pełny backfill historii
```

## 3. Źródła danych

### 3.1 Garmin Connect
Integracja przez nieoficjalną bibliotekę `garminconnect` (logowanie
e-mail/hasło, tokeny sesji cache'owane na dysku). Pobierane dane:

- dzienne: tętno (śr./maks./spoczynkowe), HRV, SpO2, stres, sen (całkowity,
  głęboki, płytki, REM, sleep score), kroki
- aktywności/treningi: dystans, czas trwania, kalorie, tętno, prędkość,
  przewyższenie, training effect (aerobowy/anaerobowy), obciążenie treningowe
- szczegóły treningu: splity (podział na odcinki), strefy tętna

Zaimplementowano dwa tryby pobierania:
1. **Synchronizacja bieżąca** — codziennie automatycznie (harmonogram
   APScheduler), pobiera dane z ostatnich dni.
2. **Backfill historyczny** — uruchamiany ręcznie, skanuje wstecz dzień po
   dniu i **automatycznie wykrywa granicę posiadania urządzenia** (zatrzymuje
   się po 90 kolejnych dniach bez żadnych danych), z mechanizmem wznawiania
   po przerwaniu (zapis postępu na dysku).

### 3.2 Xiaomi Mi Band / Mi Fitness
Ponieważ Mi Band nie udostępnia oficjalnego API do pobierania historii,
zaimplementowano parser formatu eksportu **"Pobierz moje dane"** z aplikacji
Mi Fitness (RODO/GDPR data export) — zestawu plików CSV zawierających
surowe i zagregowane dane dzienne (`hlth_center_aggregated_fitness_data.csv`)
oraz rekordy treningów (`hlth_center_sport_record.csv`). Wymagało to analizy
nieudokumentowanego formatu danych (m.in. rozróżnienia wierszy z realnymi
danymi od pustych "znaczników" o tym samym kluczu, oraz konwersji jednostek
prędkości km/h → m/s używanych w reszcie systemu).

### 3.3 Ręczne dane ankietowe
Historyczne wyniki ankiet SAM+VAS zebrane poza aplikacją (np. w arkuszu)
można zaimportować przez dedykowany skrypt CSV → baza danych, z automatycznym
przeliczeniem skali stresu.

## 4. Model danych (PostgreSQL)

Kluczowe tabele:

- **`daily_metrics`** — dzienne agregaty per źródło (`garmin`/`miband`):
  tętno, HRV, SpO2, stres, sen, kroki. Unikalność `(date, source)`.
- **`activities`** — pojedyncze treningi z obu źródeł, z surowym payloadem
  JSONB (`raw`) oraz osobnymi kolumnami `splits_raw`/`hr_zones_raw` dla
  szczegółów Garmina (splity, strefy tętna).
- **`surveys`** — wyniki ankiet SAM (walencja/pobudzenie/dominacja, skala
  0-9) i VAS stresu (skala 0-100).
- **`blood_pressure`** — ręcznie wprowadzane pomiary ciśnienia.

## 5. Zaimplementowane funkcjonalności (moduły UI)

| Zakładka | Zawartość |
|---|---|
| **Dashboard** | karty bieżących metryk (tętno, HRV, SpO2, stres, kroki, sen), wykresy trendu 7-dniowego |
| **Ankieta** | formularz SAM (skala emotikon 0-9) + suwak VAS stresu (0-100) |
| **Historia** | lista wypełnionych ankiet z możliwością usunięcia |
| **Dane** | ręczne wprowadzanie metryk z opaski i ciśnienia krwi |
| **Sport** | lista treningów z obu urządzeń (badge źródła), podsumowania per dyscyplina, wykres trendu dystansu, rozwijane szczegóły treningu (tabela splitów, wykres stref tętna) |
| **Sen** | podsumowanie (śr. czas snu, sleep score, % snu głębokiego/REM), wykres składu snu (stackowany, głęboki/płytki/REM), trend sleep score |
| **Analiza** | **korelacja Pearsona** między stresem z ankiet a metrykami fizjologicznymi, scatter plot z linią trendu (regresja liniowa), wykres czasowy (dwie osie Y) |

## 6. Analiza korelacji stresu — metodologia i wyniki

Endpoint `/analysis/correlation` łączy dzienne wyniki ankiet z metrykami
fizjologicznymi tego samego dnia (preferując dane Garmina, z fallbackiem do
Mi Banda gdy Garmin niedostępny) i liczy współczynnik korelacji Pearsona
(moduł `statistics` z biblioteki standardowej Pythona) dla każdej pary.

**Aktualny stan zebranych danych** (stan na dzień przygotowania raportu):

- **81 dni** ze sparowanymi danymi ankieta + fizjologia (okres 11.01–03.05.2026)
- **175 dni** danych z Garmina (09.02–10.08.2026)
- **343 dni** danych z Mi Banda (14.01.2025–30.04.2026)
- **90 zarejestrowanych treningów** w 14 dyscyplinach (siłownia, zumba,
  bieganie, rower, wędrówki, tenis, łyżwy, ...)

**Wstępne wyniki korelacji** (stres VAS vs metryka, n = liczba sparowanych dni):

| Metryka | r (Pearson) | n | Interpretacja |
|---|---|---|---|
| SpO2 | 0.313 | 76 | korelacja umiarkowana dodatnia |
| Stres wg urządzenia | -0.313 | 81 | korelacja umiarkowana ujemna |
| Czas snu | 0.303 | 70 | korelacja umiarkowana dodatnia |
| Tętno spoczynkowe | -0.249 | 77 | korelacja słaba ujemna |
| Sleep score | 0.182 | 70 | korelacja słaba dodatnia |
| HRV | 0.092 | 72 | brak istotnej korelacji |

*Uwaga: to wstępne wyniki na ograniczonej próbie — wartościowe do opisania
w pracy jako punkt wyjścia, ale wymagają dyskusji nt. małej próby (n~70-80),
potencjalnych czynników zakłócających i braku korekty na wielokrotne
testowanie. Warto rozważyć w pracy m.in. dlaczego korelacja ze
subiektywnym stresem wg urządzenia (Garmin/Mi Band) jest ujemna — nie jest
to intuicyjne i może wskazywać na różnice metodologiczne między percepcją
własną a algorytmem producenta.*

## 7. Napotkane problemy i ich rozwiązania (materiał do rozdziału "Trudności implementacyjne")

To dobry materiał do opisania w pracy jako proces debugowania/weryfikacji:

1. **Błąd typowania parametrów SQL w asyncpg** — zapytania z wzorcem
   `CURRENT_DATE - :days` wewnątrz CTE (Common Table Expression) powodowały
   `UndefinedFunctionError` przy automatycznym wnioskowaniu typu parametru
   przez asyncpg; rozwiązanie: jawne rzutowanie `CAST(:days AS INTEGER)`.
2. **Błąd w nazwie pola API Garmina** — pole SpO2 nigdy się nie zapisywało,
   ponieważ kod szukał klucza `averageSpO2`, podczas gdy API zwraca
   `averageSpo2` (różnica wielkości liter) — znalezione przez bezpośrednie
   odpytanie API i porównanie surowej odpowiedzi.
3. **Błędny plik konfiguracyjny Docker** — Dockerfile frontendu był kopią
   Dockerfile'a usługi synchronizującej (Python zamiast Node.js) —
   uniemożliwiało to zbudowanie obrazu frontendu.
4. **Niespójny format danych eksportu Mi Fitness** — plik CSV zawierał dwa
   typy wierszy pod tym samym kluczem: rzeczywiste dane (`daily_report`) i
   puste znaczniki (`daily_mark`, `{"has_data":true}`) — bez filtrowania po
   polu `Tag`, znaczniki nadpisywały prawdziwe wartości.
5. **Ograniczenie biblioteki wykresów (Recharts)** — komponent `ScatterChart`
   nie renderował linii trendu regresji jako osobnej serii z własnymi
   danymi; rozwiązanie: użycie bardziej uniwersalnego `ComposedChart`.
6. **Bezpieczeństwo** — w repozytorium znaleziono i usunięto zahardkodowane,
   jawne dane logowania do Garmin Connect (zastąpione zmiennymi
   środowiskowymi).

## 8. Podsumowanie możliwych kierunków rozwoju (do rozdziału "Dalsze prace")

- Rozszerzenie analizy korelacji o metody nieparametryczne / regresję
  wieloraką (kilka predyktorów jednocześnie)
- Wykrywanie automatycznych wzorców (np. klasteryzacja dni "wysokiego
  stresu")
- Powiadomienia/przypomnienia o wypełnieniu ankiety
- Eksport danych do CSV bezpośrednio z aplikacji (do dalszej analizy
  statystycznej poza aplikacją)
- Uwierzytelnianie/autoryzacja dostępu do aplikacji
