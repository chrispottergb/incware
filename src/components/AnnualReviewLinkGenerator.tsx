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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Link2, Copy, Check, Loader2, ExternalLink, ClipboardCheck, Send, AlertTriangle, Mail, Eye, ArrowLeft } from "lucide-react";
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

/** Build the same HTML the edge function sends, for preview purposes */
function buildEmailPreviewHtml(
  salutation: string,
  entityName: string,
  reviewYear: number,
  reviewUrl: string,
  expirationDate: string,
) {
  return `
<div style="margin:0;padding:0;background-color:#f4f5f7;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:24px 0;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:560px;" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td style="background-color:#1a1a2e;padding:20px 28px;text-align:center;">
              <div style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">EntityIQ</div>
              <div style="margin:4px 0 0;font-size:11px;color:#8b8fa3;text-transform:uppercase;letter-spacing:1.5px;">Annual Review System</div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px 16px;background:#ffffff;">
              <div style="margin:0 0 14px;font-size:17px;color:#1a1a2e;font-weight:600;">Hi ${salutation},</div>
              <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#3c3c4a;">
                Your <strong>${reviewYear} Annual Review Worksheet</strong> for <strong>${entityName}</strong> is ready for you to complete.
              </p>
              <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#3c3c4a;">
                Please take a few minutes to review the pre-populated information and provide any updates for the current year. This helps us keep your entity records accurate and up to date.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:0 0 20px;">
                    <a href="${reviewUrl}" target="_blank"
                       style="display:inline-block;background-color:#2563eb;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:6px;letter-spacing:0.3px;">
                      Complete Your Annual Review
                    </a>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fef9e7;border-radius:6px;border:1px solid #f5e6a3;">
                <tr>
                  <td style="padding:10px 14px;">
                    <p style="margin:0;font-size:12px;color:#92680a;">
                      ⏳ <strong>This link expires on ${expirationDate}.</strong> Please complete your review before this date.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 20px;border-top:1px solid #eee;background:#ffffff;">
              <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.5;text-align:center;">
                This is an automated message from EntityIQ. If you have questions, please reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</div>`;
}

type Step = "form" | "preview" | "done";

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
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [autoEmail, setAutoEmail] = useState(true);
  const [duplicateConflict, setDuplicateConflict] = useState<{ existingId: string; createdAt: string } | null>(null);
  const [step, setStep] = useState<Step>("form");

  const selectedCompany = companies.find((c) => c.id === selectedCompanyId);
  const hasEmail = !!selectedCompany?.contact_email;

  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + 90);
  const expirationDateStr = expiryDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const salutation = selectedCompany?.salutation_name || selectedCompany?.contact_full_name || "there";

  const doGenerate = async (replaceExistingId?: string) => {
    if (!selectedCompanyId || !user) return;

    setGenerating(true);
    try {
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

      const baseUrl = "https://entityiq.net";
      const link = `${baseUrl}/annual-review/${token}`;
      setGeneratedLink(link);

      qc.invalidateQueries({ queryKey: ["annual_review_links_all"] });

      toast.success(replaceExistingId ? "Previous link replaced. New link generated." : "Review link generated successfully.");

      // If auto-email is on, go to preview step; otherwise go straight to done
      if (autoEmail && hasEmail) {
        setStep("preview");
      } else {
        setStep("done");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to generate link");
    } finally {
      setGenerating(false);
    }
  };

  const handleSendEmail = async () => {
    if (!selectedCompany || !generatedLink) return;
    setSending(true);
    try {
      const { error: emailError } = await supabase.functions.invoke("send-review-reminder", {
        body: {
          contactName: selectedCompany.salutation_name || selectedCompany.contact_full_name || null,
          contactEmail: selectedCompany.contact_email,
          entityName: selectedCompany.name,
          reviewYear,
          reviewUrl: generatedLink,
          expiresAt: expiryDate.toISOString(),
        },
      });
      if (emailError) {
        console.error("Email send error:", emailError);
        toast.error("Email failed to send. You can copy the link and send manually.");
      } else {
        toast.success("Email sent to " + selectedCompany.contact_email);
      }
    } catch (emailErr) {
      console.error("Email send error:", emailErr);
      toast.error("Email failed to send. You can copy the link and send manually.");
    } finally {
      setSending(false);
      setStep("done");
    }
  };

  const handleGenerate = async () => {
    if (!selectedCompanyId || !user) return;

    setGenerating(true);
    try {
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
      setStep("form");
      setSending(false);
    }, 300);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className={step === "preview" ? "sm:max-w-2xl" : "sm:max-w-md"}>
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              {step === "preview" ? (
                <>
                  <Eye className="h-5 w-5 text-primary" />
                  Email Preview
                </>
              ) : (
                <>
                  <ClipboardCheck className="h-5 w-5 text-primary" />
                  Client Annual Review
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {step === "preview"
                ? `Review the email that will be sent to ${selectedCompany?.contact_email}`
                : "Generate a secure link to send to your client for their annual review worksheet."
              }
            </DialogDescription>
          </DialogHeader>

          {step === "form" && (
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
                        Will send a branded email with clickable link to <strong>{selectedCompany?.contact_email}</strong>
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
          )}

          {step === "preview" && selectedCompany && (
            <div className="space-y-4">
              {/* Email metadata */}
              <div className="rounded-md border border-border bg-muted/50 p-3 space-y-1.5 text-sm">
                <div className="flex gap-2">
                  <span className="text-muted-foreground font-medium w-12 shrink-0">From:</span>
                  <span>EntityIQ &lt;noreply@entityiq.net&gt;</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-muted-foreground font-medium w-12 shrink-0">To:</span>
                  <span>{selectedCompany.contact_email}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-muted-foreground font-medium w-12 shrink-0">Subject:</span>
                  <span className="font-medium">Action Required: {reviewYear} Annual Review — {selectedCompany.name}</span>
                </div>
              </div>

              {/* Email body preview */}
              <ScrollArea className="h-[340px] rounded-md border border-border">
                <div
                  dangerouslySetInnerHTML={{
                    __html: buildEmailPreviewHtml(
                      salutation,
                      selectedCompany.name,
                      reviewYear,
                      generatedLink,
                      expirationDateStr,
                    ),
                  }}
                />
              </ScrollArea>

              {/* Action buttons */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setStep("done")}
                  className="flex-1"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Skip Email
                </Button>
                <Button
                  onClick={handleSendEmail}
                  disabled={sending}
                  className="flex-1"
                >
                  {sending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="mr-2 h-4 w-4" />
                  )}
                  Send Email
                </Button>
              </div>
            </div>
          )}

          {step === "done" && (
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
                setStep("form");
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
