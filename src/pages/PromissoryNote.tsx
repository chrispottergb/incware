import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { FileText, Download, Eye, Printer, RotateCcw } from "lucide-react";
import { generatePromissoryNotePDF } from "@/lib/promissory-note-pdf";
import { toast } from "@/hooks/use-toast";

interface FormState {
  companyName: string;
  lenderName: string;
  borrowerName: string;
  loanAmount: string;
  interestRate: string;
  loanDuration: string;
  startDate: string;
  endDate: string;
  repaymentTerms: string;
}

const EMPTY: FormState = {
  companyName: "",
  lenderName: "",
  borrowerName: "",
  loanAmount: "",
  interestRate: "",
  loanDuration: "",
  startDate: "",
  endDate: "",
  repaymentTerms: "",
};

export default function PromissoryNote() {
  const [form, setForm] = useState<FormState>(EMPTY);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const data = useMemo(
    () => ({
      companyName: form.companyName,
      lenderName: form.lenderName,
      borrowerName: form.borrowerName,
      loanAmount: form.loanAmount ? Number(form.loanAmount) : null,
      interestRate: form.interestRate ? Number(form.interestRate) : null,
      loanDuration: form.loanDuration,
      startDate: form.startDate,
      endDate: form.endDate,
      repaymentTerms: form.repaymentTerms,
    }),
    [form],
  );

  const fmtMoney = (v: string) =>
    v ? `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "$_______";
  const fmtDate = (d: string) =>
    d
      ? new Date(d + "T00:00:00").toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "_______________";

  const handleDownload = () => {
    const doc = generatePromissoryNotePDF(data);
    const filename = `Promissory-Note-${(form.borrowerName || "borrower").replace(/\s+/g, "-")}.pdf`;
    doc.save(filename);
    toast({ title: "PDF generated", description: filename });
  };

  const handlePreview = () => {
    const doc = generatePromissoryNotePDF(data);
    window.open(doc.output("bloburl"), "_blank");
  };

  const handlePrint = () => {
    const doc = generatePromissoryNotePDF(data);
    doc.autoPrint();
    window.open(doc.output("bloburl"), "_blank");
  };

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Promissory Note Generator</h1>
            <p className="text-xs text-muted-foreground">
              Draft, preview, and export a professional promissory note in seconds.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setForm(EMPTY)}>
            <RotateCcw className="mr-1.5 h-4 w-4" />
            Reset
          </Button>
          <Button variant="outline" size="sm" onClick={handlePreview}>
            <Eye className="mr-1.5 h-4 w-4" />
            Preview PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="mr-1.5 h-4 w-4" />
            Print
          </Button>
          <Button size="sm" onClick={handleDownload}>
            <Download className="mr-1.5 h-4 w-4" />
            Download PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,460px)_minmax(0,1fr)]">
        {/* Form */}
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Note Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="companyName" className="text-xs">
                Company / Matter
              </Label>
              <Input
                id="companyName"
                value={form.companyName}
                onChange={(e) => set("companyName", e.target.value)}
                placeholder="Acme Holdings, LLC"
              />
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="lenderName" className="text-xs">
                  Lender (Payee)
                </Label>
                <Input
                  id="lenderName"
                  value={form.lenderName}
                  onChange={(e) => set("lenderName", e.target.value)}
                  placeholder="Jane Smith"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="borrowerName" className="text-xs">
                  Borrower (Maker)
                </Label>
                <Input
                  id="borrowerName"
                  value={form.borrowerName}
                  onChange={(e) => set("borrowerName", e.target.value)}
                  placeholder="John Doe"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="loanAmount" className="text-xs">
                  Principal ($)
                </Label>
                <Input
                  id="loanAmount"
                  type="number"
                  inputMode="decimal"
                  value={form.loanAmount}
                  onChange={(e) => set("loanAmount", e.target.value)}
                  placeholder="50000.00"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="interestRate" className="text-xs">
                  Interest Rate (% / yr)
                </Label>
                <Input
                  id="interestRate"
                  type="number"
                  step="0.01"
                  value={form.interestRate}
                  onChange={(e) => set("interestRate", e.target.value)}
                  placeholder="5.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="startDate" className="text-xs">
                  Commencement Date
                </Label>
                <Input
                  id="startDate"
                  type="date"
                  value={form.startDate}
                  onChange={(e) => set("startDate", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="endDate" className="text-xs">
                  Maturity Date
                </Label>
                <Input
                  id="endDate"
                  type="date"
                  value={form.endDate}
                  onChange={(e) => set("endDate", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="loanDuration" className="text-xs">
                Loan Duration
              </Label>
              <Input
                id="loanDuration"
                value={form.loanDuration}
                onChange={(e) => set("loanDuration", e.target.value)}
                placeholder="36 months"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="repaymentTerms" className="text-xs">
                Repayment Terms
              </Label>
              <Textarea
                id="repaymentTerms"
                value={form.repaymentTerms}
                onChange={(e) => set("repaymentTerms", e.target.value)}
                placeholder="Equal monthly installments of principal and interest, due on the 1st of each month, beginning the month following the commencement date."
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        {/* Live preview */}
        <Card className="overflow-hidden">
          <CardHeader className="flex-row items-center justify-between border-b bg-muted/40 py-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Live Preview
            </CardTitle>
            <span className="text-[11px] text-muted-foreground">Updates as you type</span>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[calc(100vh-220px)] overflow-y-auto bg-muted/30 p-6">
              <div className="mx-auto max-w-[700px] rounded-md border bg-background p-10 font-serif text-[13px] leading-[1.55] text-foreground shadow-sm">
                <h2 className="text-center text-lg font-bold tracking-wide">PROMISSORY NOTE</h2>
                <div className="my-3 border-t border-double" />

                <div className="mb-4 flex justify-between text-[12px]">
                  <span>
                    <span className="font-semibold">Principal Amount:</span>{" "}
                    {fmtMoney(form.loanAmount)}
                  </span>
                  <span>
                    <span className="font-semibold">Date:</span> {fmtDate(form.startDate)}
                  </span>
                </div>

                <p className="mb-4 text-justify">
                  FOR VALUE RECEIVED, the undersigned{" "}
                  <strong>{form.borrowerName || "_______________"}</strong> ("Borrower") promises
                  to pay to the order of{" "}
                  <strong>{form.lenderName || "_______________"}</strong> ("Lender"), the
                  principal sum of <strong>{fmtMoney(form.loanAmount)}</strong>, together with
                  interest thereon at the rate of{" "}
                  <strong>
                    {form.interestRate
                      ? `${Number(form.interestRate).toFixed(2)}%`
                      : "_____%"}
                  </strong>{" "}
                  per annum.
                </p>

                <h3 className="mb-2 font-bold">TERMS AND CONDITIONS</h3>
                <ol className="list-decimal space-y-1.5 pl-5 text-[12px]">
                  <li>
                    <span className="font-semibold">PRINCIPAL:</span> The principal amount of this
                    Note is {fmtMoney(form.loanAmount)}.
                  </li>
                  <li>
                    <span className="font-semibold">INTEREST RATE:</span> Interest shall accrue at
                    the rate of{" "}
                    {form.interestRate
                      ? `${Number(form.interestRate).toFixed(2)}%`
                      : "_____%"}{" "}
                    per annum on the unpaid principal balance.
                  </li>
                  <li>
                    <span className="font-semibold">LOAN DURATION:</span>{" "}
                    {form.loanDuration || "As specified by the parties."}
                  </li>
                  <li>
                    <span className="font-semibold">COMMENCEMENT DATE:</span> This Note shall
                    commence on {fmtDate(form.startDate)}.
                  </li>
                  <li>
                    <span className="font-semibold">MATURITY DATE:</span> The entire unpaid
                    balance, with all accrued interest, shall be due and payable on{" "}
                    {fmtDate(form.endDate)}.
                  </li>
                  <li>
                    <span className="font-semibold">REPAYMENT TERMS:</span>{" "}
                    {form.repaymentTerms || "Payments shall be made as agreed upon by the parties."}
                  </li>
                  <li>
                    <span className="font-semibold">PREPAYMENT:</span> The Borrower may prepay
                    this Note in whole or in part at any time without penalty.
                  </li>
                  <li>
                    <span className="font-semibold">DEFAULT:</span> If the Borrower fails to make
                    any payment when due, the entire unpaid balance shall, at the option of the
                    Lender, become immediately due and payable.
                  </li>
                  <li>
                    <span className="font-semibold">GOVERNING LAW:</span> This Note shall be
                    governed by the laws of the State of Wisconsin.
                  </li>
                  <li>
                    <span className="font-semibold">WAIVER:</span> The Borrower waives
                    presentment, demand, protest, and notice of dishonor.
                  </li>
                </ol>

                <div className="mt-8 grid grid-cols-2 gap-8 text-[12px]">
                  <div>
                    <p className="font-semibold">BORROWER:</p>
                    <div className="mt-8 border-b border-foreground/60" />
                    <p className="mt-1">{form.borrowerName || "_______________"}</p>
                    <p className="mt-1 text-muted-foreground">Date: _______________</p>
                  </div>
                  <div>
                    <p className="font-semibold">LENDER:</p>
                    <div className="mt-8 border-b border-foreground/60" />
                    <p className="mt-1">{form.lenderName || "_______________"}</p>
                    <p className="mt-1 text-muted-foreground">Date: _______________</p>
                  </div>
                </div>

                {form.companyName && (
                  <p className="mt-8 border-t pt-2 text-center text-[10px] text-muted-foreground">
                    Promissory Note — {form.companyName}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
