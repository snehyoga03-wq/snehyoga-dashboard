import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { FileCode, DownloadCloud, Image as ImageIcon, Sparkles, Check, ExternalLink } from "lucide-react";
import { WhatsAppConfig, MetaTemplate, fetchMetaTemplates } from "@/services/whatsappAutomationService";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface TemplateSettingsCardProps {
  config: WhatsAppConfig;
  templates: MetaTemplate[];
  selectedTemplate: MetaTemplate | null;
  onSelectTemplate: (t: MetaTemplate | null) => void;
  onTemplatesFetched: (tpls: MetaTemplate[]) => void;
  dynamicParams: string;
  onDynamicParamsChange: (params: string) => void;
  headerImageUrl: string;
  onHeaderImageUrlChange: (url: string) => void;
}

const MEDIA_LIBRARY_PRESETS = [
  {
    title: "Morning Yoga Session Poster",
    category: "Daily Classes",
    url: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=1000&q=80"
  },
  {
    title: "Meditation & Mind Therapy",
    category: "Programs",
    url: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1000&q=80"
  },
  {
    title: "Face Yoga & Wellness",
    category: "Faceyoga",
    url: "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1000&q=80"
  },
  {
    title: "Snehyoga Class Reminder",
    category: "Reminders",
    url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=1000&q=80"
  }
];

