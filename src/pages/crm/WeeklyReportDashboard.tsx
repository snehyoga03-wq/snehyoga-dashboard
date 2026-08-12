import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calendar, Users, PhoneCall, CheckCircle, Clock, ListTodo, XCircle, TrendingUp, RefreshCw, ChevronUp, ChevronDown, Award, Target, ArrowUpRight, ArrowDownRight, RotateCcw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import type { Lead } from '@/integrations/supabase/types';
import { motion } from 'framer-motion';
import { calculateCallTargetLedgers, UserTargetLedger } from '@/utils/callTargetLedger';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const ASSIGNED_USERS = ["Ragini K", "Shreya K", "Janhavi V"];
const LEAD_STATUSES = ["Select Option", "Follow Up", "Master Class Follow", "Deal Done", "Dead"];

const isUserMatch = (assignedTo: string | null | undefined, createdBy: string | null | undefined, targetUser: string): boolean => {
  if (!targetUser || targetUser === 'all') return true;
  const normTarget = targetUser.trim().toLowerCase();
  const targetFirstName = normTarget.split(' ')[0];

  const normAssigned = (assignedTo || "").trim().toLowerCase();
  const normCreatedBy = (createdBy || "").trim().toLowerCase();

  return (
    normAssigned.includes(normTarget) ||
    normAssigned.includes(targetFirstName) ||
    normCreatedBy.includes(normTarget) ||
    normCreatedBy.includes(targetFirstName)
  );
};

