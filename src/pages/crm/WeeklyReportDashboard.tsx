import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calendar, Users, PhoneCall, CheckCircle, Clock, ListTodo, XCircle, TrendingUp, RefreshCw, ChevronUp, ChevronDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import type { Lead } from '@/integrations/supabase/types';
import { motion } from 'framer-motion';

const ASSIGNED_USERS = ["Ragini K", "Shreya K", "Janhavi V"];
const LEAD_STATUSES = ["Select Option", "Follow Up", "Master Class Follow", "Deal Done", "Dead"];

export default function WeeklyReportDashboard() {
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  
  // Filters - Default to today's date onward
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dailyDate, setDailyDate] = useState<string>("");
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
      const effectiveStartDate = dailyDate || startDate;
      const effectiveEndDate = dailyDate || endDate;

      // 1. Fetch leads
      let leadsQuery = supabase.from('leads').select('*');
      if (effectiveMember !== 'all') {
        const firstName = effectiveMember.split(' ')[0];
        leadsQuery = leadsQuery.or(`assigned_to.ilike.%${effectiveMember}%,assigned_to.ilike.%${firstName}%`);
      }
      if (selectedStatus !== 'all') {
        leadsQuery = leadsQuery.eq('lead_status', selectedStatus);
      }
      if (effectiveStartDate) {
        leadsQuery = leadsQuery.gte('created_at', `${effectiveStartDate}T00:00:00.000Z`);
      }
      if (effectiveEndDate) {
        leadsQuery = leadsQuery.lte('created_at', `${effectiveEndDate}T23:59:59.999Z`);
      }
      
      const { data: leadsData, error: leadsError } = await leadsQuery;
      if (leadsError) throw leadsError;

      // 2. Fetch history within date range
      // For tracking "calls" and "follow-ups" completed within this week
      let historyQuery = supabase
        .from('lead_history')
        .select('*, leads!inner(assigned_to)');
        
      if (effectiveStartDate) {
        historyQuery = historyQuery.gte('created_at', `${effectiveStartDate}T00:00:00.000Z`);
      }
      if (effectiveEndDate) {
        historyQuery = historyQuery.lte('created_at', `${effectiveEndDate}T23:59:59.999Z`);
      }
      
      if (effectiveMember !== 'all') {
        const firstName = effectiveMember.split(' ')[0];
        historyQuery = historyQuery.or(`leads.assigned_to.ilike.%${effectiveMember}%,leads.assigned_to.ilike.%${firstName}%`);
      }
      
      const { data: historyData, error: historyError } = await historyQuery;
      if (historyError) throw historyError;

      // Only update state if this is still the most recent request
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
  }, [startDate, endDate, dailyDate, selectedMember, selectedStatus]);

  // Derived Metrics
  const totalAssigned = leads.length;
  
  // A "Call" / interaction is recorded when staff performs an action or status update on a lead (from history)
  const totalCallsDone = new Set(history.map(h => h.lead_id)).size;
  
  const pendingFollowUps = leads.filter(l => l.lead_status === 'Follow Up').length;
  const masterClassLeads = leads.filter(l => l.lead_status === 'Master Class Follow').length;
  const convertedLeads = leads.filter(l => l.lead_status === 'Deal Done').length;
  const deadLeads = leads.filter(l => l.lead_status === 'Dead').length;

  // Analytics Chart Data
  const displayedUsers = effectiveMember === 'all' ? ASSIGNED_USERS : [effectiveMember];
  const chartData = displayedUsers.map(user => {
    const firstName = user.split(' ')[0].toLowerCase();
    const userLeads = leads.filter(l => (l.assigned_to || "").toLowerCase().includes(firstName));
    const userHistory = history.filter(h => (h.leads?.assigned_to || "").toLowerCase().includes(firstName));
    
    return {
      name: user.split(' ')[0],
      Calls: new Set(userHistory.map(h => h.lead_id)).size,
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
                  {LEAD_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
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
        <MetricCard title="Total Assigned" value={totalAssigned} icon={<Users size={22} />} color="blue" delay={0.1} />
        <MetricCard title="Total Calls Done" value={totalCallsDone} icon={<PhoneCall size={22} />} color="indigo" delay={0.15} />
        <MetricCard title="Master Class Follow" value={masterClassLeads} icon={<Users size={22} />} color="purple" delay={0.22} />
        <MetricCard title="Pending Follow-ups" value={pendingFollowUps} icon={<Clock size={22} />} color="amber" delay={0.25} />
        <MetricCard title="Converted / Joined" value={convertedLeads} icon={<TrendingUp size={22} />} color="green" delay={0.3} />
        <MetricCard title="Not Interested" value={deadLeads} icon={<XCircle size={22} />} color="red" delay={0.35} />
      </div>

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
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12, fontWeight: 500}} dy={10} />
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
    </div>
  );
}

function MetricCard({ title, value, icon, color, delay = 0 }: { title: string, value: number, icon: React.ReactNode, color: string, delay?: number }) {
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
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">{title}</p>
            <h3 className="text-3xl font-extrabold text-gray-900 tracking-tight">{value}</h3>
          </div>
          <div className={`p-3.5 rounded-2xl ${iconBgMap[color] || 'bg-gray-100 text-gray-600'}`}>
            {icon}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
