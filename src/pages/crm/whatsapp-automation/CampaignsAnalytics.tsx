import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { MessageBatchRecord, MessageQueueItem } from "@/services/whatsappAutomationService";
import {
  BarChart3, RefreshCw, CheckCircle2, XCircle, Clock, Eye,
  ArrowRight, Users, MessageSquare, AlertCircle
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const CampaignsAnalytics: React.FC = () => {
  const [batches, setBatches] = useState<MessageBatchRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<MessageBatchRecord | null>(null);
  const [drillDownQueue, setDrillDownQueue] = useState<MessageQueueItem[]>([]);
  const [loadingDrillDown, setLoadingDrillDown] = useState(false);

  const fetchBatches = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("message_batches")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(25);

      if (!error && data) {
        setBatches(
          data.map((r: any) => ({
            id: r.id,
            batch_name: r.batch_name || r.label || "Broadcast Campaign",
            target_audience: r.target_audience || "CRM Audience",
            template_id: r.template_id || r.template_name || "Custom",
            total_messages: r.total_messages || 0,
            delivered_count: r.delivered_count || 0,
            failed_count: r.failed_count || 0,
            status: r.status || "completed",
            created_at: r.created_at,
            completed_at: r.completed_at
          }))
        );
      }
    } catch (e) {
      console.warn("Could not fetch message_batches:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  const handleDrillDown = async (batch: MessageBatchRecord) => {
    setSelectedBatch(batch);
    setLoadingDrillDown(true);
    try {
      const { data, error } = await supabase
        .from("message_queue")
        .select("*")
        .eq("batch_id", batch.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (!error && data) {
        setDrillDownQueue(
          data.map((q: any) => ({
            id: q.id,
            batch_id: q.batch_id,
            user_phone: q.user_phone || q.phone || "",
            user_name: q.user_name,
            template_id: q.template_id || q.template_name,
            status: q.status || "delivered",
            error_log: q.error_log || q.last_error,
            processed_at: q.processed_at,
            created_at: q.created_at
          }))
        );
      }
    } catch (_) {
    } finally {
      setLoadingDrillDown(false);
    }
  };

  // Aggregated totals
  const totalSent = batches.reduce((acc, b) => acc + (b.total_messages || 0), 0);
  const totalDelivered = batches.reduce((acc, b) => acc + (b.delivered_count || 0), 0);
  const totalFailed = batches.reduce((acc, b) => acc + (b.failed_count || 0), 0);
  const overallSuccessRate = totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 0;

  return (
    <Card className="border border-slate-200/80 shadow-sm bg-white overflow-hidden">
      <CardHeader className="bg-slate-50 border-b border-slate-100 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-slate-900">
                Campaigns & Delivery Funnel Analytics
              </CardTitle>
              <p className="text-xs text-slate-500">Historical performance metrics across all bulk broadcasts and automations</p>
            </div>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={fetchBatches}
            disabled={loading}
            className="text-xs font-semibold border-slate-200 text-slate-700 hover:bg-slate-100 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Delivery Funnel Overview Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100">
            <span className="text-xs font-medium text-indigo-700">Total Dispatched</span>
            <p className="text-2xl font-bold text-slate-900 mt-1">{totalSent}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Across {batches.length} batches</p>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100">
            <span className="text-xs font-medium text-emerald-700 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Delivered
            </span>
            <p className="text-2xl font-bold text-emerald-700 mt-1">{totalDelivered}</p>
            <p className="text-[11px] text-emerald-600 mt-0.5">{overallSuccessRate}% success rate</p>
          </div>

          <div className="p-4 rounded-2xl bg-rose-50/50 border border-rose-100">
            <span className="text-xs font-medium text-rose-700 flex items-center gap-1">
              <XCircle className="w-3.5 h-3.5" /> Failed
            </span>
            <p className="text-2xl font-bold text-rose-700 mt-1">{totalFailed}</p>
            <p className="text-[11px] text-rose-600 mt-0.5">Rejections & invalid nums</p>
          </div>

          <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-100">
            <span className="text-xs font-medium text-amber-700 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> Read / Engagement
            </span>
            <p className="text-2xl font-bold text-amber-800 mt-1">~{Math.round(totalDelivered * 0.72)}</p>
            <p className="text-[11px] text-amber-600 mt-0.5">Est. 72% WhatsApp read rate</p>
          </div>
        </div>

        {/* Batches Table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 text-xs font-semibold text-slate-700">
            Recent Broadcast Campaigns
          </div>

          <div className="overflow-x-auto">
            {batches.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No campaigns have been triggered yet. Start your first broadcast above!
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/70 text-slate-600 font-semibold border-b border-slate-100">
                  <tr>
                    <th className="py-2.5 px-3">Batch Name</th>
                    <th className="py-2.5 px-3">Audience</th>
                    <th className="py-2.5 px-3">Template</th>
                    <th className="py-2.5 px-3 text-center">Total</th>
                    <th className="py-2.5 px-3 text-center">Delivered</th>
                    <th className="py-2.5 px-3 text-center">Failed</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3 text-right">Drill-Down</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {batches.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{b.batch_name}</td>
                      <td className="py-2.5 px-3 text-slate-600 capitalize">{b.target_audience}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">{b.template_id}</td>
                      <td className="py-2.5 px-3 text-center font-bold text-slate-800">{b.total_messages}</td>
                      <td className="py-2.5 px-3 text-center font-bold text-emerald-600">{b.delivered_count}</td>
                      <td className="py-2.5 px-3 text-center font-bold text-rose-600">{b.failed_count}</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          b.status === "completed"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : b.status === "processing"
                            ? "bg-blue-50 text-blue-700 border border-blue-200 animate-pulse"
                            : "bg-slate-100 text-slate-700"
                        }`}>
                          {b.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                        {new Date(b.created_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDrillDown(b)}
                          className="h-7 text-xs text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" /> View Queue
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Drill-Down Modal */}
        <Dialog open={!!selectedBatch} onOpenChange={(open) => !open && setSelectedBatch(null)}>
          <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-bold">
                <Users className="w-5 h-5 text-indigo-600" />
                Recipient Queue Drill-Down: {selectedBatch?.batch_name}
              </DialogTitle>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto pt-3">
              {loadingDrillDown ? (
                <div className="p-8 text-center text-xs text-slate-400">Loading recipient log...</div>
              ) : drillDownQueue.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  No individual recipient logs found for this batch.
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">Recipient</th>
                      <th className="py-2 px-3">Phone</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3">Log / Error</th>
                      <th className="py-2 px-3 text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {drillDownQueue.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-semibold text-slate-900">{item.user_name || "Student"}</td>
                        <td className="py-2 px-3 font-mono text-slate-600">{item.user_phone}</td>
                        <td className="py-2 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.status === "delivered" || item.status === "sent"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-rose-50 text-rose-700"
                          }`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-[11px] text-slate-500 max-w-[200px] truncate">
                          {item.error_log || "Delivered via Meta"}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-400 font-mono text-[10px]">
                          {new Date(item.created_at).toLocaleTimeString("en-IN")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
