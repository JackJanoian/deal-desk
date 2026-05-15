// DEAL DESK: Task 12 — Email Accounts page (connect / disconnect Gmail).
import { useEffect, useState } from "react";
import { useCompany } from "../../context/CompanyContext";

export interface EmailAccount {
  id: string;
  emailAddress: string;
  provider: "gmail";
  revokedAt: string | null;
}

export interface EmailAccountsProps {
  companyId: string;
  accounts: EmailAccount[];
  onConnect: () => void;
  onDisconnect: (id: string) => void;
}

export function EmailAccounts(props: EmailAccountsProps) {
  const active = props.accounts.filter((a) => !a.revokedAt);
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Email Accounts</h1>
      <p className="text-sm text-gray-600 mb-4">
        Connect a Gmail account so the Outreach Analyst can send messages on your behalf.
        Each send still requires your approval.
      </p>
      <a
        href={`/api/oauth/gmail/start?companyId=${encodeURIComponent(props.companyId)}`}
        className="inline-block px-4 py-2 bg-blue-600 text-white rounded"
        onClick={props.onConnect}
      >
        Connect Gmail
      </a>
      <ul className="mt-6 divide-y">
        {active.map((a) => (
          <li key={a.id} className="py-3 flex items-center justify-between">
            <span>{a.emailAddress}</span>
            <button
              type="button"
              className="text-sm text-red-600"
              onClick={() => props.onDisconnect(a.id)}
            >
              Disconnect
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function EmailAccountsPage() {
  const { selectedCompanyId: companyId } = useCompany();
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  useEffect(() => {
    if (!companyId) return;
    fetch(`/api/companies/${companyId}/deal-desk/tools/email-accounts`, { credentials: "include" })
      .then((r) => r.json())
      .then((j) => setAccounts(j.accounts ?? []));
  }, [companyId]);

  const onDisconnect = async (id: string) => {
    if (!companyId) return;
    await fetch(`/api/companies/${companyId}/deal-desk/tools/email-accounts/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    setAccounts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, revokedAt: new Date().toISOString() } : a)),
    );
  };

  if (!companyId) return null;

  return (
    <EmailAccounts
      companyId={companyId}
      accounts={accounts}
      onConnect={() => {}}
      onDisconnect={onDisconnect}
    />
  );
}
