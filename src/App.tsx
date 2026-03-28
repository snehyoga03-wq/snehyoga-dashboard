import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Referral from "./pages/Referral";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import CRM from "./pages/CRM";
import FollowUp from "./pages/FollowUp";
import NotFound from "./pages/NotFound";
import ReferralRedirect from "./pages/ReferralRedirect";
import SessionRedirect from "./pages/SessionRedirect";
import SAP from "./pages/SAP";

const queryClient = new QueryClient();

const MobileLayout = ({ children }: { children: React.ReactNode }) => (
  <div className="max-w-md mx-auto bg-background">
    {children}
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MobileLayout><Index /></MobileLayout>} />
          <Route path="/ref=:code" element={<ReferralRedirect />} />
          <Route path="/signup" element={<MobileLayout><Signup /></MobileLayout>} />
          <Route path="/signup/:referralCode" element={<MobileLayout><Signup /></MobileLayout>} />
          <Route path="/login" element={<MobileLayout><Login /></MobileLayout>} />
          <Route path="/dashboard" element={<MobileLayout><Dashboard /></MobileLayout>} />
          <Route path="/referral" element={<MobileLayout><Referral /></MobileLayout>} />
          <Route path="/followup" element={<MobileLayout><FollowUp /></MobileLayout>} />
          <Route path="/crm" element={<CRM />} />
          <Route path="/live" element={<SessionRedirect />} />
          <Route path="/sap" element={<SAP />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<MobileLayout><NotFound /></MobileLayout>} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
