# send-test.ps1 - uses .NET WebClient to avoid proxy issues
$url = "https://bzqwaxqzggejpejyxhde.supabase.co/functions/v1/razorpay-webhook"
$body = '{"event":"payment.captured","payload":{"payment":{"entity":{"id":"pay_test_001","amount":39900,"currency":"INR","contact":"9876543210","email":"testuser@example.com","notes":{"name":"Test User"}}}}}'

$wc = New-Object System.Net.WebClient
$wc.Headers.Add("Content-Type", "application/json")

try {
    $response = $wc.UploadString($url, "POST", $body)
    Write-Host "SUCCESS:" -ForegroundColor Green
    Write-Host $response -ForegroundColor Green
}
catch [System.Net.WebException] {
    $stream = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    $errBody = $reader.ReadToEnd()
    Write-Host "HTTP Error: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    Write-Host "Body: $errBody" -ForegroundColor Yellow
}
catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}
