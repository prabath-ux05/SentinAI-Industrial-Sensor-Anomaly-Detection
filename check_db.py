import sqlite3
con = sqlite3.connect('./test.db')
cur = con.cursor()

print("=== Equipment ===")
cur.execute("SELECT id, equipment_code, name, status, health_score, manufacturer, model FROM equipment")
for row in cur.fetchall():
    print(row)

print("\n=== Sensors ===")
cur.execute("SELECT id, sensor_code, sensor_type, equipment_id, status FROM sensors")
for row in cur.fetchall():
    print(row)

con.close()
