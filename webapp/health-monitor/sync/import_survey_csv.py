"""
Jednorazowy/powtarzalny import historycznych ankiet SAM+VAS z pliku CSV.

Format pliku (nagłówek dokładnie taki, przecinki):
    Data,Radość,Podekscytowanie,Pewność siebie,Stres
    11.01.2026,8,9,9,0

- Data: DD.MM.YYYY
- Radość/Podekscytowanie/Pewność siebie: skala SAM 0-9 (jak w ankiecie w appce)
- Stres: skala 0-9 w pliku źródłowym — przeliczana na 0-100 (VAS), żeby
  pasowała do kolumny vas_stress (round(stres * 100 / 9))

Uruchamiane ręcznie:
    docker compose run --rm sync python import_survey_csv.py /data/survey_imports/sam_vas_history.csv

Idempotentne: przed importem usuwa istniejące ankiety z dat obecnych w pliku,
więc można bezpiecznie uruchomić ponownie po poprawkach w CSV.
"""

import asyncio
import csv
import logging
import sys
from datetime import datetime
from pathlib import Path

import asyncpg

import garmin_sync  # reużywamy DB_URL

log = logging.getLogger("import_survey_csv")

SAM_MAX = 9
VAS_MAX = 100


def _parse_csv(path: Path) -> list[dict]:
    rows = []
    with path.open(encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for r in reader:
            try:
                d = datetime.strptime(r["Data"].strip(), "%d.%m.%Y").date()
                valence = int(r["Radość"])
                arousal = int(r["Podekscytowanie"])
                dominance = int(r["Pewność siebie"])
                stress_raw = int(r["Stres"])
            except (KeyError, ValueError) as e:
                log.warning("Pomijam wiersz — błąd parsowania: %s (%s)", r, e)
                continue
            vas_stress = round(stress_raw * VAS_MAX / SAM_MAX)
            rows.append({
                "date": d,
                "sam_valence": valence,
                "sam_arousal": arousal,
                "sam_dominance": dominance,
                "vas_stress": vas_stress,
            })
    return rows


async def import_csv(path: Path):
    rows = _parse_csv(path)
    if not rows:
        log.error("Brak poprawnych wierszy w %s", path)
        return

    conn = await asyncpg.connect(garmin_sync.DB_URL)
    try:
        dates = [r["date"] for r in rows]
        deleted = await conn.execute(
            "DELETE FROM surveys WHERE date = ANY($1::date[])", dates
        )
        log.info("Usunięto istniejące ankiety z tych dat: %s", deleted)

        for r in rows:
            await conn.execute(
                """INSERT INTO surveys (date, sam_valence, sam_arousal, sam_dominance, vas_stress)
                   VALUES ($1, $2, $3, $4, $5)""",
                r["date"], r["sam_valence"], r["sam_arousal"],
                r["sam_dominance"], r["vas_stress"],
            )
        log.info("✓ Zaimportowano %d ankiet z %s", len(rows), path)
    finally:
        await conn.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    if len(sys.argv) != 2:
        print("Użycie: python import_survey_csv.py <ścieżka_do_csv>")
        sys.exit(1)
    asyncio.run(import_csv(Path(sys.argv[1])))
