#Requires -Version 5.1
<#
.SYNOPSIS
  Idempotent batch publish for B3 connector packages @0.1.0 (Windows operator workflow).

.DESCRIPTION
  Default mode is DRY-RUN (registry checks, build, npm publish --dry-run only).
  PUBLISH uploads sequentially with operator confirmation; skips versions already on npm.
  Local bootstrap uses: npm publish --access public --provenance=false
  (package publishConfig.provenance and GitHub Actions OIDC workflows are unchanged.)
  Live publish runs in the foreground so npm can prompt for interactive 2FA; credentials are never logged.

  LIMITATIONS (B3 closeout):
  - Default and recommended mode is DryRun (build + npm publish --dry-run + registry precheck).
  - Publish mode is NOT verified for npm EOTP/2FA when run as a batch: operator reports showed
    EOTP failures under batch automation while direct interactive "npm publish" per package succeeded.
  - Publish requires [Environment]::UserInteractive and a real TTY for OTP prompts; do not run Publish
    from non-interactive agents or piped stdin. Prefer per-package interactive publish or GitHub Actions OIDC.
  - This script does not replace registry consumer acceptance (see scripts/package-acceptance-registry-b3.mjs).

.PARAMETER Mode
  DryRun (default) or Publish.

.PARAMETER ConfirmBatch
  Required for Publish mode. Must be set explicitly after review.

.PARAMETER SkipBuild
  Skip pnpm build (use only when dist/ is already production-ready).

.PARAMETER VerifyInstallAfterEach
  When publishing, run a minimal npm view + registry install smoke after each success
  before continuing to the next package.
#>
[CmdletBinding()]
param(
  [ValidateSet('DryRun', 'Publish')]
  [string] $Mode = 'DryRun',

  [switch] $ConfirmBatch,

  [switch] $SkipBuild,

  [switch] $VerifyInstallAfterEach = $true
)

$ErrorActionPreference = 'Stop'

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$TargetVersion = '0.1.0'

$Packages = @(
  @{ Name = '@osva-ai/connector-gmail';           Dir = 'packages/gmail' }
  @{ Name = '@osva-ai/connector-google-calendar'; Dir = 'packages/google-calendar' }
  @{ Name = '@osva-ai/connector-notion';          Dir = 'packages/notion' }
  @{ Name = '@osva-ai/connector-linear';          Dir = 'packages/linear' }
  @{ Name = '@osva-ai/connector-exa';             Dir = 'packages/exa' }
  @{ Name = '@osva-ai/connector-tavily';          Dir = 'packages/tavily' }
  @{ Name = '@osva-ai/connector-firecrawl';       Dir = 'packages/firecrawl' }
)

$RegistryVisibilityRetrySeconds = @(5, 10, 20, 30)
$Results = [System.Collections.Generic.List[object]]::new()

function Write-Log {
  param([string] $Message)
  $ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
  Write-Host "[$ts] $Message"
}

function Redact-NpmOutput {
  param([string] $Text)
  if ([string]::IsNullOrEmpty($Text)) { return $Text }
  $redacted = $Text -replace '(//registry\.npmjs\.org/:_authToken=)\S+', '${1}[REDACTED]'
  $redacted = $redacted -replace '\b(npm_[A-Za-z0-9_-]{10,})\b', '[REDACTED_NPM_TOKEN]'
  $redacted = $redacted -replace '\b(otp|one-time password|2fa code)\s*[:=]\s*\S+', '$1 [REDACTED]'
  return $redacted
}

function Invoke-QuietNpm {
  param([Parameter(Mandatory)][string[]] $NpmCliArgs)
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $raw = & npm @NpmCliArgs 2>&1
    $code = $LASTEXITCODE
    if ($null -eq $code) { $code = 1 }
    $out = ($raw | Out-String).Trim()
    return @{ ExitCode = $code; Output = (Redact-NpmOutput $out) }
  } finally {
    $ErrorActionPreference = $prev
  }
}

function Get-RegistryVersionState {
  param(
    [string] $PackageName,
    [string] $Version
  )
  $spec = "${PackageName}@${Version}"
  $view = Invoke-QuietNpm -NpmCliArgs @('view', $spec, 'version', '--registry', 'https://registry.npmjs.org')
  if ($view.ExitCode -eq 0) {
    $v = ($view.Output -split "`r?`n" | Where-Object { $_ -match '^\d' } | Select-Object -First 1)
    if ([string]::IsNullOrWhiteSpace($v)) {
      return @{ State = 'Ambiguous'; Detail = "npm view returned exit 0 but no version line: $($view.Output)" }
    }
    if ($v -eq $Version) {
      return @{ State = 'Published'; Detail = $v }
    }
    return @{ State = 'Ambiguous'; Detail = "npm view version=$v expected=$Version" }
  }

  if ($view.Output -match 'E404|404 Not Found|could not be found') {
    return @{ State = 'NotFound'; Detail = 'E404' }
  }
  if ($view.Output -match 'E403|403 Forbidden|401 Unauthorized') {
    return @{ State = 'Ambiguous'; Detail = $view.Output }
  }
  return @{ State = 'Ambiguous'; Detail = $view.Output }
}

