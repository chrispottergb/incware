import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Loader2, FileSignature } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ENGAGEMENT_LETTER_TEMPLATE } from "@/lib/engagement-letter-template";
import { exportEngagementLetterPDF } from "@/lib/engagement-letter-pdf";
import { useOwnFirm } from "@/components/settings/FirmInformationCard";

interface Props {
  companyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EngagementLetterDialog({ companyId, open, onOpenChange }: Props) {
  const { data: firm } = useOwnFirm();
  const [servicesText, setServicesText] = useState(ENGAGEMENT_LETTER_TEMPLATE.defaultServices.join("\n"));
  const [feeTerms, setFeeTerms] = useState("");
  const [letterDate, setLetterDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [generating, setGenerating] = useState(false);

  const { data: company, isLoading } = useQuery({
    queryKey: ["company-engagement-letter", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("name, address, address_2, city, state, zip, contact_full_name, salutation_name")
        .eq("id", companyId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  useEffect(() => {
    if (open) setFeeTerms((firm?.default_fee_terms as string) ?? "");
  }, [open, firm]);

  const missing: string[] = [];
  if (company && !company.contact_full_name && !company.salutation_name) missing.push("client contact name");
  if (company && !company.address) missing.push("mailing address");

  const handleGenerate = async () => {
    if (!company) return;
    setGenerating(true);
    try {
      await exportEngagementLetterPDF({
        company,
        firm: (firm as any) ?? {},
        services: servicesText.split("\n").map((s) => s.trim()).filter(Boolean),
        feeTerms,
        letterDate,
      });
      toast.success("Engagement letter generated");
      onOpenChange(false);
    } catch (err: any) {
      console.error("Engagement letter generation failed:", err);
      toast.error(err?.message ?? "Could not generate the engagement letter");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="min-w-[640px] max-w-[720px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="h-4 w-4" />
            Generate Engagement Letter
          </DialogTitle>
          <DialogDescription className="text-xs">
            The services list and fee terms below are pre-filled from your firm settings and can be edited for this client.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center gap-2 py-6 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading client details…
          </div>
        ) : (
          <div className="space-y-4">
            {!firm?.firm_name && (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  Your firm name and address haven't been entered yet, so the letterhead will be blank.{" "}
                  <Link to="/settings" className="underline font-medium">Add firm information</Link>
                </div>
              </div>
            )}

            {missing.length > 0 && (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  Missing for this client: {missing.join(", ")}. The letter will print blank lines to complete by hand.{" "}
                  <Link to={`/company/${companyId}`} className="underline font-medium">Open the company details</Link>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Letter Date</Label>
              <Input
                type="date"
                className="h-8 text-xs w-[180px]"
                value={letterDate}
                onChange={(e) => setLetterDate(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Services We Will Provide (one per line)</Label>
              <Textarea
                className="text-xs min-h-[150px]"
                value={servicesText}
                onChange={(e) => setServicesText(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Fee Terms</Label>
              <Textarea
                className="text-xs min-h-[80px]"
                value={feeTerms}
                placeholder={ENGAGEMENT_LETTER_TEMPLATE.defaultFeeTerms}
                onChange={(e) => setFeeTerms(e.target.value)}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" className="h-8 text-xs" disabled={generating || isLoading} onClick={handleGenerate}>
            {generating && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Generate PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
