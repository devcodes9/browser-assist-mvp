import { ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PendingPlan {
  planId: string;
  plan: string[];
  summary: string;
}

interface PlanApprovalProps {
  plan: PendingPlan;
  onApprove: () => void;
  onReject: (feedback?: string) => void;
}

export default function PlanApproval({
  plan,
  onApprove,
  onReject,
}: PlanApprovalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-foreground/40 backdrop-blur-[1px]"
        onClick={() => onReject()}
      />
      <div className="relative w-full max-w-sm animate-fade-in rounded-lg border border-border bg-card p-5 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
            <ListChecks className="size-4" />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold tracking-tight">
              Plan approval
            </h3>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {plan.summary}
            </p>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-md border border-border">
          <div className="bg-muted/60 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Steps
          </div>
          <ol className="flex flex-col">
            {plan.plan.map((step, index) => (
              <li
                key={index}
                className="flex gap-2.5 border-t border-border px-3 py-2.5 text-[13px] leading-relaxed text-foreground"
              >
                <span className="font-mono text-[11px] text-muted-foreground">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <p className="mt-3 text-[12px] italic text-muted-foreground">
          Once approved, all of these actions run automatically.
        </p>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => onReject()}>
            Cancel
          </Button>
          <Button onClick={onApprove}>Approve plan</Button>
        </div>
      </div>
    </div>
  );
}
