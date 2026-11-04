# ============================================================
#  auto-push.ps1 - Pantau folder, commit & push otomatis
#  BK MTsN 2 Trenggalek
# ------------------------------------------------------------
#  Cara pakai:
#     .\scripts\auto-push.bat              (mode pantau)
#     .\scripts\auto-push.bat -Once        (push sekali lalu keluar)
#     .\scripts\auto-push.bat -DebounceSeconds 10
#
#  Setiap kali ada file berubah dan tersimpan, skrip menunggu
#  beberapa detik (debounce) agar tidak commit di tengah edit,
#  lalu:
#     1. cek sintaks semua file assets/js/*.js (bila Node.js ada)
#     2. git add -A
#     3. git commit
#     4. git push origin HEAD
#
#  Push ke branch main akan otomatis memicu:
#     - GitHub Pages  -> build ulang situs
#     - Vercel        -> deploy ulang situs
#     - Supabase      -> menjalankan migrasi baru di supabase/migrations
#
#  Perubahan struktur database TIDAK ditulis langsung ke Supabase.
#  Tambahkan file baru di supabase/migrations/ dengan nama
#  berawalan tanggal, contoh: 20261105120000_tambah_kolom.sql
# ============================================================

[CmdletBinding()]
param(
    [string]$RepoPath,
    [int]$DebounceSeconds = 5,
    [string]$CommitPrefix = "auto",
    [switch]$Once
)

$ErrorActionPreference = "Continue"

if ([string]::IsNullOrWhiteSpace($RepoPath)) {
    $RepoPath = Split-Path -Parent $PSScriptRoot
}
$RepoPath = (Resolve-Path -LiteralPath $RepoPath).Path
$LogFile = Join-Path $PSScriptRoot "auto-push.log"

function Write-Log {
    param(
        [Parameter(Mandatory = $true)][string]$Message,
        [ValidateSet("INFO", "OK", "WARN", "ERROR")][string]$Level = "INFO"
    )
    $line = "[{0}] [{1}] {2}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Level, $Message
    Write-Host $line
    try {
        Add-Content -LiteralPath $LogFile -Value $line -Encoding UTF8
    } catch {
        # Log tidak boleh menghentikan proses.
    }
}

function Invoke-Git {
    param([Parameter(Mandatory = $true)][string[]]$Arguments)
    Push-Location -LiteralPath $RepoPath
    try {
        $output = & git @Arguments 2>&1
        $code = $LASTEXITCODE
        return [pscustomobject]@{
            Code   = $code
            Output = (($output | Out-String).Trim())
        }
    } finally {
        Pop-Location
    }
}

function Test-JsSyntax {
    $node = Get-Command node -ErrorAction SilentlyContinue
    if (-not $node) {
        Write-Log "Node.js tidak ditemukan. Pemeriksaan sintaks dilewati." "WARN"
        return $true
    }

    $jsDir = Join-Path $RepoPath "assets\js"
    if (-not (Test-Path -LiteralPath $jsDir)) {
        return $true
    }

    $failed = @()
    Get-ChildItem -LiteralPath $jsDir -Filter "*.js" -File | ForEach-Object {
        $result = & $node.Source --check $_.FullName 2>&1
        if ($LASTEXITCODE -ne 0) {
            $failed += [pscustomobject]@{
                Name  = $_.Name
                Error = (($result | Out-String).Trim())
            }
        }
    }

    if ($failed.Count -eq 0) {
        Write-Log "Sintaks JavaScript valid." "OK"
        return $true
    }

    foreach ($item in $failed) {
        Write-Log ("Sintaks error di {0}: {1}" -f $item.Name, $item.Error) "ERROR"
    }
    Write-Log "Push dibatalkan. Perbaiki file di atas lalu simpan ulang." "ERROR"
    return $false
}

