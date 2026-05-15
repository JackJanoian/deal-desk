// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { EmailAccounts } from "./EmailAccounts";

describe("EmailAccounts", () => {
  it("shows the connect button when no accounts are connected", () => {
    render(<EmailAccounts companyId="co-1" accounts={[]} onConnect={vi.fn()} onDisconnect={vi.fn()} />);
    expect(screen.getByRole("link", { name: /connect gmail/i })).toBeInTheDocument();
  });

  it("renders connected accounts with a disconnect button", () => {
    render(
      <EmailAccounts
        companyId="co-1"
        accounts={[{ id: "a-1", emailAddress: "alice@example.com", provider: "gmail", revokedAt: null }]}
        onConnect={vi.fn()}
        onDisconnect={vi.fn()}
      />,
    );
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /disconnect/i })).toBeInTheDocument();
  });
});
