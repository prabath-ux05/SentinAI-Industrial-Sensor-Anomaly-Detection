from fastapi.testclient import TestClient
from backend.main import app
client = TestClient(app)
r = client.get('/api/equipment?sort_by=health_score&order=asc')
data = r.json()
print('Status:', r.status_code)
print('Total:', data['total_records'], 'records')
for item in data['items']:
    code = item['equipment_code']
    name = item['name'][:30]
    health = item['health_score']
    sensors = item['sensor_count']
    print(f"  {code:12} | {name:30} | health={health:5.1f}% | sensors={sensors}")
