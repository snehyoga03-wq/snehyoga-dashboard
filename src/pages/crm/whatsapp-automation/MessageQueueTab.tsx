import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Clock, RefreshCw, Search, CheckCircle2, AlertCircle, Send, ArrowUpRight } from "lucide-react";

export const MessageQueueTab: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("message_queue")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(150);

      if (!error && data) {
        setItems(data);
      }
    } catch (err) {
      console.warn("Error fetching message_queue:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  const filtered = items.filter((item) => {
    const phone = item.user_phone || item.phone || "";
    const name = item.user_name || "";
    const matchesSearch =
      phone.toLowerCase().includes(search.toLowerCase()) ||
      name.toLowerCase().includes(search.toLowerCase()) ||
      (item.template_name || item.template_id || "").toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const total = items.length;
  const delivered = items.filter(i => i.status === "delivered" || i.status === "read").length;
  const pending = items.filter(i => i.status === "pending" || i.status === "processing").length;
  const failed = items.filter(i => i.status === "failed").length;

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <p className="text-xs text-slate-500 font-medium">Total In Queue</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{total}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <p className="text-xs text-emerald-600 font-medium">Delivered / Read</p>
          <p className="text-xl font-bold text-emerald-600 mt-1">{delivered}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <p className="text-xs text-amber-600 font-medium">Pending / Queued</p>
          <p className="text-xl font-bold text-amber-600 mt-1">{pending}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <p className="text-xs text-rose-600 font-medium">Failed / Errors</p>
          <p className="text-xl font-bold text-rose-600 mt-1">{failed}</p>
        </div>
      </div>

      <Card className="border border-slate-200/80 shadow-sm bg-white rounded-2xl overflow-hidden">
        <CardHeader className="bg-white border-b border-slate-100 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-600" />
              Live Message Queue & Broadcast Logs
            </CardTitle>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Real-time delivery status of automated messages, template blasts, and WhatsApp alerts
            </p>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={fetchQueue}
            disabled={loading}
            className="text-xs rounded-xl h-10 px-4"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh Queue
          </Button>
        </CardHeader>

        <CardContent className="p-6 space-y-4">
          {/* Search & Status Filters */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
              {["all", "delivered", "sent", "pending", "failed"].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`text-xs capitalize px-3 py-1.5 rounded-lg border font-semibold transition-all ${
                    statusFilter === st
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search recipient phone, name..."
                className="pl-9 h-10 text-xs border-slate-200 bg-slate-50/50 rounded-xl"
              />
            </div>
          </div>

          {/* Table / List */}
          {loading && items.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">Loading queue records...</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              No messages found in the queue.
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200/80 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200/80">
                  <tr>
                    <th className="p-3">Recipient Phone</th>
                    <th className="p-3">Name</th>
                    <th className="p-3">Template / Content</th>
                    <th className="p-3">Batch</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Created At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((item) => {
                    const phone = item.user_phone || item.phone || "—";
                    const isOk = item.status === "delivered" || item.status === "read" || item.status === "sent";
                    const isFail = item.status === "failed";
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-3 font-mono font-medium text-slate-800">{phone}</td>
                        <td className="p-3 text-slate-700">{item.user_name || "—"}</td>
                        <td className="p-3 text-slate-600 font-mono text-[11px]">{item.template_name || item.template_id || "Direct Nudge"}</td>
                        <td className="p-3 text-slate-500 text-[11px]">{item.batch_label || "Broadcast"}</td>
                        <td className="p-3">
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                              isOk
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : isFail
                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}
                          >
                            {isOk ? <CheckCircle2 className="w-3 h-3" /> : isFail ? <AlertCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                            {item.status}
                          </span>
                        </td>
                        <td className="p-3 text-slate-400 text-[11px]">
                          {item.created_at ? new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

