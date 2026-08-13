# Health Monitor

Dashboard danych zdrowotnych (Garmin / Mi Band / ankiety SAM+VAS / ciśnienie)
— FastAPI + Postgres + React, spięte przez nginx.

## Szybki start

Wymagany [Docker Desktop](https://www.docker.com/products/docker-desktop/).

```bash
cp .env.example .env
# uzupełnij .env: DB_PASSWORD (dowolne) i opcjonalnie GARMIN_EMAIL/GARMIN_PASSWORD

docker compose up -d --build
```

Aplikacja jest dostępna pod **http://localhost**.

Bez danych Garmina w `.env` wszystko poza automatyczną synchronizacją działa
normalnie — możesz wprowadzać dane ręcznie w zakładce „Dane” i wypełniać
ankiety.

Zatrzymanie: `docker compose down` (dane w bazie zostają w wolumenie
`postgres_data`). Pełne skasowanie danych: `docker compose down -v`.

## Synchronizacja z Garmin Connect

Jeśli podasz `GARMIN_EMAIL` i `GARMIN_PASSWORD` w `.env`, kontener `sync`
sam pobiera dziennie: tętno, HRV, SpO2, stres, sen, kroki oraz nowe
aktywności/treningi. Harmonogram (zobacz `sync/scheduler.py`):

- codziennie o 23:45 — metryki dnia,
- co 2h + 23:50 — Mi Band (import plików),
- codziennie o 23:47 — nowe aktywności (ostatnie treningi).

Przy starcie kontenera dodatkowo robi się sync ostatnich 7 dni, żeby
wyrównać ewentualną przerwę.

### Pełna historia (jednorazowo)

Garmin API nie ma sposobu, by zapytać „od kiedy mam konto”, więc backfill
skanuje wstecz dzień po dniu, aż trafi na ~90 kolejnych dni bez żadnych
danych (uznając to za okres sprzed posiadania urządzenia) — nie musisz
podawać żadnej daty.

```bash
# 1) pełna historia dziennych metryk (HR, sen, stres, SpO2, kroki)
docker compose run --rm sync python garmin_backfill.py

# 2) pełna historia aktywności/treningów
docker compose run --rm sync python garmin_activities_sync.py --full

# 3) (opcjonalnie) splity i strefy tętna dla aktywności zsynchronizowanych
#    przez --full (codzienny sync pobiera je automatycznie dla ostatnich 20)
docker compose run --rm sync python garmin_activities_sync.py --details-backfill
```

To może potrwać długo (dużo zapytań do Garmina, celowo z opóźnieniami między
requestami żeby nie dostać limitu). Postęp jest logowany na bieżąco i
zapisywany w wolumenie `sync_data` — jeśli przerwiesz komendę (Ctrl+C) lub
padnie połączenie, ponowne uruchomienie tej samej komendy wznawia od
ostatniego przetworzonego dnia zamiast zaczynać od nowa.

## Import danych z Mi Band

Wyeksportuj dane ze strony [account.xiaomi.com](https://account.xiaomi.com)
(Xiaomi Health) jako JSON i wrzuć plik(i) do folderu
`webapp/health-monitor/miband_imports/` — kontener `sync` sam je wykryje i
zaimportuje (skanowanie co 2h + o 23:50). Raz przetworzony plik nie jest
importowany ponownie.

## Struktura

- `backend/` — FastAPI + SQL (`init.sql`), API na porcie 8000
- `frontend/` — React (CRA), dev server na porcie 3000
- `mobile/` — klient mobilny (Flutter) na ten sam backend, zobacz [mobile/README.md](mobile/README.md)
- `sync/` — pobieranie danych z Garmin/Mi Band do Postgresa
- `nginx/` — reverse proxy, jedyny publiczny port (80): `/` → frontend, `/api/` → backend
