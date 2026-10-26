import type { ComponentProps, MouseEvent } from "react";
import { navigate } from "@/lib/navigation";

function isNavigationClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return (
    event.button === 0 &&
    !event.defaultPrevented &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.altKey &&
    !event.shiftKey &&
    !event.currentTarget.hasAttribute("download") &&
    ["", "_self"].includes(event.currentTarget.target)
  );
}

export function AppLink({ href, onClick, ...props }: ComponentProps<"a"> & { href: string }) {
  return (
    <a
      {...props}
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (!isNavigationClick(event)) return;
        event.preventDefault();
        navigate(href);
      }}
    />
  );
}
