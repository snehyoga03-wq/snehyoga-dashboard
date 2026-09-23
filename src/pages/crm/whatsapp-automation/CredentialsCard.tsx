import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Key, ShieldCheck, Send, CheckCircle2, AlertCircle, RefreshCw, Eye, EyeOff } from "lucide-react";
import { WhatsAppConfig, saveWhatsAppConfig, checkMetaBalance, sendMetaMessage } from "@/services/whatsappAutomationService";

interface CredentialsCardProps {
  config: WhatsAppConfig;
  onChange: (updated: WhatsAppConfig) => void;
  onRefreshTemplates?: () => void;
}

export const CredentialsCard: React.FC<CredentialsCardProps> = ({ config, onChange, onRefreshTemplates }) => {
  const { toast } = useToast();
  const [showToken, setShowToken] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCheckingBalance, setIsCheckingBalance] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testMobile, setTestMobile] = useState("919145414083");
  const [balanceInfo, setBalanceInfo] = useState<{
    displayPhoneNumber: string;
    qualityRating: string;
    messagingLimitTier: string;
    verifiedName?: string;
  } | null>(null);

  const handleSave = async () => {
    setIsSaving(true);
    const res = await saveWhatsAppConfig(config);
    setIsSaving(false);
    if (res.success) {
      toast({ title: "Credentials Saved ✅", description: res.message });
      if (onRefreshTemplates) onRefreshTemplates();
    } else {
      toast({ title: "Save Error", description: res.message, variant: "destructive" });
    }
  };

  const handleCheckBalance = async () => {
    if (!config.apiToken || !config.phoneNumberId) {
      toast({ title: "Missing Credentials", description: "Please enter API Token and Phone Number ID first.", variant: "destructive" });
      return;
    }
    setIsCheckingBalance(true);
    const res = await checkMetaBalance(config);
    setIsCheckingBalance(false);
    if (res.success && res.data) {
      setBalanceInfo(res.data);
      toast({
        title: "Meta Verified ✅",
        description: `Number: ${res.data.displayPhoneNumber} • Tier: ${res.data.messagingLimitTier} • Quality: ${res.data.qualityRating}`
      });
    } else {
      toast({ title: "Balance Check Failed", description: res.error, variant: "destructive" });
    }
  };

  const handleSendTest = async () => {
    if (!testMobile.trim()) {
      toast({ title: "Enter Mobile", description: "Please specify a recipient mobile number.", variant: "destructive" });
      return;
    }
    setIsSendingTest(true);
    const res = await sendMetaMessage({
      config,
      to: testMobile,
      type: "text",
      textBody: `🧘 Namaste from Snehyoga!\n\nThis is a verified WhatsApp Cloud API test message sent at ${new Date().toLocaleTimeString('en-IN')}.\nYour WhatsApp connection is ACTIVE and ready for bulk broadcasts!`
    });
    setIsSendingTest(false);

    if (res.success) {
      toast({ title: "Test Sent Successfully 🚀", description: `Message delivered to ${testMobile}` });
    } else {
      toast({ title: "Test Delivery Failed", description: res.error || "Meta rejection", variant: "destructive" });
    }
  };

  return (
    <Card className="border border-slate-200/80 shadow-sm bg-white overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                WhatsApp API Credentials
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Meta Cloud API v20.0
                </span>
              </CardTitle>
              <p className="text-xs text-slate-300 mt-0.5">Configure your WhatsApp Business Account (WABA) tokens & verify connectivity</p>
            </div>
          </div>
          {balanceInfo && (
            <div className="text-right hidden sm:block">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="w-3.5 h-3.5" /> Quality: {balanceInfo.qualityRating}
              </span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Token Input */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Meta Permanent User Access Token</label>
            <span className="text-[11px] text-slate-400">Bearer Token with whatsapp_business_messaging scope</span>
          </div>
          <div className="relative">
            <Input
              type={showToken ? "text" : "password"}
              placeholder="EAAUtx... (Enter System User Permanent Access Token)"
              value={config.apiToken}
              onChange={(e) => onChange({ ...config, apiToken: e.target.value })}
              className="pr-10 font-mono text-xs border-slate-200 focus-visible:ring-indigo-500"
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Triple Columns: Phone Number ID, WABA ID, Language Code */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Phone Number ID</label>
            <Input
              placeholder="e.g. 1230157110176906"
              value={config.phoneNumberId}
              onChange={(e) => onChange({ ...config, phoneNumberId: e.target.value })}
              className="text-xs font-mono border-slate-200"
            />
            <p className="text-[11px] text-slate-500">Sender Phone ID in Meta App Manager</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700">WABA Account ID</label>
            <Input
              placeholder="e.g. 1564657775051850"
              value={config.wabaId}
              onChange={(e) => onChange({ ...config, wabaId: e.target.value })}
              className="text-xs font-mono border-slate-200"
            />
            <p className="text-[11px] text-slate-500">WhatsApp Business Account ID for template syncing</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Language Code</label>
            <Input
              placeholder="en, en_US, or hi"
              value={config.languageCode}
              onChange={(e) => onChange({ ...config, languageCode: e.target.value })}
              className="text-xs font-mono border-slate-200"
            />
            <p className="text-[11px] text-slate-500">Default template locale (e.g. en, en_US)</p>
          </div>
        </div>

        {/* Action Buttons: Save Credentials & Check Meta Balance */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm transition-all"
          >
            {isSaving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
            Save Credentials
          </Button>

          <Button
            variant="outline"
            onClick={handleCheckBalance}
            disabled={isCheckingBalance}
            className="border-slate-300 text-slate-700 hover:bg-slate-50 font-medium"
          >
            {isCheckingBalance ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Check Meta Balance & Tier
          </Button>
        </div>

        {/* Live Meta Diagnostics Badge if available */}
        {balanceInfo && (
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-semibold text-slate-800">Sender: {balanceInfo.displayPhoneNumber}</span>
              {balanceInfo.verifiedName && <span className="text-slate-500">({balanceInfo.verifiedName})</span>}
            </div>
            <div className="flex items-center gap-4 text-slate-600">
              <span>Quality Rating: <strong className="text-emerald-700 uppercase">{balanceInfo.qualityRating}</strong></span>
              <span>Daily Tier: <strong className="text-indigo-700">{balanceInfo.messagingLimitTier}</strong></span>
            </div>
          </div>
        )}

        {/* Demo Test Verification Box */}
        <div className="pt-4 border-t border-slate-100">
          <div className="bg-indigo-50/60 rounded-xl p-4 border border-indigo-100 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-950">Instant Connection Demo Test</span>
              </div>
              <span className="text-[11px] text-indigo-600 font-medium">Sends immediate verification ping</span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Input
                  placeholder="Recipient Mobile (e.g. 919145414083)"
                  value={testMobile}
                  onChange={(e) => setTestMobile(e.target.value)}
                  className="bg-white border-indigo-200 text-xs font-mono focus-visible:ring-indigo-500"
                />
              </div>
              <Button
                variant="default"
                onClick={handleSendTest}
                disabled={isSendingTest}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shrink-0 shadow-sm"
              >
                {isSendingTest ? <RefreshCw className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-2" />}
                Send Test Message
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
