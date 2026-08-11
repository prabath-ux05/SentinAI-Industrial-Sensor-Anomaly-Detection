import urllib.request, json

r = urllib.request.urlopen('http://localhost:8000/api/health')
print('Health:', r.read().decode())

r2 = urllib.request.urlopen('http://localhost:8000/api/equipment?page=1&page_size=12')
data = json.loads(r2.read().decode())
print('Equipment endpoint: 200 OK')
print('total_records:', data['total_records'])
print('items returned:', len(data['items']))
for eq in data['items']:
    code = eq['equipment_code']
    name = eq['name']
    health = eq['health_score']
    sensors = eq['sensor_count']
    print(f"  - {code}: {name} | health={health}% | sensors={sensors}")