export default function WeeklyReportDashboard() {
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [selectedLedgerUser, setSelectedLedgerUser] = useState<UserTargetLedger | null>(null);
  
  // Filters - Default to today's date
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dailyDate, setDailyDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const userRole = sessionStorage.getItem("crm_user_role");
  const username = sessionStorage.getItem("crm_username");
  const isRestrictedStaff = userRole === "staff" && username !== "Shreya K";

  const [selectedMember, setSelectedMember] = useState<string>(() => {
    if (isRestrictedStaff && username) return username;
    return "all";
  });
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  const effectiveMember = isRestrictedStaff && username ? username : selectedMember;

  const fetchIdRef = useRef(0);

  const fetchData = async () => {
    const currentFetchId = ++fetchIdRef.current;
    setLoading(true);
    try {
      // 1. Fetch all leads clean from database
      let leadsQuery = supabase.from('leads').select('*');
      if (selectedStatus !== 'all') {
        leadsQuery = leadsQuery.eq('lead_status', selectedStatus);
      }
      
      const { data: leadsData, error: leadsError } = await leadsQuery;
      if (leadsError) throw leadsError;

      // 2. Fetch history clean from database (avoiding invalid postgrest join queries)
      const { data: historyData, error: historyError } = await supabase
        .from('lead_history')
        .select('*');
        
      if (historyError) throw historyError;

      if (currentFetchId === fetchIdRef.current) {
        setLeads(leadsData || []);
        setHistory(historyData || []);
      }
    } catch (err) {
      if (currentFetchId === fetchIdRef.current) {
        console.error("Error fetching report data:", err);
      }
    } finally {
      if (currentFetchId === fetchIdRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedStatus]);

  // Harmonized Derived Metrics (Strictly Identical to Leads Management Filter Engine)
  const targetDate = dailyDate || startDate || endDate || new Date().toISOString().split('T')[0];

  const matchesAutoDate = (lead: Lead, tDate: string): boolean => {
    if (!tDate) return true;
    const isMasterClassFollow = lead.lead_status === "Master Class Follow";
    if (!lead.created_at) {
      return lead.follow_up_date === tDate || isMasterClassFollow;
    }
    const leadDate = new Date(lead.created_at).toISOString().split('T')[0];
    const isCreatedToday = leadDate === tDate;
    const isFollowUpToday = lead.follow_up_date === tDate;
    const isUntouchedCarryForward = leadDate < tDate && lead.lead_status === "Select Option" && !lead.follow_up_date;
    return isCreatedToday || isFollowUpToday || isUntouchedCarryForward || isMasterClassFollow;
  };

  const filteredLeads = leads.filter(l => 
    isUserMatch(l.assigned_to, null, effectiveMember) && 
    matchesAutoDate(l, targetDate)
  );

  const assignedLeadIds = new Set(filteredLeads.map(l => l.id));

  // History entries for the leads matching autoDate filter
  const filteredHistory = history.filter(h => {
    const matchesUser = isUserMatch(null, h.created_by, effectiveMember);
    const matchesAssignedLead = targetDate ? assignedLeadIds.has(h.lead_id) : true;
    return matchesUser || matchesAssignedLead;
  });

  const totalAssigned = filteredLeads.length;
  // Total Calls Done = Unique assigned leads in this pool that have been called / acted upon
  const totalCallsDone = filteredLeads.filter(l => 
    (l.lead_status && l.lead_status !== 'Select Option') || 
    (l.remark && l.remark !== '' && l.remark !== 'No remark') ||
    (l.calling_date && l.calling_date !== '') ||
    history.some(h => h.lead_id === l.id)
  ).length;
  
  const pendingFollowUps = filteredLeads.filter(l => l.lead_status === 'Follow Up').length;
  const masterClassLeads = filteredLeads.filter(l => l.lead_status === 'Master Class Follow').length;
  const convertedLeads = filteredLeads.filter(l => l.lead_status === 'Deal Done').length;
  const deadLeads = filteredLeads.filter(l => l.lead_status === 'Dead').length;

  // 60-Call Daily Target & Appreciation Ledgers
  const displayedUsers = effectiveMember === 'all' ? ASSIGNED_USERS : [effectiveMember];

  const targetLedgers = calculateCallTargetLedgers(
    filteredHistory,
    displayedUsers,
    targetDate,
    targetDate
  );

  // Analytics Chart Data (Harmonized with Top Cards & Ledger)
  const chartData = displayedUsers.map(user => {
    const userLeads = leads.filter(l => isUserMatch(l.assigned_to, null, user) && matchesAutoDate(l, targetDate));
    const userLeadIds = new Set(userLeads.map(l => l.id));
    const userHistory = history.filter(h => {
      const matchesUser = isUserMatch(null, h.created_by, user);
      const matchesAssignedLead = targetDate ? userLeadIds.has(h.lead_id) : true;
      return matchesUser || matchesAssignedLead;
    });

    const userCallsDone = userLeads.filter(l => 
      (l.lead_status && l.lead_status !== 'Select Option') || 
      (l.remark && l.remark !== '' && l.remark !== 'No remark') ||
      (l.calling_date && l.calling_date !== '') ||
      userHistory.some(h => h.lead_id === l.id)
    ).length;
    
    return {
      name: user.split(' ')[0],
      Calls: userCallsDone,
      Converted: userLeads.filter(l => l.lead_status === 'Deal Done').length,
      Assigned: userLeads.length
    };
  });

  return (
    <div className="space-y-6 mt-8">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm cursor-pointer border border-transparent hover:border-gray-200 transition-all" onClick={() => setIsExpanded(!isExpanded)}>
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="text-[#2e5a44]" /> Overview Report Dashboard
          </h2>
          <p className="text-sm text-gray-500">Track team performance and lead activity overview.</p>
        </div>
        <Button variant="ghost" size="icon" className="text-gray-500 rounded-full hover:bg-gray-100">
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </Button>
      </div>

      {isExpanded && (
        <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">

      {/* Filters */}
      <Card className="border-none shadow-sm bg-white">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 items-end">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Start Date</label>
              <Input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setDailyDate(""); }} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">End Date</label>
              <Input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setDailyDate(""); }} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Daily Performance</label>
              <Input type="date" value={dailyDate} onChange={e => {
                const d = e.target.value;
                setDailyDate(d);
                if (d) {
                  setStartDate("");
                  setEndDate("");
                }
              }} />
            </div>
            {!isRestrictedStaff && (
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Team Member</label>
                <Select value={selectedMember} onValueChange={setSelectedMember}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Members" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Members</SelectItem>
                    {ASSIGNED_USERS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Lead Status</label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {LEAD_STATUSES.map(s => <SelectItem key={s.id || s} value={s.id || s}>{s.label || s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Button onClick={fetchData} disabled={loading} className="w-full bg-[#2e5a44] hover:bg-[#203f2f]">
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Update
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <MetricCard title="Total Assigned" subtitle="Leads assigned in selected date range" value={totalAssigned} icon={<Users size={22} />} color="blue" delay={0.1} />
        <MetricCard title="Total Calls Done" subtitle="Assigned leads called/acted upon" value={totalCallsDone} icon={<PhoneCall size={22} />} color="indigo" delay={0.15} />
        <MetricCard title="Master Class Follow" value={masterClassLeads} icon={<Users size={22} />} color="purple" delay={0.22} />
        <MetricCard title="Pending Follow-ups" value={pendingFollowUps} icon={<Clock size={22} />} color="amber" delay={0.25} />
        <MetricCard title="Converted / Joined" value={convertedLeads} icon={<TrendingUp size={22} />} color="green" delay={0.3} />
        <MetricCard title="Not Interested" value={deadLeads} icon={<XCircle size={22} />} color="red" delay={0.35} />
      </div>

      {/* 60-Call Daily Target & Appreciation Ledger Section */}
      <Card className="border-none shadow-sm bg-gradient-to-br from-amber-50/40 via-white to-emerald-50/30 overflow-hidden border border-amber-100/60">
        <CardHeader className="pb-3 border-b border-gray-100 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-600" /> Target Performance & Appreciation Ledger
            </CardTitle>
            <p className="text-xs text-gray-500 mt-1">
              Daily Target: <span className="font-semibold text-gray-700">60 Calls/Day</span>. Surplus calls automatically pay back past deficits to preserve Appreciation Days.
            </p>
          </div>
          <span className="px-3 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-full border border-amber-200">
            Target: 60 Calls/Day
          </span>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {displayedUsers.map(user => {
              const ledger = targetLedgers[user];
              if (!ledger) return null;

              const isHighAppreciation = ledger.appreciationPercentage >= 80;
              const hasDeficits = ledger.totalOutstandingDeficit > 0;

              return (
                <div key={user} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition-all">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-bold text-gray-900">{user}</h4>
                      <p className="text-xs text-gray-500">
                        {ledger.appreciationDaysEarned} / {ledger.totalActiveDays} Days Target Met
                      </p>
                    </div>
                    <div className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${
                      isHighAppreciation 
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}>
                      <Award className="w-3.5 h-3.5" />
                      {ledger.appreciationPercentage}% Score
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                    <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                      <span className="text-gray-500 block text-[10px] uppercase font-semibold">Raw Calls</span>
                      <span className="font-extrabold text-gray-800 text-sm">{ledger.totalRawCalls}</span>
                      <span className="text-gray-400 text-[10px] block">Target: {ledger.totalTarget}</span>
                    </div>

                    <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                      <span className="text-gray-500 block text-[10px] uppercase font-semibold">Adjusted Calls</span>
                      <span className="font-extrabold text-indigo-700 text-sm flex items-center gap-1">
                        {ledger.totalAdjustedCalls}
                        {ledger.totalDeficitPaidBack > 0 && (
                          <span className="text-[10px] text-emerald-600 font-bold">(+{ledger.totalDeficitPaidBack} Back-Adjusted)</span>
                        )}
                      </span>
                    </div>
                  </div>

                  {hasDeficits ? (
                    <div className="flex items-center justify-between text-xs bg-red-50 text-red-700 p-2 rounded-lg border border-red-100 mb-3">
                      <span className="font-medium flex items-center gap-1">
                        <ArrowDownRight className="w-3.5 h-3.5 text-red-500" /> Outstanding Deficit
                      </span>
                      <span className="font-bold">-{ledger.totalOutstandingDeficit} Calls</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-xs bg-emerald-50 text-emerald-700 p-2 rounded-lg border border-emerald-100 mb-3">
                      <span className="font-medium flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Deficits Fully Paid Back
                      </span>
                      <span className="font-bold">0 Pending</span>
                    </div>
                  )}

                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setSelectedLedgerUser(ledger)}
                    className="w-full text-xs font-semibold text-[#2e5a44] border-[#2e5a44]/30 hover:bg-[#2e5a44]/10"
                  >
                    View Daily Ledger Details
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Performance Analytics Chart */}
      <Card className="border-none shadow-sm bg-white">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-gray-800">Weekly Performance Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#818cf8" stopOpacity={1}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={1}/>
                  </linearGradient>
                  <linearGradient id="colorConverted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#34d399" stopOpacity={1}/>
                    <stop offset="95%" stopColor="#059669" stopOpacity={1}/>
                  </linearGradient>
                  <linearGradient id="colorAssigned" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#60a5fa" stopOpacity={1}/>
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={1}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12, fontWeigh: 500}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dx={-10} />
                <RechartsTooltip 
                  cursor={{fill: '#f8fafc'}} 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)' }} 
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                <Bar dataKey="Calls" fill="url(#colorCalls)" radius={[6, 6, 0, 0]} barSize={24} />
                <Bar dataKey="Converted" fill="url(#colorConverted)" radius={[6, 6, 0, 0]} barSize={24} />
                <Bar dataKey="Assigned" fill="url(#colorAssigned)" radius={[6, 6, 0, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      </div>)}

      {/* Daily Target Ledger Dialog */}
      <Dialog open={!!selectedLedgerUser} onOpenChange={(open) => !open && setSelectedLedgerUser(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Award className="text-amber-600" /> Daily Target & Back-Adjustment Ledger: {selectedLedgerUser?.userName}
            </DialogTitle>
          </DialogHeader>

          {selectedLedgerUser && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-4 gap-3 bg-gray-50 p-4 rounded-xl text-center">
                <div>
                  <span className="text-[11px] text-gray-500 font-semibold block uppercase">Total Calls</span>
                  <span className="text-lg font-bold text-gray-800">{selectedLedgerUser.totalRawCalls}</span>
                </div>
                <div>
                  <span className="text-[11px] text-gray-500 font-semibold block uppercase">Total Target</span>
                  <span className="text-lg font-bold text-gray-800">{selectedLedgerUser.totalTarget}</span>
                </div>
                <div>
                  <span className="text-[11px] text-gray-500 font-semibold block uppercase">Back-Adjusted</span>
                  <span className="text-lg font-bold text-emerald-600">+{selectedLedgerUser.totalDeficitPaidBack}</span>
                </div>
                <div>
                  <span className="text-[11px] text-gray-500 font-semibold block uppercase">Appreciation Score</span>
                  <span className="text-lg font-bold text-amber-700">{selectedLedgerUser.appreciationPercentage}%</span>
                </div>
              </div>

              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-100 font-semibold text-gray-700 uppercase border-b">
                    <tr>
                      <th className="p-3">Date</th>
                      <th className="p-3 text-center">Raw Calls</th>
                      <th className="p-3 text-center">Target</th>
                      <th className="p-3 text-center">Back-Adjusted</th>
                      <th className="p-3 text-center">Final Balance</th>
                      <th className="p-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {selectedLedgerUser.dailyEntries.map(entry => (
                      <tr key={entry.date} className="hover:bg-gray-50/80">
                        <td className="p-3 font-medium text-gray-800">{entry.date}</td>
                        <td className="p-3 text-center font-semibold">{entry.rawCalls}</td>
                        <td className="p-3 text-center text-gray-500">60</td>
                        <td className="p-3 text-center">
                          {entry.deficitPaidByFuture > 0 ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                              +{entry.deficitPaidByFuture} Covered
                            </span>
                          ) : entry.surplusGivenToPast > 0 ? (
                            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-medium">
                              -{entry.surplusGivenToPast} Paid Back
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="p-3 text-center font-bold">
                          {entry.adjustedCalls} / 60
                        </td>
                        <td className="p-3 text-center">
                          {entry.rawCalls >= 60 ? (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                              Target Met (Direct)
                            </span>
                          ) : entry.isTargetMet ? (
                            <span className="px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-800 font-bold text-[10px] flex items-center justify-center gap-1">
                              <RotateCcw className="w-3 h-3" /> Back-Adjusted
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-800 font-bold text-[10px]">
                              Deficit (-{entry.unresolvedDeficit})
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetricCard({ title, subtitle, value, icon, color, delay = 0 }: { title: string, subtitle?: string, value: number, icon: React.ReactNode, color: string, delay?: number }) {
  const colorMap: Record<string, string> = {
    blue: "bg-gradient-to-br from-blue-50 to-blue-100/50 text-blue-600 border-blue-100",
    indigo: "bg-gradient-to-br from-indigo-50 to-indigo-100/50 text-indigo-600 border-indigo-100",
    emerald: "bg-gradient-to-br from-emerald-50 to-emerald-100/50 text-emerald-600 border-emerald-100",
    purple: "bg-gradient-to-br from-purple-50 to-purple-100/50 text-purple-600 border-purple-100",
    amber: "bg-gradient-to-br from-amber-50 to-amber-100/50 text-amber-600 border-amber-100",
    green: "bg-gradient-to-br from-green-50 to-green-100/50 text-green-600 border-green-100",
    red: "bg-gradient-to-br from-red-50 to-red-100/50 text-red-600 border-red-100",
    orange: "bg-gradient-to-br from-orange-50 to-orange-100/50 text-orange-600 border-orange-100"
  };

  const iconBgMap: Record<string, string> = {
    blue: "bg-blue-100/80 shadow-inner shadow-blue-200/50",
    indigo: "bg-indigo-100/80 shadow-inner shadow-indigo-200/50",
    emerald: "bg-emerald-100/80 shadow-inner shadow-emerald-200/50",
    purple: "bg-purple-100/80 shadow-inner shadow-purple-200/50",
    amber: "bg-amber-100/80 shadow-inner shadow-amber-200/50",
    green: "bg-green-100/80 shadow-inner shadow-green-200/50",
    red: "bg-red-100/80 shadow-inner shadow-red-200/50",
    orange: "bg-orange-100/80 shadow-inner shadow-orange-200/50"
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
    >
      <Card className={`border shadow-sm hover:shadow-md transition-all duration-300 ${colorMap[color] || 'bg-white'}`}>
        <CardContent className="p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">{title}</p>
            <h3 className="text-3xl font-extrabold text-gray-900 tracking-tight">{value}</h3>
            {subtitle && <p className="text-[10px] text-gray-500 font-medium mt-1">{subtitle}</p>}
          </div>
          <div className={`p-3.5 rounded-2xl ${iconBgMap[color] || 'bg-gray-100 text-gray-600'}`}>
            {icon}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
