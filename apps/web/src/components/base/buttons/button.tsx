// Adapted from Untitled UI (MIT); see ../NOTICE.md. Only used variants are included.
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Button as AriaButton,
  type ButtonProps as AriaButtonProps,
} from "react-aria-components/Button";
import { cx } from "@/utils/cx";

const colors = {
  primary:
    "bg-brand-solid text-white shadow-xs ring-1 ring-transparent ring-inset hover:bg-brand-solid_hover",
  secondary:
    "bg-primary text-secondary shadow-xs ring-1 ring-primary ring-inset hover:bg-primary_hover hover:text-secondary_hover",
  tertiary: "text-tertiary hover:bg-primary_hover hover:text-tertiary_hover",
};

interface ButtonProps extends Omit<AriaButtonProps, "className" | "children"> {
  color?: keyof typeof colors;
  className?: string;
  children: ReactNode;
  iconLeading?: LucideIcon;
  iconTrailing?: LucideIcon;
}

export function Button({
  color = "primary",
  className,
  children,
  iconLeading: Leading,
  iconTrailing: Trailing,
  ...props
}: ButtonProps) {
  return (
    <AriaButton
      {...props}
      type={props.type ?? "button"}
      className={cx(
        "group relative inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold outline-brand transition duration-100 ease-linear focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        colors[color],
        className,
      )}
    >
      {Leading && <Leading aria-hidden="true" />}
      {children}
      {Trailing && <Trailing aria-hidden="true" />}
    </AriaButton>
  );
}
