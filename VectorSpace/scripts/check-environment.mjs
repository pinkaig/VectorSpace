import { existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'

const minimumNodeMajor = 22
const minimumNpmMajor = 10
const failures = []

const majorVersion = (version) => Number.parseInt(version.replace(/^v/, '').split('.')[0], 10)

const nodeMajor = majorVersion(process.version)
if (nodeMajor < minimumNodeMajor) {
  failures.push(`Node.js ${minimumNodeMajor}+ is required; found ${process.version}.`)
}

try {
  const npmCli = join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')
  const npmVersion = existsSync(npmCli)
    ? execFileSync(process.execPath, [npmCli, '--version'], { encoding: 'utf8' }).trim()
    : execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim()
  if (majorVersion(npmVersion) < minimumNpmMajor) {
    failures.push(`npm ${minimumNpmMajor}+ is required; found ${npmVersion}.`)
  }
} catch {
  failures.push('npm was not found. Install Node.js LTS, which includes npm.')
}

if (!existsSync('node_modules')) {
  failures.push('Dependencies are not installed. Run: npm install')
}

if (failures.length > 0) {
  console.error('\nVThere environment check failed:\n')
  failures.forEach((failure) => console.error(`  [FAIL] ${failure}`))
  console.error('\nWindows: run scripts\\check-environment.ps1')
  console.error('macOS/Linux: run bash scripts/check-environment.sh')
  console.error('Then retry: npm.cmd run dev\n')
  process.exitCode = 1
} else {
  console.log(`VThere environment ready: Node ${process.version}; dependencies installed.`)
}