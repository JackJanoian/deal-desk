// DEAL DESK: Task 13 — Outreach Approvals page (approve / reject pending sends).
import { useEffect, useState } from "react";
import { useCompany } from "../../context/CompanyContext";

export interface PendingSend {
  id: string;
  subject: string;
  body: string;
  status: "awaiting_approval";
  contactEmail?: string | null;
  contactName?: string | null;
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/companies/${companyId}/deal-desk/tools/outreach/sends/${send.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ subject, body }),
        },
      );
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `HTTP ${res.status}`);
      }
      setEditing(false);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const onApprove = async () => {
    await fetch(
      `/api/companies/${companyId}/deal-desk/tools/outreach/sends/${send.id}/approve`,
      { method: "POST", credentials: "include" },
    );
    onChanged();
  };

  const onReject = async () => {
    await fetch(
      `/api/companies/${companyId}/deal-desk/tools/outreach/sends/${send.id}/reject`,
      { method: "POST", credentials: "include" },
    );
    onChanged();
  };

  return (
    <div className="border rounded p-4">
      {(send.contactName ?? send.contactEmail) && (
        <div className="text-sm text-gray-600 mb-1">
          To:{" "}
          <strong>{send.contactName ?? send.contactEmail}</strong>
          {send.contactEmail && send.contactName ? ` <${send.contactEmail}>` : ""}
        </div>
      )}
      {editing ? (
        <div className="space-y-2">
          <label className="block text-xs text-gray-500">
            Subject
            <input
              aria-label="subject"
              className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </label>
          <label className="block text-xs text-gray-500">
            Body
            <textarea
              aria-label="body"
              className="mt-1 h-40 w-full rounded border border-gray-300 px-2 py-1 text-sm font-mono"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </label>
          {error && <div className="text-xs text-red-600">{error}</div>}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={save}
              className="rounded bg-gray-900 px-3 py-1 text-sm text-white disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setSubject(send.subject);
                setBody(send.body);
              }}
              className="rounded border border-gray-300 px-3 py-1 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="font-medium">{send.subject}</div>
          <pre className="whitespace-pre-wrap text-sm mt-2">{send.body}</pre>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded border border-gray-300 px-3 py-1 text-sm"
            >
              Edit
            </button>
            <button
              type="button"
              className="px-3 py-1 bg-green-600 text-white rounded"
              onClick={onApprove}
            >
              Approve &amp; Send
            </button>
            <button
              type="button"
              className="px-3 py-1 bg-gray-200 rounded"
              onClick={onReject}
            >
              Reject
            </button>
          </div>
        </div>
      )}
    </div>
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
    return <div className="p-6 text-gray-500">No outreach awaiting approval.</div>;
  }
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Outreach Approvals</h1>
      {props.sends.map((s) => (
        <div key={s.id} className="border rounded p-4">
          <div className="font-medium">{s.subject}</div>
          <pre className="whitespace-pre-wrap text-sm mt-2">{s.body}</pre>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="px-3 py-1 bg-green-600 text-white rounded"
              onClick={() => props.onApprove(s.id)}
            >
              Approve &amp; Send
            </button>
            <button
              type="button"
              className="px-3 py-1 bg-gray-200 rounded"
              onClick={() => props.onReject(s.id)}
            >
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Connected page (uses PendingSendCard with inline edit) ─────────────────

export function OutreachApprovalsPage() {
  const { selectedCompanyId: companyId } = useCompany();
  const [sends, setSends] = useState<PendingSend[]>([]);

  const refresh = () => {
    if (!companyId) return;
    fetch(`/api/companies/${companyId}/deal-desk/tools/outreach/sends/pending`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((j) => setSends(j.sends ?? []));
  };

  useEffect(refresh, [companyId]);

  if (!companyId) return null;

  if (sends.length === 0) {
    return <div className="p-6 text-gray-500">No outreach awaiting approval.</div>;
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Outreach Approvals</h1>
      {sends.map((s) => (
        <PendingSendCard
          key={s.id}
          send={s}
          companyId={companyId}
          onChanged={refresh}
        />
      ))}
    </div>
  );
}
