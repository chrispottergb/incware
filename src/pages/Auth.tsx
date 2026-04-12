import { useState, useRef, useCallback } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import loginHero from "@/assets/login-hero.jpg";

import { supabase } from "@/integrations/supabase/client";

const RATE_LIMIT_MS = 3000; // 3 seconds between submissions
const PASSWORD_MIN = 12;

const Auth = () => {
  const navigate = useNavigate();
  const { signIn, signUp, session } = useAuth();
  const { toast } = useToast();
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgot, setIsForgot] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const lastSubmitRef = useRef(0);

  if (session) {
    return <Navigate to="/" replace />;
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const now = Date.now();
    if (now - lastSubmitRef.current < RATE_LIMIT_MS) {
      toast({ title: "Please wait", description: "Too many attempts. Try again in a few seconds.", variant: "destructive" });
      return;
    }
    lastSubmitRef.current = now;

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      toast({ title: "Invalid email", description: "Please enter a valid email address.", variant: "destructive" });
      return;
    }

    setLoading(true);
    await supabase.auth.resetPasswordForEmail(trimmedEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    // Always show success to prevent email enumeration
    toast({ title: "Check your email", description: "If an account exists, we sent a password reset link." });
    setIsForgot(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Rate limiting
    const now = Date.now();
    if (now - lastSubmitRef.current < RATE_LIMIT_MS) {
      toast({ title: "Please wait", description: "Too many attempts. Try again in a few seconds.", variant: "destructive" });
      return;
    }
    lastSubmitRef.current = now;

    // Input validation
    const trimmedEmail = email.trim();
    if (trimmedEmail.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      toast({ title: "Invalid email", description: "Please enter a valid email address.", variant: "destructive" });
      return;
    }
    if (isSignUp) {
      if (password.length < PASSWORD_MIN || password.length > 128) {
        toast({ title: "Invalid password", description: `Password must be at least ${PASSWORD_MIN} characters.`, variant: "destructive" });
        return;
      }
      if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
        toast({ title: "Weak password", description: "Include uppercase, lowercase, and a number.", variant: "destructive" });
        return;
      }
    } else {
      if (password.length < 6 || password.length > 128) {
        toast({ title: "Invalid password", description: "Password must be between 6 and 128 characters.", variant: "destructive" });
        return;
      }
    }
    if (isSignUp && (fullName.trim().length === 0 || fullName.trim().length > 100)) {
      toast({ title: "Invalid name", description: "Name must be between 1 and 100 characters.", variant: "destructive" });
      return;
    }

    setLoading(true);

    const { error } = isSignUp
      ? await signUp(trimmedEmail, password, fullName.trim())
      : await signIn(trimmedEmail, password);

    if (error) {
      // Genericize error messages to avoid leaking account existence
      const safeMessage = isSignUp
        ? "Unable to create account. Please check your details and try again."
        : "Invalid email or password. Please try again.";
      toast({ title: "Error", description: safeMessage, variant: "destructive" });
    } else if (isSignUp) {
      toast({ title: "Check your email", description: "We sent you a confirmation link." });
    } else {
      navigate("/");
    }

    setLoading(false);
  };

  return (
    <div className="relative min-h-screen">
      {/* Full-screen background image */}
      <div className="fixed inset-0 z-0">
        <img
          src={loginHero}
          alt="Futuristic corporate records book"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background/60 via-background/30 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-background/20" />
      </div>

      {/* Branding — upper-right */}
      <div className="absolute top-8 right-12 z-10 hidden animate-fade-in text-right lg:block">
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
          entityIQ
        </h1>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">
          Next-generation corporate records management
        </p>
      </div>

      {/* Auth form — overlaid */}
      <div className="relative z-10 flex min-h-screen items-start justify-end px-4 pt-8 lg:pr-10 xl:pr-16">
        <div className="w-full max-w-[280px] animate-fade-in rounded-2xl border border-border/50 bg-background/80 p-4 shadow-2xl backdrop-blur-xl">
          {/* Branding for mobile */}
          <div className="mb-6 lg:hidden">
            <h1 className="font-display text-4xl font-bold tracking-tight text-foreground">
              entityIQ
            </h1>
            <p className="mt-1 text-muted-foreground">Corporate Records Management</p>
          </div>

          <h2 className="font-display text-2xl font-semibold text-foreground mb-2">
            {isForgot ? "Reset Password" : isSignUp ? "Create an account" : "Welcome back"}
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            {isForgot
              ? "Enter your email and we'll send a reset link"
              : isSignUp
              ? "Sign up to get started"
              : "Sign in to your account"}
          </p>

          {isForgot ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>
              <Button className="w-full" size="lg" type="submit" disabled={loading}>
                {loading ? "Please wait…" : "Send Reset Link"}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                <button
                  type="button"
                  onClick={() => setIsForgot(false)}
                  className="font-medium text-primary hover:underline"
                >
                  Back to Sign In
                </button>
              </p>
            </form>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                {isSignUp && (
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Jane Doe"
                      required
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    {!isSignUp && (
                      <button
                        type="button"
                        onClick={() => setIsForgot(true)}
                        className="text-xs text-primary hover:underline"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    minLength={isSignUp ? PASSWORD_MIN : 6}
                  />
                  {isSignUp && (
                    <p className="text-[10px] text-muted-foreground">
                      Min {PASSWORD_MIN} chars with uppercase, lowercase, and a number.
                    </p>
                  )}
                </div>

                <Button className="w-full" size="lg" type="submit" disabled={loading}>
                  {loading ? "Please wait…" : isSignUp ? "Sign Up" : "Sign In"}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
                <button
                  type="button"
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="font-medium text-primary hover:underline"
                >
                  {isSignUp ? "Sign In" : "Sign Up"}
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Auth;
