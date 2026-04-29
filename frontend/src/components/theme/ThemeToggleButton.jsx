import React from "react";
import { Button, Tooltip } from "antd";
import { MoonFilled, SunFilled } from "@ant-design/icons";
import { useThemeStore, THEME_MODE } from "../../store/themeStore";
import { useAuthStore } from "../../store/authStore";
import * as authApi from "../../api/auth.api";

export default function ThemeToggleButton({ size = "middle", withTooltip = true }) {
  const { themeMode, resolvedTheme, applyThemeMode } = useThemeStore();
  const { user, setUser } = useAuthStore();
  const isDark = resolvedTheme === THEME_MODE.DARK;

  const handleToggle = async () => {
    const nextMode = isDark ? THEME_MODE.LIGHT : THEME_MODE.DARK;
    applyThemeMode(nextMode);
    if (!user) return;
    try {
      await authApi.updatePreferences({ themePreference: nextMode });
      setUser({ ...user, themePreference: nextMode });
    } catch (_) {}
  };

  const icon = (
    <span className={`theme-icon-wrap ${isDark ? "is-dark" : "is-light"}`}>
      <SunFilled className="theme-icon sun" />
      <MoonFilled className="theme-icon moon" />
    </span>
  );

  const button = (
    <Button
      type="text"
      size={size}
      className="theme-toggle-btn"
      onClick={handleToggle}
      aria-label={`Ubah tema ke ${isDark ? "light" : "dark"}`}
      icon={icon}
    />
  );

  if (!withTooltip) return button;
  return (
    <Tooltip title={`Mode saat ini: ${themeMode.toLowerCase()}`}>
      {button}
    </Tooltip>
  );
}
