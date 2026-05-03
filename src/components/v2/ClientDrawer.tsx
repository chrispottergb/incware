import { motion, AnimatePresence } from "framer-motion";
import type { ClientRow } from "@/data/v2-clients";
import { StatusPill } from "./StatusPill";
import { EntityMark } from "./EntityMark";
import { X } from "lucide-react";

interface Props { row: ClientRow | null; onClose: () => void; }

export function ClientDrawer({ row, onClose }: Props) {
  return (
    <AnimatePresence>
      {row && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 z-40" onClick={onClose}
          />
          <motion.aside
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.25 }}
            className="fixed top-0 right-0 bottom-0 w-[440px] z-50 border-l overflow-y-auto"
            style={{ background: "var(--v2-bg-card)", borderColor: "var(--v2-border)" }}
          >
            <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: "var(--v2-border)" }}>
              <div className="flex items-center gap-3">
                <EntityMark size={36} />
                <div>
                  <div className="v2-serif text-[18px] font-semibold leading-tight">{row.name}</div>
                  <div className="v2-mono text-[11px]" style={{ color: "var(--v2-text-meta)" }}>EIN · {row.ein}</div>
                </div>
              </div>
              <button onClick={onClose} aria-label="Close" className="h-8 w-8 rounded hover:bg-[color:var(--v2-row-hover)]">
                <X size={15} className="mx-auto" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <Field label="Type" value={row.type} />
              <Field label="State" value={row.state} mono />
              <Field label="Incorporation Date" value={row.inc} mono />
              <Field label="Fiscal Year End" value={row.fye} mono />
              <div>
                <div className="text-[10.5px] uppercase tracking-wider mb-1" style={{ color: "var(--v2-text-meta)" }}>Status</div>
                <StatusPill status={row.status} />
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-wider mb-1" style={{ color: "var(--v2-text-meta)" }}>{label}</div>
      <div className={`text-[13.5px] ${mono ? "v2-mono" : ""}`} style={{ color: "var(--v2-text-primary)" }}>{value}</div>
    </div>
  );
}
