$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
$env:ATTENDANCE_DATABASE_TEST = '1'
try {
  node --test tests/attendance-integration.test.cjs
  if ($LASTEXITCODE -ne 0) { throw 'Falló la prueba de integración de asistencia.' }
} finally {
  Remove-Item Env:\ATTENDANCE_DATABASE_TEST -ErrorAction SilentlyContinue
}