export const TemplateSettingsCard: React.FC<TemplateSettingsCardProps> = ({
  config,
  templates,
  selectedTemplate,
  onSelectTemplate,
  onTemplatesFetched,
  dynamicParams,
  onDynamicParamsChange,
  headerImageUrl,
  onHeaderImageUrlChange
}) => {
  const { toast } = useToast();
  const [isFetching, setIsFetching] = useState(false);
  const [showMediaModal, setShowMediaModal] = useState(false);

  const handleFetchTemplates = async () => {
    if (!config.apiToken || !config.wabaId) {
      toast({
        title: "Missing Config",
        description: "Please specify your API Token and WABA Account ID in the Credentials card above.",
        variant: "destructive"
      });
      return;
    }

    setIsFetching(true);
    const res = await fetchMetaTemplates(config);
    setIsFetching(false);

    if (res.success && res.templates.length > 0) {
      onTemplatesFetched(res.templates);
      toast({
        title: "Templates Synced ✅",
        description: `Loaded ${res.templates.length} approved templates directly from Meta WABA.`
      });
      if (!selectedTemplate) {
        onSelectTemplate(res.templates[0]);
      }
    } else {
      toast({
        title: "Sync Warning",
        description: res.error || "No templates found in this WABA account.",
        variant: "destructive"
      });
    }
  };

  // Preview replacement with sample values
  const renderPreviewBody = () => {
    if (!selectedTemplate?.body) return "Select a template above to preview its WhatsApp message layout.";
    let preview = selectedTemplate.body;
    const sampleVals = ["Rahul Sharma", "6:00 AM", "15 days", "https://yoga.snehyoga.com/live"];
    
    // Replace {{1}}, {{2}}, etc.
    preview = preview.replace(/\{\{(\d+)\}\}/g, (_, num) => {
      const idx = parseInt(num, 10) - 1;
      return sampleVals[idx] || `[Var ${num}]`;
    });
    return preview;
  };

  return (
    <Card className="border border-slate-200/80 shadow-sm bg-white overflow-hidden">
      <CardHeader className="bg-slate-50 border-b border-slate-100 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-slate-900">
                Template Settings & Parameters
              </CardTitle>
              <p className="text-xs text-slate-500">Sync approved Meta message templates and configure dynamic parameters</p>
            </div>
          </div>

          <Button
            onClick={handleFetchTemplates}
            disabled={isFetching}
            variant="outline"
            className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-semibold text-xs h-9 shadow-sm shrink-0"
          >
            <DownloadCloud className={`w-4 h-4 mr-2 ${isFetching ? "animate-bounce" : ""}`} />
            {isFetching ? "Fetching from Meta..." : "Fetch from Meta"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Template Selector & Meta Badge */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Choose Approved Meta Template</label>
            {templates.length > 0 && (
              <span className="text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                {templates.length} templates available
              </span>
            )}
          </div>

          {templates.length === 0 ? (
            <div className="p-4 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center space-y-2">
              <p className="text-xs text-slate-500">No templates cached yet. Click "Fetch from Meta" to pull your approved templates.</p>
              <Button size="sm" variant="secondary" onClick={handleFetchTemplates} disabled={isFetching} className="text-xs">
                Fetch Templates Now
              </Button>
            </div>
          ) : (
            <select
              value={selectedTemplate?.name || ""}
              onChange={(e) => {
                const found = templates.find((t) => t.name === e.target.value);
                onSelectTemplate(found || null);
              }}
              className="w-full h-11 px-3.5 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">-- Select an Approved Template --</option>
              {templates.map((tpl) => (
                <option key={tpl.id || tpl.name} value={tpl.name}>
                  {tpl.name} ({tpl.category} • {tpl.language} • {tpl.paramCount} vars)
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Live Body Preview Card */}
        {selectedTemplate && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Left: Template Details & Parameters Mapping */}
            <div className="space-y-4">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Category:</span>
                  <span className="font-semibold text-slate-700">{selectedTemplate.category}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Language:</span>
                  <span className="font-mono font-semibold text-indigo-600">{selectedTemplate.language}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Placeholders Detected:</span>
                  <span className="font-semibold text-emerald-600">{selectedTemplate.paramCount} parameters</span>
                </div>
              </div>

              {/* Dynamic Parameters Input */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Dynamic Parameters Mapping
                  </label>
                  <span className="text-[11px] text-slate-400">Order maps to {`{{1}}, {{2}}`}</span>
                </div>
                <Input
                  value={dynamicParams}
                  onChange={(e) => onDynamicParamsChange(e.target.value)}
                  placeholder="name, batch_time, days_left"
                  className="font-mono text-xs border-slate-200"
                />
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Available tags: <strong className="text-slate-700">name</strong>,{" "}
                  <strong className="text-slate-700">batch_time</strong>,{" "}
                  <strong className="text-slate-700">days_left</strong>,{" "}
                  <strong className="text-slate-700">phone</strong>,{" "}
                  <strong className="text-slate-700">personal_link</strong>. Any literal string will be passed as-is.
                </p>
              </div>

              {/* Header Image URL + Media Library Selector */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Header Media (Optional Image URL)
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowMediaModal(true)}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
                  >
                    <ImageIcon className="w-3.5 h-3.5" /> Media Presets
                  </button>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={headerImageUrl}
                    onChange={(e) => onHeaderImageUrlChange(e.target.value)}
                    placeholder="https://example.com/banner.jpg"
                    className="text-xs border-slate-200"
                  />
                  {headerImageUrl && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onHeaderImageUrlChange("")}
                      className="text-xs text-rose-600 hover:bg-rose-50"
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Right: WhatsApp Phone Simulation Preview */}
            <div className="flex flex-col">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                Live WhatsApp Message Preview
              </span>
              <div className="flex-1 bg-[#efeae2] border border-[#d1d7db] rounded-2xl p-4 shadow-inner relative flex flex-col justify-between min-h-[220px]">
                {/* Simulated WhatsApp Chat Bubble */}
                <div className="max-w-[88%] bg-white rounded-2xl rounded-tl-none p-3.5 shadow-sm space-y-2 border border-black/5 self-start">
                  {/* Header Image if set */}
                  {headerImageUrl && (
                    <div className="rounded-lg overflow-hidden border border-slate-100 max-h-36">
                      <img
                        src={headerImageUrl}
                        alt="Header Banner"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                    </div>
                  )}

                  {/* Body Text */}
                  <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed font-sans">
                    {renderPreviewBody()}
                  </p>

                  <div className="flex justify-end items-center gap-1 text-[10px] text-slate-400 pt-1">
                    <span>10:30 AM</span>
                    <span className="text-emerald-500 font-bold">✓✓</span>
                  </div>
                </div>

                <div className="text-center pt-2">
                  <span className="text-[10px] text-slate-500 font-medium bg-white/70 px-2.5 py-0.5 rounded-full border border-black/5">
                    Previewing with sample variables
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Media Library Modal */}
        <Dialog open={showMediaModal} onOpenChange={setShowMediaModal}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-bold">
                <ImageIcon className="w-5 h-5 text-indigo-600" />
                Select from Media Library Presets
              </DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3 py-3">
              {MEDIA_LIBRARY_PRESETS.map((m, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    onHeaderImageUrlChange(m.url);
                    setShowMediaModal(false);
                    toast({ title: "Media Applied", description: `Selected "${m.title}"` });
                  }}
                  className="group cursor-pointer rounded-xl border border-slate-200 overflow-hidden hover:border-indigo-500 hover:shadow-md transition-all"
                >
                  <div className="h-28 overflow-hidden bg-slate-100 relative">
                    <img src={m.url} alt={m.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    <span className="absolute top-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded bg-black/60 text-white backdrop-blur-sm">
                      {m.category}
                    </span>
                  </div>
                  <div className="p-2.5 bg-white">
                    <p className="text-xs font-semibold text-slate-800 truncate">{m.title}</p>
                    <p className="text-[11px] text-indigo-600 font-medium mt-0.5 group-hover:underline">Use this image →</p>
                  </div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
