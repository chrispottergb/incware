import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DatePickerField } from "@/components/ui/date-picker-field";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The saved election date, used to validate the end date. */
  electionDate: string;
  /** "ended" keeps the election date and records when it ended. */
  onEnded: (revocationDate: string) => void;
  /** "error" clears the election entirely, as before. */
  onEnteredInError: () => void;
}

/**
 * Shown when a saved S election is unchecked. An election that ENDED is history
 * that older meetings still depend on, so it is kept with an end date rather
 * than erased. Only an election entered by mistake is cleared.
 */
export default function SElectionEndDialog({
  open,
  onOpenChange,
  electionDate,
  onEnded,
  onEnteredInError,
}: Props) {
  const [mode, setMode] = useState<"ended" | "error" | null>(null);
  const [date, setDate] = useState("");
  const [error, setError] = useState("");

  const reset = () => {
    setMode(null);
    setDate("");
    setError("");
  };

  const handleConfirm = () => {
    if (mode === "error") {
      onEnteredInError();
      reset();
      onOpenChange(false);
      return;
    }
    if (!date) {
      setError("Enter the date the S election ended.");
      return;
    }
    if (electionDate && date <= electionDate) {
      setError("The end date must be after the date of the S election.");
      return;
    }
    onEnded(date);
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="min-w-[600px]">
        <DialogHeader>
          <DialogTitle>Did the S election end, or was it entered in error?</DialogTitle>
          <DialogDescription>
            Meetings from the years the election was in effect still print S corporation
            language, so an election that ended is kept on file with its end date.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <button
            type="button"
            onClick={() => {
              setMode("ended");
              setError("");
            }}
            className={`w-full rounded-md border px-3 py-2.5 text-left text-sm transition-colors ${
              mode === "ended" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
            }`}
          >
            <span className="font-medium">The S election ended</span>
            <span className="block text-[11px] text-muted-foreground">
              Keeps the election date on file and records when it stopped applying
            </span>
          </button>

          {mode === "ended" && (
            <div className="field-group max-w-xs pl-3">
              <Label className="field-label">Date the S election ended</Label>
              <DatePickerField value={date} onChange={(v) => { setDate(v || ""); setError(""); }} />
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setMode("error");
              setError("");
            }}
            className={`w-full rounded-md border px-3 py-2.5 text-left text-sm transition-colors ${
              mode === "error" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
            }`}
          >
            <span className="font-medium">It was entered in error</span>
            <span className="block text-[11px] text-muted-foreground">
              Removes the election date completely
            </span>
          </button>

          {error && <p className="text-[11px] text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!mode}>
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
