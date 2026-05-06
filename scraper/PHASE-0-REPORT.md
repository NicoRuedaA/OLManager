# Phase 0 Research Report: Leaguepedia Cargo API

> **Date:** 2026-05-04  
> **Status:** ✅ API mapping complete | ⚠️ Cargo query rate-limited (temporal) | ✅ Image pipeline validated

## 1. API Endpoint Status

| Endpoint | Status | Notes |
|----------|--------|-------|
| `action=cargoquery` | ⚠️ Rate-limited | Works but per-IP rate limit (~30 req/min). Need 1 req/sec pacing. |
| `action=cargoautocomplete` | ✅ Works | Fast, no rate limit. Good for field discovery. |
| `action=parse` | ✅ Works | Returns full page HTML. Slower but works as fallback. |
| `action=query&prop=imageinfo` | ✅ Works | Gets actual image URL from static CDN. No rate limit observed. |
| `Special:CargoExport` | ❌ Cloudflare | Blocked by Cloudflare JS challenge. |
| `Special:CargoTables` | ❌ Cloudflare | Same Cloudflare block. |
| `Special:FilePath` | ❌ Cloudflare | Redirect blocked. Use API instead. |

**Decision:** ~~Use `action=cargoquery`~~ → **NEW STRATEGY:** Use `action=query&list=embeddedin` for player discovery + `action=parse&prop=wikitext` for infobox extraction. Cargo is not needed at all — the wikitext approach is more reliable (no rate limit) AND gives richer data (favchamps, socials, residency). Image pipeline uses `action=query&prop=imageinfo`.

## 2. Cargo Tables Discovered

### Players (confirmed)
| Field | Type | Coverage | Notes |
|-------|------|----------|-------|
| `Name` | string | 100% | IGN (in-game name) |
| `ID` | string | 100% | Wiki internal ID |
| `NameFull` | string | ~95% | Real name (romanized) |
| `Birthdate` | date | ~90% | ISO format likely |
| `Country` | ISO 3166-1 | ~98% | e.g. "DK", "KR", "ES" — **confirmed ISO codes** |
| `Role` | enum string | ~95% | "Mid", "Top", "Jungle", "Bot", "Support" (and variants) |
| `Team` | string | ~90% | Current team name |
| `Image` | filename | ~60% | Wiki filename, e.g. "Caps.jpg" |
| `IsRetired` | bool | ~80% | "1" = retired |
| `Residency` | string | ~50% | "Resident", "Non-Resident", "Import" |

**NOT available in Players table:** `League`, `ContractEnd`, `Earnings`, `Region`, `Nationality`

### Teams (confirmed)
| Field | Type | Coverage | Notes |
|-------|------|----------|-------|
| `Name` | string | 100% | Full team name |
| `Short` | string | ~95% | Abbreviation (e.g. "G2", "FNC") |
| `Region` | string | ~70% | e.g. "Europe", "Korea" |
| `Image` | filename | ~60% | Team logo wiki filename |
| `Location` | string | ~80% | City/Country |
| `IsDisbanded` | bool | ~90% | |
| `OverviewPage` | string | 100% | Wiki page name |

### Tournaments (exists, not deeply explored)
Fields detected: at minimum `Name`. Used to derive league/competition context.

## 3. Role Normalization Needs

From `cargoautocomplete` on `Role` field:
```
Mid       — needs normalization: "Mid" → "Mid"
Jungle    — needs normalization: "Jungle" → "Jungle"
Bot       — needs normalization: "Bot" → "Adc"
Support   — needs normalization: "Support" → "Support"
Top       — needs normalization: "Top" → "Top"
```

Some entries might come as "Mid Laner", "Jungler", etc. Need a mapping table.

## 4. Country Data

Confirmed: Country field returns **ISO 3166-1 alpha-2 codes** (2-letter). Examples: `DK`, `KR`, `CN`, `ES`, `DE`, `FR`, `US`. This is ideal — no normalization needed beyond verifying the code is valid.

## 5. Image Pipeline Validation

**Test player:** Caps (G2 Esports)

| Step | Result |
|------|--------|
| Get filename from Cargo/API | `Caps.jpg` ✅ |
| Resolve URL via `action=query&prop=imageinfo` | `https://static.wikia.nocookie.net/lolesports_gamepedia_en/images/a/a3/Caps.jpg` ✅ |
| Download from CDN | 16 KB (served as WebP by CDN) ✅ |
| Sharp resize → 256px WebP q80 | **4.7 KB** (71% smaller) ✅ |
| Sharp resize → 128px WebP q70 | **1.6 KB** (thumbnail) ✅ |

