import { motion, AnimatePresence } from "framer-motion";
import { FileDown, Archive, FileText, X } from "lucide-react";

interface Props { count: number; onClear: () => void; }

export function BulkActionBar({ count, onClear }: Props) {
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 px-2 py-1.5 rounded-full text-white"
          style={{ background: "#1A1A1A" }}
        >
          <span
            className="text-[12px] px-2.5 py-1 rounded-full font-medium text-white"
            style={{ background: "var(--v2-brand)" }}
          >
            {count} selected
          </span>
          <BulkBtn icon={FileDown} label="Export" testId="bulk-export-btn" />
          <BulkBtn icon={Archive} label="Archive" testId="bulk-archive-btn" />
          <BulkBtn icon={FileText} label="Generate Annual Report" testId="bulk-annual-report-btn" />
          <button
            onClick={onClear}
            aria-label="Clear selection"
            className="h-7 w-7 rounded-full hover:bg-white/10 flex items-center justify-center"
          >
            <X size={13} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function BulkBtn({ icon: Icon, label, testId }: { icon: any; label: string; testId?: string }) {
  return (
    <button
      data-testid={testId}
      onClick={() => console.log("Bulk action:", label)}
      className="h-7 px-2.5 rounded-full text-[12px] flex items-center gap-1.5 hover:bg-white/10 transition-colors duration-150"
    >
      <Icon size={12} /> {label}
    </button>
  );
}
