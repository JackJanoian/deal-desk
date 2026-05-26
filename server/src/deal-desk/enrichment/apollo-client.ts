export type ApolloEmailStatus = "verified" | "unverified" | "bounced" | "invalid";

export type ApolloErrorCode =
  | "apollo_plan_blocked"
  | "apollo_credits_exhausted"
  | "apollo_auth_failed"
  | "apollo_master_key_required"
  | "apollo_unknown";

export class ApolloApiError extends Error {
  readonly status: number;
  readonly code: ApolloErrorCode;
  readonly rawBody: string;

  constructor(status: number, rawBody: string) {
    const code = classifyApolloError(status, rawBody);
    super(formatApolloErrorMessage(status, rawBody, code));
    this.name = "ApolloApiError";
    this.status = status;
    this.code = code;
    this.rawBody = rawBody;
  }
}

function classifyApolloError(status: number, rawBody: string): ApolloErrorCode {
  const lower = rawBody.toLowerCase();
  if (lower.includes("master api key") || lower.includes("master_api_key")) {
    return "apollo_master_key_required";
  }
  if (
    status === 403 &&
    (lower.includes("api_inaccessible") ||
      lower.includes("not accessible with this api_key") ||
      lower.includes("upgrade your plan"))
  ) {
    return "apollo_plan_blocked";
  }
  if (
    lower.includes("credit") &&
    (lower.includes("exhaust") || lower.includes("insufficient") || lower.includes("limit"))
  ) {
    return "apollo_credits_exhausted";
  }
  if (status === 401 || status === 403) {
    return "apollo_auth_failed";
  }
  return "apollo_unknown";
}

function formatApolloErrorMessage(
  status: number,
  rawBody: string,
  code: ApolloErrorCode,
): string {
  if (code === "apollo_plan_blocked") {
    return "Apollo cannot reveal emails on this plan. Upgrade at https://app.apollo.io/";
  }
  if (code === "apollo_credits_exhausted") {
    return "Apollo enrichment credits exhausted. Add credits at https://app.apollo.io/";
  }
  if (code === "apollo_master_key_required") {
    return "Apollo requires a Master API key for this endpoint. Create one at https://app.apollo.io/#/settings/integrations/api";
  }
  return `Apollo API failed (${status}): ${rawBody}`;
}

export interface ApolloMatchInput {
  firstName: string;
  lastName: string;
  companyDomain: string;
  apiKey: string;
}

export interface ApolloMatchResult {
  email: string | null;
  emailStatus: ApolloEmailStatus | null;
  apolloPersonId?: string | null;
}

export interface ApolloSearchInput {
  firstName: string;
  lastName: string;
  companyDomain: string;
  title?: string;
  apiKey: string;
}

export interface ApolloSearchResult {
  personIds: string[];
}

export interface ApolloBulkMatchInput {
  personIds: string[];
  apiKey: string;
}

const APOLLO_MATCH_ENDPOINT = "https://api.apollo.io/api/v1/people/match";
const APOLLO_SEARCH_ENDPOINT = "https://api.apollo.io/api/v1/mixed_people/api_search";
const APOLLO_BULK_MATCH_ENDPOINT = "https://api.apollo.io/api/v1/people/bulk_match";

function normalizeStatus(raw: unknown): ApolloEmailStatus | null {
  if (raw === "verified") return "verified";
  if (raw === "bounced") return "bounced";
  if (raw === "invalid") return "invalid";
  if (raw === "guessed" || raw === "unverified") return "unverified";
  return null;
}

function apolloHeaders(apiKey: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "X-Api-Key": apiKey,
  };
}

async function readApolloError(res: Response): Promise<never> {
  const text = await res.text().catch(() => "");
  throw new ApolloApiError(res.status, text);
}

function personFromPayload(payload: {
  person?: { id?: string; email?: string; email_status?: string } | null;
}): ApolloMatchResult {
  const person = payload.person ?? null;
  if (!person || !person.email) {
    return { email: null, emailStatus: null, apolloPersonId: person?.id ?? null };
  }
  return {
    email: person.email,
    emailStatus: normalizeStatus(person.email_status),
    apolloPersonId: person.id ?? null,
  };
}

export async function apolloMatchPerson(input: ApolloMatchInput): Promise<ApolloMatchResult> {
  const res = await fetch(APOLLO_MATCH_ENDPOINT, {
    method: "POST",
    headers: apolloHeaders(input.apiKey),
    body: JSON.stringify({
      first_name: input.firstName,
      last_name: input.lastName,
      domain: input.companyDomain,
      reveal_personal_emails: false,
    }),
  });

  if (!res.ok) {
    await readApolloError(res);
  }

  const payload = (await res.json()) as { person?: { id?: string; email?: string; email_status?: string } | null };
  return personFromPayload(payload);
}

