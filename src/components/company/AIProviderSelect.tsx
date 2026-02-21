import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Bot } from "lucide-react";

interface AIProviderSelectProps {
  value: string;
  onChange: (value: string) => void;
}

const providers = [
  { value: "lovable", label: "Lovable AI (Gemini Flash)", description: "Default — uses included credits" },
  { value: "gemini", label: "Google Gemini", description: "Direct Gemini API — your key" },
  { value: "claude", label: "Anthropic Claude", description: "Claude Sonnet — your key" },
];

export default function AIProviderSelect({ value, onChange }: AIProviderSelectProps) {
  const handleChange = (v: string) => {
    localStorage.setItem("ai_provider", v);
    onChange(v);
  };

  return (
    <div className="field-group max-w-xs">
      <Label className="field-label flex items-center gap-1.5">
        <Bot className="h-3.5 w-3.5" />
        AI Provider
      </Label>
      <Select value={value} onValueChange={handleChange}>
        <SelectTrigger className="h-8 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {providers.map((p) => (
            <SelectItem key={p.value} value={p.value}>
              <div className="flex flex-col">
                <span>{p.label}</span>
                <span className="text-[10px] text-muted-foreground">{p.description}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