function Invoke-Push {
    param([string]$Reason = "perubahan file")

    $status = Invoke-Git -Arguments @("status", "--porcelain")
    if ([string]::IsNullOrWhiteSpace($status.Output)) {
        return $false
    }

    Write-Log ("Memproses {0}." -f $Reason)

    if (-not (Test-JsSyntax)) {
        return $false
    }

    $add = Invoke-Git -Arguments @("add", "-A")
    if ($add.Code -ne 0) {
        Write-Log ("git add gagal: {0}" -f $add.Output) "ERROR"
        return $false
    }

    $staged = Invoke-Git -Arguments @("diff", "--cached", "--quiet")
    if ($staged.Code -eq 0) {
        Write-Log "Tidak ada perubahan yang perlu di-commit." "INFO"
        return $false
    }

    $message = "{0}: {1}" -f $CommitPrefix, (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
    $commit = Invoke-Git -Arguments @("commit", "-m", $message)
    if ($commit.Code -ne 0) {
        Write-Log ("git commit gagal: {0}" -f $commit.Output) "ERROR"
        return $false
    }
    Write-Log ("Commit dibuat: {0}" -f $message) "OK"

    $push = Invoke-Git -Arguments @("push", "origin", "HEAD")
    if ($push.Code -ne 0) {
        Write-Log ("Push gagal: {0}" -f $push.Output) "ERROR"
        Write-Log "Periksa koneksi internet dan login GitHub, lalu simpan perubahan lagi." "WARN"
        return $false
    }

    Write-Log "Push ke GitHub berhasil. GitHub Pages, Vercel, dan Supabase akan memperbarui otomatis." "OK"
    return $true
}

# ---------- Pemeriksaan awal ----------

if (-not (Test-Path -LiteralPath (Join-Path $RepoPath ".git"))) {
    Write-Log ("Folder ini bukan repositori git: {0}" -f $RepoPath) "ERROR"
    exit 1
}

Push-Location -LiteralPath $RepoPath
try {
    $remote = (& git remote get-url origin 2>&1 | Out-String).Trim()
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($remote)) {
        Write-Log "Remote 'origin' belum diatur. Jalankan: git remote add origin <url-repo>" "ERROR"
        exit 1
    }

    $branch = (& git rev-parse --abbrev-ref HEAD 2>&1 | Out-String).Trim()
    if ($branch -ne "main") {
        Write-Log ("Branch aktif '{0}', bukan 'main'. Push tetap dilakukan ke branch ini." -f $branch) "WARN"
    }

    $email = (& git config user.email 2>&1 | Out-String).Trim()
    if ([string]::IsNullOrWhiteSpace($email)) {
        & git config user.email "mtsn2trenggalek2026-pixel@users.noreply.github.com" | Out-Null
        Write-Log "user.email lokal diatur otomatis." "WARN"
    }

    $name = (& git config user.name 2>&1 | Out-String).Trim()
    if ([string]::IsNullOrWhiteSpace($name)) {
        & git config user.name "BK MTsN 2 Trenggalek" | Out-Null
        Write-Log "user.name lokal diatur otomatis." "WARN"
    }

    Write-Log ("Repositori : {0}" -f $RepoPath)
    Write-Log ("Remote     : {0}" -f $remote)
    Write-Log ("Branch     : {0}" -f $branch)
} finally {
    Pop-Location
}

# ---------- Mode sekali jalan ----------

if ($Once) {
    Write-Log "Mode sekali jalan."
    $pushed = Invoke-Push -Reason "mode sekali jalan"
    if (-not $pushed) {
        Write-Log "Selesai tanpa push." "WARN"
    }
    exit 0
}

# ---------- Mode pantau ----------

Write-Log ("=" * 60)
Write-Log ("Memantau perubahan setiap 2 detik. Debounce {0} detik." -f $DebounceSeconds)
Write-Log "Tekan Ctrl + C atau tutup jendela ini untuk berhenti."
Write-Log ("=" * 60)

$pendingSince = $null
$lastStatus = ""
$lastFailureAt = [datetime]::MinValue

while ($true) {
    $status = Invoke-Git -Arguments @("status", "--porcelain")
    $current = $status.Output

    if ([string]::IsNullOrWhiteSpace($current)) {
        if ($null -ne $pendingSince) {
            Write-Log "Tidak ada perubahan tertunda." "INFO"
        }
        $pendingSince = $null
        $lastStatus = ""
    }
    else {
        if ($current -ne $lastStatus) {
            $lastStatus = $current
            $pendingSince = Get-Date
            Write-Log ("Perubahan terdeteksi: {0} file." -f (($current -split "`n") | Where-Object { $_.Trim() }).Count)
        }

        $waited = ((Get-Date) - $pendingSince).TotalSeconds
        $cooldown = ((Get-Date) - $lastFailureAt).TotalSeconds
        if ($waited -ge $DebounceSeconds -and $cooldown -ge 30) {
            $pushed = Invoke-Push -Reason "perubahan file"
            if (-not $pushed) {
                $lastFailureAt = Get-Date
                Write-Log "Menunggu 30 detik sebelum mencoba lagi." "WARN"
            }
            $pendingSince = $null
            $lastStatus = ""
        }
    }

    Start-Sleep -Seconds 2
}
