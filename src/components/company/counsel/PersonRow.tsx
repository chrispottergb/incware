import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import { InitialsAvatar } from "./InitialsAvatar";
import type { CounselConfig } from "./config";

/** A single person listed inside a firm card. */
export default function PersonRow({
  person,
  config,
  onEdit,
  onDelete,
}: {
  person: any;
  config: CounselConfig;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const name = person[config.nameColumn] as string;
  const license = person[config.licenseColumn] as string | null;
  const meta = [
    license ? `${config.licensePrefix}${license}` : null,
    person.email || null,
    person.phone || null,
    person.specialty || null,
  ].filter(Boolean);

  return (
    <div className="flex items-start justify-between gap-2 py-1.5">
      <div className="flex items-start gap-2 min-w-0">
        <InitialsAvatar name={name} />
        <div className="min-w-0">
          <p className="text-sm truncate">
            <span className="font-medium">{name}</span>
            {person.title && <span className="text-muted-foreground"> — {person.title}</span>}
          </p>
          {meta.length > 0 && (
            <p className="text-xs text-muted-foreground truncate">{meta.join(" · ")}</p>
          )}
        </div>
      </div>
      <div className="flex gap-1 shrink-0">
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onEdit} aria-label={`Edit ${name}`}>
          <Pencil className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-destructive"
          onClick={onDelete}
          aria-label={`Delete ${name}`}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
