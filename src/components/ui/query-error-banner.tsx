import { AlertTriangle, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface QueryErrorBannerProps {
  message?: string;
  onRetry?: () => void;
}

export function QueryErrorBanner({ message = "Failed to load data.", onRetry }: QueryErrorBannerProps) {
  return (
    <Alert variant="destructive" className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <AlertDescription className="text-sm">{message}</AlertDescription>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="shrink-0 gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10">
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </Button>
      )}
    </Alert>
  );
}
