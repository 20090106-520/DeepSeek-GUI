$ErrorActionPreference = "Stop"

# 配置
$GH_TOKEN = $env:GH_TOKEN
$OWNER = "20090106-520"
$REPO = "DeepSeek-GUI"

Write-Host "=== DeepSeek GUI 自动发布脚本 ===" -ForegroundColor Cyan
Write-Host ""

# 1. 更新版本号
Write-Host "[1/4] 更新版本号..." -ForegroundColor Yellow
npm version patch --force
$newVersion = (Get-Content package.json | Select-String '"version"' | ForEach-Object { $_.Line -replace '.*"version":\s*"([^"]+)".*', '$1' })
Write-Host "新版本: $newVersion" -ForegroundColor Green

# 清理旧的 dist 文件夹
Write-Host ""
Write-Host "[1.5/4] 清理旧文件..." -ForegroundColor Yellow
if (Test-Path "dist") {
    Remove-Item -Recurse -Force "dist"
}
Write-Host "清理完成" -ForegroundColor Green

# 2. 打包应用
Write-Host ""
Write-Host "[2/4] 打包应用..." -ForegroundColor Yellow
$env:ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/"
npm run dist:win -- --win nsis --x64

# 3. 查找安装包
Write-Host ""
Write-Host "[3/4] 查找安装包..." -ForegroundColor Yellow
$installer = Get-ChildItem "dist" -Filter "*.exe" | Where-Object { $_.Name -like "*Setup*" } | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $installer) {
    Write-Error "未找到安装包文件"
    exit 1
}
Write-Host "找到安装包: $($installer.Name)" -ForegroundColor Green

# 4. 创建 Release 并上传
Write-Host ""
Write-Host "[4/4] 上传到 GitHub..." -ForegroundColor Yellow

# 创建 Release
$releaseUrl = "https://api.github.com/repos/$OWNER/$REPO/releases"
$tagName = "v$newVersion"
$body = @{
    tag_name = $tagName
    name = $tagName
    body = "版本 $newVersion - 包含最新功能和改进"
    draft = $false
    prerelease = $false
} | ConvertTo-Json

$headers = @{
    "Authorization" = "token $GH_TOKEN"
    "Accept" = "application/vnd.github+json"
}

$release = Invoke-RestMethod -Uri $releaseUrl -Method POST -Headers $headers -Body $body -ContentType "application/json"
$releaseId = $release.id
$uploadUrl = $release.upload_url -replace '\{\?name,label\}', ''

Write-Host "Release 创建成功: https://github.com/$OWNER/$REPO/releases/tag/$tagName" -ForegroundColor Green

# 上传安装包
$fileName = [System.IO.Path]::GetFileName($installer.FullName)
$fileBytes = [System.IO.File]::ReadAllBytes($installer.FullName)

$uploadHeaders = @{
    "Authorization" = "token $GH_TOKEN"
    "Content-Type" = "application/octet-stream"
    "Accept" = "application/vnd.github+json"
}

$uploadUri = "https://uploads.github.com/repos/$OWNER/$REPO/releases/$releaseId/assets?name=$fileName"
$asset = Invoke-RestMethod -Uri $uploadUri -Method POST -Headers $uploadHeaders -Body $fileBytes

Write-Host ""
Write-Host "=== 发布完成! ===" -ForegroundColor Cyan
Write-Host "Release: https://github.com/$OWNER/$REPO/releases/tag/$tagName" -ForegroundColor Green
Write-Host "下载: $($asset.browser_download_url)" -ForegroundColor Green
Write-Host ""
Write-Host "用户可以通过应用自动检测并更新到新版本!" -ForegroundColor Cyan
