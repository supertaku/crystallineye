param([string]$Architectures = 'arm64-v8a,x86_64')
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
if (-not $env:JAVA_HOME) {
    $studioJava = Join-Path $env:ProgramFiles 'Android\Android Studio\jbr'
    if (Test-Path -LiteralPath $studioJava) { $env:JAVA_HOME = $studioJava }
}
if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
$env:NODE_ENV = 'development'
$gitUtilities = Join-Path $env:ProgramFiles 'Git\usr\bin'
if (Test-Path -LiteralPath $gitUtilities) { $env:Path = $gitUtilities + ';' + $env:Path }
& (Join-Path $PSScriptRoot 'setup-windows-build.ps1')
$occupied = (Get-PSDrive -PSProvider FileSystem).Name
$letter = @('R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z') | Where-Object { $_ -notin $occupied } | Select-Object -First 1
if (-not $letter) { throw 'A free drive letter is needed for the short CMake build path.' }
$drive = $letter + ':'
# This is a temporary alias of this workspace; no checkout is copied or moved.
subst $drive $taskRoot
if ($LASTEXITCODE -ne 0) { throw 'Could not create the workspace drive alias.' }
try {
    $env:CRYSTALLINEYE_CMAKE_STAGING = "$drive/.build-tools/cxx"
    Push-Location -LiteralPath $taskRoot
    try {
        npx expo prebuild --platform android --no-install
        if ($LASTEXITCODE -ne 0) { throw 'Expo prebuild failed.' }
        & (Join-Path $taskRoot 'android\gradlew.bat') -p android assembleDebug "-PreactNativeArchitectures=$Architectures" --console=plain
        if ($LASTEXITCODE -ne 0) { throw 'Android compilation failed.' }
    } finally { Pop-Location }
} finally {
    Remove-Item Env:CRYSTALLINEYE_CMAKE_STAGING -ErrorAction SilentlyContinue
    subst $drive /d
}
