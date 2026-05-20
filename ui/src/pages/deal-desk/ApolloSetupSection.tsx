import { useEffect, useState } from "react";

export default function ApolloSetupSection({ companyId }: { companyId: string }) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch(
      `/api/companies/${companyId}/deal-desk/tools/apollo-api-key`,
      { credentials: "include" },
    );
    const j = await res.json();
    setConfigured(Boolean(j.configured));
  }

  useEffect(() => {
    void refresh();
  }, [companyId]);

  async function save() {
    if (apiKey.trim().length < 8) {
      setError("API key looks too short");
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
    <section className="rounded border border-gray-200 bg-white p-4">
      <h3 className="text-sm font-semibold">Apollo.io contact enrichment</h3>
      <p className="mt-1 text-xs text-gray-600">
        Used by the Contact Enricher agent to look up verified email addresses for
        target-company contacts. Get an API key at{" "}
        <a
          className="text-blue-600 underline"
          href="https://app.apollo.io/#/settings/integrations/api"
          target="_blank"
          rel="noreferrer"
        >
          app.apollo.io › Settings › Integrations › API
        </a>
        .
      </p>

      {configured === null ? (
        <div className="mt-3 text-xs text-gray-500">Loading…</div>
      ) : configured ? (
        <div className="mt-3 flex items-center gap-2">
          <span className="rounded bg-green-50 px-2 py-1 text-xs text-green-700">
            Configured
          </span>
          <button
            type="button"
            disabled={saving}
            onClick={reset}
            className="rounded border border-gray-300 px-3 py-1 text-xs disabled:opacity-50"
          >
            Reset
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <label className="block text-xs text-gray-500">
            Apollo API key
            <input
              aria-label="Apollo API key"
              type="password"
              className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm font-mono"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50 text-sm"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      )}
      {error && <div className="mt-2 text-xs text-red-600">{error}</div>}
    </section>
  );
}
