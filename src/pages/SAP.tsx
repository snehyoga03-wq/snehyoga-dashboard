import { useState, useEffect, useCallback } from "react";
import { SAPLoginForm } from "@/components/sap/SAPLoginForm";
import { SAPOTPVerify } from "@/components/sap/SAPOTPVerify";
import { SAPDocumentLibrary } from "@/components/sap/SAPDocumentLibrary";
import { SAPAccessDenied } from "@/components/sap/SAPAccessDenied";
import { AnimatePresence, motion } from "framer-motion";

type SAPStep = "login" | "otp" | "denied" | "library";

interface SAPSession {
  phone: string;
  name: string;
  verified: boolean;
  verifiedAt: string;
  expiresAt: string;
}

const SAP = () => {
  const [step, setStep] = useState<SAPStep>("login");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [deniedReason, setDeniedReason] = useState("");

  // Check for existing session on mount
  useEffect(() => {
    const sessionStr = localStorage.getItem("sap_session");
    if (sessionStr) {
      try {
        const session: SAPSession = JSON.parse(sessionStr);
        const now = new Date();
        const expiresAt = new Date(session.expiresAt);

        if (session.verified && now < expiresAt) {
          setPhone(session.phone);
          setName(session.name);
          setStep("library");
        } else {
          localStorage.removeItem("sap_session");
        }
      } catch {
        localStorage.removeItem("sap_session");
      }
    }
  }, []);

  // Disable right-click globally on SAP page
  useEffect(() => {
    const handler = (e: MouseEvent) => e.preventDefault();
    document.addEventListener("contextmenu", handler);
    return () => document.removeEventListener("contextmenu", handler);
  }, []);

  // Disable keyboard shortcuts for printing/saving/copying
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        ["p", "s", "P", "S", "c", "C", "a", "A"].includes(e.key)
      ) {
        e.preventDefault();
      }
      // Disable PrintScreen
      if (e.key === "PrintScreen") {
        e.preventDefault();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const handleOTPSent = useCallback((phoneNumber: string, userName: string) => {
    setPhone(phoneNumber);
    setName(userName);
    setStep("otp");
  }, []);

  const handleAccessDenied = useCallback((reason: string) => {
    setDeniedReason(reason);
    setStep("denied");
  }, []);

  const handleVerified = useCallback(
    ({ phone: p, name: n }: { phone: string; name: string }) => {
      setPhone(p);
      setName(n);
      setStep("library");
    },
    []
  );

  const handleLogout = useCallback(() => {
    localStorage.removeItem("sap_session");
    setStep("login");
    setPhone("");
    setName("");
  }, []);

  const handleBackToLogin = useCallback(() => {
    setStep("login");
    setDeniedReason("");
  }, []);

  return (
    <div
      className="min-h-screen bg-background relative overflow-hidden select-none"
      style={{ userSelect: "none", WebkitUserSelect: "none" }}
    >
      {/* Background decorative elements — hidden when viewing library */}
      {step !== "library" && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-gradient-to-b from-amber-500/5 to-transparent blur-3xl" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-gradient-to-tr from-orange-500/5 to-transparent blur-3xl" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-gradient-to-tl from-amber-500/5 to-transparent blur-3xl" />
        </div>
      )}

      {/* Content */}
      <AnimatePresence mode="wait">
        {step === "login" && (
          <motion.div
            key="login"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10 min-h-screen flex items-center justify-center px-4 py-8"
          >
            <SAPLoginForm
              onOTPSent={handleOTPSent}
              onAccessDenied={handleAccessDenied}
            />
          </motion.div>
        )}

        {step === "otp" && (
          <motion.div
            key="otp"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10 min-h-screen flex items-center justify-center px-4 py-8"
          >
            <SAPOTPVerify
              phone={phone}
              name={name}
              onVerified={handleVerified}
              onBack={handleBackToLogin}
            />
          </motion.div>
        )}

        {step === "denied" && (
          <motion.div
            key="denied"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10 min-h-screen flex items-center justify-center px-4 py-8"
          >
            <SAPAccessDenied
              reason={deniedReason}
              onBack={handleBackToLogin}
            />
          </motion.div>
        )}

        {step === "library" && (
          <motion.div
            key="library"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10"
          >
            <SAPDocumentLibrary userName={name} onLogout={handleLogout} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SAP;
