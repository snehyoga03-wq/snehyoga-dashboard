# test-webhook.ps1
# Sends a fake Razorpay payment.captured webhook to the Supabase Edge Function.
# Run:  .\test-webhook.ps1

$webhookUrl = "https://bzqwaxqzggejpejyxhde.supabase.co/functions/v1/razorpay-webhook"

# ---- Test user details ----
# Amount 39900 paise = Rs.399 => 1 Month plan (30 days)
$payload = @{
    event   = "payment.captured"
    payload = @{
        payment = @{
            entity = @{
                id       = "pay_TEST_$(Get-Random -Maximum 99999)"
                amount   = 39900
                currency = "INR"
                contact  = "9876543210"
                email    = "testuser@example.com"
                notes    = @{
                    name = "Test User"
                }
            }
        }
    }
} | ConvertTo-Json -Depth 10 -Compress

Write-Host "=======================================" -ForegroundColor Cyan
Write-Host " Razorpay Webhook Test " -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host "URL     : $webhookUrl"
Write-Host "Phone   : 9876543210"
Write-Host "Amount  : Rs.399 (39900 paise) => 1 Month plan"
Write-Host "Payload : $payload"
Write-Host ""

try {
    $response = Invoke-WebRequest `
        -Uri $webhookUrl `
        -Method POST `
        -ContentType "application/json" `
        -Body $payload `
        -UseBasicParsing

    Write-Host "Status : $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Result : $($response.Content)" -ForegroundColor Green
}
catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "Status : $statusCode" -ForegroundColor Red
    Write-Host "Error  : $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "Detail : $($_.ErrorDetails.Message)" -ForegroundColor Yellow
    }
}
