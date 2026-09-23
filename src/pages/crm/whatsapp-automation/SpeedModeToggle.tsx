import React from "react";
import { Zap, Clock, ShieldAlert, Sparkles } from "lucide-react";

interface SpeedModeToggleProps {
  speedMode: "turbo" | "standard";
  onChange: (mode: "turbo" | "standard") => void;
}

export const SpeedModeToggle: React.FC<SpeedModeToggleProps> = ({ speedMode, onChange }) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">Broadcast Speed Engine</h4>
            <p className="text-xs text-slate-500">Select delivery throughput mode based on your campaign size and Meta tier</p>
          </div>
        </div>

        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 w-fit">
          Current: {speedMode === "turbo" ? "⚡ Turbo High-Speed" : "🐢 Safe Sequential"}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
        {/* Option 1: Turbo Pub/Sub */}
        <div
          onClick={() => onChange("turbo")}
          className={`cursor-pointer rounded-xl p-4 border-2 transition-all relative overflow-hidden ${
            speedMode === "turbo"
              ? "border-amber-500 bg-amber-50/40 shadow-sm"
              : "border-slate-200 hover:border-slate-300 bg-slate-50/50"
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">⚡</span>
              <div>
                <p className="text-sm font-bold text-slate-900">Turbo Pub/Sub</p>
                <p className="text-xs text-amber-700 font-semibold">~100 msgs / second</p>
              </div>
            </div>
            {speedMode === "turbo" && (
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
            )}
          </div>
          <p className="text-xs text-slate-600 mt-2.5 leading-relaxed">
            Processes in concurrent chunks of <strong>25 parallel promises</strong> with a fast 10ms micro-delay. Ideal for urgent class start announcements and large lists.
          </p>
        </div>

        {/* Option 2: Standard Sequential */}
        <div
          onClick={() => onChange("standard")}
          className={`cursor-pointer rounded-xl p-4 border-2 transition-all relative overflow-hidden ${
            speedMode === "standard"
              ? "border-indigo-600 bg-indigo-50/40 shadow-sm"
              : "border-slate-200 hover:border-slate-300 bg-slate-50/50"
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">🐢</span>
              <div>
                <p className="text-sm font-bold text-slate-900">Standard Throttle</p>
                <p className="text-xs text-indigo-700 font-semibold">1 msg / second</p>
              </div>
            </div>
            {speedMode === "standard" && (
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
            )}
          </div>
          <p className="text-xs text-slate-600 mt-2.5 leading-relaxed">
            Sends sequentially with a <strong>1-second strict interval</strong>. Maximum compliance with Meta spam prevention filters on newly created or low-tier WABA numbers.
          </p>
        </div>
      </div>
    </div>
  );
};
