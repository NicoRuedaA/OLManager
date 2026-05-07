#!/usr/bin/env python3
from scrapling import Selector, Fetcher
import time

print("Probando con G2_Esports...")
f = Fetcher()
resp = f.get('https://lol.fandom.com/wiki/G2_Esports', timeout=20)
print(f"Status: {resp.status}")

if resp.status == 200:
    page = Selector(resp.text)
    imgs = page.css('.infobox-image img')
    print(f"Found {len(imgs)} imgs via .infobox-image img")
    
    for i, img in enumerate(imgs):
        src = img.attrib.get('src', '')
        if src.startswith('//'): src = 'https:' + src
        print(f"  [{i}] src: {src[:130]}")
    
    if not imgs:
        # Debug: search broader
        print("Buscando alternativas...")
        for sel in ['.infobox img', 'img', '.infobox-image']:
            found = page.css(sel)
            print(f"  '{sel}': {len(found)} resultados")
            if found and sel != 'img':
                print(f"  First: {found[0]}")
        
        # Show infobox content
        ib = page.css('.infobox')
        print(f"  .infobox: {len(ib)} encontrados")
        if ib:
            print(f"  Primer infobox: {ib[0][:200]}")

# Test more teams
print("\n--- Testing more teams ---")
teams = ['G2_Esports', 'T1', 'Fnatic', 'Karmine_Corp', 'GIANTX']
for team in teams:
    url = f'https://lol.fandom.com/wiki/{team}'
    try:
        resp = f.get(url, timeout=20)
        if resp.status == 200:
            page = Selector(resp.text)
            imgs = page.css('.infobox-image img')
            if imgs:
                src = imgs[0].attrib.get('src', '')
                if src.startswith('//'): src = 'https:' + src
                print(f'  OK {team}: {src[:100]}')
            else:
                # Try fallback
                ib = page.css('.infobox img')
                if ib:
                    src = ib[0].attrib.get('src', '')
                    if src.startswith('//'): src = 'https:' + src
                    print(f'  ALT {team}: {src[:100]}')
                else:
                    print(f'  NO {team}: no se encontro logo')
        else:
            print(f'  ERR {team}: HTTP {resp.status}')
    except Exception as e:
        print(f'  ERR {team}: {e}')
    
    time.sleep(1.5)
