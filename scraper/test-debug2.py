#!/usr/bin/env python3
from scrapling import Fetcher

f = Fetcher()
resp = f.get('https://lol.fandom.com/wiki/G2_Esports', timeout=20)
print(f"Status: {resp.status}")
print(f"Type: {type(resp)}")
print(f"Dir: {[x for x in dir(resp) if not x.startswith('_')]}")

# Try various content access methods
for attr in ['text', 'content', 'body', 'raw', 'data', 'html']:
    val = getattr(resp, attr, None)
    if val is not None:
        if isinstance(val, (str, bytes)):
            print(f".{attr}: {type(val).__name__} len={len(val)} preview={str(val)[:200]}")
        else:
            print(f".{attr}: {type(val).__name__}")
    
# Try .read()
if hasattr(resp, 'read'):
    try:
        data = resp.read()
        print(f".read(): {type(data).__name__} len={len(data)}")
    except Exception as e:
        print(f".read() error: {e}")
