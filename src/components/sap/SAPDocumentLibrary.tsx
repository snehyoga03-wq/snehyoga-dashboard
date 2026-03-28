import { motion } from "framer-motion";
import {
  BookOpen,
  Crown,
  User,
  LogOut,
  Sparkles,
  Shield,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useRef, useEffect } from "react";

// Diet plan pages
const DIET_PAGES = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  src: `/diet/diet-page-${String(i + 1).padStart(4, "0")}.jpg`,
  alt: `संपूर्ण आहार सूत्र - Page ${i + 1}`,
}));

interface SAPDocumentLibraryProps {
  userName: string;
  onLogout: () => void;
}

export const SAPDocumentLibrary = ({
  userName,
  onLogout,
}: SAPDocumentLibraryProps) => {
  const [showScrollTop, setShowScrollTop] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Track scroll position for "back to top" button
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      setShowScrollTop(container.scrollTop > 600);
    };
    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div
      ref={scrollContainerRef}
      className="h-screen overflow-y-auto scroll-smooth"
      onContextMenu={(e) => e.preventDefault()}
      style={{ userSelect: "none", WebkitUserSelect: "none" }}
    >
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Top Bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/25">
              <Crown className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Welcome,</p>
              <p className="font-semibold text-sm text-foreground flex items-center gap-1">
                <User className="w-3.5 h-3.5" />
                {userName}
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={onLogout}
            className="text-muted-foreground hover:text-destructive transition-colors"
          >
            <LogOut className="w-4 h-4 mr-1" />
            Logout
          </Button>
        </div>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2 flex items-center justify-center gap-2">
            <BookOpen className="w-7 h-7 text-amber-500" />
            संपूर्ण आहार सूत्र
          </h1>
          <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            Exclusive Diet Plan for Premium Members
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          </p>
          <div className="flex items-center justify-center gap-2 mt-3 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 w-fit mx-auto">
            <Shield className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-xs font-medium text-amber-600">
              Read-Only • Downloads Disabled
            </span>
          </div>
        </motion.div>

        {/* Page Counter */}
        <div className="text-center mb-4">
          <span className="text-xs text-muted-foreground bg-card px-3 py-1 rounded-full border border-border/50">
            {DIET_PAGES.length} Pages
          </span>
        </div>

        {/* Diet Pages with Watermark */}
        <div className="space-y-3">
          {DIET_PAGES.map((page, idx) => (
            <motion.div
              key={page.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: idx * 0.05 }}
              className="relative rounded-xl overflow-hidden border border-border/30 shadow-lg bg-white"
              onContextMenu={(e) => e.preventDefault()}
              onDragStart={(e) => e.preventDefault()}
            >
              {/* Page number badge */}
              <div className="absolute top-3 left-3 z-20 bg-black/50 backdrop-blur-sm text-white text-xs font-medium px-2.5 py-1 rounded-full">
                {page.id} / {DIET_PAGES.length}
              </div>

              {/* The diet image */}
              <img
                src={page.src}
                alt={page.alt}
                className="w-full h-auto block pointer-events-none"
                draggable={false}
                loading={idx < 3 ? "eager" : "lazy"}
                onContextMenu={(e) => e.preventDefault()}
                onDragStart={(e) => e.preventDefault()}
              />

              {/* Transparent Logo Watermark - Center */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <img
                  src="/SNEHYOGA_FINAL_LOGO-removebg-preview.png"
                  alt=""
                  className="w-40 h-40 md:w-52 md:h-52 opacity-[0.08]"
                  draggable={false}
                />
              </div>

              {/* Transparent Logo Watermark - Bottom Right */}
              <div className="absolute bottom-4 right-4 pointer-events-none z-10">
                <img
                  src="/SNEHYOGA_FINAL_LOGO-removebg-preview.png"
                  alt=""
                  className="w-16 h-16 md:w-20 md:h-20 opacity-[0.15]"
                  draggable={false}
                />
              </div>

              {/* Anti-screenshot / Anti-save overlay */}
              <div
                className="absolute inset-0 z-10"
                onContextMenu={(e) => e.preventDefault()}
                onDragStart={(e) => e.preventDefault()}
                style={{ WebkitTouchCallout: "none" }}
              />
            </motion.div>
          ))}
        </div>

        {/* End notice */}
        <div className="text-center mt-8 mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-medium text-amber-600">
              End of Diet Plan
            </span>
            <Sparkles className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-xs text-muted-foreground/60 mt-3">
            <Shield className="w-3 h-3 inline mr-1" />
            This content is protected. Downloading, copying, or sharing is not
            permitted.
          </p>
        </div>
      </div>

      {/* Scroll to top button */}
      {showScrollTop && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-xl shadow-amber-500/30 flex items-center justify-center z-50 hover:scale-110 transition-transform"
        >
          <ChevronUp className="w-6 h-6" />
        </motion.button>
      )}
    </div>
  );
};
