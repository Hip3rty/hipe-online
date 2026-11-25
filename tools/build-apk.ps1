# Gera o APK do Hipe Online.
# Uso: powershell -ExecutionPolicy Bypass -File tools/build-apk.ps1 -Server "wss://hipe-online.onrender.com/ws"
param(
  [string]$Server = "",
  [string]$Cache = "D:\hipe-gradle-cache"
)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

# Gradle/Java falham com acentos no caminho da pasta temporária: usa uma pasta ASCII
New-Item -ItemType Directory -Force "$Cache\tmp" | Out-Null
$env:GRADLE_USER_HOME = $Cache
$env:TEMP = "$Cache\tmp"; $env:TMP = "$Cache\tmp"
$env:JAVA_TOOL_OPTIONS = "-Djava.io.tmpdir=$Cache\tmp"
if ($Server) { $env:VITE_SERVER_URL = $Server; Write-Host "Servidor embutido no APK: $Server" }

npm run build -w client
if ($LASTEXITCODE -ne 0) { throw "build do cliente falhou" }
Push-Location client
npx cap sync android
Pop-Location
node tools/make-icons.mjs
Push-Location client\android
.\gradlew.bat assembleDebug --no-daemon --console=plain
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "gradle falhou" }
Pop-Location

$apk = "client\android\app\build\outputs\apk\debug\app-debug.apk"
New-Item -ItemType Directory -Force dist-apk | Out-Null
Copy-Item $apk "dist-apk\HipeOnline.apk" -Force
Write-Host "APK pronto: dist-apk\HipeOnline.apk"
