// DEAL DESK: v0.3 — drag-or-pick a .md/.txt file and read it into the prompt state
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X } from "lucide-react";

interface Props {
  value: string;
  onChange: (text: string, fileName: string | null) => void;
  fileName: string | null;
  maxBytes?: number; // default 200 KB
}

const ALLOWED_EXTENSIONS = [".md", ".markdown", ".txt"];

export function PromptFileInput({ value, onChange, fileName, maxBytes = 200_000 }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  async function handlePick(file: File) {
    const lower = file.name.toLowerCase();
    if (!ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
      setError(`Only ${ALLOWED_EXTENSIONS.join(", ")} files are supported.`);
      return;
    }
    if (file.size > maxBytes) {
      setError(`File too large (max ${Math.floor(maxBytes / 1024)} KB).`);
      return;
    }
    setError(null);
    const text = await file.text();
    onChange(text, file.name);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="mr-1 h-3 w-3" />
          {fileName ? "Replace file" : "Attach instructions (.md)"}
        </Button>
        {fileName && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            {fileName}
            <button
              type="button"
              onClick={() => onChange("", null)}
              aria-label="Remove file"
              className="rounded p-0.5 hover:bg-accent"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".md,.markdown,.txt,text/markdown,text/plain"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handlePick(file);
          e.target.value = ""; // allow re-picking the same file
        }}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <textarea
        className="min-h-[120px] w-full rounded border border-input bg-background p-2 font-mono text-xs"
        placeholder="...or paste instructions here."
        value={value}
        onChange={(e) => onChange(e.target.value, null)}
      />
    </div>
  );
}
