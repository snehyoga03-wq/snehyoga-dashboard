import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  BookOpen, Plus, Search, Edit2, Trash2,
  Sparkles, Filter, Code, Eye, RefreshCw
} from "lucide-react";
import {
  KnowledgeBaseItem,
  addKnowledgeBaseItem,
  updateKnowledgeBaseItem,
  deleteKnowledgeBaseItem
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
  "Batches & Timings (Marathi)",
  "Batches & Timings (English)",
  "Batches & Timings (Hinglish)",
  "Subscription & Fees (Marathi)",
  "Subscription & Fees (English)",
  "Subscription & Fees (Hinglish)",
  "Free Trial & Demo (Marathi)",
  "Free Trial & Demo (English)",
  "Free Trial & Demo (Hinglish)",
  "Class Joining Link (Marathi)",
  "Class Joining Link (English)",
  "Diet Guidelines (Marathi)",
  "Diet Guidelines (English)",
  "Health & Therapy (Marathi)",
  "Health & Therapy (English)",
  "About Coach & Founder (English)",
  "Face Yoga & Programs (English)",
  "Human Support (General)"
];

export const KnowledgeBaseManager: React.FC<KnowledgeBaseManagerProps> = ({ knowledgeBase, onRefresh }) => {
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<KnowledgeBaseItem | null>(null);
  const [showPromptPreview, setShowPromptPreview] = useState(false);

  // Form State
  const [formCategory, setFormCategory] = useState("Batches & Timings (English)");
  const [formQuestion, setFormQuestion] = useState("");
  const [formAnswer, setFormAnswer] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filtered Items
  const filteredItems = knowledgeBase.filter((item) => {
    const matchesCat = selectedCategory === "All Categories" || item.category === selectedCategory;
    const matchesSearch =
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const handleOpenAdd = () => {
    setFormCategory("Batches & Timings (English)");
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
    if (!window.confirm("Are you sure you want to delete this FAQ entry from Knowledge Base?")) return;
    const success = await deleteKnowledgeBaseItem(id);
    if (success) {
      toast({ title: "Deleted", description: "FAQ item removed from AI database." });
      onRefresh();
    } else {
      toast({ title: "Delete Error", description: "Failed to delete item from database.", variant: "destructive" });
    }
  };

  return (
    <Card className="border border-slate-200/80 shadow-sm bg-white rounded-2xl overflow-hidden">
      <CardHeader className="bg-white border-b border-slate-100 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-purple-600" />
              Training Knowledge Base (RAG)
            </CardTitle>
            <p className="text-xs sm:text-sm text-slate-500">
              Add specific FAQs, rules, and diet plans. The AI will search this database to answer users accurately.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowPromptPreview(true)}
              className="text-xs font-semibold border-slate-200 text-slate-700 hover:bg-slate-50 h-10 px-3.5 rounded-xl"
            >
              <Eye className="w-3.5 h-3.5 mr-1.5" /> Prompt Preview
            </Button>
            <Button
              size="sm"
              onClick={handleOpenAdd}
              className="bg-[#e11d48] hover:bg-[#be123c] text-white font-semibold text-xs h-10 px-4 rounded-xl shadow-sm flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Add FAQ
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-5">
        {/* Category Filters & Search */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 w-full sm:w-auto">
            {CATEGORIES.slice(0, 6).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all whitespace-nowrap ${
                  selectedCategory === cat
                    ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search FAQs, topics & answers..."
              className="pl-9 h-10 text-xs border-slate-200 bg-slate-50/50 rounded-xl"
            />
          </div>
        </div>

        {/* Q&A Cards List */}
        <div className="space-y-3">
          {filteredItems.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              No knowledge base items matched your search filter. Click "+ Add FAQ" to create one.
            </div>
          ) : (
            filteredItems.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-xl border border-slate-200/80 bg-white hover:border-slate-300 hover:shadow-sm transition-all space-y-2 group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200">
                      {item.category}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900">{item.question}</h4>
                  </div>
                  <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(item)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-md transition-colors"
                      title="Edit FAQ"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteItem(item.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-md transition-colors"
                      title="Delete FAQ"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed font-sans pl-1">
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
          <DialogContent className="max-w-lg bg-white rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2 text-slate-900">
                <BookOpen className="w-5 h-5 text-purple-600" />
                {editingItem ? "Edit Knowledge Base Entry" : "Add Training FAQ Entry"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Category / Topic</label>
                <Input
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  placeholder="e.g. Schedule & Timing (Hinglish), Batches & Timings (Marathi)"
                  className="text-xs h-10 rounded-xl border-slate-200"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Student Question / Intent</label>
                <Input
                  value={formQuestion}
                  onChange={(e) => setFormQuestion(e.target.value)}
                  placeholder="e.g. Webinar kab hoga aur timing kya hai?"
                  className="text-xs h-10 rounded-xl border-slate-200 font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">AI Verified Answer</label>
                <textarea
                  value={formAnswer}
                  onChange={(e) => setFormAnswer(e.target.value)}
                  rows={4}
                  placeholder="Exact factual answer for WhatsApp reply..."
                  className="w-full p-3 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 leading-relaxed font-sans"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowAddModal(false);
                  setEditingItem(null);
                }}
                className="text-xs rounded-xl"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveItem}
                disabled={isSubmitting}
                className="bg-[#e11d48] hover:bg-[#be123c] text-white text-xs font-semibold rounded-xl"
              >
                {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                {editingItem ? "Save Changes" : "Add to Knowledge Base"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Prompt Preview Modal */}
        <Dialog open={showPromptPreview} onOpenChange={setShowPromptPreview}>
          <DialogContent className="max-w-2xl bg-white rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2 text-slate-900">
                <Sparkles className="w-5 h-5 text-purple-600" />
                Live Injected RAG Context Preview
              </DialogTitle>
            </DialogHeader>
            <div className="max-h-96 overflow-y-auto p-4 rounded-xl bg-slate-900 text-slate-200 font-mono text-xs space-y-2 whitespace-pre-wrap leading-relaxed">
              {knowledgeBase.map((k, i) => `${i + 1}. [${k.category}]\nQ: ${k.question}\nA: ${k.answer}`).join("\n\n")}
            </div>
            <DialogFooter>
              <Button size="sm" onClick={() => setShowPromptPreview(false)} className="rounded-xl">
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
