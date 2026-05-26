// DEAL DESK: Task 13 — Outreach Approvals page (approve / reject pending sends).
import { useEffect, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Clock,
  Loader2,
  Mail,
  Pencil,
  Search,
  Send,
  X,
  XCircle,
} from "lucide-react";
import { useCompany } from "../../context/CompanyContext";
import { useBreadcrumbs } from "../../context/BreadcrumbContext";
import { EmptyState } from "../../components/EmptyState";
import { PageSkeleton } from "../../components/PageSkeleton";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export interface PendingSend {
  id: string;
  subject: string;
  body: string;
  status: "awaiting_approval";
  contactId?: string | null;
  contactEmail?: string | null;
  contactName?: string | null;
  contactEmailStatus?: string | null;
  contactSource?: string | null;
  intermediaryId?: string | null;
  intermediaryName?: string | null;
  intermediaryFirm?: string | null;
  intermediaryTitle?: string | null;
  intermediaryEmail?: string | null;
  isIntermediaryCheckIn?: boolean;
}

function formatApproveError(body: unknown, status: number): string {
  if (body && typeof body === "object") {
    const record = body as { reason?: unknown; code?: unknown };
    if (typeof record.reason === "string" && record.reason.length > 0) {
      if (record.code === "apollo_plan_blocked") {
        return `${record.reason} Configure Apollo at /deal-desk/email-accounts.`;
      }
      if (record.code === "apollo_master_key_required") {
        return `${record.reason} Use a Master API key in Email Accounts settings.`;
      }
      return record.reason;
    }
  }
  return `Approve failed (HTTP ${status})`;
}

function emailSourceLabel(send: PendingSend): string | null {
  if (!send.contactEmail) return null;
  if (send.contactSource === "apollo") {
    return send.contactEmailStatus === "verified" ? "Apollo verified" : "Apollo unverified";
  }
  return "Manual";
}

type SourceBadgeKind =
  | "intermediary"
  | "apollo-verified"
  | "apollo-unverified"
  | "manual";

function resolveSourceBadge(send: PendingSend): { label: string; kind: SourceBadgeKind } | null {
  if (send.isIntermediaryCheckIn) {
    return { label: "Intermediary check-in", kind: "intermediary" };
  }
  const label = emailSourceLabel(send);
  if (!label) return null;
  if (label === "Apollo verified") return { label, kind: "apollo-verified" };
  if (label === "Apollo unverified") return { label, kind: "apollo-unverified" };
  return { label, kind: "manual" };
}

function SourceBadge({ kind, label }: { kind: SourceBadgeKind; label: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[10.5px] font-medium",
        kind === "intermediary" &&
          "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
        kind === "apollo-verified" &&
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        kind === "apollo-unverified" &&
          "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
        kind === "manual" &&
          "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
      )}
    >
      {label}
    </Badge>
  );
}

function InlineNotice({
  tone,
  children,
}: {
  tone: "warning" | "error";
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm leading-5",
        tone === "warning" &&
          "border-amber-500/30 bg-amber-500/5 text-amber-900 dark:text-amber-100",
        tone === "error" &&
          "border-destructive/30 bg-destructive/10 text-destructive",
      )}
    >
      <AlertTriangle
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0",
          tone === "warning" ? "text-amber-600 dark:text-amber-400" : "text-destructive",
        )}
      />
      <div>{children}</div>
    </div>
  );
}

function OutreachPageHeader({ count }: { count: number }) {
  return (
    <div className="dd-panel-subtle flex flex-wrap items-center justify-between gap-3 rounded-lg p-3">
      <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
        Review outreach drafts before they leave your connected inbox. Edit copy, enrich
        contacts with Apollo, then approve to send.
      </p>
      <Badge variant="secondary" className="tabular-nums">
        {count} pending
      </Badge>
    </div>
  );
}

const outreachToolbarShell =
  "inline-flex items-center rounded-lg border border-border/70 bg-background/70 p-0.5 shadow-[inset_0_1px_0_color-mix(in_oklab,var(--foreground)_5%,transparent)]";

const outreachToolbarButton = cn(
  buttonVariants({ variant: "ghost", size: "sm" }),
  "h-7 rounded-md px-2.5 text-muted-foreground hover:bg-accent/80 hover:text-foreground",
);

