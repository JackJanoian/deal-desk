// DEAL DESK: Phase 6 v0.2 — shared thesis form used by the edit dialog
// (and intended for reuse by the onboarding wizard in a future pass; the
// wizard kept its inline form for v0.2 because its ownership-preference
// state is split across three booleans rather than the array shape this
// form uses).
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  FolderAttachmentInput,
  type ThesisAttachment,
} from "./FolderAttachmentInput";

export interface ThesisFormValues {
  name: string;
  sector: string;
  geos: string; // comma-separated; serialize/deserialize at the boundary
  revenueMin: string;
  revenueMax: string;
  ownershipPreferences: string[];
  narrative: string;
  templateSlug: string | null;
  // DEAL DESK: v0.3 — research files attached to a thesis (text only, capped).
  attachments: ThesisAttachment[];
}

export const EMPTY_THESIS: ThesisFormValues = {
  name: "",
  sector: "",
  geos: "",
  revenueMin: "",
  revenueMax: "",
  ownershipPreferences: [],
  narrative: "",
  templateSlug: null,
  attachments: [],
};

const OWNERSHIP_OPTIONS = [
  "Founder-owned",
  "Family-owned",
  "Sponsor-backed",
] as const;

interface ThesisFormProps {
  initial?: ThesisFormValues;
  onSubmit: (values: ThesisFormValues) => Promise<void> | void;
  submitting?: boolean;
  submitLabel?: string;
}

export function ThesisForm({
  initial,
  onSubmit,
  submitting = false,
  submitLabel = "Save thesis",
}: ThesisFormProps) {
  const [values, setValues] = useState<ThesisFormValues>(
    initial ?? EMPTY_THESIS,
  );

  useEffect(() => {
    if (initial) setValues(initial);
  }, [initial]);

  function update<K extends keyof ThesisFormValues>(
    key: K,
    val: ThesisFormValues[K],
  ) {
    setValues((prev) => ({ ...prev, [key]: val }));
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void onSubmit(values);
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="thesis-name">Thesis name</Label>
        <Input
          id="thesis-name"
          value={values.name}
          onChange={(e) => update("name", e.target.value)}
          placeholder={
            values.sector ? `${values.sector} thesis` : "e.g., HVAC Southeast"
          }
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="thesis-sector">Sector *</Label>
        <Input
          id="thesis-sector"
          value={values.sector}
          onChange={(e) => update("sector", e.target.value)}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="thesis-geos">Geographies (comma-separated)</Label>
        <Textarea
          id="thesis-geos"
          rows={2}
          value={values.geos}
          onChange={(e) => update("geos", e.target.value)}
          placeholder="FL, GA, NC, SC, TN, AL"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="thesis-rev-min">Revenue min ($)</Label>
          <Input
            id="thesis-rev-min"
            inputMode="numeric"
            value={values.revenueMin}
            onChange={(e) => update("revenueMin", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="thesis-rev-max">Revenue max ($)</Label>
          <Input
            id="thesis-rev-max"
            inputMode="numeric"
            value={values.revenueMax}
            onChange={(e) => update("revenueMax", e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Ownership preferences</Label>
        <div className="flex flex-wrap gap-3 text-sm">
          {OWNERSHIP_OPTIONS.map((opt) => (
            <label key={opt} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={values.ownershipPreferences.includes(opt)}
                onChange={(e) => {
                  const next = e.target.checked
                    ? [...values.ownershipPreferences, opt]
                    : values.ownershipPreferences.filter((x) => x !== opt);
                  update("ownershipPreferences", next);
                }}
              />
              {opt}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="thesis-narrative">Narrative</Label>
        <Textarea
          id="thesis-narrative"
          rows={4}
          value={values.narrative}
          onChange={(e) => update("narrative", e.target.value)}
          placeholder="Describe your investment thesis in your own words."
        />
      </div>

      <div className="space-y-1.5">
        <Label>Research files (optional)</Label>
        <FolderAttachmentInput
          value={values.attachments}
          onChange={(next) => update("attachments", next)}
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={submitting || !values.sector.trim()}>
          {submitting ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

export function thesisFormValuesToApiPayload(v: ThesisFormValues) {
  return {
    name: v.name.trim() || `${v.sector.trim()} thesis`,
    sector: v.sector.trim(),
    geos: v.geos
      .split(",")
      .map((g) => g.trim())
      .filter(Boolean),
    revenueMin: v.revenueMin ? v.revenueMin : null,
    revenueMax: v.revenueMax ? v.revenueMax : null,
    ownershipPreferences: v.ownershipPreferences,
    narrative: v.narrative.trim() || null,
    templateSlug: v.templateSlug,
    attachments: v.attachments,
  };
}
