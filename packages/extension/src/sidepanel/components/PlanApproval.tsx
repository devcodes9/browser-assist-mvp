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
    <div className="permission-gate">
      <div className="permission-overlay" />
      <div className="permission-modal plan-modal">
        <div className="permission-header">
          <h3>Plan Approval</h3>
          <p>{plan.summary}</p>
        </div>

        <div className="plan-steps">
          <p className="plan-label">I will do the following:</p>
          <ol className="plan-list">
            {plan.plan.map((step, index) => (
              <li key={index} className="plan-step">
                {step}
              </li>
            ))}
          </ol>
        </div>

        <div className="plan-note">
          Once approved, all these actions will execute automatically.
        </div>

        <div className="permission-actions">
          <button onClick={() => onReject()} className="deny-button">
            Cancel
          </button>
          <button onClick={onApprove} className="approve-button">
            Approve Plan
          </button>
        </div>
      </div>
    </div>
  );
}
