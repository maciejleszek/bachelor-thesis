import os
from dotenv import load_dotenv
from garminconnect import Garmin

load_dotenv()

EMAIL    = os.environ["GARMIN_EMAIL"]
PASSWORD = os.environ["GARMIN_PASSWORD"]

os.environ["GARTHOME"] = os.path.expanduser("~/garmin_tokens")
os.makedirs(os.path.expanduser("~/garmin_tokens"), exist_ok=True)

client = Garmin(EMAIL, PASSWORD)
client.login()
print("✓ Tokeny zapisane w ~/garmin_tokens/")