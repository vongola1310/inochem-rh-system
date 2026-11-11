$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
node node_modules/prisma/build/index.js validate
if ($LASTEXITCODE -ne 0) { throw 'El esquema Prisma no es válido.' }
node node_modules/prisma/build/index.js generate
if ($LASTEXITCODE -ne 0) { throw 'No se pudo generar el cliente Prisma.' }
$qaRoot = Join-Path (Split-Path -Parent $projectRoot) 'propuestas\validacion-asistencia'
New-Item -ItemType Directory -Path $qaRoot -Force | Out-Null
$baseline = Join-Path $projectRoot 'tests\fixtures\schema-before-attendance.prisma'
$migrationRoot = Join-Path $projectRoot 'prisma\migrations\202610260001_attendance'
New-Item -ItemType Directory -Path $migrationRoot -Force | Out-Null
$proposal = Join-Path $qaRoot 'attendance-proposed.sql'
node node_modules/prisma/build/index.js migrate diff --from-schema-datamodel $baseline --to-schema-datamodel prisma/schema.prisma --script --output $proposal
if ($LASTEXITCODE -ne 0) { throw 'No se pudo preparar la migración.' }
$migration = Join-Path $migrationRoot 'migration.sql'
if (Test-Path -LiteralPath $migration) {
  if ((Get-Content -LiteralPath $migration -Raw).Trim() -ne (Get-Content -LiteralPath $proposal -Raw).Trim()) {
    throw 'La propuesta difiere de la migración existente. Crea una migración nueva; no sobrescribas SQL ya aplicado.'
  }
} else { Copy-Item -LiteralPath $proposal -Destination $migration }
Write-Output 'Cliente generado y migración preparada. No se modificó la base de datos.'
