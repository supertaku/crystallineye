$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$toolDirectory = Join-Path $taskRoot '.build-tools'
New-Item -ItemType Directory -Path $toolDirectory -Force | Out-Null
$archive = Join-Path $toolDirectory 'ninja-win.zip'
$executable = Join-Path $toolDirectory 'ninja.exe'
if (-not (Test-Path -LiteralPath $executable)) {
    # Official pinned Ninja release. Nothing in the Android SDK is replaced.
    Invoke-WebRequest -Uri 'https://github.com/ninja-build/ninja/releases/download/v1.13.2/ninja-win.zip' -OutFile $archive
    Expand-Archive -LiteralPath $archive -DestinationPath $toolDirectory -Force
}
& $executable --version
Write-Output 'Run Expo prebuild next to apply the project-local Ninja path.'
