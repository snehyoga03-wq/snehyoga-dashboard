import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

// SessionRedirect is eagerly loaded — it's the critical fast path for personal links
import SessionRedirect from "./pages/SessionRedirect";

// All other pages are lazy-loaded to reduce initial bundle size
const Index = lazy(() => import("./pages/Index"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Referral = lazy(() => import("./pages/Referral"));
const Signup = lazy(() => import("./pages/Signup"));
const Login = lazy(() => import("./pages/Login"));
const CRM = lazy(() => import("./pages/CRM"));
const FollowUp = lazy(() => import("./pages/FollowUp"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ReferralRedirect = lazy(() => import("./pages/ReferralRedirect"));
const SAP = lazy(() => import("./pages/SAP"));

const queryClient = new QueryClient();

const MobileLayout = ({ children }: { children: React.ReactNode }) => (
  <div className="max-w-md mx-auto bg-background">
    {children}
  </div>
);

// Minimal spinner fallback for lazy-loaded pages
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
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
            <Route path="/:slug" element={<SessionRedirect />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<MobileLayout><NotFound /></MobileLayout>} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
