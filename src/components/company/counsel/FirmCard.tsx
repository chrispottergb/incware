import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Building, Pencil, Plus, Trash2 } from "lucide-react";
import PersonRow from "./PersonRow";
import { InitialsAvatar } from "./InitialsAvatar";
import type { CounselConfig } from "./config";

/** A firm card with its affiliated people nested underneath. */
export function FirmCard({
  firm,
  people,
  config,
  onEditFirm,
  onDeleteFirm,
  onAddPerson,
  onEditPerson,
  onDeletePerson,
}: {
  firm: any;
  people: any[];
  config: CounselConfig;
  onEditFirm: () => void;
  onDeleteFirm: () => void;
  onAddPerson: () => void;
  onEditPerson: (p: any) => void;
  onDeletePerson: (p: any) => void;
}) {
  const location = [firm.city, firm.state].filter(Boolean).join(", ");

  return (
    <Card className="border border-border bg-card shadow-none p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <Building className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{firm.firm_name}</p>
            <p className="text-xs text-muted-foreground truncate">
              {config.firmTypeLabel}
              {location && ` · ${location}`}
            </p>
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onEditFirm}
            aria-label={`Edit ${firm.firm_name}`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive"
            onClick={onDeleteFirm}
            aria-label={`Delete ${firm.firm_name}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="mt-3 ml-3 border-l border-border pl-3">
        {people.length > 0 ? (
          <div className="divide-y divide-border/60">
            {people.map((p) => (
              <PersonRow
                key={p.id}
                person={p}
                config={config}
                onEdit={() => onEditPerson(p)}
                onDelete={() => onDeletePerson(p)}
              />
            ))}
          </div>
        ) : (
          <p className="py-1.5 text-xs text-muted-foreground">
            No {config.personLabel}s listed for this firm.
          </p>
        )}
        <Button variant="ghost" size="sm" className="mt-1 h-7 px-2 text-xs" onClick={onAddPerson}>
          <Plus className="h-3 w-3 mr-1" />
          Add {config.personLabel} to this firm
        </Button>
      </div>
    </Card>
  );
}

/** A solo practitioner rendered as a standalone card with the same weight as a firm card. */
export function SoloCard({
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
    <Card className="border border-border bg-card shadow-none p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <InitialsAvatar name={name} className="mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{name}</p>
            <p className="text-xs text-muted-foreground truncate">Solo practitioner · no firm affiliation</p>
            {meta.length > 0 && <p className="text-xs text-muted-foreground truncate">{meta.join(" · ")}</p>}
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit} aria-label={`Edit ${name}`}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive"
            onClick={onDelete}
            aria-label={`Delete ${name}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
