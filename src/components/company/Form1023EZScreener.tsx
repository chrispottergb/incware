import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ClipboardCheck, CheckCircle2, XCircle, RotateCcw } from "lucide-react";

interface Question {
  id: number;
  text: string;
  why: string;
}

export const QUESTIONS_1023EZ: Question[] = [
  { id: 1, text: "Do you project that your annual gross receipts will exceed $50,000 in any of the next 3 years?", why: "Gross receipts are total amounts received from all sources without subtracting costs or expenses. Consider this year and the next 2 years." },
  { id: 2, text: "Have your annual gross receipts exceeded $50,000 in any of the past 3 years?", why: "Past receipts exceeding this threshold disqualify you from using the simplified form." },
  { id: 3, text: "Do you have total assets with a fair market value exceeding $250,000?", why: "Total assets include cash, receivables, investments, land, buildings, equipment, and all other assets." },
  { id: 4, text: "Were you formed under the laws of a foreign country?", why: "You must be formed under the laws of the United States, its states or territories, federally recognized Indian tribal or Alaskan native governments, or the District of Columbia." },
  { id: 5, text: "Is your mailing address in a foreign country?", why: "Your mailing address is where all IRS correspondence will be sent and must be domestic." },
  { id: 6, text: "Are you a successor to, or controlled by, an entity suspended under section 501(p) as a terrorist organization?", why: "Organizations connected to designated terrorist organizations are ineligible." },
  { id: 7, text: "Are you organized as an entity other than a corporation, unincorporated association, or trust (for example, an LLC)?", why: "Only corporations, unincorporated associations, and trusts may use Form 1023-EZ." },
  { id: 8, text: "Are you formed as a for-profit entity?", why: "Only nonprofit entities may apply for 501(c)(3) tax-exempt status." },
  { id: 9, text: "Are you a successor to a for-profit entity?", why: "You are a successor if you have substantially taken over assets or activities of a for-profit entity, been converted or merged from one, or installed the same officers or directors." },
  { id: 10, text: "Were you previously revoked or are you a successor to a previously revoked organization (other than automatic revocation for failure to file Form 990 for 3 consecutive years)?", why: "Prior revocations for cause require the full Form 1023." },
  { id: 11, text: "Are you currently recognized as tax exempt under another section of IRC 501(a), or were you previously exempt under another section?", why: "Organizations with existing or prior exemptions under other IRC sections must use Form 1023." },
  { id: 12, text: "Are you a church or a convention or association of churches?", why: "Churches have a separate application process and must use Form 1023." },
  { id: 13, text: "Are you a school, college, or university?", why: "Educational institutions with a formal curriculum, faculty, and enrolled student body must use Form 1023." },
  { id: 14, text: "Are you a hospital, medical research organization, or hospital organization?", why: "Healthcare organizations whose principal purpose is medical care, education, or research must use Form 1023." },
  { id: 15, text: "Are you an agricultural research organization?", why: "Organizations directly engaged in continuous agricultural research in conjunction with a land grant college or university must use Form 1023." },
  { id: 16, text: "Are you applying for exemption as a cooperative hospital service organization under section 501(e)?", why: "Cooperative hospital service organizations have specific requirements and must use Form 1023." },
  { id: 17, text: "Are you applying for exemption as a cooperative service organization of operating educational organizations under section 501(f)?", why: "These organizations must use Form 1023." },
  { id: 18, text: "Are you applying for exemption as a qualified charitable risk pool under section 501(n)?", why: "Charitable risk pools that pool insurable risks of 501(c)(3) members must use Form 1023." },
  { id: 19, text: "Are you requesting classification as a supporting organization under section 509(a)(3)?", why: "Supporting organizations that exist to support other public charities must use Form 1023." },
  { id: 20, text: "Is a substantial purpose of your activities to provide assistance through credit counseling, budgeting, personal finance, financial literacy, or mortgage foreclosure assistance?", why: "Credit counseling organizations must use Form 1023." },
  { id: 21, text: "Do you or will you invest 5% or more of your total assets in securities or funds that are not publicly traded?", why: "Significant investment in non-publicly traded securities requires Form 1023." },
  { id: 22, text: "Do you participate, or intend to participate, in partnerships in which you share losses with partners other than section 501(c)(3) organizations?", why: "Loss-sharing partnerships with non-exempt entities require Form 1023." },
  { id: 23, text: "Do you sell, or intend to sell, carbon credits or carbon offsets?", why: "Organizations engaged in carbon credit transactions must use Form 1023." },
  { id: 24, text: "Are you a Health Maintenance Organization (HMO)?", why: "HMOs must use Form 1023." },
  { id: 25, text: "Are you an Accountable Care Organization (ACO), or do you engage in ACO activities such as participation in the Medicare Shared Savings Program?", why: "ACOs must use Form 1023." },
  { id: 26, text: "Do you maintain or intend to maintain one or more donor advised funds?", why: "Organizations maintaining donor advised funds must use Form 1023." },
  { id: 27, text: "Are you organized and operated exclusively for testing for public safety and requesting a foundation classification under section 509(a)(4)?", why: "Public safety testing organizations must use Form 1023." },
  { id: 28, text: "Are you requesting classification as a private operating foundation?", why: "Private operating foundations must use Form 1023." },
  { id: 29, text: "Are you a private foundation applying for reinstatement after automatic revocation and requesting to change to a public charity classification?", why: "Private foundations seeking reclassification must use Form 1023." },
  { id: 30, text: "Are you applying for retroactive reinstatement of exemption under section 5 or 6 of Rev. Proc. 2014-11 after being automatically revoked?", why: "Only organizations applying under section 4 or 7 of Rev. Proc. 2014-11 may use Form 1023-EZ." },
  { id: 31, text: "Have you previously received a ruling or determination letter denying recognition of exemption?", why: "A prior denial requires submission of the full Form 1023." },
  { id: 32, text: "Have you previously been determined to be ineligible to file Form 1023-EZ?", why: "A prior ineligibility determination requires Form 1023." },
  { id: 33, text: "Are you conducting activities involving controlled substances prohibited by federal law, regardless of state law legality?", why: "Organizations conducting federally prohibited controlled substance activities are ineligible." },
  { id: 34, text: "Are you engaged in exchanging, creating, or distributing digital assets?", why: "Organizations engaged in digital asset activities must use Form 1023." },
];

