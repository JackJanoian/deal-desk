// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter } from "react-router-dom";
import { OutreachApprovalsPage } from "../OutreachApprovals";

vi.mock("../../../context/CompanyContext", () => ({
  useCompany: () => ({
    selectedCompanyId: "company-1",
    selectedCompany: { id: "company-1", issuePrefix: "PAP", name: "Paperclip" },
  }),
}));

const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (init?.method === "PATCH") {
      return { ok: true, status: 200, json: async () => ({ ok: true }) } as Response;
    }
    // Default GET for pending sends
    return {
      ok: true,
      status: 200,
      json: async () => ({
        sends: [
          {
            id: "send-1",
            subject: "Hello Alice",
            body: "Original body",
            contactEmail: "alice@acme.com",
            contactName: "Alice",
            status: "awaiting_approval" as const,
          },
        ],
      }),
    } as Response;
  });
});

describe("OutreachApprovals edit flow", () => {
  it("lets the user edit subject and body and PATCHes the server", async () => {
    render(
      <MemoryRouter>
        <OutreachApprovalsPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText(/Hello Alice/)).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /edit/i }));

    const subjectInput = screen.getByLabelText(/subject/i) as HTMLInputElement;
    const bodyInput = screen.getByLabelText(/body/i) as HTMLTextAreaElement;
    fireEvent.change(subjectInput, { target: { value: "Updated subject" } });
    fireEvent.change(bodyInput, { target: { value: "Updated body" } });

    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      const patchCall = fetchMock.mock.calls.find(
        ([, init]) => (init as RequestInit | undefined)?.method === "PATCH",
      );
      expect(patchCall).toBeTruthy();
      const body = JSON.parse((patchCall![1] as RequestInit).body as string);
      expect(body).toEqual({ subject: "Updated subject", body: "Updated body" });
    });
  });
});
