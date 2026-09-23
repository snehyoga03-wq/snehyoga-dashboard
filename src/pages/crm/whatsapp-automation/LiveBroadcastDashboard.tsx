import React, { useEffect, useRef } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BroadcastProgress } from "@/services/whatsappAutomationService";
import {
  Terminal, Pause, Play, Square, ArrowLeft, CheckCircle2,
  XCircle, ShieldAlert, Sparkles, Activity, AlertTriangle
} from "lucide-react";

interface LiveBroadcastDashboardProps {
  progress: BroadcastProgress;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onClose: () => void;
}

export const LiveBroadcastDashboard: React.FC<LiveBroadcastDashboardProps> = ({
  progress,
  onPause,
  onResume,
  onStop,
  onClose
}) => {
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const isComplete = progress.processed >= progress.total && progress.total > 0;

  // Auto-scroll terminal log
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [progress.logs]);

  // Warn user on window close during active broadcast
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isComplete && !progress.isStopped) {
        e.preventDefault();
        e.returnValue = "A WhatsApp broadcast is actively running. Leaving now will stop transmission.";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isComplete, progress.isStopped]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-slate-100 max-h-[90vh]">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isComplete ? "bg-emerald-500/20 text-emerald-400" : "bg-indigo-500/20 text-indigo-400"}`}>
              <Activity className={`w-5 h-5 ${!isComplete && !progress.isPaused ? "animate-pulse" : ""}`} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Live Broadcast Execution Engine
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                  isComplete
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                    : progress.isPaused
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                    : "bg-indigo-500/20 text-indigo-300 border-indigo-500/30 animate-pulse"
                }`}>
                  {isComplete ? "COMPLETED" : progress.isPaused ? "PAUSED" : "ACTIVE TRANSMISSION"}
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Streaming real-time Meta Graph API message acknowledgments</p>
            </div>
          </div>

          {/* Return button if finished or stopped */}
          {(isComplete || progress.isStopped) && (
            <Button
              onClick={onClose}
              variant="outline"
              className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 font-semibold text-xs h-9"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Return to Configurator
            </Button>
          )}
        </div>

        {/* Counters Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-6 border-b border-slate-800/80 bg-slate-900/60">
          <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-800">
            <span className="text-xs text-slate-400 font-medium">Total Queue</span>
            <p className="text-2xl font-bold text-white mt-1">{progress.total}</p>
            <div className="text-[11px] text-slate-500 mt-0.5">Processed: {progress.processed}</div>
          </div>

          <div className="bg-emerald-950/20 rounded-2xl p-4 border border-emerald-800/30">
            <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Delivered
            </span>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{progress.delivered}</p>
            <div className="text-[11px] text-emerald-500/80 mt-0.5">
              Success Rate: {progress.processed > 0 ? Math.round((progress.delivered / progress.processed) * 100) : 0}%
            </div>
          </div>

          <div className="bg-rose-950/20 rounded-2xl p-4 border border-rose-800/30">
            <span className="text-xs text-rose-400 font-medium flex items-center gap-1">
              <XCircle className="w-3.5 h-3.5" /> Failed
            </span>
            <p className="text-2xl font-bold text-rose-400 mt-1">{progress.failed}</p>
            <div className="text-[11px] text-rose-500/80 mt-0.5">Delivery errors logged</div>
          </div>

          <div className="bg-amber-950/20 rounded-2xl p-4 border border-amber-800/30">
            <span className="text-xs text-amber-400 font-medium flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5" /> Blocked Skipped
            </span>
            <p className="text-2xl font-bold text-amber-400 mt-1">{progress.blocked}</p>
            <div className="text-[11px] text-amber-500/80 mt-0.5">customer_blocks table</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="px-6 py-4 bg-slate-900 border-b border-slate-800">
          <div className="flex justify-between items-center text-xs font-semibold text-slate-400 mb-2">
            <span>Overall Dispatch Progress</span>
            <span className="text-indigo-400 font-bold font-mono">{progress.percent}%</span>
          </div>
          <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden p-0.5">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 via-blue-500 to-emerald-500 rounded-full transition-all duration-300 shadow-sm shadow-indigo-500/50"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>

        {/* Streaming Dark Terminal Log */}
        <div className="flex-1 p-6 flex flex-col min-h-[260px] max-h-[360px] bg-black/60 font-mono">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span className="font-semibold text-slate-300">Live Meta Graph Stream</span>
            </div>
            <span className="text-[11px] text-slate-500">Auto-scrolling stream</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 pt-3 text-xs leading-relaxed">
            {progress.logs.length === 0 ? (
              <p className="text-slate-600 italic">Waiting for initial batch worker start...</p>
            ) : (
              progress.logs.map((log) => {
                const isSuccess = log.type === "success";
                const isFailed = log.type === "failed";
                const isBlocked = log.type === "blocked";
                return (
                  <div
                    key={log.id}
                    className={`flex items-start gap-2 ${
                      isSuccess
                        ? "text-emerald-400"
                        : isFailed
                        ? "text-rose-400 font-semibold"
                        : isBlocked
                        ? "text-amber-400"
                        : "text-slate-300"
                    }`}
                  >
                    <span className="text-slate-500 shrink-0 font-mono text-[11px]">{log.time}</span>
                    <span className="break-all">{log.text}</span>
                  </div>
                );
              })
            )}
            <div ref={terminalEndRef} />
          </div>
        </div>

        {/* Footer Actions: Pause, Resume, Stop */}
        <div className="p-5 bg-slate-900 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <span>Do not close this browser tab while transmission is actively running.</span>
          </div>

          <div className="flex items-center gap-2.5">
            {!isComplete && !progress.isStopped && (
              <>
                {progress.isPaused ? (
                  <Button
                    onClick={onResume}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-9"
                  >
                    <Play className="w-3.5 h-3.5 mr-1.5 fill-current" /> Resume
                  </Button>
                ) : (
                  <Button
                    onClick={onPause}
                    variant="outline"
                    className="border-amber-700 text-amber-400 hover:bg-amber-950/40 font-semibold text-xs h-9"
                  >
                    <Pause className="w-3.5 h-3.5 mr-1.5" /> Pause
                  </Button>
                )}

                <Button
                  onClick={onStop}
                  variant="destructive"
                  className="bg-rose-600 hover:bg-rose-700 font-semibold text-xs h-9"
                >
                  <Square className="w-3.5 h-3.5 mr-1.5 fill-current" /> Stop / Cancel
                </Button>
              </>
            )}

            {(isComplete || progress.isStopped) && (
              <Button
                onClick={onClose}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 px-6"
              >
                Return to Configurator
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
