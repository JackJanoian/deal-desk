import { X } from "lucide-react";
import { usePanel } from "../context/PanelContext";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

export function PropertiesPanel() {
  const { panelContent, panelVisible, setPanelVisible } = usePanel();

  if (!panelContent) return null;

  return (
    <aside
      className="hidden md:flex border-l border-border/75 bg-card/80 flex-col shrink-0 overflow-hidden shadow-[inset_1px_0_0_color-mix(in_oklab,var(--foreground)_4%,transparent)] transition-[width,opacity] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] h-full"
      style={{ width: panelVisible ? 320 : 0, opacity: panelVisible ? 1 : 0 }}
    >
      <div className="w-80 flex-1 flex flex-col min-w-[320px] min-h-0">
        <div className="flex items-center justify-between border-b border-border/70 bg-background/35 px-4 py-2">
          <span className="dd-kicker">Properties</span>
          <Button variant="ghost" size="icon-xs" onClick={() => setPanelVisible(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-4">{panelContent}</div>
        </ScrollArea>
      </div>
    </aside>
  );
}
