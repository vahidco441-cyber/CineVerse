$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "CineVerse - Telegram channel connection test" -ForegroundColor Yellow
Write-Host "Paste the Telegram bot token. Input will be hidden." -ForegroundColor Cyan

$secureToken = Read-Host "Telegram bot token" -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
try {
    $Token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
}
finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
}

if ([string]::IsNullOrWhiteSpace($Token)) {
    Write-Host "Bot token is empty." -ForegroundColor Red
    exit 1
}

$Api = "https://api.telegram.org/bot$Token"

try {
    $me = Invoke-RestMethod -Uri "$Api/getMe" -Method Get -TimeoutSec 20
    if (-not $me.ok) {
        throw "Telegram did not accept this bot token."
    }
    Write-Host ("Connected to bot: @" + $me.result.username) -ForegroundColor Green
}
catch {
    Write-Host ("Could not connect to Telegram: " + $_.Exception.Message) -ForegroundColor Red
    $Token = $null
    exit 1
}

Write-Host ""
Write-Host "Waiting for a NEW post in your private channel..." -ForegroundColor Green
Write-Host "Keep this window open. Press Ctrl+C to stop." -ForegroundColor Yellow
Write-Host "Do not paste the token into chat or send it to anyone." -ForegroundColor Yellow
Write-Host ""

$offset = 0

while ($true) {
    try {
        $url = "$Api/getUpdates?timeout=25&offset=$offset&allowed_updates=%5B%22channel_post%22%5D"
        $updates = Invoke-RestMethod -Uri $url -Method Get -TimeoutSec 35

        foreach ($update in $updates.result) {
            $offset = [Int64]$update.update_id + 1
            $post = $update.channel_post

            if ($null -ne $post) {
                Write-Host "----------------------------------------" -ForegroundColor DarkGray
                Write-Host ("Channel: " + $post.chat.title) -ForegroundColor Cyan
                Write-Host ("Channel ID: " + $post.chat.id) -ForegroundColor Green
                Write-Host ("Message ID: " + $post.message_id) -ForegroundColor Gray

                if ($post.video) {
                    Write-Host "Video received successfully." -ForegroundColor Green
                    Write-Host ("File size: " + [Math]::Round(($post.video.file_size / 1MB), 2) + " MB")
                    Write-Host ("File ID: " + $post.video.file_id)
                }
                elseif ($post.document -and $post.document.mime_type -like "video/*") {
                    Write-Host "Video document received successfully." -ForegroundColor Green
                    Write-Host ("File name: " + $post.document.file_name)
                    Write-Host ("File size: " + [Math]::Round(($post.document.file_size / 1MB), 2) + " MB")
                    Write-Host ("File ID: " + $post.document.file_id)
                }
                else {
                    Write-Host "A channel post arrived, but it does not contain a video attachment." -ForegroundColor Yellow
                }
            }
        }
    }
    catch {
        Write-Host ("Telegram polling error: " + $_.Exception.Message) -ForegroundColor Red
        Start-Sleep -Seconds 4
    }
}
