import { useState } from "react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Shield, Phone, User, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatPhone } from "@/lib/utils";

interface SAPLoginFormProps {
  onOTPSent: (phone: string, name: string) => void;
  onAccessDenied: (reason: string) => void;
}

export const SAPLoginForm = ({ onOTPSent, onAccessDenied }: SAPLoginFormProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !phone.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter both your name and mobile number.",
        variant: "destructive",
      });
      return;
    }

    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      toast({
        title: "Invalid Phone Number",
        description: "Please enter a valid 10-digit mobile number.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const normalizedPhone = formatPhone(phone);

      // Check if user exists in main_data_registration with 12-month plan
      const { data: userData, error: dbError } = await supabase
        .from("main_data_registration")
        .select("name, mobile_number, subscription_plan, days_left")
        .eq("mobile_number", normalizedPhone)
        .maybeSingle();

      if (dbError) throw dbError;

      if (!userData) {
        onAccessDenied("no_account");
        return;
      }

      // Check if user has 12-month subscription
      const plan = (userData.subscription_plan || "").toLowerCase().replace(/[\s_-]/g, "");
      const is12Month = plan.includes("12month") || plan.includes("12months") || plan === "yearly";

      if (!is12Month) {
        onAccessDenied("not_12_month");
        return;
      }

      // Send OTP via Supabase Phone Auth (Twilio)
      const phoneForAuth = normalizedPhone.startsWith("+")
        ? normalizedPhone
        : `+91${cleanPhone}`;

      const { error: otpError } = await supabase.auth.signInWithOtp({
        phone: phoneForAuth,
      });

      if (otpError) throw otpError;

      toast({
        title: "OTP Sent! 📱",
        description: `Verification code sent to +91 ${cleanPhone.slice(-4).padStart(10, '•')}`,
      });

      onOTPSent(phoneForAuth, userData.name || name);
    } catch (error: any) {
      console.error("SAP Login Error:", error);
      toast({
        title: "Error",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="w-full max-w-md mx-auto"
    >
      {/* Header */}
      <div className="text-center mb-8">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/30 mb-4"
        >
          <Shield className="w-10 h-10 text-white" />
        </motion.div>
        <h1 className="text-2xl font-bold text-foreground mb-1">
          Snehyoga Access Portal
        </h1>
        <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          Exclusive for 12-Month Premium Members
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
        </p>
      </div>

      {/* Login Card */}
      <div className="relative">
        <div className="absolute -inset-1 bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-amber-500/20 rounded-2xl blur-xl" />

        <div className="relative bg-card/80 backdrop-blur-xl border border-amber-500/20 rounded-2xl p-6 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <User className="w-4 h-4 text-amber-500" />
                Full Name
              </label>
              <Input
                id="sap-name"
                type="text"
                placeholder="Enter your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="h-12 bg-background/50 border-amber-500/20 focus:border-amber-500/50 focus:ring-amber-500/30 rounded-xl transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <Phone className="w-4 h-4 text-amber-500" />
                Mobile Number
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
                  +91
                </span>
                <Input
                  id="sap-phone"
                  type="tel"
                  placeholder="9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  required
                  maxLength={10}
                  className="h-12 pl-12 bg-background/50 border-amber-500/20 focus:border-amber-500/50 focus:ring-amber-500/30 rounded-xl transition-all"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading || !name.trim() || phone.length < 10}
              className="w-full h-12 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold rounded-xl shadow-lg shadow-amber-500/25 transition-all duration-300 hover:shadow-amber-500/40 hover:scale-[1.02] active:scale-[0.98]"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Verifying...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Send OTP
                </span>
              )}
            </Button>
          </form>

          <p className="text-xs text-muted-foreground text-center mt-4">
            You'll receive a verification code on your registered mobile number
          </p>
        </div>
      </div>
    </motion.div>
  );
};
