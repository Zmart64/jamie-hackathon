import { useSyncExternalStore } from "react";

const navigationEvent = "app:navigate";

function subscribe(callback: () => void) {
  window.addEventListener("popstate", callback);
  window.addEventListener(navigationEvent, callback);
  return () => {
    window.removeEventListener("popstate", callback);
    window.removeEventListener(navigationEvent, callback);
  };
}

export function usePathname(): string {
  return useSyncExternalStore(subscribe, () => window.location.pathname);
}

export function useSearch(): string {
  return useSyncExternalStore(subscribe, () => window.location.search);
}

export function navigate(path: string): void {
  if (`${window.location.pathname}${window.location.search}` === path) return;
  window.history.pushState(null, "", path);
  window.dispatchEvent(new Event(navigationEvent));
}
