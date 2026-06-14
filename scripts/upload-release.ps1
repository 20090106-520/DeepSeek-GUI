$GH_TOKEN = $env:GH_TOKEN
$headers = @{
    "Authorization" = "token $GH_TOKEN"
    "Accept" = "application/vnd.github+json"
}

$body = @{
    tag_name = "v0.1.2"
    name = "v0.1.2"
    body = "版本 0.1.2 - 包含最新功能和改进"
    draft = $false
    prerelease = $false
} | ConvertTo-Json

Write-Host "Creating Release..."
$release = Invoke-RestMethod -Uri "https://api.github.com/repos/20090106-520/DeepSeek-GUI/releases" -Method POST -Headers $headers -Body $body -ContentType "application/json"
$releaseId = $release.id

Write-Host "Release created: https://github.com/20090106-520/DeepSeek-GUI/releases/tag/v0.1.2"

Write-Host "Uploading installer..."
$filePath = "dist\DeepSeek-GUI-0.1.2-win-x64.exe"
$fileBytes = [System.IO.File]::ReadAllBytes($filePath)
$uploadHeaders = @{
    "Authorization" = "token $GH_TOKEN"
    "Content-Type" = "application/octet-stream"
    "Accept" = "application/vnd.github+json"
}
$uploadUri = "https://uploads.github.com/repos/20090106-520/DeepSeek-GUI/releases/$releaseId/assets?name=DeepSeek-GUI-0.1.2-win-x64.exe"
$asset = Invoke-RestMethod -Uri $uploadUri -Method POST -Headers $uploadHeaders -Body $fileBytes

Write-Host ""
Write-Host "=== Upload Complete! ==="
Write-Host "Release: https://github.com/20090106-520/DeepSeek-GUI/releases/tag/v0.1.2"
Write-Host "Download: $($asset.browser_download_url)"
