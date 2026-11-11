# REQ-016 A9: write the store sub-category labels (and four category corrections) from store-labels-20261111.json
# through the inventory API on this PC. Each change is audit-logged; running it again changes nothing.
# Run after the new version is started:  powershell -ExecutionPolicy Bypass -File .\scripts\req-016\import-store-labels.ps1
param([string]$Api = 'http://localhost:3100/api/v1', [int]$StoreId = 1)
$data = Get-Content -Raw -Encoding UTF8 (Join-Path $PSScriptRoot 'store-labels-20261111.json') | ConvertFrom-Json
Write-Host "Labels: $($data.labels.Count)  Category corrections: $($data.categories.Count)  Store: $StoreId"
$user = Read-Host 'Admin username'
$pass = Read-Host 'Admin password' -AsSecureString
$plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($pass))
$send = { param($path, $body, $token)
  $headers = @{}; if ($token) { $headers.Authorization = "Bearer $token" }
  Invoke-RestMethod -Method Post -Uri "$Api$path" -Headers $headers -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes(($body | ConvertTo-Json)))
}
$token = (& $send '/auth/login' @{ username = $user; password = $plain } $null).data.accessToken
$ok = 0; $fail = 0
foreach ($row in $data.labels) {
  try { & $send "/management/product-categories/label?storeId=$StoreId" @{ productId = $row.productId; label = $row.label } $token | Out-Null; $ok++ }
  catch { $fail++; Write-Host "FAIL label $($row.productId)  $($_.ErrorDetails.Message)" }
}
foreach ($row in $data.categories) {
  try { & $send "/management/product-categories/assign?storeId=$StoreId" @{ productId = $row.productId; category = $row.category } $token | Out-Null; $ok++ }
  catch { $fail++; Write-Host "FAIL category $($row.productId)  $($_.ErrorDetails.Message)" }
}
Write-Host "Done: $ok ok, $fail failed"
