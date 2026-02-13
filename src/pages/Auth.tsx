import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import loginHero from "@/assets/login-hero.jpg";

const Auth = () => {
  const navigate = useNavigate();
  const { signIn, signUp, session } = useAuth();
  const { toast } = useToast();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  if (session) {
    navigate("/");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = isSignUp
      ? await signUp(email, password, fullName)
      : await signIn(email, password);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
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
      <div className="relative z-10 flex min-h-screen items-start justify-end px-4 pt-16 lg:pr-12 xl:pr-20">
        <div className="w-full max-w-xs animate-fade-in rounded-2xl border border-border/50 bg-background/80 p-5 shadow-2xl backdrop-blur-xl">
          {/* Branding for mobile */}
          <div className="mb-6 lg:hidden">
            <h1 className="font-display text-4xl font-bold tracking-tight text-foreground">
              entityIQ
            </h1>
            <p className="mt-1 text-muted-foreground">Corporate Records Management</p>
          </div>

          <h2 className="font-display text-2xl font-semibold text-foreground mb-2">
            {isSignUp ? "Create an account" : "Welcome back"}
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            {isSignUp ? "Sign up to get started" : "Sign in to your account"}
          </p>

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
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
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
        </div>
      </div>
    </div>
  );
};

export default Auth;
