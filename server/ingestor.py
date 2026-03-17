import os
import datetime
import time
import requests
from garminconnect import Garmin
from dotenv import load_dotenv

# 1. ŁADOWANIE KONFIGURACJI
load_dotenv()

EMAIL = os.getenv("GARMIN_EMAIL")
PASSWORD = os.getenv("GARMIN_PASSWORD")
API_URL = "http://127.0.0.1:8000/ingest"

# ZAKRES DAT (zgodny z Twoim Notebookiem)
START_DATE = datetime.date(2026, 2, 9)
END_DATE = datetime.date(2026, 3, 17)


def run_ingestor():
    print(f"🚀 Start Ingestora. Logowanie: {EMAIL}...")

    try:
        client = Garmin(EMAIL, PASSWORD)
        client.login()
        print("✅ Zalogowano do Garmin Connect.")
    except Exception as e:
        print(f"❌ Błąd logowania: {e}")
        return

    current_date = START_DATE
    while current_date <= END_DATE:
        date_str = current_date.isoformat()
        print(f"🔄 Przetwarzanie {date_str}...", end=" ")

        try:
            # Pobieranie danych
            sleep_data = client.get_sleep_data(date_str)

            # Główne podsumowanie dnia
            summary = sleep_data.get("dailySleepDTO")

            if summary and summary.get("sleepTimeSeconds") is not None:
                # Przygotowanie paczki danych
                # Konwertujemy sekundy na minuty dla lepszej czytelności w Tableau
                payload = {
                    "date": date_str,
                    "duration_min": round(summary.get("sleepTimeSeconds", 0) / 60, 2),
                    "deep_min": round(summary.get("deepSleepSeconds", 0) / 60, 2),
                    "rem_min": round(summary.get("remSleepSeconds", 0) / 60, 2),
                    "light_min": round(summary.get("lightSleepSeconds", 0) / 60, 2),
                    "awake_min": round(summary.get("awakeSleepSeconds", 0) / 60, 2)
                }

                # Wysyłka do FastAPI
                response = requests.post(API_URL, json=payload)

                if response.status_code == 200:
                    print(f"✅ OK (Suma: {payload['duration_min']} min)")
                else:
                    print(f"⚠️ Błąd API: {response.status_code} {response.text}")
            else:
                print(f"ℹ️ Brak danych dla tej daty.")

        except Exception as e:
            print(f"❌ Błąd krytyczny dla {date_str}: {e}")

        # Garmin ma limity zapytań - 1-2 sekundy przerwy to bezpieczny odstęp
        time.sleep(1.5)
        current_date += datetime.timedelta(days=1)

    print("\n🏁 GOTOWE! Wszystkie dane historyczne zostały przesłane do serwera.")


if __name__ == "__main__":
    run_ingestor()