export async function apolloSearchPeople(input: ApolloSearchInput): Promise<ApolloSearchResult> {
  const params = new URLSearchParams();
  params.set("q_keywords", `${input.firstName} ${input.lastName}`.trim());
  params.set("q_organization_domains_list[]", input.companyDomain);
  params.set("per_page", "5");
  params.set("page", "1");
  if (input.title) {
    params.set("person_titles[]", input.title);
  }

  const res = await fetch(`${APOLLO_SEARCH_ENDPOINT}?${params.toString()}`, {
    method: "POST",
    headers: apolloHeaders(input.apiKey),
  });

  if (!res.ok) {
    await readApolloError(res);
  }

  const payload = (await res.json()) as {
    people?: Array<{ id?: string; first_name?: string; last_name?: string }>;
  };
  const people = payload.people ?? [];
  const normalizedFirst = input.firstName.toLowerCase();
  const normalizedLast = input.lastName.toLowerCase();

  const personIds = people
    .filter((p) => {
      const fn = (p.first_name ?? "").toLowerCase();
      const ln = (p.last_name ?? "").toLowerCase();
      return fn.includes(normalizedFirst) && ln.includes(normalizedLast);
    })
    .map((p) => p.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  return { personIds };
}

export async function apolloBulkMatchPeople(input: ApolloBulkMatchInput): Promise<ApolloMatchResult> {
  if (input.personIds.length === 0) {
    return { email: null, emailStatus: null };
  }

  const res = await fetch(APOLLO_BULK_MATCH_ENDPOINT, {
    method: "POST",
    headers: apolloHeaders(input.apiKey),
    body: JSON.stringify({
      details: input.personIds.slice(0, 10).map((id) => ({ id })),
      reveal_personal_emails: false,
    }),
  });

  if (!res.ok) {
    await readApolloError(res);
  }

  const payload = (await res.json()) as {
    matches?: Array<{ person?: { id?: string; email?: string; email_status?: string } | null }>;
  };
  const matches = payload.matches ?? [];
  for (const match of matches) {
    const result = personFromPayload({ person: match.person ?? null });
    if (result.email) {
      return result;
    }
  }
  return { email: null, emailStatus: null };
}

export interface ResolvePersonEmailInput {
  firstName: string;
  lastName: string;
  companyDomain: string;
  title?: string;
  apiKey: string;
}

export async function resolvePersonEmail(input: ResolvePersonEmailInput): Promise<ApolloMatchResult> {
  try {
    const direct = await apolloMatchPerson({
      firstName: input.firstName,
      lastName: input.lastName,
      companyDomain: input.companyDomain,
      apiKey: input.apiKey,
    });
    if (direct.email) {
      return direct;
    }
  } catch (err) {
    if (err instanceof ApolloApiError && err.code !== "apollo_plan_blocked") {
      throw err;
    }
    if (!(err instanceof ApolloApiError)) {
      throw err;
    }
  }

  const search = await apolloSearchPeople({
    firstName: input.firstName,
    lastName: input.lastName,
    companyDomain: input.companyDomain,
    title: input.title,
    apiKey: input.apiKey,
  });

  if (search.personIds.length === 0) {
    return { email: null, emailStatus: null };
  }

  return apolloBulkMatchPeople({
    personIds: search.personIds,
    apiKey: input.apiKey,
  });
}

export interface ApolloKeyCapabilities {
  matchEnabled: boolean;
  searchEnabled: boolean;
  /** True when emails can be revealed via people/match or search + bulk_match (free-tier credits). */
  enrichmentEnabled: boolean;
  /** Direct people/match is blocked (common on free plans). Search + bulk_match may still work. */
  planLimited: boolean;
  /** Search endpoints require a Master API key in Apollo settings. */
  masterKeyRequired: boolean;
  lastValidatedAt: string;
}

const PROBE_PERSON = {
  firstName: "Tim",
  lastName: "Zheng",
  companyDomain: "apollo.io",
} as const;

function isAuthFailure(err: unknown): boolean {
  return err instanceof ApolloApiError && err.code === "apollo_auth_failed";
}

export async function probeApolloKeyCapabilities(apiKey: string): Promise<ApolloKeyCapabilities> {
  const lastValidatedAt = new Date().toISOString();
  let matchEnabled = false;
  let searchEnabled = false;
  let enrichmentEnabled = false;
  let planLimited = false;
  let masterKeyRequired = false;

  try {
    const match = await apolloMatchPerson({ ...PROBE_PERSON, apiKey });
    matchEnabled = true;
    if (match.email) {
      enrichmentEnabled = true;
    }
  } catch (err) {
    if (isAuthFailure(err)) throw err;
    if (err instanceof ApolloApiError && err.code === "apollo_plan_blocked") {
      planLimited = true;
    }
  }

  let searchPersonIds: string[] = [];
  try {
    const search = await apolloSearchPeople({ ...PROBE_PERSON, apiKey });
    searchEnabled = true;
    searchPersonIds = search.personIds;
  } catch (err) {
    if (isAuthFailure(err)) throw err;
    if (err instanceof ApolloApiError && err.code === "apollo_master_key_required") {
      masterKeyRequired = true;
    } else if (err instanceof ApolloApiError && err.code === "apollo_plan_blocked") {
      planLimited = true;
    }
  }

  if (searchPersonIds.length > 0 && !enrichmentEnabled) {
    try {
      await apolloBulkMatchPeople({ personIds: searchPersonIds.slice(0, 1), apiKey });
      enrichmentEnabled = true;
    } catch (err) {
      if (isAuthFailure(err)) throw err;
      if (err instanceof ApolloApiError) {
        if (err.code === "apollo_plan_blocked") {
          planLimited = true;
        } else if (err.code === "apollo_credits_exhausted") {
          enrichmentEnabled = true;
        } else if (err.code === "apollo_master_key_required") {
          masterKeyRequired = true;
        }
      }
    }
  }

  return {
    matchEnabled,
    searchEnabled,
    enrichmentEnabled,
    planLimited,
    masterKeyRequired,
    lastValidatedAt,
  };
}
