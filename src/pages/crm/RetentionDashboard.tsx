import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { HeartPulse, Users, AlertTriangle, Clock, TrendingUp, Search, RefreshCw, ChevronDown, Bell, Settings, ClipboardList, Eye, UserCheck, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const STATE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  JUST_JOINED: { label: "Just Joined", color: "text-blue-700", bg: "bg-blue-100", icon: "🆕" },
  ONBOARDING: { label: "Onboarding", color: "text-indigo-700", bg: "bg-indigo-100", icon: "📋" },
  ACTIVATED: { label: "Activated", color: "text-teal-700", bg: "bg-teal-100", icon: "✅" },
  EARLY_RHYTHM: { label: "Early Rhythm", color: "text-green-700", bg: "bg-green-100", icon: "🌱" },
  ACTIVE_CORE: { label: "Active Core", color: "text-emerald-700", bg: "bg-emerald-100", icon: "💪" },
  INCONSISTENT: { label: "Inconsistent", color: "text-amber-700", bg: "bg-amber-100", icon: "⚠️" },
  AT_RISK: { label: "At Risk", color: "text-orange-700", bg: "bg-orange-100", icon: "🔥" },
  EXPIRING_SOON: { label: "Expiring Soon", color: "text-red-700", bg: "bg-red-100", icon: "⏰" },
  RENEWED_MONTHLY: { label: "Renewed Monthly", color: "text-blue-700", bg: "bg-blue-100", icon: "🔄" },
  YEARLY: { label: "Yearly", color: "text-purple-700", bg: "bg-purple-100", icon: "⭐" },
  EXPIRED: { label: "Expired", color: "text-gray-700", bg: "bg-gray-200", icon: "❌" },
  LOYAL_MEMBER: { label: "Loyal Member", color: "text-yellow-700", bg: "bg-yellow-100", icon: "👑" },
};

function StateBadge({ state }: { state: string }) {
  const cfg = STATE_CONFIG[state] || { label: state, color: "text-gray-700", bg: "bg-gray-100", icon: "❓" };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.color}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

type Tab = "health" | "users" | "outreach" | "notifications" | "config";

