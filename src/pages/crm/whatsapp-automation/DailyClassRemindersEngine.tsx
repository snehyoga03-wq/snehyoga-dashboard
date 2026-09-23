import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Clock, Send, HeartPulse, CheckCircle2, AlertTriangle, ShieldCheck, Zap } from "lucide-react";
import { WhatsAppConfig, sendMetaMessage } from "@/services/whatsappAutomationService";
import { supabase } from "@/integrations/supabase/client";

interface DailyClassRemindersEngineProps {
  crmUsers: any[];
  config: WhatsAppConfig;
}

export const DailyClassRemindersEngine: React.FC<DailyClassRemindersEngineProps> = ({ crmUsers, config }) => {
  const { toast } = useToast();
  const [isDispatchingBatch, setIsDispatchingBatch] = useState<string | null>(null);
  const [isHealthChecking, setIsHealthChecking] = useState(false);
  const [adminReportPhone, setAdminReportPhone] = useState("919145414083");

  const todayDay = new Date().getDay(); // 0 is Sunday, 6 is Saturday
  const isWeekend = todayDay === 0 || todayDay === 6;

  // Batch schedules
  const batchSlots = [
    { id: "6am", label: "Morning Batch", time: "6:00 AM – 7:00 AM", match: "6" },
    { id: "11am", label: "Mid-Day Batch", time: "11:00 AM – 12:00 PM", match: "11" },
    { id: "4pm", label: "Evening Batch", time: "4:00 PM – 5:00 PM", match: "4" }
  ];

  const handleDispatchBatch = async (slotId: string, match: string, label: string) => {
    if (isWeekend) {
      toast({
        title: "Weekend Skipped 🌿",
        description: "Live class batches are scheduled Mon-Fri only. Weekend rest is observed."
      });
      return;
    }

    // Filter active users for this batch
    const batchUsers = (crmUsers || []).filter(
      (u) =>
        (u.batch_timing || "").includes(match) &&
        !u.subscription_paused &&
        (u.days_left || 0) > 0
    );

    if (batchUsers.length === 0) {
      toast({
        title: "No Active Members",
        description: `No active paid members assigned to ${label} currently.`,
        variant: "destructive"
      });
      return;
    }

    setIsDispatchingBatch(slotId);
    toast({
      title: "Dispatching Class Reminders 🚀",
      description: `Sending personalized links to ${batchUsers.length} students in ${label}...`
    });

    let sent = 0;
    for (const u of batchUsers) {
      const phone = u.mobile_number || u.phone;
      const name = u.name || "Student";
      const personalLink = `https://yoga.snehyoga.com/live?u=${phone}`;

      const text = `🧘 *Snehyoga Daily Class Reminder*\n\nNamaste ${name}! Your ${label} starts in 20 minutes.\n\n🔗 *Click to join live class:*\n${personalLink}\n\nHave your yoga mat ready. See you on the mat! 🙏`;

      await sendMetaMessage({
        config,
        to: phone,
        type: "text",
        textBody: text,
        userName: name
      });
      sent++;
    }

    setIsDispatchingBatch(null);
    toast({
      title: "Reminders Sent ✅",
      description: `Dispatched personalized class links to ${sent} students in ${label}!`
    });
  };

  const handleHealthCheckAndAlert = async () => {
    setIsHealthChecking(true);
    try {
      // 1. Check queue stats
      const { count: pendingCount } = await supabase
        .from("message_queue")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");

      const { count: failedCount } = await supabase
        .from("message_queue")
        .select("*", { count: "exact", head: true })
        .eq("status", "failed");

      const activeMemberCount = (crmUsers || []).filter(
        (u) => !u.subscription_paused && (u.days_left || 0) > 0
      ).length;

      const healthStatus = (failedCount || 0) > 5 ? "WARNING" : "OPTIMAL";

      // 2. Dispatch Admin WhatsApp Report
      const reportMessage = `📊 *Snehyoga WhatsApp Engine Health Report*\n\n• *System Health*: ${healthStatus === "OPTIMAL" ? "✅ All Systems Operational" : "⚠️ Attention Needed"}\n• *Active Students*: ${activeMemberCount}\n• *Queue Pending*: ${pendingCount || 0}\n• *Failed Messages*: ${failedCount || 0}\n• *Weekend State*: ${isWeekend ? "Weekend (Paused)" : "Weekday (Active Mon-Fri)"}\n\nGenerated: ${new Date().toLocaleTimeString("en-IN")}`;

      if (adminReportPhone) {
        await sendMetaMessage({
          config,
          to: adminReportPhone,
          type: "text",
          textBody: reportMessage,
          userName: "Admin"
        });
      }

      toast({
        title: "Health Check Complete ✅",
        description: `Engine status: ${healthStatus}. WhatsApp report dispatched to ${adminReportPhone}`
      });
    } catch (err: any) {
      toast({ title: "Health Check Error", description: err.message, variant: "destructive" });
    } finally {
      setIsHealthChecking(false);
    }
  };

  return (
    <Card className="border border-slate-200/80 shadow-sm bg-white overflow-hidden">
      <CardHeader className="bg-slate-50 border-b border-slate-100 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-slate-900">
                Daily Class Reminders Engine (Mon-Fri)
              </CardTitle>
              <p className="text-xs text-slate-500">
                Automated schedule dispatch with personalized student attendance links & queue health
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
              isWeekend
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-emerald-50 text-emerald-700 border-emerald-200"
            }`}>
              {isWeekend ? "Weekend Rest (Skipping)" : "Weekday Active (Mon-Fri)"}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* 3 Class Batch Slot Dispatchers */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {batchSlots.map((b) => {
            const count = (crmUsers || []).filter(
              (u) =>
                (u.batch_timing || "").includes(b.match) &&
                !u.subscription_paused &&
                (u.days_left || 0) > 0
            ).length;

            const isBusy = isDispatchingBatch === b.id;

            return (
              <div
                key={b.id}
                className="p-4 rounded-2xl border border-slate-200 hover:border-emerald-300 bg-slate-50/60 flex flex-col justify-between space-y-3 transition-all"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">{b.label}</span>
                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      {count} students
                    </span>
                  </div>
                  <p className="text-xs font-mono text-slate-500 mt-1 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" /> {b.time}
                  </p>
                </div>

                <Button
                  size="sm"
                  onClick={() => handleDispatchBatch(b.id, b.match, b.label)}
                  disabled={isBusy}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm"
                >
                  {isBusy ? <Zap className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1" />}
                  Dispatch {b.label}
                </Button>
              </div>
            );
          })}
        </div>

        {/* Health Check & Alert Section */}
        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
          <div className="space-y-0.5">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <HeartPulse className="w-4 h-4 text-rose-500" />
              Engine Health Check & Admin WhatsApp Alert
            </h4>
            <p className="text-[11px] text-slate-500">
              Evaluates queue latency, retry dead-letters, and transmits an instant diagnostics report
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
              type="text"
              placeholder="Admin Mobile"
              value={adminReportPhone}
              onChange={(e) => setAdminReportPhone(e.target.value)}
              className="h-9 px-3 text-xs font-mono rounded-lg border border-slate-300 w-36 bg-white"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={handleHealthCheckAndAlert}
              disabled={isHealthChecking}
              className="border-indigo-300 text-indigo-700 hover:bg-indigo-50 font-semibold text-xs h-9 shrink-0"
            >
              {isHealthChecking ? "Analyzing..." : "Health Check & Alert"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
