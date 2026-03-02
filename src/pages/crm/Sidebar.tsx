
import { motion, AnimatePresence } from "framer-motion";
import {
    Users,
    Settings,
    LogOut,
    Menu,
    X,
    CreditCard,
    Calendar,
    MessageCircle,
    BarChart3,
    ClipboardList,
    Link2
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
    currentSection: string;
    setCurrentSection: (section: any) => void;
    onLogout: () => void;
    className?: string;
}

const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 }, // Added Dashboard/Analytics as first item
    { id: 'users', label: 'User Management', icon: Users },
    { id: 'chats', label: 'Chats', icon: MessageCircle },
    { id: 'reminders', label: 'Reminders', icon: Calendar }, // Added Pabbly Reminders
    { id: 'followup', label: 'Leads Management', icon: ClipboardList }, // Renamed for professional look
    { id: 'session-links', label: 'Session Settings', icon: Link2 },
    { id: 'others', label: 'Others', icon: Settings }, // For future expansion
];

export function Sidebar({
    isOpen,
    setIsOpen,
    currentSection,
    setCurrentSection,
    onLogout,
    className
}: SidebarProps) {

    return (
        <>
            <motion.div
                className={cn(
                    "fixed left-0 top-0 h-full bg-[#0f172a] text-white z-50 flex flex-col shadow-xl", // Dark navy background
                    className
                )}
                animate={{ width: isOpen ? 260 : 80 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-700/50">
                    <motion.div
                        className="flex items-center gap-2 overflow-hidden"
                        animate={{ opacity: isOpen ? 1 : 0 }}
                    >
                        <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center shrink-0">
                            <img src="/favicon.ico" alt="Logo" className="w-8 h-8 rounded-lg" />
                        </div>
                        <span className="text-lg font-bold whitespace-nowrap">Snehayoga CRM</span>
                    </motion.div>
                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        className="p-1 hover:bg-gray-700 rounded-md transition-colors"
                    >
                        {isOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>
                </div>

                {/* Menu Items */}
                <div className="flex-1 py-4 overflow-y-auto space-y-1 px-2">
                    {menuItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setCurrentSection(item.id)}
                            className={cn(
                                "w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-200 group relative",
                                currentSection === item.id
                                    ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20"
                                    : "text-gray-400 hover:bg-gray-800 hover:text-white"
                            )}
                        >
                            <item.icon size={22} strokeWidth={1.5} className="shrink-0" />

                            <AnimatePresence>
                                {isOpen && (
                                    <motion.span
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -10 }}
                                        className="font-medium whitespace-nowrap"
                                    >
                                        {item.label}
                                    </motion.span>
                                )}
                            </AnimatePresence>

                            {/* Tooltip for collapsed state */}
                            {!isOpen && (
                                <div className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                                    {item.label}
                                </div>
                            )}
                        </button>
                    ))}
                </div>

                {/* Footer / Logout */}
                <div className="p-4 border-t border-gray-700/50">
                    <button
                        onClick={onLogout}
                        className="w-full flex items-center gap-3 p-3 rounded-lg text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors group"
                    >
                        <LogOut size={22} strokeWidth={1.5} className="shrink-0" />
                        <AnimatePresence>
                            {isOpen && (
                                <motion.span
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="font-medium whitespace-nowrap"
                                >
                                    Logout
                                </motion.span>
                            )}
                        </AnimatePresence>
                    </button>
                </div>
            </motion.div>
        </>
    );
}
