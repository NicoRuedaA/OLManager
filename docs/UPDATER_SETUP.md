# Guía de configuración del Auto-Updater

> **Idioma / Language:** [Español](#español) | [English](#english)

---

<a name="español"></a>
## Español

Esta guía explica cómo configurar el sistema de actualizaciones automáticas de OLManager basado en `tauri-plugin-updater`.

### 1. Generación del par de claves Ed25519

El updater utiliza firmas criptográficas Ed25519 para verificar la integridad de los paquetes de actualización.

#### Requisitos previos

- Tener instalado el CLI de Tauri:
  ```bash
  cargo install tauri-cli
  ```

#### Generar claves

```bash
tauri signer generate
```

El comando te pedirá:
- **Password** (opcional): protege la clave privada con una contraseña. Anótala, la necesitarás para los secrets de GitHub.
- **Ruta de salida**: por defecto genera `~/.tauri/olmanager.key` (privada) y muestra la pública por consola.

#### Archivos resultantes

- **Clave privada** (`olmanager.key` o similar): **NUNCA** la subas al repositorio. Guárdala en un gestor de contraseñas seguro.
- **Clave pública**: cadena codificada en base64 que empieza por `dW50cnVzdGVkIGNvbW1lbnQ6...`. Es la que configuras en la app.

### 2. Configuración en la aplicación

#### 2.1 `src-tauri/tauri.conf.json`

Dentro del objeto raíz, existe el bloque `plugins.updater`:

```json
{
  "plugins": {
    "updater": {
      "pubkey": "TU_CLAVE_PUBLICA_AQUI",
      "endpoints": [
        "https://github.com/OpenLeagueManager/OLManager/releases/latest/download/latest.json"
      ],
      "windows": {
        "installMode": "passive"
      }
    }
  }
}
```

**Campos importantes:**

| Campo | Descripción | Cuándo cambiarlo |
|-------|-------------|------------------|
| `pubkey` | Clave pública Ed25519 generada con `tauri signer generate` | Al rotar claves o al cambiar de equipo que firma releases |
| `endpoints` | URL donde el plugin busca el `latest.json` | Si el repositorio cambia de owner/organización o se usa un mirror/CDN |
| `windows.installMode` | `passive` (silencioso) o `basicUi` (muestra progreso nativo) | Según preferencia de UX en Windows |

#### 2.2 `src-tauri/Cargo.toml`

Asegúrate de que existe la dependencia:

```toml
[dependencies]
tauri-plugin-updater = "2"
```

Y el campo `repository` apunta al repo correcto:

```toml
repository = "https://github.com/OpenLeagueManager/OLManager"
```

#### 2.3 `src-tauri/capabilities/default.json`

Añade el permiso:

```json
"updater:default"
```

### 3. Secrets de GitHub

Ve a **Settings > Secrets and variables > Actions** del repositorio y añade:

| Secret | Valor | Obligatorio |
|--------|-------|-------------|
| `TAURI_SIGNING_PRIVATE_KEY` | Contenido completo de la clave privada (el archivo `.key`) | Sí |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Contraseña usada al generar la clave (si aplica) | No |

**Importante:** las releases pensadas para auto-update deben tener estos secrets configurados. Sin una firma `.sig` válida, el workflow no puede generar un `latest.json` útil para `tauri-plugin-updater` y fallará antes de publicar el manifiesto del updater.

### 4. Cómo funciona el release

El flujo está automatizado en `.github/workflows/release.yml`:

1. **Crear un tag** `v*.*.*` (ej. `v0.3.0`) o ejecutar el workflow manualmente.
2. **Job `source-release`**: verifica que las versiones estén sincronizadas (`package.json`, `Cargo.toml`, `tauri.conf.json`) y crea el release en GitHub.
3. **Job `build-tauri`**: compila los bundles para Windows, Linux y macOS. Si los secrets están configurados, firma cada bundle generando archivos `.sig`.
4. **Job `generate-latest-json`**: descarga los artefactos de las 3 plataformas, extrae las firmas y ensambla `latest.json` subiéndolo al release en `https://github.com/OpenLeagueManager/OLManager/releases/latest/download/latest.json`.

El manifiesto apunta al artefacto que realmente firma Tauri para cada plataforma: `.msi`/`.exe` en Windows, `.AppImage` en Linux y `.app.tar.gz` en macOS. No cambies esas URLs a instaladores no emparejados con su `.sig`, porque el updater rechazará la descarga.

El archivo `latest.json` tiene este formato:

```json
{
  "version": "v0.3.0",
  "notes": "Notas de la release...",
  "pub_date": "2026-05-01T12:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "...",
      "url": "https://github.com/OpenLeagueManager/OLManager/releases/download/v0.3.0/olmanager-0.3.0-windows-setup.exe"
    },
    "linux-x86_64": { ... },
    "darwin-aarch64": { ... }
  }
}
```

### 5. Testing local del updater

Para probar el updater sin hacer releases reales:

1. Genera un par de claves de prueba.
2. Crea un servidor local que sirva un `latest.json` falso apuntando a un bundle local.
3. Modifica temporalmente `endpoints` en `tauri.conf.json` para apuntar a `http://localhost:3000/latest.json`.
4. Ejecuta la app en modo dev y fuerza una comprobación manual desde Settings.

**Recuerda revertir los cambios de `endpoints` antes de commitear.**

### 6. Rotación de claves

Si necesitas rotar el par de claves:

1. Genera un nuevo par con `tauri signer generate`.
2. Actualiza `pubkey` en `tauri.conf.json`.
3. Actualiza los secrets `TAURI_SIGNING_PRIVATE_KEY` y `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` en GitHub.
4. Publica una nueva release; a partir de ahí, todas las actualizaciones usarán la nueva clave.

---

<a name="english"></a>
## English

This guide explains how to configure OLManager's automatic update system based on `tauri-plugin-updater`.

### 1. Ed25519 Key Pair Generation

The updater uses Ed25519 cryptographic signatures to verify update package integrity.

#### Prerequisites

- Have the Tauri CLI installed:
  ```bash
  cargo install tauri-cli
  ```

#### Generate keys

```bash
tauri signer generate
```

The command will ask you for:
- **Password** (optional): protects the private key with a password. Write it down, you'll need it for GitHub secrets.
- **Output path**: by default generates `~/.tauri/olmanager.key` (private) and displays the public key in the console.

#### Resulting files

- **Private key** (`olmanager.key` or similar): **NEVER** commit it to the repository. Store it in a secure password manager.
- **Public key**: base64-encoded string starting with `dW50cnVzdGVkIGNvbW1lbnQ6...`. This is the one you configure in the app.

### 2. Application Configuration

#### 2.1 `src-tauri/tauri.conf.json`

Inside the root object, the `plugins.updater` block exists:

```json
{
  "plugins": {
    "updater": {
      "pubkey": "YOUR_PUBLIC_KEY_HERE",
      "endpoints": [
        "https://github.com/OpenLeagueManager/OLManager/releases/latest/download/latest.json"
      ],
      "windows": {
        "installMode": "passive"
      }
    }
  }
}
```

**Important fields:**

| Field | Description | When to change |
|-------|-------------|----------------|
| `pubkey` | Ed25519 public key generated with `tauri signer generate` | When rotating keys or changing the team that signs releases |
| `endpoints` | URL where the plugin looks for `latest.json` | If the repository changes owner/organization or a mirror/CDN is used |
| `windows.installMode` | `passive` (silent) or `basicUi` (shows native progress) | According to Windows UX preference |

#### 2.2 `src-tauri/Cargo.toml`

Make sure the dependency exists:

```toml
[dependencies]
tauri-plugin-updater = "2"
```

And the `repository` field points to the correct repo:

```toml
repository = "https://github.com/OpenLeagueManager/OLManager"
```

#### 2.3 `src-tauri/capabilities/default.json`

Add the permission:

```json
"updater:default"
```

### 3. GitHub Secrets

Go to **Settings > Secrets and variables > Actions** in the repository and add:

| Secret | Value | Required |
|--------|-------|----------|
| `TAURI_SIGNING_PRIVATE_KEY` | Complete content of the private key file (the `.key` file) | Yes |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Password used when generating the key (if applicable) | No |

**Important:** releases intended for auto-update must have these secrets configured. Without a valid `.sig` signature, the workflow cannot generate a useful `latest.json` for `tauri-plugin-updater` and will fail before publishing the updater manifest.

### 4. How the Release Works

The flow is automated in `.github/workflows/release.yml`:

1. **Create a tag** `v*.*.*` (e.g. `v0.3.0`) or run the workflow manually.
2. **Job `source-release`**: verifies that versions are synchronized (`package.json`, `Cargo.toml`, `tauri.conf.json`) and creates the GitHub release.
3. **Job `build-tauri`**: compiles bundles for Windows, Linux, and macOS. If secrets are configured, signs each bundle generating `.sig` files.
4. **Job `generate-latest-json`**: downloads artifacts from all 3 platforms, extracts signatures, and assembles `latest.json` uploading it to the release at `https://github.com/OpenLeagueManager/OLManager/releases/latest/download/latest.json`.

The manifest points to the artifact Tauri actually signs for each platform: `.msi`/`.exe` on Windows, `.AppImage` on Linux, and `.app.tar.gz` on macOS. Do not change those URLs to installers that are not paired with their `.sig`, because the updater will reject the download.

The `latest.json` file has this format:

```json
{
  "version": "v0.3.0",
  "notes": "Release notes...",
  "pub_date": "2026-05-01T12:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "...",
      "url": "https://github.com/OpenLeagueManager/OLManager/releases/download/v0.3.0/olmanager-0.3.0-windows-setup.exe"
    },
    "linux-x86_64": { ... },
    "darwin-aarch64": { ... }
  }
}
```

### 5. Local Updater Testing

To test the updater without making real releases:

1. Generate a test key pair.
2. Create a local server that serves a fake `latest.json` pointing to a local bundle.
3. Temporarily modify `endpoints` in `tauri.conf.json` to point to `http://localhost:3000/latest.json`.
4. Run the app in dev mode and force a manual check from Settings.

**Remember to revert `endpoints` changes before committing.**

### 6. Key Rotation

If you need to rotate the key pair:

1. Generate a new pair with `tauri signer generate`.
2. Update `pubkey` in `tauri.conf.json`.
3. Update the `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` secrets in GitHub.
4. Publish a new release; from then on, all updates will use the new key.
