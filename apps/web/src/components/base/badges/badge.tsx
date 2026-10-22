// Adapted from Untitled UI (MIT); see ../NOTICE.md. Text badges only.
import type { ComponentProps } from "react";
import { cx } from "@/utils/cx";

const colors = {
  gray: "bg-utility-neutral-50 text-utility-neutral-700 ring-utility-neutral-200",
  error: "bg-utility-red-50 text-utility-red-700 ring-utility-red-200",
  success: "bg-utility-green-50 text-utility-green-700 ring-utility-green-200",
  warning: "bg-utility-yellow-50 text-utility-yellow-700 ring-utility-yellow-200",
};

interface BadgeProps extends ComponentProps<"span"> {
  color?: keyof typeof colors;
}

export function Badge({ color = "gray", className, ...props }: BadgeProps) {
  return (
    <span
      {...props}
      className={cx(
        "inline-flex w-fit items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        colors[color],
        className,
      )}
    />
  );
}