function Wait-RegistryPublished {
  param(
    [string] $PackageName,
    [string] $Version
  )
  foreach ($delay in $RegistryVisibilityRetrySeconds) {
    $state = Get-RegistryVersionState -PackageName $PackageName -Version $Version
    if ($state.State -eq 'Published') {
      return $true
    }
    if ($state.State -eq 'Ambiguous') {
      throw "Ambiguous registry response while waiting for ${PackageName}@${Version}: $($state.Detail)"
    }
    Write-Log "Registry not visible yet for ${PackageName}@${Version}; waiting ${delay}s…"
    Start-Sleep -Seconds $delay
  }
  return $false
}

function Test-OperatorNpmAuth {
  $who = Invoke-QuietNpm -NpmCliArgs @('whoami')
  if ($who.ExitCode -ne 0) {
    throw "npm whoami failed; run npm login before PUBLISH mode. (No credentials are logged.)"
  }
  $publisher = ($who.Output -split "`r?`n" | Where-Object { $_ -match '\S' } | Select-Object -First 1).Trim()
  Write-Log "npm publisher: $publisher"
  Write-Log "Each publish runs in the foreground; complete npm OTP / 2FA prompts when asked."
}

function Assert-PackageManifest {
  param([string] $PackageDir, [string] $ExpectedName)
  $manifestPath = Join-Path $PackageDir 'package.json'
  $json = Get-Content -Raw -Path $manifestPath | ConvertFrom-Json
  if ($json.name -ne $ExpectedName) {
    throw "package.json name mismatch in ${PackageDir}: $($json.name)"
  }
  if ($json.version -ne $TargetVersion) {
    throw "package.json version mismatch in ${PackageDir}: $($json.version) (expected $TargetVersion)"
  }
  if ($json.dependencies.'@osva-ai/connector-sdk' -ne '1.1.4') {
    throw "connector-sdk pin mismatch in ${PackageDir}: $($json.dependencies.'@osva-ai/connector-sdk')"
  }
  $access = $json.publishConfig.access
  if ($access -ne 'public') {
    throw "publishConfig.access must be public in ${PackageDir} (got $access)"
  }
}

function Invoke-PackageBuild {
  param([string] $FilterName)
  if ($SkipBuild) {
    Write-Log "SkipBuild: skipping pnpm build for $FilterName"
    return
  }
  Push-Location $RepoRoot
  try {
    Write-Log "Building $FilterName…"
    & pnpm --filter $FilterName build
    if ($LASTEXITCODE -ne 0) { throw "pnpm build failed for $FilterName" }
  } finally {
    Pop-Location
  }
}

function Invoke-DryRunPublish {
  param([string] $PackageDir)
  Push-Location $PackageDir
  try {
    $pub = Invoke-QuietNpm -NpmCliArgs @('publish', '--dry-run', '--access', 'public', '--provenance=false')
    if ($pub.ExitCode -ne 0) {
      if ($pub.Output -match 'cannot publish over the previously published versions') {
        return 'AlreadyPublished'
      }
      throw "npm publish --dry-run failed in ${PackageDir}: $($pub.Output)"
    }
    return 'Ok'
  } finally {
    Pop-Location
  }
}

function Resolve-AfterAmbiguousPublish {
  param(
    [string] $PackageName,
    [int] $PublishExitCode
  )
  Write-Log "npm publish exit $PublishExitCode for $PackageName; rechecking registry (no automatic retry)…"
  $recheck = Get-RegistryVersionState -PackageName $PackageName -Version $TargetVersion
  switch ($recheck.State) {
    'Published' {
      Write-Log "Registry confirms ${PackageName}@${TargetVersion}; treating upload as successful."
      return 'UploadedAfterRecheck'
    }
    'NotFound' {
      throw "npm publish failed (exit $PublishExitCode) and registry has no ${PackageName}@${TargetVersion}. Investigate; do not auto-retry."
    }
    'Ambiguous' {
      throw "npm publish failed (exit $PublishExitCode) and registry state is ambiguous: $($recheck.Detail). Stop and verify manually."
    }
    default {
      throw "Unexpected registry state after publish: $($recheck.State)"
    }
  }
}

function Invoke-LivePublish {
  param(
    [string] $PackageDir,
    [string] $PackageName
  )
  Push-Location $PackageDir
  try {
    Write-Log "Publishing $PackageName (foreground; npm may prompt for 2FA)…"
    # Stdio inherited so operator can complete interactive npm login / OTP; output not captured or stored.
    & npm publish --access public --provenance=false
    $code = $LASTEXITCODE
    if ($null -eq $code) { $code = 1 }

    if ($code -ne 0) {
      return (Resolve-AfterAmbiguousPublish -PackageName $PackageName -PublishExitCode $code)
    }
    return 'Uploaded'
  } finally {
    Pop-Location
  }
}

