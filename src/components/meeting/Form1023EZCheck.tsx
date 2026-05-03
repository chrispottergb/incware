import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, ExternalLink, ClipboardCheck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface Question {
  id: string;
  text: string;
  passingAnswer: boolean; // true = "Yes" passes, false = "No" passes
}

const QUESTIONS: Question[] = [
  { id: "receipts", text: "Are the organization's projected annual gross receipts $50,000 or less for each of the next 3 years?", passingAnswer: true },
  { id: "assets", text: "Are the organization's total assets $250,000 or less?", passingAnswer: true },
  { id: "us_address", text: "Does the organization have a mailing address in the United States?", passingAnswer: true },
  { id: "ein", text: "Does the organization have an Employer Identification Number (EIN)?", passingAnswer: true },
  { id: "formed_in_us", text: "Was the organization formed in the United States?", passingAnswer: true },
  { id: "not_successor", text: "Is the organization NOT a successor to, or controlled by, an entity suspended under IRC § 501(p)?", passingAnswer: true },
  { id: "not_church", text: "Is the organization NOT a church, school, hospital, or supporting organization described in IRC § 509(a)(3)?", passingAnswer: true },
  { id: "not_llc", text: "Is the organization NOT an LLC?", passingAnswer: true },
  { id: "not_foreign", text: "Does the organization NOT have foreign activities or foreign grants exceeding 15% of total?", passingAnswer: true },
];

const IRS_1023_EZ_URL = "https://www.pay.gov/public/form/start/62759871";

export default function Form1023EZCheck() {
  const [open, setOpen] = useState(false);
  const [answers, setAnswers] = useState<Record<string, boolean | null>>({});

  const allAnswered = QUESTIONS.every(q => answers[q.id] !== undefined && answers[q.id] !== null);
  const allPassing = allAnswered && QUESTIONS.every(q => answers[q.id] === q.passingAnswer);
  const anyFailing = QUESTIONS.some(q => answers[q.id] !== null && answers[q.id] !== undefined && answers[q.id] !== q.passingAnswer);

  const reset = () => setAnswers({});

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs">
          <ClipboardCheck className="h-3 w-3 mr-1" /> Form 1023-EZ Eligibility Check
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ClipboardCheck className="h-4 w-4 text-primary" />
            Form 1023-EZ Eligibility
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          Answer each question to determine if your organization qualifies for the streamlined Form 1023-EZ application instead of the full Form 1023.
        </p>

        <div className="space-y-3 mt-2">
          {QUESTIONS.map((q, i) => {
            const answer = answers[q.id];
            const isPassing = answer === q.passingAnswer;
            const isFailing = answer !== null && answer !== undefined && !isPassing;

            return (
              <Card key={q.id} className={isFailing ? "border-destructive/50" : isPassing ? "border-success" : ""}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-xs leading-relaxed flex-1">
                      <span className="font-medium text-muted-foreground mr-1">{i + 1}.</span>
                      {q.text}
                    </p>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant={answer === true ? "default" : "outline"}
                        className="h-6 text-[10px] px-2"
                        onClick={() => setAnswers(prev => ({ ...prev, [q.id]: true }))}
                      >
                        Yes
                      </Button>
                      <Button
                        size="sm"
                        variant={answer === false ? "default" : "outline"}
                        className="h-6 text-[10px] px-2"
                        onClick={() => setAnswers(prev => ({ ...prev, [q.id]: false }))}
                      >
                        No
                      </Button>
                    </div>
                  </div>
                  {isFailing && (
                    <div className="flex items-center gap-1 mt-1.5 text-[10px] text-destructive">
                      <XCircle className="h-3 w-3" />
                      This response disqualifies you from using Form 1023-EZ.
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Results */}
        {allAnswered && (
          <div className="mt-4 rounded-md border p-3 space-y-2">
            {allPassing ? (
              <>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                  <span className="text-sm font-semibold text-success">Eligible for Form 1023-EZ</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Based on your answers, your organization may qualify for the streamlined Form 1023-EZ. The filing fee is $275.
                </p>
                <Button size="sm" className="h-7 text-xs mt-1" asChild>
                  <a href={IRS_1023_EZ_URL} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3 w-3 mr-1" /> Go to IRS Form 1023-EZ Portal
                  </a>
                </Button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-destructive" />
                  <span className="text-sm font-semibold text-destructive">Not Eligible for Form 1023-EZ</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Your organization does not qualify for the streamlined form. You will need to file the full Form 1023 application. The filing fee is $600.
                </p>
              </>
            )}
          </div>
        )}

        {anyFailing && !allAnswered && (
          <div className="mt-3 flex items-center gap-2 text-xs text-destructive">
            <XCircle className="h-3.5 w-3.5" />
            One or more answers indicate you may not qualify for Form 1023-EZ. Continue answering to complete the check.
          </div>
        )}

        <div className="flex justify-end mt-2">
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={reset}>
            Reset Answers
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
