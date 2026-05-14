// DEAL DESK: v0.3 — pick a folder (webkitdirectory) or individual files; small text only.
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { FolderOpen, FileText, X } from "lucide-react";

export interface ThesisAttachment {
  name: string;
  mime: string;
  sizeBytes: number;
  content: string;
}

interface Props {
  value: ThesisAttachment[];
  onChange: (next: ThesisAttachment[]) => void;
  maxFiles?: number;
  maxBytesPerFile?: number;
}

const ALLOWED_EXTS = [".md", ".markdown", ".txt", ".csv"];

function isAllowed(name: string): boolean {
  const lower = name.toLowerCase();
  return ALLOWED_EXTS.some((ext) => lower.endsWith(ext));
}

export function FolderAttachmentInput({
  value,
  onChange,
  maxFiles = 5,
  maxBytesPerFile = 50_000,
}: Props) {
  const folderRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  async function ingestFiles(files: FileList | null) {
    if (!files) return;
    const next: ThesisAttachment[] = [...value];
    const errors: string[] = [];

    for (const file of Array.from(files)) {
      if (next.length >= maxFiles) {
        errors.push(`Skipped — only the first ${maxFiles} files are kept.`);
        break;
      }
      if (!isAllowed(file.name)) {
        errors.push(`${file.name}: unsupported type (allow ${ALLOWED_EXTS.join(", ")})`);
        continue;
      }
      if (file.size > maxBytesPerFile) {
        errors.push(`${file.name}: too large (max ${Math.round(maxBytesPerFile / 1024)} KB)`);
        continue;
      }
      const text = await file.text();
      next.push({
        name: file.name,
        mime: file.type || "text/plain",
        sizeBytes: file.size,
        content: text,
      });
    }

    onChange(next);
    setError(errors.length ? errors.join("\n") : null);
  }

  function removeAt(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => folderRef.current?.click()}>
          <FolderOpen className="mr-1 h-3 w-3" />
          Attach folder
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
          <FileText className="mr-1 h-3 w-3" />
          Attach file(s)
        </Button>
      </div>

      {/* webkitdirectory is non-standard but supported by Chrome/Edge/Safari */}
      <input
        ref={folderRef}
        type="file"
        multiple
        className="hidden"
        // @ts-expect-error — webkitdirectory is not in standard React type defs
        webkitdirectory=""
        directory=""
        onChange={(e) => {
          void ingestFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={fileRef}
        type="file"
        multiple
        accept=".md,.markdown,.txt,.csv,text/markdown,text/plain,text/csv"
        className="hidden"
        onChange={(e) => {
          void ingestFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {value.length > 0 && (
        <ul className="space-y-1 text-xs">
          {value.map((att, idx) => (
            <li
              key={`${att.name}-${idx}`}
              className="flex items-center justify-between rounded border border-border bg-card px-2 py-1"
            >
              <span className="truncate">
                {att.name}{" "}
                <span className="text-muted-foreground">
                  ({Math.round(att.sizeBytes / 1024) || 1} KB)
                </span>
              </span>
              <button
                type="button"
                aria-label={`Remove ${att.name}`}
                onClick={() => removeAt(idx)}
                className="rounded p-0.5 hover:bg-accent"
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <pre className="whitespace-pre-wrap text-xs text-destructive">{error}</pre>}
      <p className="text-[11px] text-muted-foreground">
        Up to {maxFiles} files, {Math.round(maxBytesPerFile / 1024)} KB each. Text only (
        {ALLOWED_EXTS.join(", ")}).
      </p>
    </div>
  );
}
