param()
$ErrorActionPreference='Stop'
$launcherRoot=Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$launcherOutput=Join-Path $launcherRoot 'launcher-build'
New-Item -ItemType Directory -Path $launcherOutput -Force | Out-Null
$launcherCompiler=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if(-not(Test-Path -LiteralPath $launcherCompiler)){throw 'Compiler .NET Framework tidak ditemukan.'}
& $launcherCompiler /nologo /target:winexe "/out:$launcherOutput\Unboxin.exe" /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Net.Http.dll /reference:System.Web.Extensions.dll (Join-Path $PSScriptRoot 'UnboxinLauncher.cs')
if($LASTEXITCODE -ne 0){throw 'Kompilasi launcher gagal.'}
Write-Output "EXE tersedia: $launcherOutput\Unboxin.exe"
