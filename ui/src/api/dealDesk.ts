// DEAL DESK: Frontend HTTP client for PE-specific endpoints.
import { api } from "./client";

export type CreateThesisInput = {
  name: string;
  sector: string;
  subSectors?: string[];
  geos?: string[];
  revenueMin?: string | number | null;
  revenueMax?: string | number | null;
  ebitdaMin?: string | number | null;
  ebitdaMax?: string | number | null;
  dealSizeMin?: string | number | null;
  dealSizeMax?: string | number | null;
  ownershipPreferences?: string[];
  exclusionCriteria?: string | null;
  narrative?: string | null;
  templateSlug?: string | null;
};

export type Thesis = {
  id: string;
  paperclipCompanyId: string;
  name: string;
  sector: string;
  subSectors: unknown;
  geos: unknown;
  narrative: string | null;
  templateSlug: string | null;
  createdAt: string;
};

// DEAL DESK: Phase 7 — extended types for dashboard pages.
export type DdTargetStatus =
  | "sourced"
  | "qualified"
  | "contacted"
  | "replied"
  | "meeting_booked"
  | "in_diligence"
  | "passed"
  | "closed_won"
  | "closed_lost";

export type DdSource = { url: string; description?: string };

export type DdTarget = {
  id: string;
  paperclipCompanyId: string;
  thesisId: string;
  sourcedByAgentId: string | null;
  sourceTicketId: string | null;
  companyName: string;
  website: string | null;
  description: string | null;
  sector: string | null;
  subSector: string | null;
  hqCity: string | null;
  hqState: string | null;
  hqCountry: string;
  estimatedRevenue: string | null;
  estimatedEbitda: string | null;
  estimatedEmployees: number | null;
  ownershipType: string | null;
  fitScore: number | null;
  fitRationale: string | null;
  sources: DdSource[] | unknown;
  status: DdTargetStatus;
  tags: unknown;
  notes: string | null;
  crmExternalId: string | null;
  statusChangedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DdIntermediary = {
  id: string;
  paperclipCompanyId: string;
  name: string;
  firm: string | null;
  title: string | null;
  coverageSectors: unknown;
  coverageSizeMin: string | null;
  coverageSizeMax: string | null;
  email: string | null;
  linkedinUrl: string | null;
  phone: string | null;
  recentDeals: unknown;
  lastTouchDate: string | null;
  cadenceDays: number;
  nextTouchDue: string | null;
  relationshipStrength: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateIntermediaryInput = {
  name: string;
  firm?: string | null;
  title?: string | null;
  email?: string | null;
  linkedinUrl?: string | null;
  phone?: string | null;
  coverageSectors?: string[];
  cadenceDays?: number;
  relationshipStrength?: number;
  notes?: string | null;
};

export type DdMemo = {
  id: string;
  paperclipCompanyId: string;
  generatedByAgentId: string | null;
  weekStartDate: string;
  markdown: string;
  metricsSnapshot: unknown;
  createdAt: string;
};

// DEAL DESK: Phase 8 — pre-built PE agent role templates (read-only).
export type DdRoleTemplate = {
  id: string;
  slug: string;
  name: string;
  description: string;
  defaultHeartbeatCron: string;
  defaultBudgetUsd: number;
  skillFiles: string[];
  systemPrompt: string;
};

export const dealDeskApi = {
  listRoleTemplates: (companyId: string) =>
    api.get<DdRoleTemplate[]>(
      `/companies/${companyId}/deal-desk/role-templates`,
    ),
  createThesis: (companyId: string, data: CreateThesisInput) =>
    api.post<Thesis>(`/companies/${companyId}/deal-desk/theses`, data),
  listTheses: (companyId: string) =>
    api.get<Thesis[]>(`/companies/${companyId}/deal-desk/theses`),
  getThesis: (companyId: string, thesisId: string) =>
    api.get<Thesis>(`/companies/${companyId}/deal-desk/theses/${thesisId}`),
  listThesisTargets: (companyId: string, thesisId: string) =>
    api.get<DdTarget[]>(
      `/companies/${companyId}/deal-desk/theses/${thesisId}/targets`,
    ),
  updateTargetStatus: (
    companyId: string,
    targetId: string,
    status: DdTargetStatus,
  ) =>
    api.patch<DdTarget>(
      `/companies/${companyId}/deal-desk/targets/${targetId}/status`,
      { status },
    ),
  listIntermediaries: (companyId: string) =>
    api.get<DdIntermediary[]>(
      `/companies/${companyId}/deal-desk/intermediaries`,
    ),
  // TODO(v0.2): server tools endpoint may differ; wired per FORK.md.
  createIntermediary: (companyId: string, data: CreateIntermediaryInput) =>
    api.post<DdIntermediary>(
      `/companies/${companyId}/deal-desk/tools/intermediaries`,
      data,
    ),
  listMemos: (companyId: string) =>
    api.get<DdMemo[]>(`/companies/${companyId}/deal-desk/memos`),
};
