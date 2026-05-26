// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import ApolloSetupSection from "../ApolloSetupSection";

const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});
afterEach(() => {
  cleanup();
});

describe("ApolloSetupSection", () => {
  it("renders input when not configured and saves on submit", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ configured: false, matchEnabled: null, searchEnabled: null, enrichmentEnabled: null }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          capabilities: {
            matchEnabled: true,
            searchEnabled: true,
            enrichmentEnabled: true,
            planLimited: false,
            masterKeyRequired: false,
            lastValidatedAt: "2026-01-01T00:00:00.000Z",
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          configured: true,
          matchEnabled: true,
          searchEnabled: true,
          enrichmentEnabled: true,
          planLimited: false,
          masterKeyRequired: false,
          lastValidatedAt: "2026-01-01T00:00:00.000Z",
        }),
      } as Response);

    render(<ApolloSetupSection companyId="c1" />);
    await waitFor(() => screen.getByLabelText(/apollo api key/i));

    fireEvent.change(screen.getByLabelText(/apollo api key/i), {
      target: { value: "my-apollo-key-123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find(
        ([, init]) => (init as RequestInit | undefined)?.method === "POST",
      );
      expect(postCall).toBeTruthy();
      expect(JSON.parse((postCall![1] as RequestInit).body as string)).toEqual({
        apiKey: "my-apollo-key-123",
      });
    });
    await waitFor(() =>
      expect(screen.getByText(/email enrichment enabled/i)).toBeInTheDocument(),
    );
  });

  it("shows Reset when configured and clears on click", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          configured: true,
          matchEnabled: true,
          searchEnabled: true,
          enrichmentEnabled: true,
          planLimited: false,
          masterKeyRequired: false,
          lastValidatedAt: "2026-01-01T00:00:00.000Z",
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ configured: false, matchEnabled: null, searchEnabled: null, enrichmentEnabled: null }),
      } as Response);

    render(<ApolloSetupSection companyId="c1" />);
    await waitFor(() => screen.getByText(/email enrichment enabled/i));

    fireEvent.click(screen.getByRole("button", { name: /reset/i }));

    await waitFor(() => {
      const delCall = fetchMock.mock.calls.find(
        ([, init]) => (init as RequestInit | undefined)?.method === "DELETE",
      );
      expect(delCall).toBeTruthy();
    });
    await waitFor(() => expect(screen.getByLabelText(/apollo api key/i)).toBeInTheDocument());
  });

  it("shows plan-limited badge when enrichment is blocked", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        configured: true,
        matchEnabled: false,
        searchEnabled: false,
        enrichmentEnabled: false,
        planLimited: true,
        masterKeyRequired: false,
        lastValidatedAt: "2026-01-01T00:00:00.000Z",
      }),
    } as Response);

    render(<ApolloSetupSection companyId="c1" />);
    await waitFor(() =>
      expect(screen.getByText(/plan doesn't support email reveal/i)).toBeInTheDocument(),
    );
  });

  it("shows free-tier enrichment when search + bulk path works", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        configured: true,
        matchEnabled: false,
        searchEnabled: true,
        enrichmentEnabled: true,
        planLimited: true,
        masterKeyRequired: false,
        lastValidatedAt: "2026-01-01T00:00:00.000Z",
      }),
    } as Response);

    render(<ApolloSetupSection companyId="c1" />);
    await waitFor(() =>
      expect(screen.getByText(/email enrichment enabled/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/free-tier path active/i)).toBeInTheDocument();
  });
});
