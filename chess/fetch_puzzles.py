import urllib.request
import zstandard
import csv
import io
import json
import random
import os

URL = "https://database.lichess.org/lichess_db_puzzle.csv.zst"

def fetch_daily_puzzles():
    req = urllib.request.Request(URL)
    
    # We will pick a random start line between 0 and 500,000
    skip_lines = random.randint(0, 500000)
    
    easy = []
    mid = []
    hard = []
    
    easy_target = 50
    mid_target = 30
    hard_target = 20
    
    print(f"Skipping {skip_lines} lines to get random puzzles...")

    with urllib.request.urlopen(req) as response:
        dctx = zstandard.ZstdDecompressor()
        with dctx.stream_reader(response) as reader:
            text_stream = io.TextIOWrapper(reader, encoding='utf-8')
            csv_reader = csv.reader(text_stream)
            
            # skip header
            next(csv_reader)
            
            # skip random lines
            for _ in range(skip_lines):
                try:
                    next(csv_reader)
                except StopIteration:
                    break
            
            # now collect
            for row in csv_reader:
                if len(easy) == easy_target and len(mid) == mid_target and len(hard) == hard_target:
                    break
                
                # PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags
                if len(row) < 4:
                    continue
                
                try:
                    rating = int(row[3])
                except:
                    continue
                    
                puzzle = {
                    "id": row[0],
                    "fen": row[1],
                    "moves": row[2].split(" "),
                    "rating": rating,
                    "themes": row[7].split(" ") if len(row) > 7 else []
                }
                
                if rating < 1500 and len(easy) < easy_target:
                    easy.append(puzzle)
                elif 1500 <= rating <= 2000 and len(mid) < mid_target:
                    mid.append(puzzle)
                elif rating > 2000 and len(hard) < hard_target:
                    hard.append(puzzle)

    os.makedirs("todays", exist_ok=True)
    with open("todays/chess.json", "w", encoding="utf-8") as f:
        json.dump({"easy": easy, "mid": mid, "hard": hard}, f)
        
    print(f"Saved {len(easy)} easy, {len(mid)} mid, {len(hard)} hard puzzles.")

if __name__ == "__main__":
    fetch_daily_puzzles()
