import { useEffect, useState } from "react";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { getCookie } from "@/lib/cookies";
import { Flame, Sparkles } from "lucide-react";

export const AttendanceTracker = () => {
    const [attendanceDays, setAttendanceDays] = useState<Date[]>([]);
    const [loading, setLoading] = useState(true);

    const today = new Date();
    const startOfCurrentWeek = startOfWeek(today, { weekStartsOn: 1 });
    const weekDays = Array.from({ length: 7 }).map((_, i) =>
        addDays(startOfCurrentWeek, i)
    );

    // Calculate streak
    const attendedCount = weekDays.filter(day =>
        attendanceDays.some(ad => isSameDay(ad, day))
    ).length;

    useEffect(() => {
        const fetchAttendance = async () => {
            const userPhone = getCookie("userPhone");
            if (!userPhone) { setLoading(false); return; }

            const { data, error } = await supabase
                .from("attendance")
                .select("created_at")
                .eq("mobile_number", userPhone)
                .gte("created_at", startOfCurrentWeek.toISOString());

            if (error) {
                console.error("Error fetching attendance:", error);
            } else if (data) {
                setAttendanceDays(data.map((r) => new Date(r.created_at)));
            }
            setLoading(false);
        };
        fetchAttendance();
    }, []);

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full py-4 px-2"
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-6 px-3">
                <div className="flex items-center gap-2.5">
                    <h3 className="text-xl font-black text-gray-800 tracking-tight">Your Week</h3>
                    {attendedCount > 0 && (
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", delay: 0.3 }}
                            className="flex items-center gap-1.5 bg-gradient-to-r from-orange-100 to-amber-100 px-3 py-1 rounded-full border border-orange-200/60 shadow-sm"
                        >
                            <Flame className="w-4 h-4 text-orange-500" />
                            <span className="text-xs font-black text-orange-700 tracking-wider">{attendedCount}/7</span>
                        </motion.div>
                    )}
                </div>
            </div>

            {/* Week Grid */}
            <div className="grid grid-cols-7 gap-2 pb-2">
                {weekDays.map((day, index) => {
                    const isAttended = attendanceDays.some((ad) => isSameDay(ad, day));
                    const isToday = isSameDay(day, today);
                    const isPast = day < today && !isToday;

                    return (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.06, duration: 0.4 }}
                            className="flex flex-col items-center gap-2"
                        >
                            {/* Day label */}
                            <span className={`text-[11px] font-bold uppercase tracking-widest ${isToday ? "text-orange-600 drop-shadow-sm" : "text-gray-400"
                                }`}>
                                {format(day, "EEE")}
                            </span>

                            {/* Circle indicator */}
                            <motion.div
                                whileHover={{ scale: 1.08 }}
                                whileTap={{ scale: 0.95 }}
                                className={`relative w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${isAttended
                                    ? "bg-gradient-to-br from-orange-400 via-amber-400 to-yellow-500 shadow-lg shadow-orange-300/50"
                                    : isToday
                                        ? "bg-white border-2 border-dashed border-orange-300 shadow-sm"
                                        : isPast
                                            ? "bg-gray-50/80 border border-gray-200/60"
                                            : "bg-white border border-gray-100 shadow-sm"
                                    }`}
                            >
                                {loading ? (
                                    <div className="w-2.5 h-2.5 rounded-full bg-gray-200 animate-pulse" />
                                ) : isAttended ? (
                                    <motion.div
                                        initial={{ scale: 0, rotate: -30 }}
                                        animate={{ scale: 1, rotate: 0 }}
                                        transition={{ type: "spring", stiffness: 300, damping: 15, delay: index * 0.06 }}
                                        className="flex items-center justify-center"
                                    >
                                        <span className="text-white text-lg font-bold">✓</span>
                                    </motion.div>
                                ) : isToday ? (
                                    <motion.div
                                        animate={{ scale: [1, 1.3, 1] }}
                                        transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                                        className="w-2 h-2 rounded-full bg-orange-400"
                                    />
                                ) : isPast ? (
                                    <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                                ) : (
                                    <div className="w-1.5 h-1.5 rounded-full bg-gray-200" />
                                )}

                                {/* Glow ring for attended */}
                                {isAttended && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: [0.4, 0, 0.4], scale: [1, 1.4, 1] }}
                                        transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                                        className="absolute inset-0 rounded-2xl bg-orange-400/20"
                                    />
                                )}
                            </motion.div>

                            {/* Date number */}
                            <span className={`text-xs font-black drop-shadow-sm ${isAttended ? "text-white" : isToday ? "text-orange-500" : "text-gray-400"
                                }`}>
                                {format(day, "d")}
                            </span>
                        </motion.div>
                    );
                })}
            </div>

            {/* Progress bar */}
            <div className="mt-5 px-3">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Weekly Goal</span>
                    <span className="text-[11px] font-black text-orange-600 uppercase tracking-widest">{attendedCount} of 7 days</span>
                </div>
                <div className="h-2.5 bg-gray-100/80 rounded-full overflow-hidden shadow-inner border border-gray-200/50">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(attendedCount / 7) * 100}%` }}
                        transition={{ duration: 0.8, ease: "easeOut", delay: 0.5 }}
                        className="h-full bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-500 rounded-full"
                    />
                </div>
            </div>
        </motion.div>
    );
};
