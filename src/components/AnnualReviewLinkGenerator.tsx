import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Link2, Copy, Check, Loader2, ExternalLink, ClipboardCheck } from "lucide-react";
import { toast } from "sonner";

interface AnnualReviewLinkGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companies: any[];
}

function generateToken(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export default function AnnualReviewLinkGenerator({
  open,
  onOpenChange,
  companies,
}: AnnualReviewLinkGeneratorProps) {
  const { user } = useAuth();
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [reviewYear, setReviewYear] = useState(new Date().getFullYear());
  const [generatedLink, setGeneratedLink] = useState("");
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!selectedCompanyId || !user) return;

    setGenerating(true);
    try {
      const token = generateToken();

      const { error } = await supabase.from("annual_review_links").insert({
        company_id: selectedCompanyId,
        user_id: user.id,
        token,
        review_year: reviewYear,
        status: "pending",
      });

      if (error) throw error;

      const baseUrl = window.location.origin;
      const link = `${baseUrl}/annual-review/${token}`;
      setGeneratedLink(link);
      toast.success("Review link generated successfully.");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to generate link");
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      setSelectedCompanyId("");
      setGeneratedLink("");
      setCopied(false);
    }, 300);
  };

  const selectedCompany = companies.find((c) => c.id === selectedCompanyId);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            Client Annual Review
          </DialogTitle>
          <DialogDescription>
            Generate a secure link to send to your client for their annual review worksheet.
          </DialogDescription>
        </DialogHeader>

        {!generatedLink ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Entity</label>
              <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an entity..." />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Review Year</label>
              <Input
                type="number"
                value={reviewYear}
                onChange={(e) => setReviewYear(Number(e.target.value))}
                min={2020}
                max={2099}
                className="h-7"
              />
            </div>

            <Button
              onClick={handleGenerate}
              disabled={!selectedCompanyId || generating}
              className="w-full"
            >
              {generating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="mr-2 h-4 w-4" />
              )}
              Generate Secure Link
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border border-border bg-muted p-3 text-sm text-foreground">
              ✅ Review link generated for{" "}
              <strong>{selectedCompany?.name}</strong> ({reviewYear})
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Shareable Link</label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={generatedLink}
                  className="h-7 text-xs font-mono"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopy}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              This link is valid for 90 days. The client can access the form
              without logging in. You'll be notified when they submit.
            </p>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => window.open(generatedLink, "_blank")}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Preview
              </Button>
              <Button className="flex-1" onClick={handleCopy}>
                <Copy className="mr-2 h-4 w-4" />
                {copied ? "Copied!" : "Copy Link"}
              </Button>
            </div>

            <Button variant="ghost" size="sm" className="w-full" onClick={() => {
              setGeneratedLink("");
              setSelectedCompanyId("");
            }}>
              ← Generate another link
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
