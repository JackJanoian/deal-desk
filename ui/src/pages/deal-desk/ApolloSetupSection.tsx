import { useEffect, useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ApolloSetupSection({ companyId }: { companyId: string }) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [matchEnabled, setMatchEnabled] = useState<boolean | null>(null);
  const [searchEnabled, setSearchEnabled] = useState<boolean | null>(null);
  const [enrichmentEnabled, setEnrichmentEnabled] = useState<boolean | null>(null);
  const [planLimited, setPlanLimited] = useState<boolean | null>(null);
  const [masterKeyRequired, setMasterKeyRequired] = useState<boolean | null>(null);
  const [lastValidatedAt, setLastValidatedAt] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch(
      `/api/companies/${companyId}/deal-desk/tools/apollo-api-key`,
      { credentials: "include" },
    );
    const j = await res.json();
    setConfigured(Boolean(j.configured));
    setMatchEnabled(typeof j.matchEnabled === "boolean" ? j.matchEnabled : null);
    setSearchEnabled(typeof j.searchEnabled === "boolean" ? j.searchEnabled : null);
    setEnrichmentEnabled(typeof j.enrichmentEnabled === "boolean" ? j.enrichmentEnabled : null);
    setPlanLimited(typeof j.planLimited === "boolean" ? j.planLimited : null);
    setMasterKeyRequired(typeof j.masterKeyRequired === "boolean" ? j.masterKeyRequired : null);
    setLastValidatedAt(typeof j.lastValidatedAt === "string" ? j.lastValidatedAt : null);
  }

  useEffect(() => {
    void refresh();
  }, [companyId]);

  async function save() {
    if (apiKey.trim().length < 8) {
      setError("API key looks too short — paste the full key from Apollo.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/companies/${companyId}/deal-desk/tools/apollo-api-key`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ apiKey: apiKey.trim() }),
        },
      );
      if (!res.ok) throw new Error(await res.text());
      setApiKey("");
      setShowKey(false);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/companies/${companyId}/deal-desk/tools/apollo-api-key`,
        { method: "DELETE", credentials: "include" },
      );
      if (!res.ok) throw new Error(await res.text());
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4 text-muted-foreground" aria-hidden />
          Apollo.io enrichment
        </CardTitle>
        <CardDescription>
          Powers the Contact Enricher agent to look up verified email addresses for
          target-company contacts.
        </CardDescription>
        {configured === true && (
          <CardAction>
            {enrichmentEnabled ? (
              <Badge variant="secondary" className="gap-1">
                <CheckCircle2 className="size-3" aria-hidden />
                Email enrichment enabled
              </Badge>
            ) : masterKeyRequired ? (
              <Badge variant="outline" className="gap-1 border-amber-500/40 text-amber-700 dark:text-amber-300">
                Master API key required
              </Badge>
            ) : planLimited ? (
              <Badge variant="outline" className="gap-1 border-amber-500/40 text-amber-700 dark:text-amber-300">
                Plan doesn&apos;t support email reveal
              </Badge>
            ) : (
              <Badge variant="destructive" className="gap-1">
                Key invalid or blocked
              </Badge>
            )}
          </CardAction>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Get an API key from{" "}
          <a
            className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
            href="https://app.apollo.io/#/settings/integrations/api"
            target="_blank"
            rel="noreferrer"
          >
            Apollo Settings → Integrations → API
            <ExternalLink className="size-3.5 shrink-0" aria-hidden />
          </a>
          .
        </p>

        {configured === null ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Checking Apollo configuration…
          </div>
        ) : configured ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Your Apollo API key is stored for this company. Outreach sends will look up
              recipient emails through Apollo before approval.
            </p>
            {lastValidatedAt && (
              <p className="text-xs text-muted-foreground">
                Last validated {new Date(lastValidatedAt).toLocaleString()}
              </p>
            )}
            {enrichmentEnabled && planLimited && (
              <p className="text-sm text-muted-foreground">
                Free-tier path active: Deal Desk searches Apollo, then uses your monthly
                enrichment credits to reveal emails (search + bulk match).
              </p>
            )}
            {masterKeyRequired && (
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Apollo requires a <strong>Master API key</strong> for search and enrichment.
                Create one under{" "}
                <a
                  className="underline underline-offset-4"
                  href="https://app.apollo.io/#/settings/integrations/api"
                  target="_blank"
                  rel="noreferrer"
                >
                  Apollo Settings → Integrations → API
                </a>
                , then reset and re-save your key here.
              </p>
            )}
            {!enrichmentEnabled && planLimited && !masterKeyRequired && (
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Your Apollo plan blocked direct email match. If you have free enrichment credits,
                create a Master API key and save it again. Otherwise upgrade at{" "}
                <a
                  className="underline underline-offset-4"
                  href="https://app.apollo.io/#/settings/plans/upgrade"
                  target="_blank"
                  rel="noreferrer"
                >
                  app.apollo.io
                </a>
                .
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={saving}
                onClick={reset}
                className="ml-auto"
              >
              {saving ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden />
                  Resetting…
                </>
              ) : (
                "Reset key"
              )}
            </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
            <div className="space-y-2">
              <Label htmlFor="apollo-api-key" className="flex items-center gap-1.5">
                <KeyRound className="size-3.5 text-muted-foreground" aria-hidden />
                Apollo API key
              </Label>
              <div className="flex gap-2">
                <Input
                  id="apollo-api-key"
                  type={showKey ? "text" : "password"}
                  className="font-mono text-sm"
                  placeholder="Paste your Apollo API key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void save();
                  }}
                  aria-invalid={error ? true : undefined}
                  autoComplete="off"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={showKey ? "Hide API key" : "Show API key"}
                  onClick={() => setShowKey((v) => !v)}
                >
                  {showKey ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Stored encrypted per company. Never shared with connected Gmail accounts.
              </p>
            </div>
            <Button type="button" disabled={saving || apiKey.trim().length === 0} onClick={save}>
              {saving ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden />
                  Saving…
                </>
              ) : (
                "Save API key"
              )}
            </Button>
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
