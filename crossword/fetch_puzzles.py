import json
import os
import urllib.request

ENDPOINTS = {
    "mini": "https://www.nytimes.com/svc/crosswords/v6/puzzle/mini.json",
    "midi": "https://www.nytimes.com/svc/crosswords/v6/puzzle/midi.json",
    "daily": "https://www.nytimes.com/svc/crosswords/v6/puzzle/daily.json",
}

HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "X-Games-Auth-Bypass": "true"
}

os.makedirs("todays", exist_ok=True)

for name, url in ENDPOINTS.items():
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req) as response:
            if response.status == 200:
                data = json.loads(response.read().decode("utf-8"))
                with open(f"todays/{name}.json", "w", encoding="utf-8") as f:
                    json.dump(data, f, separators=(",", ":"))
                print(f"Saved {name}.json")
    except Exception as e:
        print(f"Error fetching {name}: {e}")