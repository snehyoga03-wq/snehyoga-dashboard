import { motion } from "framer-motion";
import { ShieldX, Lock, ArrowLeft, Crown, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SAPAccessDeniedProps {
  reason: "no_account" | "not_12_month" | string;
  onBack: () => void;
}

export const SAPAccessDenied = ({ reason, onBack }: SAPAccessDeniedProps) => {
  const isNoAccount = reason === "no_account";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="w-full max-w-md mx-auto text-center"
    >
      {/* Animated Lock Icon */}
      <motion.div
        initial={{ y: -20, rotate: -10 }}
        animate={{ y: 0, rotate: 0 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 150 }}
        className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-br from-red-500/15 to-rose-500/15 border border-red-500/20 mb-6"
      >
        <motion.div
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          {isNoAccount ? (
            <ShieldX className="w-12 h-12 text-red-500" />
          ) : (
            <Lock className="w-12 h-12 text-red-500" />
          )}
        </motion.div>
      </motion.div>

      {/* Title */}
      <h2 className="text-2xl font-bold text-foreground mb-2">
        {isNoAccount ? "Account Not Found" : "Access Restricted"}
      </h2>

      {/* Card */}
      <div className="relative mt-6">
        <div className="absolute -inset-1 bg-gradient-to-r from-red-500/10 via-rose-500/10 to-red-500/10 rounded-2xl blur-xl" />

        <div className="relative bg-card/80 backdrop-blur-xl border border-red-500/20 rounded-2xl p-6 shadow-2xl">
          {isNoAccount ? (
            <>
              <div className="flex items-center justify-center gap-2 mb-4 text-red-500">
                <AlertTriangle className="w-5 h-5" />
                <span className="font-medium">No Registration Found</span>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed">
                We couldn't find your mobile number in our system.
                The <strong>Snehyoga Access Portal</strong> is exclusively
                available for registered 12-month premium subscribers.
              </p>
              <div className="mt-5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <p className="text-xs text-amber-600 font-medium">
                  💡 If you believe this is an error, please contact Sneha Yoga support
                  with your registered mobile number.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-center gap-2 mb-4 text-amber-500">
                <Crown className="w-5 h-5" />
                <span className="font-medium">Premium Access Only</span>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed">
                The <strong>Snehyoga Access Portal</strong> is exclusively available
                for our <span className="text-amber-500 font-semibold">12-month premium</span> subscribers.
              </p>
              <p className="text-muted-foreground text-sm mt-3">
                Your current subscription plan does not include portal access.
                Upgrade to the 12-month plan to unlock all premium documents
                and resources.
              </p>
              <div className="mt-5 p-4 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20">
                <p className="text-sm font-semibold text-foreground mb-1">
                  🌟 Why Upgrade to 12 Months?
                </p>
                <ul className="text-xs text-muted-foreground space-y-1 text-left">
                  <li>✅ Full access to SAP document library</li>
                  <li>✅ Advanced yoga guides & workbooks</li>
                  <li>✅ Personalized diet & nutrition plans</li>
                  <li>✅ Best value — save up to 40%</li>
                </ul>
              </div>
            </>
          )}

          {/* Back Button */}
          <Button
            onClick={onBack}
            variant="outline"
            className="w-full mt-6 h-11 border-border/50 hover:border-amber-500/30 rounded-xl transition-all"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    </motion.div>
  );
};
