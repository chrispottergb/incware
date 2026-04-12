import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { KeyRound, CheckCircle2 } from "lucide-react";

const PASSWORD_MIN = 12;

export default function ResetPassword() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);

  useEffect(() => {
    // Listen for the PASSWORD_RECOVERY event from the auth state change
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
      }
    });

    // Also check if we're in a recovery flow from the URL hash
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setIsRecovery(true);
    }

    // Fix race condition: if session was already established before mount,
    // the PASSWORD_RECOVERY event was consumed. Check for active session + recovery params.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && (hash.includes("type=recovery") || window.location.search.includes("type=recovery"))) {
        setIsRecovery(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const passwordErrors = (): string | null => {
    if (password.length < PASSWORD_MIN) return `Password must be at least ${PASSWORD_MIN} characters.`;
    if (!/[A-Z]/.test(password)) return "Include at least one uppercase letter.";
    if (!/[a-z]/.test(password)) return "Include at least one lowercase letter.";
    if (!/[0-9]/.test(password)) return "Include at least one number.";
    if (password !== confirm) return "Passwords do not match.";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = passwordErrors();
    if (err) {
      toast({ title: "Invalid password", description: err, variant: "destructive" });
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      toast({ title: "Error", description: "Unable to update password. Please try again.", variant: "destructive" });
    } else {
      setDone(true);
      setTimeout(() => navigate("/"), 2000);
    }
  };

  if (!isRecovery) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <KeyRound className="mx-auto h-10 w-10 text-muted-foreground" />
          <h1 className="text-xl font-semibold text-foreground">Password Reset</h1>
          <p className="text-sm text-muted-foreground">
            This link is invalid or has expired. Please request a new password reset from the sign-in page.
          </p>
          <Button onClick={() => navigate("/auth")} variant="outline">Back to Sign In</Button>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <CheckCircle2 className="mx-auto h-10 w-10 text-green-600" />
          <h1 className="text-xl font-semibold text-foreground">Password Updated</h1>
          <p className="text-sm text-muted-foreground">Redirecting you to the dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-border/50 bg-background/80 p-6 shadow-2xl backdrop-blur-xl">
        <div className="text-center">
          <KeyRound className="mx-auto h-8 w-8 text-primary mb-2" />
          <h1 className="text-xl font-semibold text-foreground">Set New Password</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Must be at least {PASSWORD_MIN} characters with uppercase, lowercase, and a number.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">New Password</Label>
            <Input
              id="new-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              required
              minLength={PASSWORD_MIN}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm Password</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••••••"
              required
              minLength={PASSWORD_MIN}
            />
          </div>
          <Button className="w-full" type="submit" disabled={loading}>
            {loading ? "Updating…" : "Update Password"}
          </Button>
        </form>
      </div>
    </div>
  );
}
