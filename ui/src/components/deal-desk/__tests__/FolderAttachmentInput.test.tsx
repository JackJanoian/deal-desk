// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FolderAttachmentInput,
  type ThesisAttachment,
} from "../FolderAttachmentInput";

function makeFile(name: string, body: string, type = "text/markdown"): File {
  return new File([body], name, { type });
}

describe("FolderAttachmentInput", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("accepts a .md file and surfaces it", async () => {
    const onChange = vi.fn();
    act(() => {
      root.render(<FolderAttachmentInput value={[]} onChange={onChange} />);
    });

    const input = container.querySelector<HTMLInputElement>(
      'input[type="file"][accept*="markdown"]',
    );
    expect(input).not.toBeNull();
    Object.defineProperty(input!, "files", {
      value: [makeFile("memo.md", "# hi")],
      configurable: true,
    });

    await act(async () => {
      input!.dispatchEvent(new Event("change", { bubbles: true }));
      // wait for file.text() promise + onChange
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(onChange).toHaveBeenCalled();
    const next = onChange.mock.calls.at(-1)![0] as ThesisAttachment[];
    expect(next[0]?.name).toBe("memo.md");
    expect(next[0]?.content).toBe("# hi");
  });

  it("rejects an unsupported extension", async () => {
    const onChange = vi.fn();
    act(() => {
      root.render(<FolderAttachmentInput value={[]} onChange={onChange} />);
    });

    const input = container.querySelector<HTMLInputElement>(
      'input[type="file"][accept*="markdown"]',
    );
    expect(input).not.toBeNull();
    Object.defineProperty(input!, "files", {
      value: [makeFile("x.exe", "MZ\x00", "application/octet-stream")],
      configurable: true,
    });

    await act(async () => {
      input!.dispatchEvent(new Event("change", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(onChange).toHaveBeenCalledWith([]);
    expect(container.textContent ?? "").toMatch(/unsupported type/i);
  });
});