const outreachApproveButton = cn(
  buttonVariants({ size: "sm" }),
  "h-8 rounded-none rounded-r-[calc(var(--radius)-2px)] border-0 px-4 font-semibold tracking-[-0.01em]",
  "border-emerald-600/80 bg-emerald-600 text-white",
  "shadow-[inset_0_1px_0_color-mix(in_oklab,white_18%,transparent),0_8px_22px_color-mix(in_oklab,var(--color-emerald-600,#059669)_28%,transparent)]",
  "hover:bg-emerald-500 hover:shadow-[inset_0_1px_0_color-mix(in_oklab,white_22%,transparent),0_10px_26px_color-mix(in_oklab,var(--color-emerald-600,#059669)_34%,transparent)]",
  "focus-visible:ring-emerald-500/35",
);

const outreachRejectButton = cn(
  "h-8 rounded-none rounded-l-[calc(var(--radius)-2px)] border-0 px-3.5 font-medium",
  "!bg-red-600 !text-white",
  "shadow-[inset_0_1px_0_color-mix(in_oklab,white_16%,transparent),0_8px_22px_rgba(220,38,38,0.35)]",
  "hover:!bg-red-500 hover:!text-white hover:shadow-[inset_0_1px_0_color-mix(in_oklab,white_20%,transparent),0_10px_26px_rgba(220,38,38,0.45)]",
  "focus-visible:ring-red-500/40",
);

function OutreachEditActions({
  onEdit,
  showApollo,
  onApollo,
  lookingUp,
  disabled,
}: {
  onEdit: () => void;
  showApollo: boolean;
  onApollo: () => void;
  lookingUp: boolean;
  disabled: boolean;
}) {
  return (
    <div className={outreachToolbarShell}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={outreachToolbarButton}
        onClick={onEdit}
        disabled={disabled}
      >
        <Pencil className="h-3.5 w-3.5" />
        Edit draft
      </Button>
      {showApollo ? (
        <>
          <span aria-hidden className="mx-0.5 h-5 w-px bg-border/70" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              outreachToolbarButton,
              "text-sky-700 hover:bg-sky-500/10 hover:text-sky-700 dark:text-sky-300 dark:hover:text-sky-200",
            )}
            onClick={onApollo}
            disabled={disabled || lookingUp}
          >
            {lookingUp ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Looking up…
              </>
            ) : (
              <>
                <Search className="h-3.5 w-3.5" />
                Apollo lookup
              </>
            )}
          </Button>
        </>
      ) : null}
    </div>
  );
}

function OutreachDecisionActions({
  onApprove,
  onReject,
  approving,
  rejecting,
  disabled,
}: {
  onApprove: () => void;
  onReject: () => void;
  approving: boolean;
  rejecting: boolean;
  disabled: boolean;
}) {
  return (
    <div
      className={cn(
        outreachToolbarShell,
        "overflow-hidden p-0 shadow-[0_0_0_1px_color-mix(in_oklab,var(--border)_80%,transparent),0_10px_28px_color-mix(in_oklab,var(--foreground)_4%,transparent)]",
      )}
    >
      <Button
        type="button"
        variant="destructive"
        size="sm"
        className={outreachRejectButton}
        onClick={onReject}
        disabled={disabled || rejecting}
      >
        {rejecting ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Rejecting…
          </>
        ) : (
          <>
            <XCircle className="h-3.5 w-3.5" />
            Reject
          </>
        )}
      </Button>
      <span aria-hidden className="h-8 w-px bg-border/70" />
      <Button
        type="button"
        size="sm"
        className={outreachApproveButton}
        onClick={onApprove}
        disabled={disabled || approving}
      >
        {approving ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Sending…
          </>
        ) : (
          <>
            <Send className="h-3.5 w-3.5" />
            Approve & Send
          </>
        )}
      </Button>
    </div>
  );
}

function OutreachSaveActions({
  onSave,
  onCancel,
  saving,
}: {
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  return (
    <div className={cn(outreachToolbarShell, "gap-0.5")}>
      <Button
        type="button"
        size="sm"
        className={cn(
          buttonVariants({ size: "sm" }),
          "h-7 rounded-md px-3 font-medium",
        )}
        disabled={saving}
        onClick={onSave}
      >
        {saving ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Saving…
          </>
        ) : (
          "Save changes"
        )}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={outreachToolbarButton}
        onClick={onCancel}
      >
        <X className="h-3.5 w-3.5" />
        Cancel
      </Button>
    </div>
  );
}

// ─── Inline-editable card (used by OutreachApprovalsPage) ───────────────────

