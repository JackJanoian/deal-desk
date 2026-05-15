// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

afterEach(cleanup);
import { GmailSetupWizard } from "./GmailSetupWizard";

describe("GmailSetupWizard", () => {
  it("renders the redirect URI prominently for the user to copy", () => {
    render(
      <GmailSetupWizard
        redirectUri="http://localhost:3000/api/oauth/gmail/callback"
        onSave={vi.fn()}
        saving={false}
      />,
    );
    expect(
      screen.getByText("http://localhost:3000/api/oauth/gmail/callback"),
    ).toBeInTheDocument();
  });

  it("renders inputs for Client ID and Client Secret", () => {
    render(<GmailSetupWizard redirectUri="x" onSave={vi.fn()} saving={false} />);
    expect(screen.getByLabelText(/client id/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/client secret/i)).toBeInTheDocument();
  });

  it("calls onSave with the entered credentials when Save is clicked", () => {
    const onSave = vi.fn();
    render(<GmailSetupWizard redirectUri="x" onSave={onSave} saving={false} />);
    fireEvent.change(screen.getByLabelText(/client id/i), {
      target: { value: "the-id" },
    });
    fireEvent.change(screen.getByLabelText(/client secret/i), {
      target: { value: "the-secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save credentials/i }));
    expect(onSave).toHaveBeenCalledWith({
      clientId: "the-id",
      clientSecret: "the-secret",
    });
  });

  it("disables the Save button while saving", () => {
    render(<GmailSetupWizard redirectUri="x" onSave={vi.fn()} saving={true} />);
    expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();
  });
});
