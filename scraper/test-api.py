#!/usr/bin/env python3
from scrapling import Selector, Fetcher
import time

# Check Selector methods
print("Selector methods:", [x for x in dir(Selector) if not x.startswith('_')])

# Try with sample HTML
s = Selector('<html><body><div class="infobox-image"><img src="test.png"></div></body></html>')
print("Instance methods:", [x for x in dir(s) if not x.startswith('_')])

# Try different query approaches
for method_name in ['css', 'find', 'query', 'select', 'first', 'one']:
    m = getattr(s, method_name, None)
    if m:
        print(f"Has method: {method_name}")

# Try the actual query
result = s.css('.infobox-image img')
print(f"css result: {result}")
print(f"css type: {type(result)}")

# Try attribute access
if result:
    print(f"First item attributes: {result[0].attributes}")
    print(f"First item attrs: {result[0].attrs}")

# Now test with real Fetcher
print("\n--- Testing with real Fetcher ---")
f = Fetcher()
resp = f.get('https://lol.fandom.com/wiki/G2_Esports', timeout=20)
print(f"Status: {resp.status}")
if resp.status == 200:
    page = Selector(resp.text)
    imgs = page.css('.infobox-image img')
    print(f"Found {len(imgs)} images with .infobox-image img")
    for i, img in enumerate(imgs):
        src = img.attributes.get('src', '')
        if src.startswith('//'): src = 'https:' + src
        print(f"  [{i}] src: {src[:120]}")
    
    if not imgs:
        # Try different selectors
        for sel in ['.infobox img', '.infobox-image', '.infobox']:
            found = page.css(sel)
            print(f"  '{sel}': found {len(found)}")
            if found:
                print(f"  First: {found[0]}")
