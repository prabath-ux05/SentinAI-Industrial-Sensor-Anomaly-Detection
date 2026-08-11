import argparse
import time
import random
import json
import requests
import os
from dotenv import load_dotenv

load_dotenv()

API_URL = os.getenv("API_URL", "http://localhost:8000/api/telemetry")

class SensorSimulator:
    def __init__(self, mode="normal"):
        self.mode = mode
        self.sensors = [
            {"id": "T-101", "type": "temperature", "base": 60.0, "range": (20.0, 100.0), "noise": 2.0},
            {"id": "P-104", "type": "pressure", "base": 5.0, "range": (0.0, 15.0), "noise": 0.2},
            {"id": "F-201", "type": "flow", "base": 50.0, "range": (0.0, 100.0), "noise": 1.5},
        ]
        self.tick = 0

    def generate_value(self, sensor):
        base = sensor["base"]
        noise = random.uniform(-sensor["noise"], sensor["noise"])
        val = base + noise
        
        # Apply anomaly patterns based on mode
        if self.mode == "drift" and sensor["type"] == "pressure":
            # gradual drift up
            drift_factor = (self.tick / 10.0) * 0.1
            val += drift_factor
            
        elif self.mode == "spike" and sensor["type"] == "temperature":
            if self.tick % 20 == 0:
                val += 30.0 # sudden spike
                
        elif self.mode == "flatline" and sensor["type"] == "flow":
            if self.tick > 10:
                val = 42.1 # flatline
                
        elif self.mode == "mixed":
            if sensor["type"] == "pressure":
                val += (self.tick / 20.0) * 0.1
            if sensor["type"] == "temperature" and self.tick % 30 == 0:
                val += 40.0
            if sensor["type"] == "flow" and self.tick > 50:
                val = 0.0

        # constrain within realistic bounds broadly, but allow anomalies to push slightly outside
        val = max(0, val)
        return round(val, 2)

    def run(self, interval=2):
        print(f"Starting simulator in '{self.mode}' mode. Press Ctrl+C to stop.")
        try:
            while True:
                self.tick += 1
                payloads = []
                for s in self.sensors:
                    val = self.generate_value(s)
                    payload = {
                        "sensor_id": s["id"],
                        "sensor_type": s["type"],
                        "value": val,
                        "timestamp": time.time()
                    }
                    payloads.append(payload)
                
                print(f"Tick {self.tick}: {json.dumps(payloads)}")
                
                # Send to API
                for p in payloads:
                    try:
                        requests.post(API_URL, json=p, timeout=3)
                    except requests.exceptions.RequestException as e:
                        # Print error so we know if it's failing
                        print(f"  [!] Failed to send {p['sensor_id']}: {e}")
                
                time.sleep(interval)
        except KeyboardInterrupt:
            print("Simulator stopped.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Industrial Sensor Simulator")
    parser.add_argument("--mode", type=str, default="normal", choices=["normal", "drift", "spike", "flatline", "mixed"], help="Anomaly mode to simulate")
    parser.add_argument("--interval", type=int, default=2, help="Seconds between ticks")
    args = parser.parse_args()
    
    sim = SensorSimulator(mode=args.mode)
    sim.run(interval=args.interval)
