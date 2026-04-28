import { useAuthStore } from "../store/authStore";

describe("authStore", () => {
  beforeEach(() => useAuthStore.getState().clearSession());

  test("initial state", () => {
    const s = useAuthStore.getState();
    expect(s.user).toBeNull();
    expect(s.accessToken).toBeNull();
    expect(s.isAuthenticated).toBe(false);
  });

  test("setSession menetapkan user dan token", () => {
    useAuthStore.getState().setSession({
      user: { id: "1", peran: "ADMIN" },
      accessToken: "a",
      refreshToken: "r",
    });
    const s = useAuthStore.getState();
    expect(s.isAuthenticated).toBe(true);
    expect(s.accessToken).toBe("a");
    expect(s.user.peran).toBe("ADMIN");
  });

  test("hasRole memvalidasi peran", () => {
    useAuthStore.getState().setSession({
      user: { id: "1", peran: "OPERATOR_SPPG" },
      accessToken: "a",
      refreshToken: "r",
    });
    const { hasRole } = useAuthStore.getState();
    expect(hasRole("OPERATOR_SPPG")).toBe(true);
    expect(hasRole("ADMIN")).toBe(false);
    expect(hasRole("ADMIN", "OPERATOR_SPPG")).toBe(true);
  });

  test("clearSession reset state", () => {
    useAuthStore.getState().setSession({ user: { id: "1" }, accessToken: "a", refreshToken: "r" });
    useAuthStore.getState().clearSession();
    const s = useAuthStore.getState();
    expect(s.isAuthenticated).toBe(false);
    expect(s.user).toBeNull();
  });
});
