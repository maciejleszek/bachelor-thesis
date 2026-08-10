"""
Scheduler dzienny — uruchamia sync o 23:45 każdego dnia.
Garmin: pełny sync dnia bieżącego.
Mi Band: skanowanie folderu imports (tryb file) lub cloud.

Dodatkowe uruchomienia:
  - startup: sync ostatnich 3 dni (wyrównanie po ewentualnym przestoju)
  - co 6h: sync Mi Band (żeby wrzucone pliki były szybko przetworzone)
"""

import asyncio
import logging
import os
from dotenv import load_dotenv
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

import garmin_sync
import miband_sync

load_dotenv()
log = logging.getLogger("scheduler")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s  %(message)s",
)


async def job_garmin_daily():
    """Sync Garmin — ostatnie 2 dni (na wypadek opóźnionego uploadu danych)."""
    log.info("=== START: Garmin sync ===")
    try:
        await garmin_sync.run(days_back=2)
    except Exception as e:
        log.error(f"Garmin sync nieudany: {e}")
    log.info("=== KONIEC: Garmin sync ===")


async def job_miband():
    """Sync Mi Band — tryb zdefiniowany w MIBAND_MODE."""
    log.info("=== START: Mi Band sync ===")
    try:
        await miband_sync.run(days_back=2)
    except Exception as e:
        log.error(f"Mi Band sync nieudany: {e}")
    log.info("=== KONIEC: Mi Band sync ===")


async def startup_sync():
    """Wyrównujący sync przy starcie — ostatnie 7 dni."""
    log.info("=== STARTUP SYNC (7 dni) ===")
    try:
        await garmin_sync.run(days_back=7)
    except Exception as e:
        log.error(f"Startup Garmin sync błąd: {e}")
    try:
        await miband_sync.run(days_back=7)
    except Exception as e:
        log.error(f"Startup Mi Band sync błąd: {e}")
    log.info("=== STARTUP SYNC ZAKOŃCZONY ===")


async def main():
    scheduler = AsyncIOScheduler(timezone="Europe/Warsaw")

    # Garmin — raz dziennie o 23:45
    scheduler.add_job(
        job_garmin_daily,
        CronTrigger(hour=23, minute=45),
        id="garmin_daily",
        name="Garmin codzienny sync",
        replace_existing=True,
    )

    # Mi Band (file watcher) — co 2h + o 23:50
    scheduler.add_job(
        job_miband,
        CronTrigger(minute=0, hour="*/2"),
        id="miband_periodic",
        name="Mi Band file watcher",
        replace_existing=True,
    )
    scheduler.add_job(
        job_miband,
        CronTrigger(hour=23, minute=50),
        id="miband_daily",
        name="Mi Band codzienny sync",
        replace_existing=True,
    )

    scheduler.start()
    log.info("Scheduler uruchomiony")
    log.info("Garmin sync: 23:45 Europe/Warsaw")
    log.info("Mi Band sync: co 2h + 23:50")

    # Sync przy starcie (w tle, żeby nie blokować startu schedulera)
    asyncio.create_task(startup_sync())

    # Trzymaj procesor przy życiu
    try:
        while True:
            await asyncio.sleep(60)
    except (KeyboardInterrupt, SystemExit):
        scheduler.shutdown()
        log.info("Scheduler zatrzymany")


if __name__ == "__main__":
    asyncio.run(main())
