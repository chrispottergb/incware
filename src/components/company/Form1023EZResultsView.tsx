import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Eye, CheckCircle2, XCircle, RotateCcw } from "lucide-react";
import { QUESTIONS_1023EZ, type ScreenerAnswers } from "./Form1023EZScreener";

interface Props {
  answers: ScreenerAnswers | null;
  result: "Pass" | "Fail" | string | null;
  runDate: string | null;
  onRerun: () => void;
}

export function Form1023EZResultsView({ answers, result, runDate, onRerun }: Props) {
  const [open, setOpen] = useState(false);
  const isPass = result === "Pass";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Eye className="h-3 w-3 mr-1" /> View Screener Results
      </Button>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Form 1023-EZ Screener Results</DialogTitle>
          <DialogDescription>Read-only record of the most recent eligibility screener.</DialogDescription>
        </DialogHeader>

        <div
          className={
            "rounded-md border p-3 flex items-center justify-between " +
            (isPass ? "border-green-600 bg-green-50" : "border-destructive bg-destructive/10")
          }
        >
          <div className={"flex items-center gap-2 font-semibold " + (isPass ? "text-green-700" : "text-destructive")}>
            {isPass ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
            Result: {result ?? "—"}
          </div>
          <div className="text-xs text-muted-foreground">Run date: {runDate ?? "—"}</div>
        </div>

        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-2 font-medium w-10">#</th>
                <th className="text-left p-2 font-medium">Question</th>
                <th className="text-left p-2 font-medium w-20">Answer</th>
              </tr>
            </thead>
            <tbody>
              {QUESTIONS_1023EZ.map((q) => {
                const a = answers?.[q.id];
                return (
                  <tr key={q.id} className="border-t align-top">
                    <td className="p-2 text-xs text-muted-foreground">{q.id}</td>
                    <td className="p-2 text-xs leading-relaxed">{q.text}</td>
                    <td className="p-2">
                      {a ? (
                        <span
                          className={
                            "inline-block px-2 py-0.5 rounded text-xs font-medium " +
                            (a === "Yes"
                              ? "bg-destructive/10 text-destructive"
                              : "bg-green-100 text-green-700")
                          }
                        >
                          {a}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            Close
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setOpen(false);
              onRerun();
            }}
          >
            <RotateCcw className="h-3 w-3 mr-1" /> Re-run Screener
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
