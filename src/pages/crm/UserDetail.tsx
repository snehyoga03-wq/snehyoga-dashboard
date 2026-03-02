
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, User, Calendar, CreditCard, Edit2, Save, X, Pause, Play, Phone, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";

interface UserDetailProps {
    user: any;
    onBack: () => void;
    onUpdate?: (id: string, updates: any) => void;
}

const BATCH_TIMINGS = ["5 AM", "6 AM", "7:30 AM", "5 PM", "6 PM", "9:00 PM"];
const PLAN_OPTIONS = ["basic", "premium", "pro"];

export function UserDetail({ user, onBack, onUpdate }: UserDetailProps) {
    // General editing
    const [isEditingGeneral, setIsEditingGeneral] = useState(false);
    const [editName, setEditName] = useState(user.name);
    const [editMobile, setEditMobile] = useState(user.mobile_number);

    // Subscription editing
    const [isEditingSub, setIsEditingSub] = useState(false);
    const [editPlan, setEditPlan] = useState(user.subscription_plan || 'basic');
    const [editDaysLeft, setEditDaysLeft] = useState(user.days_left ?? 0);
    const [editBatch, setEditBatch] = useState(user.batch_timing || '5 AM');

    // Attendance data
    const [attendanceRecords, setAttendanceRecords] = useState<Date[]>([]);
    const [attendanceLoading, setAttendanceLoading] = useState(true);
    const [totalAttendance, setTotalAttendance] = useState(0);

    if (!user) return null;

    // Fetch attendance when component loads
    useEffect(() => {
        const fetchAttendance = async () => {
            setAttendanceLoading(true);
            try {
                // Fetch all attendance for this user
                const { data, error } = await supabase
                    .from('attendance')
                    .select('created_at')
                    .eq('mobile_number', user.mobile_number)
                    .order('created_at', { ascending: false });

                if (error) {
                    console.error("Error fetching attendance:", error);
                } else if (data) {
                    setAttendanceRecords(data.map(r => new Date(r.created_at)));
                    setTotalAttendance(data.length);
                }
            } catch (err) {
                console.error("Error:", err);
            }
            setAttendanceLoading(false);
        };
        fetchAttendance();
    }, [user.mobile_number]);

    // Current week for tracker
    const today = new Date();
    const startOfCurrentWeek = startOfWeek(today, { weekStartsOn: 1 });
    const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(startOfCurrentWeek, i));
    const weekAttendedCount = weekDays.filter(day =>
        attendanceRecords.some(ad => isSameDay(ad, day))
    ).length;

    // Last 4 weeks for history
    const last4Weeks = Array.from({ length: 28 }).map((_, i) => {
        const date = addDays(startOfCurrentWeek, -27 + i);
        const attended = attendanceRecords.some(ad => isSameDay(ad, date));
        return { date, attended };
    });

    const handleSaveGeneral = () => {
        if (onUpdate) {
            onUpdate(user.id, { name: editName, mobile_number: editMobile });
        }
        setIsEditingGeneral(false);
    };

    const handleCancelGeneral = () => {
        setEditName(user.name);
        setEditMobile(user.mobile_number);
        setIsEditingGeneral(false);
    };

    const handleSaveSub = () => {
        if (onUpdate) {
            onUpdate(user.id, {
                subscription_plan: editPlan,
                days_left: Number(editDaysLeft),
                batch_timing: editBatch,
            });
        }
        setIsEditingSub(false);
    };

    const handleCancelSub = () => {
        setEditPlan(user.subscription_plan || 'basic');
        setEditDaysLeft(user.days_left ?? 0);
        setEditBatch(user.batch_timing || '5 AM');
        setIsEditingSub(false);
    };

    const handleTogglePause = () => {
        if (onUpdate) {
            onUpdate(user.id, { subscription_paused: !user.subscription_paused });
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
        >
            {/* Header */}
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full hover:bg-gray-100">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">{user.name}</h2>
                        <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                            <span>#{user.id.slice(0, 8)}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" /> {user.mobile_number}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button onClick={handleTogglePause} className="focus:outline-none" title={user.subscription_paused ? "Click to Resume" : "Click to Pause"}>
                        <Badge
                            variant={user.subscription_paused ? "destructive" : "default"}
                            className={`text-sm px-3 py-1 cursor-pointer transition-all hover:scale-105 flex items-center gap-1.5 ${user.subscription_paused
                                ? "bg-red-100 text-red-800 hover:bg-red-200 border-red-200"
                                : "bg-green-100 text-green-800 hover:bg-green-200 border-green-200"
                                }`}
                        >
                            {user.subscription_paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
                            {user.subscription_paused ? "Paused — Click to Resume" : "Active — Click to Pause"}
                        </Badge>
                    </button>
                    <Badge variant="outline" className="text-sm px-3 py-1 border-blue-200 bg-blue-50 text-blue-700">
                        {user.days_left !== null && user.days_left !== undefined ? user.days_left : "0"} Days Left
                    </Badge>
                </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="general" className="w-full">
                <TabsList className="grid w-full grid-cols-3 h-12 bg-gray-100/50 p-1 rounded-xl">
                    <TabsTrigger value="general" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">General</TabsTrigger>
                    <TabsTrigger value="subscription" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Subscription</TabsTrigger>
                    <TabsTrigger value="attendance" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Attendance</TabsTrigger>
                </TabsList>

                <div className="mt-6">
                    {/* GENERAL TAB */}
                    <TabsContent value="general">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle className="text-lg font-medium flex items-center gap-2">
                                    <User className="h-5 w-5 text-gray-500" /> General Information
                                </CardTitle>
                                {!isEditingGeneral ? (
                                    <Button variant="outline" size="sm" onClick={() => setIsEditingGeneral(true)} className="gap-1.5">
                                        <Edit2 className="h-3.5 w-3.5" /> Edit
                                    </Button>
                                ) : (
                                    <div className="flex gap-2">
                                        <Button size="sm" onClick={handleSaveGeneral} className="gap-1.5 bg-green-600 hover:bg-green-700">
                                            <Save className="h-3.5 w-3.5" /> Save
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={handleCancelGeneral} className="gap-1.5">
                                            <X className="h-3.5 w-3.5" /> Cancel
                                        </Button>
                                    </div>
                                )}
                            </CardHeader>
                            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    {isEditingGeneral ? (
                                        <>
                                            <EditableField label="Full Name" value={editName} onChange={setEditName} />
                                            <EditableField label="Mobile Number" value={editMobile} onChange={setEditMobile} />
                                        </>
                                    ) : (
                                        <>
                                            <InfoItem label="Full Name" value={user.name} />
                                            <InfoItem label="Mobile Number" value={user.mobile_number} />
                                        </>
                                    )}
                                </div>
                                <div className="space-y-4">
                                    <InfoItem label="Referral Link" value={user.referral_link || 'None'} />
                                    <InfoItem label="Joined" value={user.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'} />
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* SUBSCRIPTION TAB */}
                    <TabsContent value="subscription">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle className="text-lg font-medium flex items-center gap-2">
                                    <CreditCard className="h-5 w-5 text-gray-500" /> Subscription Details
                                </CardTitle>
                                {!isEditingSub ? (
                                    <Button variant="outline" size="sm" onClick={() => setIsEditingSub(true)} className="gap-1.5">
                                        <Edit2 className="h-3.5 w-3.5" /> Edit
                                    </Button>
                                ) : (
                                    <div className="flex gap-2">
                                        <Button size="sm" onClick={handleSaveSub} className="gap-1.5 bg-green-600 hover:bg-green-700">
                                            <Save className="h-3.5 w-3.5" /> Save
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={handleCancelSub} className="gap-1.5">
                                            <X className="h-3.5 w-3.5" /> Cancel
                                        </Button>
                                    </div>
                                )}
                            </CardHeader>
                            <CardContent className="space-y-5">
                                {/* Plan */}
                                <div className="flex items-center justify-between p-4 bg-blue-50/50 rounded-lg border border-blue-100">
                                    <div className="flex-1">
                                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Subscription Plan</p>
                                        {isEditingSub ? (
                                            <select className="h-9 w-full max-w-[200px] rounded-md border border-blue-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400" value={editPlan} onChange={(e) => setEditPlan(e.target.value)}>
                                                {PLAN_OPTIONS.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                                            </select>
                                        ) : (
                                            <p className="text-sm font-semibold text-blue-900 capitalize">{user.subscription_plan || 'Basic'}</p>
                                        )}
                                    </div>
                                </div>

                                {/* Days Left */}
                                <div className="flex items-center justify-between p-4 bg-orange-50/50 rounded-lg border border-orange-100">
                                    <div className="flex-1">
                                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Days Left</p>
                                        {isEditingSub ? (
                                            <Input type="number" min={0} className="h-9 w-full max-w-[200px] border-orange-200 focus-visible:ring-orange-400" value={editDaysLeft} onChange={(e) => setEditDaysLeft(Number(e.target.value))} />
                                        ) : (
                                            <p className="text-sm font-semibold text-orange-900">{user.days_left ?? 0} days</p>
                                        )}
                                    </div>
                                </div>

                                {/* Batch Timing */}
                                <div className="flex items-center justify-between p-4 bg-purple-50/50 rounded-lg border border-purple-100">
                                    <div className="flex-1">
                                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Batch Timing</p>
                                        {isEditingSub ? (
                                            <select className="h-9 w-full max-w-[200px] rounded-md border border-purple-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-purple-400" value={editBatch} onChange={(e) => setEditBatch(e.target.value)}>
                                                {BATCH_TIMINGS.map(t => <option key={t} value={t}>{t}</option>)}
                                            </select>
                                        ) : (
                                            <p className="text-sm font-semibold text-purple-900">{user.batch_timing || 'Not set'}</p>
                                        )}
                                    </div>
                                </div>

                                {/* Payment & Order Info */}
                                <div className="flex flex-col gap-3 p-4 bg-gray-50/50 rounded-lg border border-gray-200">
                                    <div className="flex-1">
                                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Last Payment ID</p>
                                        <p className="text-sm font-medium text-gray-900 font-mono">{user.last_payment_id || 'Not available'}</p>
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Last Order ID</p>
                                        <p className="text-sm font-medium text-gray-900 font-mono">{user.last_order_id || 'Not available'}</p>
                                    </div>
                                </div>

                                {/* Pause / Resume */}
                                <div className={`flex items-center justify-between p-4 rounded-lg border ${user.subscription_paused ? 'bg-red-50/50 border-red-100' : 'bg-green-50/50 border-green-100'}`}>
                                    <div>
                                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Subscription Status</p>
                                        <p className={`text-sm font-semibold ${user.subscription_paused ? 'text-red-900' : 'text-green-900'}`}>
                                            {user.subscription_paused ? 'Paused' : 'Active'}
                                        </p>
                                    </div>
                                    <Button
                                        variant="outline" size="sm" onClick={handleTogglePause}
                                        className={`gap-1.5 ${user.subscription_paused ? 'text-green-700 border-green-300 hover:bg-green-100' : 'text-red-700 border-red-300 hover:bg-red-100'}`}
                                    >
                                        {user.subscription_paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                                        {user.subscription_paused ? 'Resume' : 'Pause'}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* ATTENDANCE TAB — Real Data */}
                    <TabsContent value="attendance">
                        <div className="space-y-4">
                            {/* Stats row */}
                            <div className="grid grid-cols-3 gap-3">
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                                    className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl border border-orange-100 p-4 text-center"
                                >
                                    <p className="text-2xl font-bold text-orange-600">{weekAttendedCount}</p>
                                    <p className="text-xs text-orange-700/70 font-medium mt-0.5">This Week</p>
                                </motion.div>
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                                    className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100 p-4 text-center"
                                >
                                    <p className="text-2xl font-bold text-blue-600">{totalAttendance}</p>
                                    <p className="text-xs text-blue-700/70 font-medium mt-0.5">Total Sessions</p>
                                </motion.div>
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                                    className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-100 p-4 text-center"
                                >
                                    <p className="text-2xl font-bold text-green-600">
                                        {totalAttendance > 0 ? Math.round((weekAttendedCount / 7) * 100) : 0}%
                                    </p>
                                    <p className="text-xs text-green-700/70 font-medium mt-0.5">Week Rate</p>
                                </motion.div>
                            </div>

                            {/* This Week Tracker */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg font-medium flex items-center gap-2">
                                        <Calendar className="h-5 w-5 text-gray-500" /> This Week
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {attendanceLoading ? (
                                        <div className="flex gap-2">
                                            {Array.from({ length: 7 }).map((_, i) => (
                                                <div key={i} className="flex-1 h-14 rounded-lg bg-gray-100 animate-pulse" />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-7 gap-2">
                                            {weekDays.map((day, index) => {
                                                const isAttended = attendanceRecords.some(ad => isSameDay(ad, day));
                                                const isToday = isSameDay(day, today);
                                                return (
                                                    <motion.div
                                                        key={index}
                                                        initial={{ opacity: 0, scale: 0.8 }}
                                                        animate={{ opacity: 1, scale: 1 }}
                                                        transition={{ delay: index * 0.05 }}
                                                        className="flex flex-col items-center gap-1.5"
                                                    >
                                                        <span className={`text-xs font-semibold ${isToday ? 'text-orange-600' : 'text-gray-400'}`}>
                                                            {format(day, "EEE")}
                                                        </span>
                                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isAttended
                                                            ? 'bg-gradient-to-br from-orange-400 to-amber-500 shadow-md shadow-orange-200/50'
                                                            : isToday
                                                                ? 'bg-white border-2 border-dashed border-orange-300'
                                                                : 'bg-gray-50 border border-gray-200'
                                                            }`}>
                                                            {isAttended ? (
                                                                <Check className="w-4 h-4 text-white" strokeWidth={3} />
                                                            ) : isToday ? (
                                                                <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
                                                            ) : (
                                                                <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                                                            )}
                                                        </div>
                                                        <span className={`text-[10px] font-medium ${isAttended ? 'text-orange-600' : 'text-gray-400'}`}>
                                                            {format(day, "d")}
                                                        </span>
                                                    </motion.div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* 4-Week Heatmap */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg font-medium flex items-center gap-2">
                                        <Calendar className="h-5 w-5 text-gray-500" /> Last 4 Weeks
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-7 gap-1.5">
                                        {/* Headers */}
                                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                                            <div key={d} className="text-center text-[10px] font-semibold text-gray-400 uppercase mb-1">{d}</div>
                                        ))}
                                        {/* Heatmap cells */}
                                        {last4Weeks.map((entry, i) => (
                                            <motion.div
                                                key={i}
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                transition={{ delay: i * 0.01 }}
                                                title={`${format(entry.date, "MMM d")} — ${entry.attended ? 'Present' : 'Absent'}`}
                                                className={`aspect-square rounded-md cursor-default transition-all ${entry.attended
                                                    ? 'bg-gradient-to-br from-green-400 to-emerald-500'
                                                    : isSameDay(entry.date, today)
                                                        ? 'bg-orange-100 border border-orange-300'
                                                        : entry.date > today
                                                            ? 'bg-gray-50 border border-gray-100'
                                                            : 'bg-gray-100 border border-gray-200'
                                                    }`}
                                            />
                                        ))}
                                    </div>
                                    <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
                                        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-gradient-to-br from-green-400 to-emerald-500" /> Present</span>
                                        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-gray-100 border border-gray-200" /> Absent</span>
                                        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-orange-100 border border-orange-300" /> Today</span>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Recent sessions list */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg font-medium flex items-center gap-2">
                                        <Calendar className="h-5 w-5 text-gray-500" /> Recent Sessions
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {attendanceLoading ? (
                                        <div className="space-y-2">
                                            {[1, 2, 3].map(i => <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />)}
                                        </div>
                                    ) : attendanceRecords.length === 0 ? (
                                        <div className="text-center py-8 text-gray-400">
                                            <p className="text-sm">No attendance records yet</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                                            {attendanceRecords.slice(0, 20).map((record, i) => (
                                                <motion.div
                                                    key={i}
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: i * 0.03 }}
                                                    className="p-3 border rounded-lg flex justify-between items-center text-sm hover:bg-gray-50/50 transition-colors"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full bg-green-500" />
                                                        <span className="text-gray-700 font-medium">{format(record, "EEEE, MMM d, yyyy")}</span>
                                                    </div>
                                                    <span className="text-gray-400 text-xs">{format(record, "h:mm a")}</span>
                                                </motion.div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>
                </div>
            </Tabs>
        </motion.div>
    );
}

function InfoItem({ label, value }: { label: string, value: string }) {
    return (
        <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">{label}</p>
            <p className="text-sm font-medium text-gray-900 border-b border-gray-100 pb-2">{value}</p>
        </div>
    );
}

function EditableField({ label, value, onChange }: { label: string, value: string, onChange: (v: string) => void }) {
    return (
        <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">{label}</p>
            <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-9 border-gray-200 focus-visible:ring-blue-400" />
        </div>
    );
}
