import requests
import time
import sqlite3
import sys

conn = sqlite3.connect('storage/autoshorts.db')
c = conn.cursor()
c.execute("SELECT id FROM scripts LIMIT 1")
row = c.fetchone()
if not row:
    print("No script found.")
    sys.exit(1)
script_id = row[0]
conn.close()

print(f"Using script_id: {script_id}")

url = "http://127.0.0.1:8000/api/videos/render"
data = {
    "script_id": script_id,
    "style": "fast_facts"
}
response = requests.post(url, json=data)
print(f"Render response: {response.status_code}, {response.text}")
if response.status_code != 202:
    sys.exit(1)

video_id = response.json()["id"]

print(f"Monitoring video {video_id}...")
for i in range(25):
    time.sleep(2)
    conn = sqlite3.connect('storage/autoshorts.db')
    c = conn.cursor()
    c.execute("SELECT status, notes FROM videos WHERE id=?", (video_id,))
    row = c.fetchone()
    conn.close()
    if row:
        print(f"Check {i}: status={row[0]}, notes={row[1]}")
        if row[0] != "rendering":
            break
