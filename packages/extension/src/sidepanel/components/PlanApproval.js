import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
export default function PlanApproval({ plan, onApprove, onReject, }) {
    const [showFeedback, setShowFeedback] = useState(false);
    const [feedback, setFeedback] = useState('');
    const handleReject = () => {
        if (showFeedback && feedback.trim()) {
            onReject(feedback.trim());
        }
        else {
            onReject();
        }
    };
    return (_jsxs("div", { className: "permission-gate", children: [_jsx("div", { className: "permission-overlay" }), _jsxs("div", { className: "permission-modal plan-modal", children: [_jsxs("div", { className: "permission-header", children: [_jsx("h3", { children: "Plan Approval" }), _jsx("p", { children: plan.summary })] }), _jsxs("div", { className: "plan-steps", children: [_jsx("p", { className: "plan-label", children: "I will do the following:" }), _jsx("ol", { className: "plan-list", children: plan.plan.map((step, index) => (_jsx("li", { className: "plan-step", children: step }, index))) })] }), _jsx("div", { className: "plan-note", children: "Once approved, all these actions will execute automatically." }), showFeedback && (_jsx("div", { className: "plan-feedback", children: _jsx("textarea", { value: feedback, onChange: (e) => setFeedback(e.target.value), placeholder: "Tell the AI what to change...", className: "feedback-input", rows: 2, autoFocus: true }) })), _jsxs("div", { className: "permission-actions", children: [!showFeedback ? (_jsx("button", { onClick: () => setShowFeedback(true), className: "deny-button", children: "Modify" })) : (_jsx("button", { onClick: handleReject, className: "deny-button", children: "Send Feedback" })), _jsx("button", { onClick: onApprove, className: "approve-button", children: "Approve Plan" })] })] })] }));
}
