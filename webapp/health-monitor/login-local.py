import os
from garminconnect import Garmin

EMAIL    = "maciej02.leszek@gmail.com"
PASSWORD = "!cQ*CvqWR5FhDLQ"

os.environ["GARTHOME"] = os.path.expanduser("~/garmin_tokens")
os.makedirs(os.path.expanduser("~/garmin_tokens"), exist_ok=True)

client = Garmin(EMAIL, PASSWORD)
client.login()
print("✓ Tokeny zapisane w ~/garmin_tokens/")