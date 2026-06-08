param(
  [Parameter(Mandatory)] [string] $SourceRoot,  # e.g. src/components or src/pages
  [Parameter(Mandatory)] [string] $TargetBase,  # e.g. src/ui-v2/_legacy/components
  [Parameter(Mandatory)] [string[]] $Files      # relative paths from SourceRoot
)

# Resolve a relative import path to an absolute one based on file location
function Resolve-RelativeImport {
  param([string]$FileDir, [string]$ImportPath)
  # FileDir is the directory of the source file (relative to project root)
  # ImportPath is e.g. "../../store/gameStore"
  $parts = $ImportPath -split '/'
  $dir = $FileDir -split '/'
  # Trim trailing empty from split
  if ($dir[-1] -eq '') { $dir = $dir[0..($dir.Length-2)] }
  # If the import starts with ../ or ./
  $i = 0
  while ($i -lt $parts.Length -and $parts[$i] -eq '..') {
    if ($dir.Count -gt 0) { $dir = $dir[0..($dir.Count-2)] }
    $i++
  }
  $result = @($dir)
  for ($j = $i; $j -lt $parts.Length; $j++) {
    if ($parts[$j] -ne '.') { $result += $parts[$j] }
  }
  return ($result -join '/').TrimStart('/')
}

function Convert-File {
  param([string]$SourcePath, [string]$DestPath, [string]$ProjectRoot)

  $sourceRelDir = (Resolve-Path -Path $SourcePath -Relative).TrimStart('.\')
  $sourceRelDir = Split-Path $sourceRelDir -Parent
  if (-not $sourceRelDir) { $sourceRelDir = '.' }

  $content = Get-Content $SourcePath -Raw
  $modified = $false

  # Match both import and re-export statements with relative paths
  $pattern = '(?<=(?:from|import)\s+["''])(\.\.?/)([^"''\n]*)(?=["''])'
  $result = [System.Text.StringBuilder]::new($content)

  # We need to process matches in reverse order to maintain positions
  $matches = [regex]::Matches($content, $pattern)
  for ($i = $matches.Count - 1; $i -ge 0; $i--) {
    $m = $matches[$i]
    $relPath = $m.Value  # e.g. "../../store/gameStore"
    $resolved = Resolve-RelativeImport -FileDir $sourceRelDir -ImportPath $relPath
    # If resolved doesn't start with 'src/', it might be outside the project
    if ($resolved.StartsWith('src/')) {
      $aliasPath = '@/' + $resolved.Substring(4)
      $result.Replace($m.Value, $aliasPath, $m.Index, $m.Length) | Out-Null
      $modified = $true
    } elseif ($resolved.StartsWith('node_modules/') -or $resolved -like '*node_modules*') {
      # Keep as-is (external package)
    } else {
      Write-Warning "  Cannot resolve: $relPath from $sourceRelDir → resolved to $resolved"
    }
  }

  if ($modified) {
    $destDir = Split-Path $DestPath -Parent
    if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
    $result.ToString() | Set-Content -Path $DestPath -NoNewline
    Write-Output "  ✓ Converted + copied: $($SourcePath -replace '.*src/', '')"
  } else {
    # No relative imports — simple copy
    $destDir = Split-Path $DestPath -Parent
    if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
    Copy-Item -Path $SourcePath -Destination $DestPath -Force
    Write-Output "  ✓ Copied (no changes): $($SourcePath -replace '.*src/', '')"
  }
}

Write-Output "Processing $($Files.Count) files..."
foreach ($f in $Files) {
  $src = Join-Path $SourceRoot $f
  $dest = Join-Path $TargetBase $f
  if (Test-Path $src) {
    Convert-File -SourcePath $src -DestPath $dest -ProjectRoot (Get-Location)
  } else {
    Write-Warning "  NOT FOUND: $src"
  }
}
Write-Output "Done."
