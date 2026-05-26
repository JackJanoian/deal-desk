// DEAL DESK: Fit score badge for pipeline and targets views.
import { Badge } from "@/components/ui/badge";
import { fitScoreClasses } from "./target-utils";

export function FitScoreBadge({ score }: { score: number | null }) {
  return (
    <Badge variant="outline" className={fitScoreClasses(score)}>
      {score ?? "—"}
    </Badge>
  );
}