function PendingSendCard({
  send,
  companyId,
  onChanged,
}: {
  send: PendingSend;
  companyId: string;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState(send.subject);
  const [body, setBody] = useState(send.body);
  const [recipientEmail, setRecipientEmail] = useState(send.contactEmail ?? "");
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setSubject(send.subject);
    setBody(send.body);
    setRecipientEmail(send.contactEmail ?? "");
  }, [send]);

  const sourceBadge = resolveSourceBadge(send);
  const isManualEmail =
    !send.isIntermediaryCheckIn && Boolean(send.contactEmail && send.contactSource !== "apollo");
  const displayName = send.isIntermediaryCheckIn
    ? [send.intermediaryName, send.intermediaryFirm].filter(Boolean).join(" — ")
    : send.contactName;
  const displayEmail = send.isIntermediaryCheckIn ? send.intermediaryEmail : send.contactEmail;
  const isBusy = saving || approving || rejecting || lookingUp;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, string> = { subject, body };
      const trimmedEmail = recipientEmail.trim();
      if (trimmedEmail) payload.recipientEmail = trimmedEmail;

      const res = await fetch(
        `/api/companies/${companyId}/deal-desk/tools/outreach/sends/${send.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        const txt = await res.text();
        let message = txt || `HTTP ${res.status}`;
        try {
          const parsed = JSON.parse(txt) as { reason?: string };
          if (parsed.reason) message = parsed.reason;
        } catch {
          // keep raw text
        }
        throw new Error(message);
      }
      setEditing(false);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function lookupWithApollo() {
    if (!send.contactId) {
      setActionError("This send has no linked contact for Apollo lookup.");
      return;
    }
    setLookingUp(true);
    setActionError(null);
    try {
      const res = await fetch(
        `/api/companies/${companyId}/deal-desk/tools/contacts/enrich/${send.contactId}`,
        { method: "POST", credentials: "include" },
      );
      const body = (await res.json()) as { ok?: boolean; reason?: string; email?: string };
      if (!res.ok || body.ok === false) {
        throw new Error(body.reason ?? `Apollo lookup failed (HTTP ${res.status})`);
      }
      onChanged();
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setLookingUp(false);
    }
  }

  const onApprove = async () => {
    setActionError(null);
    if (editing && recipientEmail.trim() !== (send.contactEmail ?? "")) {
      setActionError("Save your edits before approving.");
      return;
    }

    setApproving(true);
    try {
      const res = await fetch(
        `/api/companies/${companyId}/deal-desk/tools/outreach/sends/${send.id}/approve`,
        { method: "POST", credentials: "include" },
      );
      if (!res.ok) {
        let message = `Approve failed (HTTP ${res.status})`;
        try {
          message = formatApproveError(await res.json(), res.status);
        } catch {
          const txt = await res.text();
          if (txt) message = txt;
        }
        throw new Error(message);
      }
      onChanged();
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setApproving(false);
    }
  };

  const onReject = async () => {
    setActionError(null);
    setRejecting(true);
    try {
      const res = await fetch(
        `/api/companies/${companyId}/deal-desk/tools/outreach/sends/${send.id}/reject`,
        { method: "POST", credentials: "include" },
      );
      if (!res.ok) {
        throw new Error(`Reject failed (HTTP ${res.status})`);
      }
      onChanged();
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setRejecting(false);
    }
  };

  return (
    <article className="rounded-xl border border-border/70 bg-card shadow-sm">
      <header className="flex items-start justify-between gap-4 border-b border-border/60 p-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background/80">
            <Mail className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              {displayName ? (
                <span className="text-sm font-semibold text-foreground">{displayName}</span>
              ) : null}
              {sourceBadge ? (
                <SourceBadge kind={sourceBadge.kind} label={sourceBadge.label} />
              ) : null}
            </div>
            {displayEmail ? (
              <p className="truncate font-mono text-xs text-muted-foreground">{displayEmail}</p>
            ) : (
              <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                {send.isIntermediaryCheckIn
                  ? "No email on intermediary record"
                  : "No email yet — use Look up with Apollo"}
              </p>
            )}
          </div>
        </div>
        <div className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border/70 bg-background/80 px-2.5 py-1 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400" />
          <span>Awaiting approval</span>
        </div>
      </header>

      <div className="space-y-4 p-4">
        {editing ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor={`subject-${send.id}`}>Subject</Label>
              <Input
                id={`subject-${send.id}`}
                aria-label="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`body-${send.id}`}>Body</Label>
              <Textarea
                id={`body-${send.id}`}
                aria-label="body"
                className="min-h-40 font-mono text-xs leading-relaxed"
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`recipient-${send.id}`}>Recipient email (manual override)</Label>
              <Input
                id={`recipient-${send.id}`}
                aria-label="recipient email"
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="Only if Apollo cannot find the address"
              />
              <p className="text-xs leading-5 text-muted-foreground">
                Manual emails are a last resort. Approve will try Apollo first and replace a
                non-Apollo address when enrichment succeeds.
              </p>
            </div>
            {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
            <OutreachSaveActions
              onSave={save}
              onCancel={() => {
                setEditing(false);
                setSubject(send.subject);
                setBody(send.body);
                setRecipientEmail(send.contactEmail ?? "");
                setError(null);
              }}
              saving={saving}
            />
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Subject
              </p>
              <h3 className="text-base font-semibold leading-6 text-foreground">{send.subject}</h3>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Message
              </p>
              <div className="rounded-lg border border-border/60 bg-muted/20 px-3.5 py-3">
                <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-foreground/90">
                  {send.body}
                </pre>
              </div>
            </div>

            {isManualEmail ? (
              <InlineNotice tone="warning">
                This recipient uses a manual email. Approve will attempt Apollo lookup and
                replace it with the enriched address when found.
              </InlineNotice>
            ) : null}
            {!displayEmail && !send.isIntermediaryCheckIn ? (
              <InlineNotice tone="warning">
                No email on file. Click Look up with Apollo before approving, or add a manual
                override in Edit.
              </InlineNotice>
            ) : null}
            {actionError ? <InlineNotice tone="error">{actionError}</InlineNotice> : null}
          </>
        )}
      </div>

      {!editing ? (
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 bg-muted/10 px-4 py-3">
          <OutreachEditActions
            onEdit={() => setEditing(true)}
            showApollo={Boolean(send.contactId && !send.isIntermediaryCheckIn)}
            onApollo={lookupWithApollo}
            lookingUp={lookingUp}
            disabled={isBusy}
          />
          <OutreachDecisionActions
            onApprove={onApprove}
            onReject={onReject}
            approving={approving}
            rejecting={rejecting}
            disabled={isBusy || lookingUp}
          />
        </footer>
      ) : null}
    </article>
  );
}

// ─── Presentational component (preserved for existing tests) ────────────────

export interface OutreachApprovalsProps {
  sends: PendingSend[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

export function OutreachApprovals(props: OutreachApprovalsProps) {
  if (props.sends.length === 0) {
    return (
      <EmptyState
        icon={Mail}
        message="No outreach awaiting approval. Drafts from your outreach agents will appear here."
      />
    );
  }
  return (
    <div className="space-y-4">
      <OutreachPageHeader count={props.sends.length} />
      <div className="grid gap-4">
        {props.sends.map((s) => (
          <article
            key={s.id}
            className="rounded-xl border border-border/70 bg-card p-4 shadow-sm"
          >
            <h3 className="text-base font-semibold leading-6 text-foreground">{s.subject}</h3>
            <div className="mt-3 rounded-lg border border-border/60 bg-muted/20 px-3.5 py-3">
              <pre className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                {s.body}
              </pre>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-end gap-3 border-t border-border/60 pt-4">
              <OutreachDecisionActions
                onApprove={() => props.onApprove(s.id)}
                onReject={() => props.onReject(s.id)}
                approving={false}
                rejecting={false}
                disabled={false}
              />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

// ─── Connected page (uses PendingSendCard with inline edit) ─────────────────

export function OutreachApprovalsPage() {
  const { selectedCompanyId: companyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const [sends, setSends] = useState<PendingSend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setBreadcrumbs([{ label: "Deal Sourcing" }, { label: "Outreach Approvals" }]);
  }, [setBreadcrumbs]);

  const refresh = () => {
    if (!companyId) return;
    setLoading(true);
    fetch(`/api/companies/${companyId}/deal-desk/tools/outreach/sends/pending`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((j) => setSends(j.sends ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(refresh, [companyId]);

  if (!companyId) {
    return <EmptyState icon={Mail} message="Select a fund to review outreach drafts." />;
  }

  if (loading) return <PageSkeleton variant="approvals" />;

  if (sends.length === 0) {
    return (
      <EmptyState
        icon={Mail}
        message="No outreach awaiting approval. Drafts from your outreach agents will appear here."
      />
    );
  }

  return (
    <div className="space-y-4">
      <OutreachPageHeader count={sends.length} />
      <div className="grid gap-4">
        {sends.map((s) => (
          <PendingSendCard key={s.id} send={s} companyId={companyId} onChanged={refresh} />
        ))}
      </div>
    </div>
  );
}
