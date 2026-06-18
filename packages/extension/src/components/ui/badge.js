import { jsx as _jsx } from "react/jsx-runtime";
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';
const badgeVariants = cva('inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-medium leading-none transition-colors', {
    variants: {
        variant: {
            default: 'border-transparent bg-primary text-primary-foreground',
            secondary: 'border-transparent bg-secondary text-secondary-foreground',
            outline: 'border-border text-muted-foreground',
            success: 'border-transparent bg-success/10 text-success',
        },
    },
    defaultVariants: {
        variant: 'default',
    },
});
function Badge({ className, variant, ...props }) {
    return _jsx("span", { className: cn(badgeVariants({ variant }), className), ...props });
}
export { Badge, badgeVariants };
