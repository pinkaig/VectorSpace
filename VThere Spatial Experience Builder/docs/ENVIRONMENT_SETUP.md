# Environment Setup

The project uses a preflight check to tell contributors exactly why development cannot start.

## Windows

From `VThere Spatial Experience Builder`:

```powershell
.\scripts\check-environment.ps1
npm.cmd install
npm.cmd run dev
```

If PowerShell blocks scripts, run the check through a temporary process-policy override:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\check-environment.ps1
```

Install Node.js 22 LTS or newer from [nodejs.org](https://nodejs.org/). npm is included with Node.js.

## macOS/Linux

```bash
bash scripts/check-environment.sh
npm install
npm run dev
```

## What the checks verify

- Node.js 22 or newer.
- npm availability.
- Installed `node_modules` dependencies.
- A clear non-zero exit code when setup is incomplete.

The npm `predev` and `prebuild` hooks run the Node check automatically once npm itself is available. The standalone PowerShell/Bash scripts are necessary because npm cannot run when Node.js is missing.

## Why not CMake?

CMake is useful for native C/C++ compilation, but this project is a Vite/React/TypeScript application with a Python API. It would add another tool without solving the actual setup problem. Small platform-native preflight scripts are easier for contributors to run and easier to maintain.