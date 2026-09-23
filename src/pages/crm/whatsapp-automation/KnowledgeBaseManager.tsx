import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  BookOpen, Plus, Search, Edit2, Trash2, CheckCircle2,
  Sparkles, Filter, Code, Eye, RefreshCw
} from "lucide-react";
import {
  KnowledgeBaseItem,
  addKnowledgeBaseItem,
  updateKnowledgeBaseItem,
  deleteKnowledgeBaseItem,
  fetchKnowledgeBase
} from "@/services/whatsappAutomationService";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";

interface KnowledgeBaseManagerProps {
  knowledgeBase: KnowledgeBaseItem[];
  onRefresh: () => void;
}

const CATEGORIES = [
  "All Categories",
  "Batches & Timings",
  "Live Class Link",
  "Subscription & Fees",
  "Free Trial / Demo",
  "Diet Guidelines",
  "Medical & Therapy",
  "General"
];

export const KnowledgeBaseManager: React.FC<KnowledgeBaseManagerProps> = ({ knowledgeBase, onRefresh }) => {
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<KnowledgeBaseItem | null>(null);
  const [showPromptPreview, setShowPromptPreview] = useState(false);

  // Form State
  const [formCategory, setFormCategory] = useState("Batches & Timings");
  const [formQuestion, setFormQuestion] = useState("");
  const [formAnswer, setFormAnswer] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filtered Items
  const filteredItems = knowledgeBase.filter((item) => {
    const matchesCat = selectedCategory === "All Categories" || item.category === selectedCategory;
    const matchesSearch =
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const handleOpenAdd = () => {
    setFormCategory("Batches & Timings");
    setFormQuestion("");
    setFormAnswer("");
    setShowAddModal(true);
  };

  const handleOpenEdit = (item: KnowledgeBaseItem) => {
    setEditingItem(item);
    setFormCategory(item.category);
    setFormQuestion(item.question);
    setFormAnswer(item.answer);
  };

  const handleSaveItem = async () => {
    if (!formQuestion.trim() || !formAnswer.trim()) {
      toast({ title: "Incomplete Form", description: "Question and Answer are required.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    let success = false;
    if (editingItem) {
      success = await updateKnowledgeBaseItem(editingItem.id, {
        category: formCategory,
        question: formQuestion,
        answer: formAnswer
      });
      if (success) toast({ title: "Q&A Updated ✅", description: "Knowledge base entry revised." });
    } else {
      success = await addKnowledgeBaseItem({
        category: formCategory,
        question: formQuestion,
        answer: formAnswer
      });
      if (success) toast({ title: "Q&A Added ✅", description: "New knowledge base item saved." });
    }
    setIsSubmitting(false);

    if (success) {
      setShowAddModal(false);
      setEditingItem(null);
      onRefresh();
    } else {
      toast({ title: "Error Saving", description: "Could not save entry to database.", variant: "destructive" });
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this Knowledge Base entry?")) return;
    const success = await deleteKnowledgeBaseItem(id);
    if (success) {
      toast({ title: "Deleted", description: "Knowledge Base item removed." });
      onRefresh();
    } else {
      toast({ title: "Delete Error", description: "Failed to delete item from database.", variant: "destructive" });
    }
  };

  return (
    <Card className="border border-slate-200/80 shadow-sm bg-white overflow-hidden">
      <CardHeader className="bg-slate-50 border-b border-slate-100 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-slate-900">
                AI Knowledge Base Manager
              </CardTitle>
              <p className="text-xs text-slate-500">
                Verified Q&A pairs dynamically injected into Google Gemini prompt for accurate student guidance
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowPromptPreview(true)}
              className="text-xs font-semibold border-purple-200 text-purple-700 hover:bg-purple-50 h-9"
            >
              <Eye className="w-3.5 h-3.5 mr-1.5" /> Prompt Preview
            </Button>
            <Button
              size="sm"
              onClick={handleOpenAdd}
              className="bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs h-9 shadow-sm"
            >
              <Plus className="w-4 h-4 mr-1" /> Add New Q&A
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-5">
        {/* Category Filters & Search */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 w-full sm:w-auto">
            {CATEGORIES.slice(0, 5).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all whitespace-nowrap ${
                  selectedCategory === cat
                    ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search FAQs & answers..."
              className="pl-9 h-9 text-xs border-slate-200"
            />
          </div>
        </div>

        {/* Q&A Cards List */}
        <div className="space-y-3">
          {filteredItems.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              No knowledge base items matched your query. Click "Add New Q&A" to create one.
            </div>
          ) : (
            filteredItems.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-xl border border-slate-200 bg-white hover:border-purple-300 hover:shadow-sm transition-all space-y-2 group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                      {item.category}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 pt-0.5">{item.question}</h4>
                  </div>
                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(item)}
                      className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-md"
                      title="Edit"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteItem(item.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-slate-100 rounded-md"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed font-sans pl-2 border-l-2 border-purple-200">
                  {item.answer}
                </p>
              </div>
            ))
          )}
        </div>

        {/* Add/Edit Modal */}
        <Dialog open={showAddModal || !!editingItem} onOpenChange={(open) => {
          if (!open) {
            setShowAddModal(false);
            setEditingItem(null);
          }
        }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-purple-600" />
                {editingItem ? "Edit Knowledge Base Entry" : "Add Knowledge Base Entry"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Category</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 text-xs font-medium text-slate-800 bg-white"
                >
                  {CATEGORIES.filter(c => c !== "All Categories").map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Student Question / Topic</label>
                <Input
                  value={formQuestion}
                  onChange={(e) => setFormQuestion(e.target.value)}
                  placeholder="e.g. Can I attend yoga if I have back pain?"
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Verified Answer</label>
                <textarea
                  value={formAnswer}
                  onChange={(e) => setFormAnswer(e.target.value)}
                  placeholder="e.g. Yes, our Mind & Spine Program (MSP) is specifically customized for lumbar and cervical spine therapy..."
                  className="w-full h-28 p-3 rounded-lg border border-slate-200 text-xs leading-relaxed"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowAddModal(false);
                  setEditingItem(null);
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveItem}
                disabled={isSubmitting}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold"
              >
                {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                Save Entry
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Prompt Injection Preview Modal */}
        <Dialog open={showPromptPreview} onOpenChange={setShowPromptPreview}>
          <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-bold">
                <Code className="w-5 h-5 text-purple-600" />
                Live Prompt Injected Context
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto p-4 bg-slate-900 text-slate-200 rounded-xl font-mono text-xs whitespace-pre-wrap leading-relaxed">
              {`// Injected into Google Gemini system instructions:\n\nVerified Knowledge Base:\n` +
                knowledgeBase.map((k, i) => `${i + 1}. [${k.category}] Q: ${k.question}\nA: ${k.answer}`).join("\n\n")}
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
