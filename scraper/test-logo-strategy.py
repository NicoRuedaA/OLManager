#!/usr/bin/env python3
"""Test: validar estrategia de logos con Scrapling + lol.fandom.com"""
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from scrapling import Fetcher
import aiohttp

# Equipos para testear: mezcla de fáciles y difíciles
teams = [
    # Fáciles (nombres directos)
    "T1",
    "G2 Esports",
    "Fnatic",
    "SK Gaming",
    "Karmine Corp",
    # Problemáticos
    "GIANTX",
    "MAD Lions KOI",  # puede no existir
    "Movistar KOI",   # puede no existir
    "BDS Academy",    # puede ser Team BDS Academy
    "Natus Vincere",  # existe como NAVI?
]

# Aliases manuales para equipos que no resuelven directo
ALIASES = {
    "MAD Lions KOI": "MAD_Lions",
    "Movistar KOI": "Movistar_KOI",
    "GIANTX": "GIANTX",
    "Natus Vincere": "Natus_Vincere",
    "BDS Academy": "Team_BDS_Academy",
    "Giantx LEC": "Giantx",
}

def get_logo_url(fetcher: Fetcher, team_name: str) -> str | None:
    """Obtener URL del logo de un equipo desde Leaguepedia"""
    # Probar con el nombre directo primero
    slugs_to_try = [
        team_name.replace(" ", "_"),
    ]
    
    # Agregar alias si existe
    if team_name in ALIASES:
        slugs_to_try.append(ALIASES[team_name])
    
    seen = set()
    for slug in slugs_to_try:
        if slug in seen:
            continue
        seen.add(slug)
        
        url = f"https://lol.fandom.com/wiki/{slug}"
        try:
            page = fetcher.get(url)
            if page.status == 200:
                img = page.css_first(".infobox-image img")
                if img:
                    src = img.attributes.get("src")
                    if src:
                        if src.startswith("//"):
                            src = "https:" + src
                        return src
                # Fallback: buscar cualquier img en la infobox
                infobox = page.css_first(".infobox")
                if infobox:
                    img = infobox.css_first("img")
                    if img:
                        src = img.attributes.get("src")
                        if src:
                            if src.startswith("//"):
                                src = "https:" + src
                            return src
        except Exception as e:
            pass
    
    return None


async def test_logo(fetcher: Fetcher, session: aiohttp.ClientSession, team: str):
    """Testear logo de un equipo"""
    print(f"\n📌 {team}")
    logo_url = get_logo_url(fetcher, team)
    
    if not logo_url:
        print(f"   ❌ No se encontró logo")
        return
    
    print(f"   ✅ URL: {logo_url[:120]}")
    
    # Intentar descargar
    try:
        async with session.get(logo_url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
            if resp.status == 200:
                data = await resp.read()
                content_type = resp.headers.get("Content-Type", "?")
                print(f"   ✅ Descargable: {len(data)} bytes ({content_type})")
            else:
                print(f"   ❌ HTTP {resp.status}")
    except Exception as e:
        print(f"   ❌ Error descarga: {e}")


async def main():
    print("=" * 60)
    print("🧪 Validación: Scrapling + Leaguepedia para logos")
    print(f"   Equipos a testear: {len(teams)}")
    print("=" * 60)
    
    fetcher = Fetcher(
        stealthy_headers=True,
        # Persistir cookies entre requests
        persist_cookies=True,
    )
    
    connector = aiohttp.TCPConnector(limit=3)
    async with aiohttp.ClientSession(connector=connector) as session:
        for i, team in enumerate(teams):
            await test_logo(fetcher, session, team)
            # Delay entre equipos para no saturar
            if i < len(teams) - 1:
                await asyncio.sleep(1.5)
    
    print("\n" + "=" * 60)
    print("🏁 Test completo")


if __name__ == "__main__":
    asyncio.run(main())