**Total storage estimate for 1500 players:**
- 256px avatars: 1500 × 5KB = **~7.5 MB**
- 128px thumbnails: 1500 × 2KB = **~3 MB**
- **Total: ~10 MB** for all player photos

> The CDN (`static.wikia.nocookie.net`) serves WebP when the client supports it (Content-Type: `image/webp`), so we may not even need Sharp for some images — but resizing is still valuable.

## 6. Rate Limiting Strategy

- `cargoautocomplete`: ~1 req/sec, no rate limit observed
- `cargoquery`: triggered rate limit after ~10 rapid requests → needs **1 req every 2 seconds** minimum
- `action=query&imageinfo`: no rate limit observed
- Image downloads from CDN: add 200ms delay between downloads

**Estimated scraping time for 10 leagues × 200 players:**
- Cargo queries: ~10 leagues × 1 page = 10 requests × 2s = 20 seconds
- Image resolution: ~1500 players × 1 request = 1500 requests (but batching possible) × 200ms = 5 minutes
- Total: **~6-8 minutes per full scrape**

## 7. Architecture Decision

**Language:** TypeScript (same stack as frontend, `sharp` for images, `tsx` for running).  
**Location:** Monorepo at `OLManager/scraper/`  
**Cache:** `.cache/` directory with request cache to avoid re-fetching identical queries  
**Output:** `scraper/output/world.json` + `scraper/output/player-photos/`

## 8. Next Steps

- [x] **NEW: Validate wikitext-based pipeline** — `embeddedin` + `parse&prop=wikitext` confirmed working with Faker (59 fields extracted)
- [x] **NEW: Player discovery via embeddedin** — 1500+ player pages discovered in 3 API calls
- [ ] Implement proper API client with retry, rate limiting, and cache
- [ ] Proceed to Phase 1: Scraper Core

## 9. Revised Data Pipeline (Post-Research Discovery)

### Player Discovery
```
action=query&list=embeddedin&eititle=Template:Infobox Player
→ Returns ALL pages using the player infobox (paginated, 500/page)
→ Filter: exclude User: namespace pages
→ Total: ~1500-2000 player pages across all leagues
```

### Player Data Extraction
```
For each player page:
  action=parse&prop=wikitext|images → raw wikitext + image list
  Parse {{Infobox Player|...|key=value|...}}
  
Available fields (59+):
  Core:     id, name, country, residency, role, isretired
  Birth:    birth_date_year, birth_date_month, birth_date_day
  Social:   twitter, stream, instagram, youtube, discord
  Game:     favchamp[1-5], checkboxAutoImage
  Meta:     checkboxAutoTeams, page_type, low_content
  League:   (inferred from team templates in page)
  Team:     (parsed from team roster templates)
```

### Image Pipeline
```
For each player:
  action=query&titles=File:{imagename}&prop=imageinfo&iiprop=url
  Download from static.wikia.nocookie.net CDN
  Sharp → 256px WebP q80 (~5KB per image)
  Sharp → 128px WebP q70 (~2KB thumbnail)
```

### Performance Estimate
- Discovery: ~3-5 API calls (2-3 seconds)
- Player data: ~1500 API calls at 1/sec = ~25 minutes
- Image resolution: ~1500 API calls at 2/sec = ~12 minutes
- Image download: ~1500 downloads at 5 concurrent = ~5 minutes
- **Total: ~45 minutes for full scrape**

## 10. Infobox Field Mapping → OLManager

| Wiki Field | OLManager Field | Notes |
|-----------|-----------------|-------|
| `id` | `match_name` | IGN |
| `name` | `full_name` | Real name |
| `country` | `nationality` | Need mapping to ISO ("South Korea"→"KR") |
| `residency` | `residency_region` | For import rules |
| `role` | `position` | "Mid"→LolRole::Mid |
| `isretired` | `status` | "Yes"→Retired, "No"→Active |
| `birth_date_*` | `date_of_birth` | Combine to YYYY-MM-DD |
| `favchamp[1-5]` | `champion_pool` | Array of champions |
| `checkboxAutoImage` | `has_photo` | Bool for image existence |
| `twitter/stream` | `socials` | Optional metadata |
