import time
import threading
import pandas as pd
from flask import Flask, jsonify, send_file
import RPi.GPIO as GPIO
import adafruit_dht
import board

# --- Inicjalizacja GPIO ---
GPIO.setmode(GPIO.BCM)
PIR_PIN = 17
SOUND_PIN = 27

GPIO.setup(PIR_PIN, GPIO.IN)
GPIO.setup(SOUND_PIN, GPIO.IN)

# --- Inicjalizacja DHT11 ---
dht_device = adafruit_dht.DHT11(board.D4)

# --- DataFrame do przechowywania danych ---
columns = ['timestamp', 'temperature', 'humidity', 'motion', 'sound']
data = pd.DataFrame(columns=columns)

# --- Funkcje do odczytu czujników ---

def read_dht11():
    try:
        temperature = dht_device.temperature
        humidity = dht_device.humidity
        return temperature, humidity
    except Exception as e:
        print("Błąd DHT11:", e)
        return None, None

def read_motion():
    return GPIO.input(PIR_PIN)

def read_sound():
    return GPIO.input(SOUND_PIN)

# --- Funkcja zbierania danych ---
def collect_data():
    global data
    while True:
        timestamp = pd.Timestamp.now()

        temp, hum = read_dht11()
        motion = read_motion()
        sound = read_sound()

        # Dodanie wiersza do DataFrame
        new_row = pd.DataFrame(
            [[timestamp, temp, hum, motion, sound]],
            columns=columns
        )

        data = pd.concat([data, new_row], ignore_index=True)

        print(f"[{timestamp}] T:{temp}°C H:{hum}% Motion:{motion} Sound:{sound}")

        time.sleep(5)  # odczyt co 5 sekund

# --- Flask do udostępniania danych ---
app = Flask(__name__)

@app.route('/')
def index():
    return """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Environment Data</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: center; }
            th { background-color: #4CAF50; color: white; }
            tr:nth-child(even){background-color: #f2f2f2;}
            tr:hover {background-color: #ddd;}
        </style>
    </head>
    <body>
        <h1>Raspberry Pi Environment Data</h1>
        <table id="data-table">
            <thead>
                <tr>
                    <th>Timestamp</th>
                    <th>Temperature (°C)</th>
                    <th>Humidity (%)</th>
                    <th>Motion</th>
                    <th>Sound</th>
                </tr>
            </thead>
            <tbody></tbody>
        </table>

        <script>
            async function fetchData() {
                const response = await fetch('/data/json');
                const data = await response.json();
                const tbody = document.querySelector("#data-table tbody");
                tbody.innerHTML = "";
                data.forEach(row => {
                    const tr = document.createElement("tr");
                    tr.innerHTML = `
                        <td>${row.timestamp}</td>
                        <td>${row.temperature ?? '-'}</td>
                        <td>${row.humidity ?? '-'}</td>
                        <td>${row.motion}</td>
                        <td>${row.sound}</td>
                    `;
                    tbody.appendChild(tr);
                });
            }

            // Pobieraj dane co 5 sekund
            fetchData();
            setInterval(fetchData, 5000);
        </script>
    </body>
    </html>
    """

@app.route('/data/json')
def get_data_json():
    return jsonify(data.to_dict(orient='records'))

@app.route('/data/csv')
def get_data_csv():
    filename = "/tmp/environment_data.csv"
    data.to_csv(filename, index=False)
    return send_file(filename, mimetype='text/csv', as_attachment=True)

# --- Uruchomienie wątków ---
if __name__ == '__main__':
    t = threading.Thread(target=collect_data)
    t.daemon = True
    t.start()

    app.run(host='0.0.0.0', port=5000)