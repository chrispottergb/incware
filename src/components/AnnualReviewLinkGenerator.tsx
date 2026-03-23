import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Link2, Copy, Check, Loader2, ExternalLink, ClipboardCheck, Send, AlertTriangle } from "lucide-react";
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
  const qc = useQueryClient();
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [reviewYear, setReviewYear] = useState(new Date().getFullYear());
  const [generatedLink, setGeneratedLink] = useState("");
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [autoEmail, setAutoEmail] = useState(true);
  const [duplicateConflict, setDuplicateConflict] = useState<{ existingId: string; createdAt: string } | null>(null);

  const selectedCompany = companies.find((c) => c.id === selectedCompanyId);
  const hasEmail = !!selectedCompany?.contact_email;

  const doGenerate = async (replaceExistingId?: string) => {
    if (!selectedCompanyId || !user) return;

    setGenerating(true);
    try {
      // If replacing, delete the old link first
      if (replaceExistingId) {
        await supabase.from("annual_review_links").delete().eq("id", replaceExistingId);
      }

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

      qc.invalidateQueries({ queryKey: ["annual_review_links_all"] });

      toast.success(replaceExistingId ? "Previous link replaced. New link generated." : "Review link generated successfully.");

      // Auto-email if enabled and company has contact email
      if (autoEmail && hasEmail && selectedCompany) {
        const subject = encodeURIComponent(
          `Action Required: ${reviewYear} Annual Review — ${selectedCompany.name}`
        );
        const salutation = selectedCompany.salutation_name || "there";
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 90);
        const body = encodeURIComponent(
          `Hi ${salutation},\n\nPlease complete your ${reviewYear} annual review for ${selectedCompany.name} using the secure link below:\n\n${link}\n\nThis link will expire on ${expiryDate.toLocaleDateString()}.\n\nThank you!`
        );
        window.open(`mailto:${selectedCompany.contact_email}?subject=${subject}&body=${body}`, "_blank");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to generate link");
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedCompanyId || !user) return;

    setGenerating(true);
    try {
      // Check for existing active link for this entity + year
      const { data: existing } = await supabase
        .from("annual_review_links")
        .select("id, created_at")
        .eq("company_id", selectedCompanyId)
        .eq("review_year", reviewYear)
        .eq("status", "pending")
        .limit(1);

      if (existing && existing.length > 0) {
        setGenerating(false);
        setDuplicateConflict({ existingId: existing[0].id, createdAt: existing[0].created_at });
        return;
      }

      await doGenerate();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to check for existing links");
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
      setAutoEmail(true);
      setDuplicateConflict(null);
    }, 300);
  };

  return (
    <>
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

              {/* Auto-email option */}
              {selectedCompanyId && (
                <div className="flex items-start gap-2 rounded-md border border-border bg-muted/50 p-3">
                  <Checkbox
                    id="auto-email"
                    checked={autoEmail && hasEmail}
                    onCheckedChange={(checked) => setAutoEmail(!!checked)}
                    disabled={!hasEmail}
                  />
                  <div className="flex-1">
                    <Label htmlFor="auto-email" className="text-sm font-medium cursor-pointer">
                      <Send className="inline mr-1.5 h-3.5 w-3.5" />
                      Email link to client
                    </Label>
                    {hasEmail ? (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Will open email draft to <strong>{selectedCompany?.contact_email}</strong>
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        No contact email on file. Add one in the entity's Incorporation tab.
                      </p>
                    )}
                  </div>
                </div>
              )}

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

      {/* Duplicate Link Warning Dialog */}
      <AlertDialog open={!!duplicateConflict} onOpenChange={(open) => { if (!open) setDuplicateConflict(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Active Link Already Exists
            </AlertDialogTitle>
            <AlertDialogDescription>
              An active review link for <strong>{selectedCompany?.name}</strong> ({reviewYear}) was already generated on{" "}
              <strong>{duplicateConflict ? new Date(duplicateConflict.createdAt).toLocaleDateString() : ""}</strong>.
              Would you like to replace it with a new link or keep both?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel onClick={() => setDuplicateConflict(null)}>Cancel</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => {
                setDuplicateConflict(null);
                doGenerate();
              }}
            >
              Keep Both
            </Button>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const existingId = duplicateConflict!.existingId;
                setDuplicateConflict(null);
                doGenerate(existingId);
              }}
            >
              Replace Existing
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}