export function RetentionDashboard() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("health");
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
  const [outreachItems, setOutreachItems] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [flowConfigs, setFlowConfigs] = useState<any[]>([]);
  const [isRunningEngine, setIsRunningEngine] = useState(false);
  const [outreachNotes, setOutreachNotes] = useState("");
  const [outreachAssign, setOutreachAssign] = useState("");
  const [editingOutreach, setEditingOutreach] = useState<string | null>(null);
  const [newAssignee, setNewAssignee] = useState("");
  const [showAddAssignee, setShowAddAssignee] = useState(false);
  const [assignees] = useState(["Prathm", "Gaurav sir"]);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [usersRes, outreachRes, notifRes, configRes] = await Promise.all([
        supabase.from("main_data_registration").select("id, name, mobile_number, created_at, days_left, subscription_plan, subscription_paused, batch_timing, lifecycle_state, is_activated, is_loyal_member, total_sessions, sessions_last_30d, sessions_last_14d, first_session_at, last_session_at, state_updated_at").order("created_at", { ascending: false }),
        supabase.from("retention_outreach_queue").select("*").order("created_at", { ascending: false }).limit(100),
        supabase.from("retention_notification_log").select("*").order("created_at", { ascending: false }).limit(200),
        supabase.from("retention_flow_config").select("*").order("trigger_code"),
      ]);
      setUsers(usersRes.data || []);
      setOutreachItems(outreachRes.data || []);
      setNotifications(notifRes.data || []);
      setFlowConfigs(configRes.data || []);
    } catch (e) {
      console.error("Retention fetch error:", e);
    } finally {
      setLoading(false);
    }
  };

  const runStateEngine = async () => {
    setIsRunningEngine(true);
    try {
      const { data, error } = await supabase.functions.invoke("compute-retention-states", { body: {} });
      if (error) throw error;
      toast({ title: "State Engine Complete", description: `Processed ${data?.processed || 0} users, ${data?.stateChanges || 0} state changes` });
      fetchAll();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsRunningEngine(false);
    }
  };

  const toggleFlow = async (triggerCode: string, enabled: boolean) => {
    await supabase.from("retention_flow_config").update({ enabled: !enabled, updated_at: new Date().toISOString() }).eq("trigger_code", triggerCode);
    setFlowConfigs(prev => prev.map(f => f.trigger_code === triggerCode ? { ...f, enabled: !enabled } : f));
    toast({ title: `Flow ${!enabled ? "Enabled" : "Disabled"}`, description: triggerCode });
  };

  const updateOutreach = async (id: string, status: string) => {
    const updates: any = { status, updated_at: new Date().toISOString() };
    if (status === "deferred") updates.deferred_until = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from("retention_outreach_queue").update(updates).eq("id", id);
    setOutreachItems(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o));
    toast({ title: "Updated", description: `Marked as ${status}` });
  };

  const assignOutreach = async (id: string, assignee: string) => {
    await supabase.from("retention_outreach_queue").update({ assigned_to: assignee, updated_at: new Date().toISOString() }).eq("id", id);
    setOutreachItems(prev => prev.map(o => o.id === id ? { ...o, assigned_to: assignee } : o));
    setEditingOutreach(null);
  };

  // Computed metrics
  const activeUsers = users.filter(u => (u.days_left || 0) > 0 && !u.subscription_paused);
  const stateCounts: Record<string, number> = {};
  users.forEach(u => { const s = u.lifecycle_state || "JUST_JOINED"; stateCounts[s] = (stateCounts[s] || 0) + 1; });
  const atRiskCount = stateCounts["AT_RISK"] || 0;
  const expiringCount = stateCounts["EXPIRING_SOON"] || 0;
  const expiredCount = stateCounts["EXPIRED"] || 0;
  const joinedLast30 = users.filter(u => { const d = new Date(u.created_at); return (Date.now() - d.getTime()) <= 30 * 24 * 60 * 60 * 1000; });
  const activatedIn7d = joinedLast30.filter(u => u.is_activated).length;
  const activationRate = joinedLast30.length > 0 ? Math.round((activatedIn7d / joinedLast30.length) * 100) : 0;
  const maxState = Math.max(...Object.values(stateCounts), 1);

  const filteredUsers = users.filter(u => {
    const matchesSearch = !search || (u.name || "").toLowerCase().includes(search.toLowerCase()) || (u.mobile_number || "").includes(search);
    const matchesState = stateFilter === "all" || u.lifecycle_state === stateFilter;
    return matchesSearch && matchesState;
  });

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: "health", label: "Health Overview", icon: HeartPulse },
    { id: "users", label: "Lifecycle View", icon: Users },
    { id: "outreach", label: "Outreach Queue", icon: ClipboardList },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "config", label: "Flow Config", icon: Settings },
  ];

  return (
    <motion.div key="retention" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><HeartPulse className="text-rose-500" /> User Retention OS</h1>
          <p className="text-sm text-gray-500 mt-1">Monitor lifecycle states, engagement, and automated retention flows</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}><RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh</Button>
          <Button size="sm" className="bg-rose-600 hover:bg-rose-700 text-white" onClick={runStateEngine} disabled={isRunningEngine}>{isRunningEngine ? "Running..." : "⚡ Run State Engine"}</Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === t.id ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* TAB: Health Overview */}
      {activeTab === "health" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Active Users", value: activeUsers.length, color: "from-emerald-500 to-green-600", icon: "👥" },
              { label: "At Risk", value: atRiskCount, color: "from-orange-500 to-red-500", icon: "🔥" },
              { label: "Expiring (7d)", value: expiringCount, color: "from-amber-500 to-orange-500", icon: "⏰" },
              { label: "Activation Rate", value: `${activationRate}%`, color: "from-blue-500 to-indigo-600", icon: "🚀" },
            ].map((m, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
                <Card className="border-none shadow-md overflow-hidden">
                  <div className={`h-1.5 bg-gradient-to-r ${m.color}`} />
                  <CardContent className="pt-4 pb-4">
                    <p className="text-sm text-gray-500 font-medium">{m.icon} {m.label}</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">{m.value}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* State Distribution */}
          <Card className="border-none shadow-md">
            <CardHeader><CardTitle className="text-base">Lifecycle State Distribution</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(stateCounts).sort((a, b) => b[1] - a[1]).map(([state, count]) => {
                const cfg = STATE_CONFIG[state] || { label: state, bg: "bg-gray-100", color: "text-gray-700" };
                return (
                  <div key={state} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{cfg.label}</span>
                      <span className="text-gray-600 font-semibold">{count}</span>
                    </div>
                    <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${(count / maxState) * 100}%` }} transition={{ duration: 0.6 }}
                        className={`h-full rounded-full ${cfg.bg.replace("100", "400").replace("200", "400")}`} style={{ backgroundColor: cfg.color.includes("emerald") ? "#34d399" : cfg.color.includes("red") ? "#f87171" : cfg.color.includes("amber") ? "#fbbf24" : cfg.color.includes("orange") ? "#fb923c" : cfg.color.includes("blue") ? "#60a5fa" : cfg.color.includes("green") ? "#4ade80" : cfg.color.includes("purple") ? "#a78bfa" : cfg.color.includes("teal") ? "#2dd4bf" : cfg.color.includes("indigo") ? "#818cf8" : "#9ca3af" }} />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Quick Stats Row */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="border-none shadow-sm"><CardContent className="pt-4 text-center">
              <p className="text-sm text-gray-500">Expired Users</p>
              <p className="text-2xl font-bold text-gray-400">{expiredCount}</p>
            </CardContent></Card>
            <Card className="border-none shadow-sm"><CardContent className="pt-4 text-center">
              <p className="text-sm text-gray-500">Pending Outreach</p>
              <p className="text-2xl font-bold text-amber-600">{outreachItems.filter(o => o.status === "pending").length}</p>
            </CardContent></Card>
            <Card className="border-none shadow-sm"><CardContent className="pt-4 text-center">
              <p className="text-sm text-gray-500">Notifications Sent (24h)</p>
              <p className="text-2xl font-bold text-blue-600">{notifications.filter(n => (Date.now() - new Date(n.created_at).getTime()) < 24 * 60 * 60 * 1000).length}</p>
            </CardContent></Card>
          </div>
        </div>
      )}

      {/* TAB: Users Lifecycle View */}
      {activeTab === "users" && (
        <div className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input placeholder="Search by name or phone..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="border rounded-lg px-3 py-2 text-sm bg-white" value={stateFilter} onChange={e => setStateFilter(e.target.value)}>
              <option value="all">All States</option>
              {Object.entries(STATE_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.icon} {cfg.label}</option>
              ))}
            </select>
          </div>
          <Card className="border-none shadow-md">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>User</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Days Left</TableHead>
                    <TableHead>Sessions (30d)</TableHead>
                    <TableHead>Last Session</TableHead>
                    <TableHead>Loyal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.slice(0, 100).map(u => (
                    <TableRow key={u.id} className="hover:bg-gray-50">
                      <TableCell>
                        <div><p className="font-medium text-gray-900">{u.name}</p><p className="text-xs text-gray-400">{u.mobile_number}</p></div>
                      </TableCell>
                      <TableCell><StateBadge state={u.lifecycle_state || "JUST_JOINED"} /></TableCell>
                      <TableCell className="text-sm">{u.subscription_plan || "—"}</TableCell>
                      <TableCell><span className={`font-bold ${(u.days_left || 0) <= 7 ? "text-red-600" : "text-gray-700"}`}>{u.days_left ?? "—"}</span></TableCell>
                      <TableCell className="text-center font-semibold">{u.sessions_last_30d || 0}</TableCell>
                      <TableCell className="text-sm text-gray-500">{u.last_session_at ? new Date(u.last_session_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "Never"}</TableCell>
                      <TableCell>{u.is_loyal_member ? "👑" : "—"}</TableCell>
                    </TableRow>
                  ))}
                  {filteredUsers.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-gray-400">No users match filters</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            {filteredUsers.length > 100 && <p className="text-xs text-gray-400 p-3 text-center">Showing 100 of {filteredUsers.length} users</p>}
          </Card>
        </div>
      )}

      {/* TAB: Outreach Queue */}
      {activeTab === "outreach" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Outreach Queue</h2>
            <div className="flex gap-2 text-sm">
              <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full font-medium">{outreachItems.filter(o => o.status === "pending").length} Pending</span>
              <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full font-medium">{outreachItems.filter(o => o.status === "resolved").length} Resolved</span>
            </div>
          </div>
          <Card className="border-none shadow-md">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>User</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {outreachItems.map(item => (
                  <TableRow key={item.id}>
                    <TableCell><p className="font-medium">{item.user_name}</p><p className="text-xs text-gray-400">{item.mobile_number}</p></TableCell>
                    <TableCell className="text-sm text-gray-600 max-w-[200px]">{item.reason}</TableCell>
                    <TableCell>{item.lifecycle_state && <StateBadge state={item.lifecycle_state} />}</TableCell>
                    <TableCell>
                      {editingOutreach === item.id ? (
                        <div className="flex gap-1">
                          <select className="border rounded px-2 py-1 text-sm" value={outreachAssign} onChange={e => setOutreachAssign(e.target.value)}>
                            <option value="">Select...</option>
                            {assignees.map(a => <option key={a} value={a}>{a}</option>)}
                          </select>
                          <Button size="sm" variant="ghost" onClick={() => { assignOutreach(item.id, outreachAssign); }}>✓</Button>
                        </div>
                      ) : (
                        <button className="text-sm text-blue-600 hover:underline" onClick={() => { setEditingOutreach(item.id); setOutreachAssign(item.assigned_to || ""); }}>
                          {item.assigned_to || "Assign →"}
                        </button>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${item.status === "pending" ? "bg-amber-100 text-amber-700" : item.status === "contacted" ? "bg-blue-100 text-blue-700" : item.status === "resolved" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                        {item.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {item.status === "pending" && <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => updateOutreach(item.id, "contacted")}>📞 Contacted</Button>}
                        {item.status !== "resolved" && <Button size="sm" variant="outline" className="text-xs h-7 text-green-600" onClick={() => updateOutreach(item.id, "resolved")}>✓ Resolve</Button>}
                        {item.status !== "deferred" && item.status !== "resolved" && <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => updateOutreach(item.id, "deferred")}>Defer</Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {outreachItems.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-gray-400">🎉 No pending outreach tasks</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}

      {/* TAB: Notifications */}
      {activeTab === "notifications" && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Retention Notification Log</h2>
          <Card className="border-none shadow-md">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>Time</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Trigger</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notifications.slice(0, 100).map(n => (
                    <TableRow key={n.id}>
                      <TableCell className="text-sm text-gray-500">{new Date(n.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</TableCell>
                      <TableCell className="text-sm font-medium">{n.mobile_number}</TableCell>
                      <TableCell><span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs font-mono">{n.trigger_code}</span></TableCell>
                      <TableCell className="text-sm">{n.channel === "whatsapp" ? "📱 WhatsApp" : "📧 Email"}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${n.status === "delivered" ? "bg-green-100 text-green-700" : n.status === "queued" ? "bg-gray-100 text-gray-600" : n.status === "sent" ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"}`}>
                          {n.status}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                  {notifications.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-gray-400">No retention notifications sent yet</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      )}

      {/* TAB: Flow Config */}
      {activeTab === "config" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Notification Flow Configuration</h2>
            <p className="text-sm text-gray-500">{flowConfigs.filter(f => f.enabled).length}/{flowConfigs.length} flows enabled</p>
          </div>
          <div className="grid gap-3">
            {flowConfigs.map(flow => (
              <Card key={flow.trigger_code} className={`border shadow-sm transition-opacity ${!flow.enabled ? "opacity-60" : ""}`}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-gray-800">{flow.trigger_code}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${flow.enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {flow.enabled ? "Active" : "Paused"}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">{flow.description || "—"}</p>
                    <p className="text-xs text-gray-400 mt-1">Template: <code className="bg-gray-100 px-1 rounded">{flow.template_name || "Not set"}</code></p>
                  </div>
                  <Button size="sm" variant={flow.enabled ? "outline" : "default"} className={flow.enabled ? "border-amber-200 text-amber-700 hover:bg-amber-50" : "bg-green-600 hover:bg-green-700 text-white"}
                    onClick={() => toggleFlow(flow.trigger_code, flow.enabled)}>
                    {flow.enabled ? "⏸ Pause" : "▶ Enable"}
                  </Button>
                </CardContent>
              </Card>
            ))}
            {flowConfigs.length === 0 && (
              <Card className="border-none shadow-sm"><CardContent className="py-12 text-center text-gray-400">
                <p>No flow configurations found.</p>
                <p className="text-sm mt-1">Run the SQL migration to seed the retention_flow_config table.</p>
              </CardContent></Card>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}
