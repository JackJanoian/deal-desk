// DEAL DESK: Frontend HTTP client for PE-specific endpoints.
import { api } from "./client";

// DEAL DESK: v0.3 — attachments are small text files persisted as JSONB on dd_theses.
export type DdThesisAttachment = {
  name: string;
  mime: string;
  sizeBytes: number;
  content: string;
};

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
  attachments?: DdThesisAttachment[];
};

export type Thesis = {
  id: string;
  dealDeskCompanyId: string;
  name: string;
  sector: string;
  subSectors: unknown;
  geos: unknown;
  narrative: string | null;
  templateSlug: string | null;
  attachments?: DdThesisAttachment[];
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
  dealDeskCompanyId: string;
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

// DEAL DESK: Phase 8 — pre-built PE agent role templates (read-only).
export type DdRoleTemplate = {
  id: string;
  slug: string;
  name: string;
  description: string;
  defaultHeartbeatCron: string;
  defaultBudgetUsd: number;
  systemPrompt: string;
};

export type CreateTargetInput = {
  thesisId: string;
  companyName: string;
  website?: string;
  description?: string;
  sector?: string;
  subSector?: string;
  hqCity?: string;
  hqState?: string;
  estimatedRevenue?: number;
  ownershipType?: string;
  fitScore: number;
  fitRationale: string;
  sources?: DdSource[];
};

export type UpdateTargetInput = {
  status?: DdTargetStatus;
  notes?: string | null;
  fitScore?: number;
  fitRationale?: string;
  sector?: string | null;
  subSector?: string | null;
  website?: string | null;
  description?: string | null;
  hqCity?: string | null;
  hqState?: string | null;
  ownershipType?: string | null;
};

export type PipelineSummary = {
  total: number;
  byStatus: Record<DdTargetStatus, number>;
};

export type DdIntermediary = {
  id: string;
  dealDeskCompanyId: string;
  name: string;
  firm: string | null;
  title: string | null;
  email: string | null;
  linkedinUrl: string | null;
  coverageSectors: unknown;
  cadenceDays: number;
  lastTouchDate: string | null;
  nextTouchDue: string | null;
  relationshipStrength: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
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
  // DEAL DESK: Phase 6 v0.2 — partial update of a thesis.
  updateThesis: (
    companyId: string,
    thesisId: string,
    data: Partial<CreateThesisInput & { status: "active" | "paused" | "archived" }>,
  ) =>
    api.patch<Thesis>(
      `/companies/${companyId}/deal-desk/theses/${thesisId}`,
      data,
    ),
  listThesisTargets: (companyId: string, thesisId: string) =>
    api.get<DdTarget[]>(
      `/companies/${companyId}/deal-desk/theses/${thesisId}/targets`,
    ),
  getTarget: (companyId: string, targetId: string) =>
    api.get<DdTarget>(`/companies/${companyId}/deal-desk/targets/${targetId}`),
  createTarget: (companyId: string, data: CreateTargetInput) =>
    api.post<DdTarget>(`/companies/${companyId}/deal-desk/targets`, data),
  updateTarget: (companyId: string, targetId: string, data: UpdateTargetInput) =>
    api.patch<DdTarget>(
      `/companies/${companyId}/deal-desk/targets/${targetId}`,
      data,
    ),
  getPipelineSummary: (companyId: string, thesisId: string) =>
    api.get<PipelineSummary>(
      `/companies/${companyId}/deal-desk/pipeline/summary?thesisId=${encodeURIComponent(thesisId)}`,
    ),
  listIntermediaries: (companyId: string) =>
    api.get<DdIntermediary[]>(`/companies/${companyId}/deal-desk/intermediaries`),
  updateTargetStatus: (
    companyId: string,
    targetId: string,
    status: DdTargetStatus,
  ) =>
    api.patch<DdTarget>(
      `/companies/${companyId}/deal-desk/targets/${targetId}/status`,
      { status },
    ),
};
