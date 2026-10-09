$ErrorActionPreference = 'Continue'
$failures = @()

function Add-Failure($message) {
  $script:failures += $message
  Write-Host "  [FAIL] $message" -ForegroundColor Red
}

Write-Host "VectorSpace environment check" -ForegroundColor Cyan

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  Add-Failure "Node.js was not found. Install Node.js 22+ LTS from https://nodejs.org/"
} else {
  $nodeVersion = node --version
  $nodeMajor = [int]($nodeVersion.TrimStart('v').Split('.')[0])
  Write-Host "  Node.js: $nodeVersion"
  if ($nodeMajor -lt 22) { Add-Failure "Node.js 22+ is required; found $nodeVersion." }
}

$npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $npm) {
  Add-Failure "npm was not found. Reinstall Node.js LTS or refresh PATH."
} else {
  $npmVersion = npm.cmd --version
  Write-Host "  npm: $npmVersion"
}

if (-not (Test-Path 'node_modules')) {
  Add-Failure "Dependencies are not installed. Run: npm.cmd install"
} else {
  Write-Host "  Dependencies: installed"
}

if ($failures.Count -gt 0) {
  Write-Host "`nEnvironment is not ready. Fix the failures above, then run:" -ForegroundColor Yellow
  Write-Host "  npm.cmd run dev"
  exit 1
}

Write-Host "`nEnvironment ready. Start the editor with: npm.cmd run dev" -ForegroundColor Green