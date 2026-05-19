export type ApolloEmailStatus = "verified" | "unverified" | "bounced" | "invalid";

export interface ApolloMatchInput {
  firstName: string;
  lastName: string;
  companyDomain: string;
  apiKey: string;
}

export interface ApolloMatchResult {
  email: string | null;
  emailStatus: ApolloEmailStatus | null;
}

const APOLLO_ENDPOINT = "https://api.apollo.io/api/v1/people/match";

function normalizeStatus(raw: unknown): ApolloEmailStatus | null {
  if (raw === "verified") return "verified";
  if (raw === "bounced") return "bounced";
  if (raw === "invalid") return "invalid";
  if (raw === "guessed" || raw === "unverified") return "unverified";
  return null;
}

export async function apolloMatchPerson(input: ApolloMatchInput): Promise<ApolloMatchResult> {
  const res = await fetch(APOLLO_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": input.apiKey,
    },
    body: JSON.stringify({
      first_name: input.firstName,
      last_name: input.lastName,
      domain: input.companyDomain,
      reveal_personal_emails: false,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Apollo people/match failed (${res.status}): ${text}`);
  }

  const payload = (await res.json()) as { person?: { email?: string; email_status?: string } | null };
  const person = payload.person ?? null;
  if (!person || !person.email) {
    return { email: null, emailStatus: null };
  }
  return {
    email: person.email,
    emailStatus: normalizeStatus(person.email_status),
  };
}
