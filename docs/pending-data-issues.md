# Pending Data Loading Issues (EXE build)

## 1. `load_external_more_fa_seed()` — Intencional, no es bug

**Archivo:** `src-tauri/src/commands/game.rs:687-731`

Busca un archivo `MoreFA_Players.json` en:
- `USERPROFILE/Downloads/` (Windows)
- `HOME/Downloads/` (Linux/Mac)
- CWD + `MoreFA_Players.json`
- `data/lec/draft/MoreFA_Players.json`

No usa `resource_dir` porque es intencional — es un archivo opcional que el usuario coloca manualmente en su carpeta de Downloads para agregar agentes libres custom. Si no existe, simplemente no se agrega nada.

**No requiere fix.**

---

## 2. `draft_seed_root()` — LazyLock problemático

**Archivo:** `src-tauri/src/commands/game.rs`

Usa `LazyLock` (static) para cachear `load_draft_seed_root()`. Esto significa que se inicializa UNA vez en toda la vida del proceso.

**El problema:** si `load_draft_seed_root()` falla (no encuentra `data/draft/players.json`), retorna una estructura vacía y NUNCA vuelve a intentar. En producción sin el fix de `RESOURCE_DATA_DIR`, los draft potentials quedan vacíos para siempre en esa sesión.

**Estado:** Ahora usa `RESOURCE_DATA_DIR` como primer candidato, así que en producción debería encontrar los archivos correctamente desde `assemble_world_from_modular_data`.

**Riesgo remanente:** Si `assemble_world_from_modular_data` no se llama (Flow A o B), `RESOURCE_DATA_DIR` nunca se inicializa y el fallback CWD podría fallar en producción. En la práctica, el draft seed solo se necesita en Flow C (nuevo juego con datos modulares), así que no debería ser problema.
