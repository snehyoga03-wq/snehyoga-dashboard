@echo off
echo Sending test webhook...
curl -s -X POST "https://bzqwaxqzggejpejyxhde.supabase.co/functions/v1/razorpay-webhook" ^
  -H "Content-Type: application/json" ^
  -d "{\"event\":\"payment.captured\",\"payload\":{\"payment\":{\"entity\":{\"id\":\"pay_test_001\",\"amount\":39900,\"currency\":\"INR\",\"contact\":\"9876543210\",\"email\":\"testuser@example.com\",\"notes\":{\"name\":\"Test User\"}}}}}"
echo.
echo Done.
