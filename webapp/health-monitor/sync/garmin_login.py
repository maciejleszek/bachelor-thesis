"""
Jednorazowe logowanie do Garmin Connect.
Uruchom raz ręcznie: docker compose run --rm sync python garmin_login.py

Skrypt otwiera przeglądarkę Playwright i czeka na ręczne zalogowanie.
Po zalogowaniu zapisuje ciasteczka/tokeny do /data/garmin_tokens/
i od tej pory scheduler może działać bez hasła przez ~1 rok.
"""

import asyncio
import json
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

TOKEN_DIR    = Path(os.getenv("GARMIN_TOKEN_DIR", "/data/garmin_tokens"))
GARMIN_EMAIL = os.getenv("GARMIN_EMAIL", "")
GARMIN_PASS  = os.getenv("GARMIN_PASSWORD", "")


async def login_via_playwright():
    """
    Otwiera headful Chromium (widoczna przeglądarka) i pozwala na ręczne
    zalogowanie do connect.garmin.com. Zapisuje ciasteczka po zalogowaniu.
    """
    from playwright.async_api import async_playwright

    TOKEN_DIR.mkdir(parents=True, exist_ok=True)
    cookie_file = TOKEN_DIR / "cookies.json"

    print("\n" + "="*60)
    print("GARMIN CONNECT — jednorazowe logowanie")
    print("="*60)
    print("Zaraz otworzy się przeglądarka Chromium.")
    print("Zaloguj się ręcznie do connect.garmin.com")
    print("(możesz użyć 2FA, Google, Apple — cokolwiek działa).")
    print("Po zalogowaniu przeglądarka zamknie się automatycznie.\n")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False, slow_mo=100)
        ctx = await browser.new_context()
        page = await ctx.new_page()

        await page.goto("https://connect.garmin.com/signin")

        # Czekamy aż URL zmieni się na dashboard — oznacza zalogowanie
        print("Czekam na zalogowanie... (do 5 minut)")
        try:
            await page.wait_for_url(
                lambda url: "connect.garmin.com/modern" in url or
                            "connect.garmin.com/user" in url or
                            "connect.garmin.com/dashboard" in url or
                            "connect.garmin.com/explore" in url,
                timeout=300_000,
            )
        except Exception:
            print("Timeout — nie wykryto zalogowania. Spróbuj ponownie.")
            await browser.close()
            return False

        # Zapisz ciasteczka
        cookies = await ctx.cookies()
        cookie_file.write_text(json.dumps(cookies, indent=2))
        print(f"\n✓ Zalogowano! Ciasteczka zapisane: {cookie_file}")

        await browser.close()
        return True


def login_via_library():
    """
    Próbuje zalogować się przez garminconnect 0.3 (curl_cffi, TLS impersonation).
    Działa bez przeglądarki dla kont bez 2FA.
    """
    from garminconnect import Garmin

    if not GARMIN_EMAIL or not GARMIN_PASS:
        print("Brak GARMIN_EMAIL lub GARMIN_PASSWORD w .env")
        return False

    TOKEN_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Logowanie do Garmin Connect jako: {GARMIN_EMAIL}")
    print("(Używam garminconnect 0.3 z TLS impersonation)")

    try:
        client = Garmin(GARMIN_EMAIL, GARMIN_PASS, tokenstore=str(TOKEN_DIR))
        client.login()
        print(f"✓ Zalogowano! Tokeny zapisane w: {TOKEN_DIR}")
        return True
    except Exception as e:
        print(f"✗ Błąd logowania przez bibliotekę: {e}")
        print("\nSpróbuj logowania przez przeglądarkę (--browser).")
        return False


if __name__ == "__main__":
    import sys
    use_browser = "--browser" in sys.argv

    if use_browser:
        print("Tryb: przeglądarka Playwright")
        ok = asyncio.run(login_via_playwright())
    else:
        print("Tryb: garminconnect 0.3 (bez przeglądarki)")
        ok = login_via_library()
        if not ok:
            print("\nJeśli konto ma 2FA, uruchom z flagą --browser:")
            print("  docker compose run --rm sync python garmin_login.py --browser")

    sys.exit(0 if ok else 1)
