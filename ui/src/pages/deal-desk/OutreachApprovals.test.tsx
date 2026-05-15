// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OutreachApprovals } from "./OutreachApprovals";

describe("OutreachApprovals", () => {
  it("renders pending sends with subject + body and approve/reject buttons", async () => {
    const onApprove = vi.fn();
    render(
      <OutreachApprovals
        sends={[{ id: "s-1", subject: "Hello", body: "Body text", status: "awaiting_approval" }]}
        onApprove={onApprove}
        onReject={vi.fn()}
      />,
    );
    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.getByText("Body text")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /approve & send/i }));
    expect(onApprove).toHaveBeenCalledWith("s-1");
  });

  it("shows an empty state when there are no pending sends", () => {
    render(<OutreachApprovals sends={[]} onApprove={vi.fn()} onReject={vi.fn()} />);
    expect(screen.getByText(/no outreach awaiting approval/i)).toBeInTheDocument();
  });
});
