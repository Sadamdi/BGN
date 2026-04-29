import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export const THEME_MODE = {
  LIGHT: "LIGHT",
  DARK: "DARK",
  SYSTEM: "SYSTEM",
};

function detectSystemDark() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolveMode(mode) {
  if (mode === THEME_MODE.SYSTEM) {
    return detectSystemDark() ? THEME_MODE.DARK : THEME_MODE.LIGHT;
  }
  return mode === THEME_MODE.DARK ? THEME_MODE.DARK : THEME_MODE.LIGHT;
}

export const useThemeStore = create(
  persist(
    (set, get) => ({
      themeMode: THEME_MODE.SYSTEM,
      resolvedTheme: resolveMode(THEME_MODE.SYSTEM),

      applyThemeMode: (mode) => {
        const next = mode || THEME_MODE.SYSTEM;
        set({
          themeMode: next,
          resolvedTheme: resolveMode(next),
        });
      },

      syncSystemTheme: () => {
        const mode = get().themeMode;
        if (mode !== THEME_MODE.SYSTEM) return;
        set({ resolvedTheme: resolveMode(mode) });
      },
    }),
    {
      name: "sipgn-theme",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        themeMode: s.themeMode,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.resolvedTheme = resolveMode(state.themeMode || THEME_MODE.SYSTEM);
      },
    }
  )
);