function Invoke-RegistryInstallSmoke {
  param([string] $PackageName, [string] $Version)
  $tmp = Join-Path $env:TEMP ("osva-b3-publish-smoke-{0}" -f ([Guid]::NewGuid().ToString('N').Substring(0, 8)))
  New-Item -ItemType Directory -Path $tmp | Out-Null
  try {
    $pkgJson = @{ name = 'osva-b3-smoke'; private = $true; type = 'module' } | ConvertTo-Json
    Set-Content -Path (Join-Path $tmp 'package.json') -Value $pkgJson -Encoding utf8
    $install = Invoke-QuietNpm -NpmCliArgs @('install', "${PackageName}@${Version}", '--omit=dev', '--no-fund', '--no-audit')
    if ($install.ExitCode -ne 0) {
      throw "Registry install smoke failed for ${PackageName}@${Version}: $($install.Output)"
    }
    $scope, $leaf = ($PackageName -replace '^@', '').Split('/', 2)
    $installed = Join-Path $tmp 'node_modules' "@$scope" $leaf
    $manifest = Get-Content -Raw (Join-Path $installed 'package.json') | ConvertFrom-Json
    if ($manifest.version -ne $Version) {
      throw "Installed version mismatch: $($manifest.version)"
    }
    Write-Log "Registry install smoke OK for ${PackageName}@${Version}"
  } finally {
    Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
  }
}

Write-Log "OSVA B3 batch publish — Mode=$Mode — repo=$RepoRoot"

if ($Mode -eq 'Publish') {
  if (-not [Environment]::UserInteractive) {
    throw 'PUBLISH mode requires an interactive console (npm 2FA/EOTP). Use DryRun or publish packages individually.'
  }
  if (-not $ConfirmBatch) {
    throw 'PUBLISH mode requires -ConfirmBatch after operator review.'
  }
  $typed = Read-Host "Type PUBLISH-B3 to authorize batch upload of 7 packages at $TargetVersion"
  if ($typed -ne 'PUBLISH-B3') {
    throw 'Batch authorization phrase did not match; aborting.'
  }
  Test-OperatorNpmAuth
} else {
  Write-Log 'DRY-RUN mode (default): no registry uploads.'
}

foreach ($pkg in $Packages) {
  $name = $pkg.Name
  $dir = Join-Path $RepoRoot $pkg.Dir
  Write-Log "---- $name ----"

  $entry = [ordered]@{
    Package   = $name
    Version   = $TargetVersion
    Mode      = $Mode
    Registry  = $null
    Build     = $null
    DryRun    = $null
    Publish   = $null
    Verify    = $null
    Outcome   = $null
    Detail    = $null
  }

  try {
    Assert-PackageManifest -PackageDir $dir -ExpectedName $name

    $reg = Get-RegistryVersionState -PackageName $name -Version $TargetVersion
    $entry.Registry = $reg.State
    if ($reg.State -eq 'Ambiguous') {
      throw "Registry check ambiguous: $($reg.Detail)"
    }
    if ($reg.State -eq 'Published') {
      $entry.Outcome = 'Skipped'
      $entry.Detail = 'Version already on npm (no overwrite).'
      Write-Log "$name@$TargetVersion already published — skipping."
      $Results.Add([pscustomobject]$entry) | Out-Null
      continue
    }

    Invoke-PackageBuild -FilterName $name
    $entry.Build = 'Ok'

    $dry = Invoke-DryRunPublish -PackageDir $dir
    $entry.DryRun = $dry
    if ($dry -eq 'AlreadyPublished') {
      $entry.Outcome = 'Skipped'
      $entry.Detail = 'Dry-run reported version already published.'
      Write-Log "$name dry-run indicates already published — skipping."
      $Results.Add([pscustomobject]$entry) | Out-Null
      continue
    }

    if ($Mode -eq 'DryRun') {
      $entry.Outcome = 'DryRunOk'
      $entry.Detail = 'Registry not found; dry-run succeeded.'
      Write-Log "DRY-RUN OK: $name"
      $Results.Add([pscustomobject]$entry) | Out-Null
      continue
    }

    $pubResult = Invoke-LivePublish -PackageDir $dir -PackageName $name
    $entry.Publish = $pubResult

    $visible = Wait-RegistryPublished -PackageName $name -Version $TargetVersion
    if (-not $visible) {
      throw "Published but registry visibility not confirmed for $name@$TargetVersion after retries."
    }
    $entry.Verify = 'npm view'

    if ($VerifyInstallAfterEach) {
      Invoke-RegistryInstallSmoke -PackageName $name -Version $TargetVersion
      $entry.Verify = 'npm view + install smoke'
    }

    $entry.Outcome = 'Published'
    $entry.Detail = 'Upload and registry verification succeeded.'
    Write-Log "PUBLISHED: $name@$TargetVersion"
  } catch {
    $entry.Outcome = 'Failed'
    $entry.Detail = $_.Exception.Message
    Write-Log "FAILED: $name — $($_.Exception.Message)"
    $Results.Add([pscustomobject]$entry) | Out-Null
    throw
  }

  $Results.Add([pscustomobject]$entry) | Out-Null
}

Write-Log 'Batch complete.'
$Results | Format-Table -AutoSize
$failed = $Results | Where-Object { $_.Outcome -eq 'Failed' }
if ($failed) { exit 1 }
exit 0
