import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import loginHero from "@/assets/login-hero.jpg";

const Auth = () => {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen">
      {/* Full-screen background image */}
      <div className="fixed inset-0 z-0">
        <img
          src={loginHero}
          alt="Futuristic corporate records book"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-background/50 to-background/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-background/40" />
      </div>

      {/* Branding — bottom-left */}
      <div className="absolute bottom-12 left-10 right-10 z-10 hidden animate-fade-in lg:block">
        <h1 className="font-display text-5xl font-bold tracking-tight text-foreground">
          entityIQ
        </h1>
        <p className="mt-2 max-w-sm text-lg text-muted-foreground">
          Next-generation corporate records management — organized, compliant, effortless.
        </p>
      </div>

      {/* CTA — overlaid */}
      <div className="relative z-10 flex min-h-screen items-center justify-center px-6 lg:justify-end lg:pr-16 xl:pr-24">
        <div className="w-full max-w-md animate-fade-in rounded-2xl border border-border/50 bg-background/80 p-8 shadow-2xl backdrop-blur-xl text-center">
          {/* Branding for mobile */}
          <div className="mb-6 lg:hidden">
            <h1 className="font-display text-4xl font-bold tracking-tight text-foreground">
              entityIQ
            </h1>
            <p className="mt-1 text-muted-foreground">Corporate Records Management</p>
          </div>

          <h2 className="font-display text-2xl font-semibold text-foreground mb-2">
            Welcome to entityIQ
          </h2>
          <p className="text-sm text-muted-foreground mb-8">
            Click below to explore the demo
          </p>

          <Button className="w-full" size="lg" onClick={() => navigate("/")}>
            Open App
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Auth;
