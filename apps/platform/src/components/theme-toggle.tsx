import { Moon, Sun } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useTheme } from "@/components/theme-provider";

// Theme is a set-once preference, so it lives in the account menu.
export function ThemeMenuItem() {
  const { theme, setTheme } = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <DropdownMenuItem onSelect={() => setTheme(next)}>
      {next === "dark" ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
      {next === "dark" ? "Dark mode" : "Light mode"}
    </DropdownMenuItem>
  );
}
