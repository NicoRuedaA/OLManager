#!/usr/bin/env python3
"""Test minimo: Scrapling + lol.fandom.com"""
import sys
from scrapling import Fetcher

print("[INICIO] Inicializando Fetcher...")
sys.stdout.flush()

fetcher = Fetcher()
fetcher.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
})

print("[OK] Fetcher listo. Probando G2 Esports...")
sys.stdout.flush()

url = "https://lol.fandom.com/wiki/G2_Esports"
try:
    page = fetcher.get(url, timeout=30)
    print(f"[STATUS] {page.status}")
    sys.stdout.flush()
    
    if page.status == 200:
        print(f"[HTML] {len(page.text)} bytes")
        img = page.css_first(".infobox-image img")
        if img:
            src = img.attributes.get("src")
            print(f"[LOGO OK] {src}")
        else:
            print("[NO] No .infobox-image img")
            infobox = page.css_first(".infobox")
            print(f"[DEBUG] .infobox encontrado: {infobox is not None}")
            imgs = page.css("img")
            print(f"[DEBUG] Total <img>: {len(imgs)}")
            for i, img in enumerate(imgs[:5]):
                s = img.attributes.get("src", "?")
                print(f"[DEBUG] img[{i}]: {s[:100]}")
    else:
        print(f"[FALLO] Status {page.status}")
except Exception as e:
    import traceback
    traceback.print_exc()
    print(f"[ERROR] {e}")

# Probar algunos mas
for team in ["T1", "Fnatic", "Karmine Corp", "GIANTX"]:
    slug = team.replace(" ", "_")
    url2 = f"https://lol.fandom.com/wiki/{slug}"
    try:
        page = fetcher.get(url2, timeout=30)
        if page.status == 200:
            img = page.css_first(".infobox-image img")
            if img:
                print(f"[OK] {team}: {img.attributes.get('src', '?')[:100]}")
            else:
                print(f"[NO] {team}: no infobox-image img")
        else:
            print(f"[FALLO] {team}: HTTP {page.status}")
    except Exception as e:
        print(f"[ERROR] {team}: {e}")
    
    import time
    time.sleep(2)

print("[FIN] Done")
