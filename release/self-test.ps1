[CmdletBinding()]
param(
    [string]$BaseUrl = "https://morrow.coders.kr",
    [ValidateRange(0, 60)]
    [int]$DurationMinutes = 2,
    [ValidateRange(5, 300)]
    [int]$IntervalSeconds = 15
)

$ErrorActionPreference = "Stop"
$base = $BaseUrl.TrimEnd('/')
$checks = @(
    @{ Name = "liveness"; Path = "/api/health/live"; Expected = @(200) },
    @{ Name = "database health"; Path = "/api/health"; Expected = @(200) },
    @{ Name = "readiness"; Path = "/api/health/ready"; Expected = @(200) },
    @{ Name = "auth providers"; Path = "/api/auth/providers"; Expected = @(200) },
    # Protected routes must reject anonymous traffic instead of leaking data.
    @{ Name = "protected route gate"; Path = "/api/interests/received?limit=12"; Expected = @(401, 403) }
)

function Invoke-Check($check) {
    try {
        $response = Invoke-WebRequest -Uri ($base + $check.Path) -Method Get -TimeoutSec 15 -UseBasicParsing
        $code = [int]$response.StatusCode
    } catch {
        $code = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 0 }
    }
    $ok = $check.Expected -contains $code
    [pscustomobject]@{ name = $check.Name; status = $code; ok = $ok }
}

$started = Get-Date
$deadline = $started.AddMinutes($DurationMinutes)
$iteration = 0
$failed = $false
Write-Host "MORROW self-test: $base (${DurationMinutes}m, every ${IntervalSeconds}s)"
do {
    $iteration++
    $results = $checks | ForEach-Object { Invoke-Check $_ }
    $stamp = (Get-Date).ToString("o")
    foreach ($result in $results) {
        $state = if ($result.ok) { "PASS" } else { "FAIL" }
        Write-Host "$stamp [$state] $($result.name) -> HTTP $($result.status)"
    }
    if ($results.ok -contains $false) { $failed = $true }
    if ((Get-Date) -ge $deadline -or $DurationMinutes -eq 0) { break }
    Start-Sleep -Seconds $IntervalSeconds
} while ((Get-Date) -lt $deadline)

if ($failed) {
    Write-Error "Self-test failed in iteration $iteration. Check the non-secret status lines above."
    exit 1
}
Write-Host "Self-test passed ($iteration iterations)."

