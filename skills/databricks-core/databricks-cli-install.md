# Databricks CLI Installation

Set up or upgrade the Databricks CLI on macOS, Windows, or Linux via verified package managers or versioned release artifacts. Covers checksum validation, installation to user directories for non-sudo environments, and recovery from common failures.

## Sandboxed agent / container environments

CLI installation commands frequently write to system directories outside the workspace (e.g. `/opt/homebrew/`, `/usr/local/bin/`) that are inaccessible in sandboxed environments.

**Agent behavior**: Do not run install commands directly. Instead, present the relevant command to the user and ask them to execute it in their own terminal. Once they confirm completion, verify with `databricks -v`.

For Linux/macOS containers or sandboxed agent environments: prefer the **Linux manual install to user directory** method (`~/.local/bin`) — it requires no sudo and avoids any writes outside the workspace.

## Preconditions (always do first)
1. Identify the OS and shell in use:
   - macOS/Linux: bash/zsh
   - Windows: Command Prompt / PowerShell; optionally WSL for Linux shell
2. Check whether `databricks` is already present on the system:
   - Run: `databricks -v` (or `databricks version`)
   - If a recent version is already installed, no further action is needed.
3. Do not use the legacy Python package `databricks-cli` (PyPI). This skill installs the modern Databricks CLI binary.

## Preferred installation paths (by OS)

### macOS (preferred: Homebrew)
Run:
- `brew tap databricks/tap`
- `brew install databricks`

Verify:
- `databricks -v` (or `databricks version`)

If macOS quarantines the binary (Gatekeeper), use Apple’s “open app from unidentified developer” flow to allow it.

#### macOS fallback: verified release artifact

Download the versioned macOS archive from the [official releases](https://github.com/databricks/cli/releases), verify its published checksum prior to extraction, inspect the archive contents, and get explicit user approval before placing the binary on `PATH`. Prefer a user-owned directory such as `~/.local/bin`; never pipe a remote installer response directly into a shell.

Verify:
- `databricks -v`

### Linux (preferred: Homebrew if available)
Run:
- `brew tap databricks/tap`
- `brew install databricks`

Verify:
- `databricks -v`

#### Linux fallback: verified release artifact

Use the manual user-directory installation described below. Choose a specific version from the [official releases](https://github.com/databricks/cli/releases), verify its published checksum, review the archive contents, and get explicit user approval before placing the binary. Never pipe a remote response directly into a shell.

Verify:
- `databricks -v`

#### Linux alternative: Manual install to user directory (when sudo unavailable)
Apply this approach when sudo is unavailable or requires interactive password input.

Steps:
1. Detect architecture with `uname -m` (`x86_64` maps to `amd64`; `aarch64` maps to `arm64`).
2. Select an explicit version from the [official releases](https://github.com/databricks/cli/releases). Do not resolve an unreviewed moving `latest` URL.
3. Download the matching archive and its published checksum/signature to a temporary directory. Verify it before extraction; if the release provides no verifiable integrity metadata, use Homebrew instead.
4. Inspect the archive, then install after explicit approval:
   ```bash
   sha256sum -c databricks.sha256
   tar -tzf "databricks_cli_<version>_linux_<arch>.tar.gz"
   mkdir -p "$HOME/.local/bin"
   tar -xzf "databricks_cli_<version>_linux_<arch>.tar.gz" -C "$HOME/.local/bin" databricks
   chmod 0755 "$HOME/.local/bin/databricks"
   ```
5. Add to PATH (add to `~/.bashrc` or `~/.zshrc` for persistence):
   ```bash
   export PATH="$HOME/.local/bin:$PATH"
   ```
6. Verify:
   - `databricks -v`

Notes:
- The download files are `.tar.gz` archives (not `.zip`) with naming pattern: `databricks_cli_<version>_linux_<arch>.tar.gz`
- Common architectures: `amd64` (x86_64), `arm64` (aarch64)
- This approach functions correctly in containerized and sandboxed agent environments where sudo is not available

### Windows (preferred: WinGet)
Execute in Command Prompt (then open a new terminal session):
- `winget search databricks`
- `winget install Databricks.DatabricksCLI`

Verify:
- `databricks -v`

#### Windows alternative: Chocolatey (Experimental)
Run:
- `choco install databricks-cli`

Verify:
- `databricks -v`

#### Windows fallback: verified release artifact

Download a specific Windows release archive from the [official releases](https://github.com/databricks/cli/releases), verify its published checksum in PowerShell, review the archive contents, and get explicit approval before extracting the binary to a user-owned directory on `PATH`. Do not run downloaded installer scripts or execute unverified artifacts as Administrator.

Verify in the same environment:
- `databricks -v`

## Manual install (all OSes): download from GitHub releases
Use this method when package managers or curl-based installation are unavailable.

Steps:
1. Select an explicit reviewed version from https://github.com/databricks/cli/releases and note it before downloading anything. Do not resolve a moving `latest` URL.
2. Download the appropriate versioned file for your OS and architecture:
   - Linux: `databricks_cli_<version>_linux_<arch>.tar.gz` (use tar -xzf)
   - macOS: `databricks_cli_<version>_darwin_<arch>.zip` (use unzip)
   - Windows: `databricks_cli_<version>_windows_<arch>.zip` (use native extraction)
   - Common architectures: `amd64` (x86_64), `arm64` (aarch64/Apple Silicon)
3. Extract the downloaded archive.
4. Place the extracted `databricks` executable on PATH, or invoke it directly from its location.
5. Verify with `databricks -v`.

## Update / repair procedures

### Homebrew update (macOS/Linux)
- `brew upgrade databricks`
- `databricks -v`

### WinGet update (Windows)
- `winget upgrade Databricks.DatabricksCLI`
- `databricks -v`

### Manual release update (all OSes)
1. Locate the currently installed binary using `which databricks` or `where databricks`; do not remove anything until the replacement has been verified.
2. Choose an explicit newer version from the official release page, download the corresponding artifact, and confirm its published checksum/signature.
3. Inspect and extract the replacement into a temporary location, run `<temporary-path>/databricks -v`, then get explicit approval before atomically swapping out the existing binary.
4. Confirm the binary resolved from `PATH` with `databricks -v`; keep the previous binary until verification succeeds.

## Common failures & fixes (agent playbook)
- `Target path <path> already exists`:
  - Validate the new binary in a temporary location, get explicit approval to replace, then back up the existing binary before installing the new one.
- Permission error writing `/usr/local/bin`:
  - Switch to the manual install targeting `~/.local/bin` rather than escalating installer privileges.
- `sudo: a terminal is required to read the password`:
  - sudo cannot be used in non-interactive environments (containers, CI/CD).
  - Fall back to the manual install to `~/.local/bin` approach instead (see "Linux alternative" section).
- Windows PATH not updated after WinGet:
  - Close and reopen Command Prompt/PowerShell.
- Multiple `databricks` binaries on PATH:
  - Run `which databricks` (macOS/Linux/WSL) or `where databricks` (Windows) to identify and remove the incorrect entry.
- Wrong file type (trying to unzip a tar.gz):
  - Linux releases are `.tar.gz` files, use `tar -xzf` not `unzip`.
  - macOS and Windows releases are `.zip` files, use appropriate extraction tool.
- `databricks: command not found` after installation to `~/.local/bin`:
  - Add to PATH: `export PATH="$HOME/.local/bin:$PATH"`
  - For persistence, add the export command to `~/.bashrc` or `~/.zshrc`.
