// DEAL DESK: Task 13 — Outreach Approvals page (approve / reject pending sends).
import { useEffect, useState } from "react";
import { useCompany } from "../../context/CompanyContext";

export interface PendingSend {
  id: string;
  subject: string;
  body: string;
  status: "awaiting_approval";
}

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

  const onApprove = async (id: string) => {
    if (!companyId) return;
    await fetch(
      `/api/companies/${companyId}/deal-desk/tools/outreach/sends/${id}/approve`,
      { method: "POST", credentials: "include" },
    );
    refresh();
  };

  const onReject = async (id: string) => {
    if (!companyId) return;
    await fetch(
      `/api/companies/${companyId}/deal-desk/tools/outreach/sends/${id}/reject`,
      { method: "POST", credentials: "include" },
    );
    refresh();
  };

  if (!companyId) return null;

  return <OutreachApprovals sends={sends} onApprove={onApprove} onReject={onReject} />;
}
