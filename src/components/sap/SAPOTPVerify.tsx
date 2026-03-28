import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from "@/components/ui/input-otp";
import { Loader2, ArrowLeft, ShieldCheck, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SAPOTPVerifyProps {
  phone: string;
  name: string;
  onVerified: (userData: { phone: string; name: string }) => void;
  onBack: () => void;
}

export const SAPOTPVerify = ({ phone, name, onVerified, onBack }: SAPOTPVerifyProps) => {
  const { toast } = useToast();
  const [otp, setOtp] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown <= 0) {
      setCanResend(true);
      return;
    }
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleVerify = async () => {
    if (otp.length !== 6) {
      toast({
        title: "Incomplete OTP",
        description: "Please enter the full 6-digit code.",
        variant: "destructive",
      });
      return;
    }

    setIsVerifying(true);

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone,
        token: otp,
        type: "sms",
      });

      if (error) throw error;

      if (data.session) {
        toast({
          title: "Verified! ✅",
          description: "Welcome to Snehyoga Access Portal",
        });

        // Store SAP session
        const sapSession = {
          phone,
          name,
          verified: true,
          verifiedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        };
        localStorage.setItem("sap_session", JSON.stringify(sapSession));

        onVerified({ phone, name });
      }
    } catch (error: any) {
      console.error("OTP Verify Error:", error);
      toast({
        title: "Invalid OTP",
        description: error.message || "The code you entered is incorrect. Please try again.",
        variant: "destructive",
      });
      setOtp("");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone,
      });

      if (error) throw error;

      toast({
        title: "OTP Resent! 📱",
        description: "A new verification code has been sent.",
      });

      setCountdown(60);
      setCanResend(false);
      setOtp("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to resend OTP. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsResending(false);
    }
  };

  // Auto-verify when OTP is complete
  useEffect(() => {
    if (otp.length === 6) {
      handleVerify();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

  const maskedPhone = phone.replace(/(\+91)(\d{2})(\d{4})(\d{4})/, "$1 $2****$4");

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="w-full max-w-md mx-auto"
    >
      {/* Header */}
      <div className="text-center mb-8">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.15, type: "spring", stiffness: 200 }}
          className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/30 mb-4"
        >
          <ShieldCheck className="w-10 h-10 text-white" />
        </motion.div>
        <h2 className="text-2xl font-bold text-foreground mb-1">
          Enter Verification Code
        </h2>
        <p className="text-sm text-muted-foreground">
          We sent a 6-digit code to{" "}
          <span className="font-semibold text-foreground">{maskedPhone}</span>
        </p>
      </div>

      {/* OTP Input Card */}
      <div className="relative">
        <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-emerald-500/20 rounded-2xl blur-xl" />

        <div className="relative bg-card/80 backdrop-blur-xl border border-emerald-500/20 rounded-2xl p-6 shadow-2xl">
          <div className="flex justify-center mb-6">
            <InputOTP
              maxLength={6}
              value={otp}
              onChange={setOtp}
              disabled={isVerifying}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} className="w-12 h-14 text-xl font-bold border-emerald-500/30 rounded-lg" />
                <InputOTPSlot index={1} className="w-12 h-14 text-xl font-bold border-emerald-500/30 rounded-lg" />
                <InputOTPSlot index={2} className="w-12 h-14 text-xl font-bold border-emerald-500/30 rounded-lg" />
              </InputOTPGroup>
              <InputOTPSeparator />
              <InputOTPGroup>
                <InputOTPSlot index={3} className="w-12 h-14 text-xl font-bold border-emerald-500/30 rounded-lg" />
                <InputOTPSlot index={4} className="w-12 h-14 text-xl font-bold border-emerald-500/30 rounded-lg" />
                <InputOTPSlot index={5} className="w-12 h-14 text-xl font-bold border-emerald-500/30 rounded-lg" />
              </InputOTPGroup>
            </InputOTP>
          </div>

          <Button
            onClick={handleVerify}
            disabled={isVerifying || otp.length !== 6}
            className="w-full h-12 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/25 transition-all duration-300 hover:shadow-emerald-500/40 hover:scale-[1.02] active:scale-[0.98]"
          >
            {isVerifying ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Verifying...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5" />
                Verify & Continue
              </span>
            )}
          </Button>

          <div className="flex items-center justify-between mt-5">
            <button
              onClick={onBack}
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Change Number
            </button>

            {canResend ? (
              <button
                onClick={handleResend}
                disabled={isResending}
                className="text-sm text-emerald-500 hover:text-emerald-400 flex items-center gap-1 font-medium transition-colors"
              >
                {isResending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Resend OTP
              </button>
            ) : (
              <span className="text-sm text-muted-foreground">
                Resend in <span className="font-semibold text-foreground">{countdown}s</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
