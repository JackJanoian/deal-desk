// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { EmailAccounts } from "./EmailAccounts";

afterEach(cleanup);

const defaultClientConfigProps = {
  clientConfigStatus: {
    configured: true,
    redirectUri: "http://localhost:3000/api/oauth/gmail/callback",
  },
  onSaveClientConfig: vi.fn(),
  savingClientConfig: false,
  onResetClientConfig: vi.fn(),
};

describe("EmailAccounts", () => {
  it("shows the connect button when no accounts are connected", () => {
    render(
      <EmailAccounts
        companyId="co-1"
        accounts={[]}
        onConnect={vi.fn()}
        onDisconnect={vi.fn()}
        {...defaultClientConfigProps}
      />,
    );
    expect(screen.getByRole("link", { name: /connect gmail/i })).toBeInTheDocument();
  });

  it("renders connected accounts with a disconnect button", () => {
    render(
      <EmailAccounts
        companyId="co-1"
        accounts={[{ id: "a-1", emailAddress: "alice@example.com", provider: "gmail", revokedAt: null }]}
        onConnect={vi.fn()}
        onDisconnect={vi.fn()}
        {...defaultClientConfigProps}
      />,
    );
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /disconnect/i })).toBeInTheDocument();
  });

  it("shows the setup wizard when the company has no OAuth client configured", () => {
    render(
      <EmailAccounts
        companyId="co-1"
        accounts={[]}
        onConnect={vi.fn()}
        onDisconnect={vi.fn()}
        clientConfigStatus={{
          configured: false,
          redirectUri: "http://localhost:3000/api/oauth/gmail/callback",
        }}
        onSaveClientConfig={vi.fn()}
        savingClientConfig={false}
        onResetClientConfig={vi.fn()}
      />,
    );
    expect(screen.getByText(/1\. Create a Google Cloud project/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /connect gmail/i })).not.toBeInTheDocument();
  });

  it("shows the Connect Gmail button when the company has OAuth client configured", () => {
    render(
      <EmailAccounts
        companyId="co-1"
        accounts={[]}
        onConnect={vi.fn()}
        onDisconnect={vi.fn()}
        {...defaultClientConfigProps}
      />,
    );
    expect(screen.getByRole("link", { name: /connect gmail/i })).toBeInTheDocument();
    expect(screen.queryByText(/1\. Create a Google Cloud project/i)).not.toBeInTheDocument();
  });
});
