$ErrorActionPreference = "Stop"
$Jellyfin = "http://localhost:8096"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path

function Send-Bytes($Response, [byte[]]$Bytes, $ContentType, $StatusCode = 200) {
    $Response.StatusCode = $StatusCode
    $Response.ContentType = $ContentType
    $Response.ContentLength64 = $Bytes.Length
    $Response.OutputStream.Write($Bytes, 0, $Bytes.Length)
    $Response.OutputStream.Close()
}

function Mime($Path) {
    switch ([IO.Path]::GetExtension($Path).ToLower()) {
        ".html" { "text/html; charset=utf-8" }
        ".css"  { "text/css; charset=utf-8" }
        ".js"   { "application/javascript; charset=utf-8" }
        ".json" { "application/json; charset=utf-8" }
        ".png"  { "image/png" }
        ".jpg"  { "image/jpeg" }
        ".jpeg" { "image/jpeg" }
        ".webp" { "image/webp" }
        default { "application/octet-stream" }
    }
}

Write-Host ""
Write-Host "CineVerse - Jellyfin API Key Setup" -ForegroundColor Yellow
Write-Host "Create a new API key in Jellyfin for CineVerse." -ForegroundColor Cyan
$ApiKey = Read-Host "Paste the Jellyfin API key here"
if ([string]::IsNullOrWhiteSpace($ApiKey)) {
    Write-Host "API key is empty." -ForegroundColor Red
    pause
    exit 1
}
$ApiKey = $ApiKey.Trim()

$listener = $null
$Port = 0
foreach ($p in 5500..5599) {
    try {
        $x = New-Object System.Net.HttpListener
        $x.Prefixes.Add("http://127.0.0.1:$p/")
        $x.Start()
        $listener = $x
        $Port = $p
        break
    } catch {
        if ($x) { try { $x.Close() } catch {} }
    }
}

if (-not $listener) {
    Write-Host "No free port from 5500 to 5599." -ForegroundColor Red
    pause
    exit 1
}

Write-Host "CineVerse: http://127.0.0.1:$Port/" -ForegroundColor Yellow
Write-Host "Jellyfin:  $Jellyfin" -ForegroundColor Cyan
Write-Host "Simple player is active." -ForegroundColor Green
Write-Host "Keep this window open." -ForegroundColor Green
Start-Process "http://127.0.0.1:$Port/"

while ($listener.IsListening) {
    try {
        $c = $listener.GetContext()
        $r = $c.Response
        try {
            $p = $c.Request.Url.AbsolutePath

            if ($p.StartsWith("/jellyfin/", [StringComparison]::OrdinalIgnoreCase)) {
                $rel = $p.Substring(9)
                $query = $c.Request.Url.Query
                $u = [Uri]($Jellyfin + $rel + $query)

                Write-Host ("Proxy -> " + $p) -ForegroundColor DarkGray

                $req = [System.Net.HttpWebRequest]::Create($u)
                $req.Method = "GET"
                $req.AllowAutoRedirect = $true
                $req.UserAgent = "CineVerse/1.0"
                $req.Headers["X-Emby-Token"] = $ApiKey
                $req.Headers["Authorization"] = "MediaBrowser Token=`"$ApiKey`""

                $range = $c.Request.Headers["Range"]
                if (-not [string]::IsNullOrWhiteSpace($range)) {
                    if ($range -match '^bytes=(\d+)-(\d*)$') {
                        $start = [Int64]$Matches[1]
                        if ([string]::IsNullOrWhiteSpace($Matches[2])) {
                            $req.AddRange($start)
                        } else {
                            $end = [Int64]$Matches[2]
                            $req.AddRange($start, $end)
                        }
                    }
                }

                try {
                    $resp = [System.Net.HttpWebResponse]$req.GetResponse()
                    $r.StatusCode = [int]$resp.StatusCode
                    if ($resp.ContentType) { $r.ContentType = $resp.ContentType }
                    if ($resp.ContentLength -ge 0) {
                        $r.ContentLength64 = $resp.ContentLength
                    } else {
                        $r.SendChunked = $true
                    }
                    if ($resp.Headers["Accept-Ranges"]) { $r.Headers["Accept-Ranges"] = $resp.Headers["Accept-Ranges"] }
                    if ($resp.Headers["Content-Range"]) { $r.Headers["Content-Range"] = $resp.Headers["Content-Range"] }
                    if ($resp.Headers["Content-Disposition"]) { $r.Headers["Content-Disposition"] = $resp.Headers["Content-Disposition"] }

                    $input = $resp.GetResponseStream()
                    $output = $r.OutputStream
                    $buffer = New-Object byte[] 65536
                    while (($read = $input.Read($buffer, 0, $buffer.Length)) -gt 0) {
                        $output.Write($buffer, 0, $read)
                    }
                    $output.Close()
                    $input.Close()
                    $resp.Close()
                    continue
                } catch [System.Net.WebException] {
                    $wr = $_.Exception.Response
                    if ($wr) {
                        $statusCode = [int]$wr.StatusCode
                        $errorText = "Jellyfin returned HTTP $statusCode for $rel"
                        try {
                            $sr = New-Object IO.StreamReader($wr.GetResponseStream())
                            $body = $sr.ReadToEnd()
                            $sr.Close()
                            if ($body) { $errorText += "`n" + $body }
                        } catch {}
                        Write-Host $errorText -ForegroundColor Red
                        Send-Bytes $r ([Text.Encoding]::UTF8.GetBytes($errorText)) "text/plain; charset=utf-8" $statusCode
                    } else {
                        $msg = "Jellyfin connection error: " + $_.Exception.Message
                        Write-Host $msg -ForegroundColor Red
                        Send-Bytes $r ([Text.Encoding]::UTF8.GetBytes($msg)) "text/plain; charset=utf-8" 502
                    }
                    continue
                }
            }

            $rf = $p.TrimStart("/").Replace("/", "\")
            if ([string]::IsNullOrEmpty($rf)) { $rf = "index.html" }
            $f = [IO.Path]::GetFullPath((Join-Path $Root $rf))
            $rr = [IO.Path]::GetFullPath($Root)
            if (-not $f.StartsWith($rr, [StringComparison]::OrdinalIgnoreCase)) {
                Send-Bytes $r ([Text.Encoding]::UTF8.GetBytes("Forbidden")) "text/plain" 403
                continue
            }
            if (Test-Path $f -PathType Leaf) {
                Send-Bytes $r ([IO.File]::ReadAllBytes($f)) (Mime $f) 200
            } else {
                Send-Bytes $r ([Text.Encoding]::UTF8.GetBytes("Not Found")) "text/plain" 404
            }
        } catch {
            $msg = "Server error: " + $_.Exception.Message
            Write-Host $msg -ForegroundColor Red
            try { Send-Bytes $r ([Text.Encoding]::UTF8.GetBytes($msg)) "text/plain; charset=utf-8" 500 } catch {}
        }
    } catch {}
}