export type ScreenerAnswers = Record<number, "Yes" | "No">;

interface Props {
  onComplete: (result: "Pass" | "Fail", date: string, answers: ScreenerAnswers) => void;
  triggerLabel?: string;
  externalOpenSignal?: number;
}

export function Form1023EZScreener({ onComplete, triggerLabel = "Run Eligibility Screener", externalOpenSignal }: Props) {
  const [open, setOpen] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [outcome, setOutcome] = useState<"Pass" | "Fail" | null>(null);
  const [answers, setAnswers] = useState<ScreenerAnswers>({});

  // Open the screener when external signal increments
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useState(() => {});


  const today = () => new Date().toISOString().slice(0, 10);

  const reset = () => {
    setCurrentIdx(0);
    setOutcome(null);
    setAnswers({});
  };

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (v) reset();
  };

  const answer = (yes: boolean) => {
    const q = QUESTIONS_1023EZ[currentIdx];
    const nextAnswers: ScreenerAnswers = { ...answers, [q.id]: yes ? "Yes" : "No" };
    setAnswers(nextAnswers);
    if (yes) {
      const date = today();
      setOutcome("Fail");
      onComplete("Fail", date, nextAnswers);
      return;
    }
    if (currentIdx + 1 >= QUESTIONS_1023EZ.length) {
      const date = today();
      setOutcome("Pass");
      onComplete("Pass", date, nextAnswers);
    } else {
      setCurrentIdx(currentIdx + 1);
    }
  };

  const q = QUESTIONS_1023EZ[currentIdx];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button type="button" variant="outline" size="sm" onClick={() => handleOpenChange(true)}>
        <ClipboardCheck className="h-3 w-3 mr-1" /> {triggerLabel}
      </Button>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Form 1023-EZ Eligibility Screener</DialogTitle>
          <DialogDescription>
            Answer all questions carefully. A Yes answer to any question means you must file the full Form 1023 instead of Form 1023-EZ.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>Disclaimer:</strong> This screener is for informational purposes only and does not constitute legal advice. Consult a qualified attorney before filing.
        </div>

        {outcome === null && q && (
          <div className="space-y-4">
            <div className="text-xs text-muted-foreground">
              Question {currentIdx + 1} of {QUESTIONS_1023EZ.length}
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold leading-relaxed">{q.text}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="font-medium">Why we ask:</span> {q.why}
              </p>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => answer(true)}>Yes</Button>
              <Button onClick={() => answer(false)}>No</Button>
            </div>
          </div>
        )}

        {outcome === "Fail" && (
          <div className="rounded-md border border-destructive bg-destructive/10 p-4 space-y-3">
            <div className="flex items-center gap-2 text-destructive font-semibold">
              <XCircle className="h-5 w-5" /> DISQUALIFIED
            </div>
            <p className="text-sm text-destructive">
              Based on your answers, you do not qualify to file Form 1023-EZ. You must submit the full Form 1023. Please consult a qualified attorney.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={reset}>
                <RotateCcw className="h-3 w-3 mr-1" /> Re-run Screener
              </Button>
              <Button size="sm" onClick={() => setOpen(false)}>Close</Button>
            </div>
          </div>
        )}

        {outcome === "Pass" && (
          <div className="rounded-md border border-green-600 bg-green-50 p-4 space-y-3">
            <div className="flex items-center gap-2 text-green-700 font-semibold">
              <CheckCircle2 className="h-5 w-5" /> QUALIFIED
            </div>
            <p className="text-sm text-green-800">
              Based on your answers, you appear to qualify to file Form 1023-EZ. This result is for informational purposes only. Please consult a qualified attorney before filing.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={reset}>
                <RotateCcw className="h-3 w-3 mr-1" /> Re-run Screener
              </Button>
              <Button size="sm" onClick={() => setOpen(false)}>Close</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
