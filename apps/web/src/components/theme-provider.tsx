import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark";
type ThemeState = { theme: Theme; setTheme: (theme: Theme) => void };
const ThemeContext = createContext<ThemeState>({ theme: "light", setTheme: () => {} });

function readTheme(): Theme {
  try {
    return localStorage.getItem("theme") === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

// Based on shadcn's Vite theme provider; storage is optional in private contexts.
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, updateTheme] = useState<Theme>(readTheme);
  useEffect(() => {
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(theme);
    document.documentElement.style.colorScheme = theme;
  }, [theme]);
  function setTheme(value: Theme) {
    updateTheme(value);
    try {
      localStorage.setItem("theme", value);
    } catch {
      // The theme still works for this session if storage is unavailable.
    }
  }
  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
