import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calendar, Users, PhoneCall, CheckCircle, Clock, ListTodo, XCircle, TrendingUp, RefreshCw, ChevronUp, ChevronDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import type { Lead } from '@/integrations/supabase/types';

const ASSIGNED_USERS = ["Mayuri K", "Ragini K", "Shreya K"];
const LEAD_STATUSES = ["Select Option", "Follow Up", "Deal Done", "Dead"];

export default function WeeklyReportDashboard() {
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  
  // Filters
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dailyDate, setDailyDate] = useState<string>("");
  const userRole = sessionStorage.getItem("crm_user_role");
  const username = sessionStorage.getItem("crm_username");

  const [selectedMember, setSelectedMember] = useState<string>(() => {
    if (userRole === "staff" && username && username !== "Shreya K") return username;
    return "all";
  });
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  const fetchIdRef = useRef(0);

  const fetchData = async () => {
    const currentFetchId = ++fetchIdRef.current;
    setLoading(true);
    try {
      // 1. Fetch leads
      let leadsQuery = supabase.from('leads').select('*');
      if (selectedMember !== 'all') {
        leadsQuery = leadsQuery.eq('assigned_to', selectedMember);
      }
      if (selectedStatus !== 'all') {
        leadsQuery = leadsQuery.eq('lead_status', selectedStatus);
      }
      
      const { data: leadsData, error: leadsError } = await leadsQuery;
      if (leadsError) throw leadsError;

      // 2. Fetch history within date range
      // For tracking "calls" and "follow-ups" completed within this week
      let historyQuery = supabase
        .from('lead_history')
        .select('*, leads!inner(assigned_to)')
        .gte('created_at', `${startDate}T00:00:00.000Z`)
        .lte('created_at', `${endDate}T23:59:59.999Z`);
      
      if (selectedMember !== 'all') {
        historyQuery = historyQuery.eq('leads.assigned_to', selectedMember);
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
  }, [startDate, endDate, selectedMember, selectedStatus]);

  // Derived Metrics
  const totalAssigned = leads.length;
  
  // A "Call" or interaction is any history record that is not "Created" or "Imported"
  const totalCallsDone = history.filter(h => h.action_type !== 'Created' && h.action_type !== 'Imported').length;
  
  // "Follow-ups Completed" inferred as any status change or remark update during the period
  const followUpsCompleted = history.filter(h => 
    h.action_type === 'Status Changed' || h.action_type === 'Updated'
  ).length;

  const pendingFollowUps = leads.filter(l => l.lead_status === 'Follow Up').length;
  const convertedLeads = leads.filter(l => l.lead_status === 'Deal Done').length;
  const deadLeads = leads.filter(l => l.lead_status === 'Dead').length;
  
  const todayStr = new Date().toISOString().split('T')[0];
  const todaysPendingTasks = leads.filter(l => 
    l.follow_up_date === todayStr && 
    l.lead_status !== 'Deal Done' && 
    l.lead_status !== 'Dead'
  ).length;

  // Analytics Chart Data
  const displayedUsers = selectedMember === 'all' ? ASSIGNED_USERS : [selectedMember];
  const chartData = displayedUsers.map(user => {
    const userLeads = leads.filter(l => l.assigned_to === user);
    const userHistory = history.filter(h => h.leads?.assigned_to === user);
    
    return {
      name: user.split(' ')[0],
      Calls: userHistory.filter(h => h.action_type !== 'Created' && h.action_type !== 'Imported').length,
      Converted: userLeads.filter(l => l.lead_status === 'Deal Done').length,
      Assigned: userLeads.length
    };
  });

  return (
    <div className="space-y-6 mt-8">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm cursor-pointer border border-transparent hover:border-gray-200 transition-all" onClick={() => setIsExpanded(!isExpanded)}>
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="text-[#2e5a44]" /> Weekly Report Dashboard
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
                  setStartDate(d);
                  setEndDate(d);
                }
              }} />
            </div>
            {(userRole !== "staff" || username === "Shreya K") && (
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard title="Total Assigned" value={totalAssigned} icon={<Users size={20} />} color="blue" />
        <MetricCard title="Total Calls Done" value={totalCallsDone} icon={<PhoneCall size={20} />} color="indigo" />
        <MetricCard title="Follow-ups Completed" value={followUpsCompleted} icon={<CheckCircle size={20} />} color="emerald" />
        <MetricCard title="Pending Follow-ups" value={pendingFollowUps} icon={<Clock size={20} />} color="amber" />
        <MetricCard title="Converted / Joined" value={convertedLeads} icon={<TrendingUp size={20} />} color="green" />
        <MetricCard title="Not Interested" value={deadLeads} icon={<XCircle size={20} />} color="red" />
        <MetricCard title="Today's Pending Tasks" value={todaysPendingTasks} icon={<ListTodo size={20} />} color="orange" />
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
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <RechartsTooltip cursor={{fill: '#f9fafb'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Legend iconType="circle" />
                <Bar dataKey="Calls" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={30} />
                <Bar dataKey="Converted" fill="#10b981" radius={[4, 4, 0, 0]} barSize={30} />
                <Bar dataKey="Assigned" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      </div>)}
    </div>
  );
}

function MetricCard({ title, value, icon, color }: { title: string, value: number, icon: React.ReactNode, color: string }) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600",
    indigo: "bg-indigo-50 text-indigo-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    green: "bg-green-50 text-green-600",
    red: "bg-red-50 text-red-600",
    orange: "bg-orange-50 text-orange-600"
  };

  return (
    <Card className="border-none shadow-sm bg-white">
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`p-3 rounded-xl ${colorMap[color] || 'bg-gray-100 text-gray-600'}`}>
          {icon}
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{title}</p>
          <h3 className="text-2xl font-bold text-gray-900 mt-1">{value}</h3>
        </div>
      </CardContent>
    </Card>
  );
}
