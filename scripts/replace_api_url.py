import os
import glob

FRONTEND_DIR = r"c:\Documents\Desktop Files\SentinAI\frontend\src"

def replace_in_files():
    for root, dirs, files in os.walk(FRONTEND_DIR):
        for file in files:
            if file.endswith((".tsx", ".ts")):
                filepath = os.path.join(root, file)
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()

                # Handle specific files with hardcoded fetch
                if "dashboard/page.tsx" in filepath.replace("\\", "/"):
                    if 'const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";' not in content:
                        content = content.replace(
                            'export default function Dashboard() {',
                            'const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";\n\nexport default function Dashboard() {'
                        )
                    content = content.replace('"http://localhost:8000/api/dashboard/summary"', '`${API}/dashboard/summary`')
                    content = content.replace('`http://localhost:8000/api/dashboard/alerts?limit=${DASHBOARD_ALERTS_LIMIT}`', '`${API}/dashboard/alerts?limit=${DASHBOARD_ALERTS_LIMIT}`')
                    content = content.replace('"http://localhost:8000/api/dashboard/telemetry?limit=100"', '`${API}/dashboard/telemetry?limit=100`')
                
                elif "copilot/page.tsx" in filepath.replace("\\", "/"):
                    if 'const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";' not in content:
                        content = content.replace(
                            'export default function Copilot() {',
                            'const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";\n\nexport default function Copilot() {'
                        )
                    content = content.replace('"http://localhost:8000/api/copilot/chat"', '`${API}/copilot/chat`')

                elif "AddEquipmentModal.tsx" in filepath.replace("\\", "/"):
                    if 'const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";' not in content:
                        content = content.replace(
                            'export default function AddEquipmentModal',
                            'const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";\n\nexport default function AddEquipmentModal'
                        )
                    content = content.replace('"http://localhost:8000/api/equipment"', '`${API}/equipment`')
                
                else:
                    # Standard replacement for files that define `const API = ...`
                    if 'const API = "http://localhost:8000/api";' in content:
                        content = content.replace(
                            'const API = "http://localhost:8000/api";',
                            'const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";'
                        )

                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(content)

if __name__ == "__main__":
    replace_in_files()
    print("Replacement complete.")
