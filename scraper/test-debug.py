#!/usr/bin/env python3
from scrapling import Fetcher

print("Debug: contenido de la pagina")
f = Fetcher()
resp = f.get('https://lol.fandom.com/wiki/G2_Esports', timeout=20)
print(f"Status: {resp.status}")
print(f"Content length: {len(resp.text)}")
print(f"Content type: {type(resp.text)}")
print(f"First 1000 chars:\n{resp.text[:1000]}")
print(f"\n--- Contains 'infobox': {'infobox' in resp.text}")
print(f"Contains 'infobox-image': {'infobox-image' in resp.text}")
print(f"Contains '<img': {'<img' in resp.text}")
