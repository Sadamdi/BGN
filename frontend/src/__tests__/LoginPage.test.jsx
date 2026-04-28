import "@testing-library/jest-dom";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ConfigProvider, App as AntApp } from "antd";

jest.mock("../api/axios", () => ({ default: { post: jest.fn(), get: jest.fn() } }));
jest.mock("../api/auth.api", () => ({
  login: jest.fn(),
  forgotPassword: jest.fn(),
}));
jest.mock("react-leaflet", () => ({}), { virtual: true });

import LoginPage from "../pages/LoginPage";
import * as authApi from "../api/auth.api";
import { useAuthStore } from "../store/authStore";

function renderLogin() {
  return render(
    <ConfigProvider>
      <AntApp>
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </AntApp>
    </ConfigProvider>
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    useAuthStore.getState().clearSession();
    authApi.login.mockReset();
    authApi.forgotPassword.mockReset();
  });

  test("menampilkan form login dengan field username & password", () => {
    renderLogin();
    expect(screen.getByText(/Masuk/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Masukkan username/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Masukkan password/i)).toBeInTheDocument();
  });

  test("validasi: submit kosong menampilkan error", async () => {
    renderLogin();
    const submit = screen.getByRole("button", { name: /Masuk/i });
    fireEvent.click(submit);
    await waitFor(() => {
      expect(authApi.login).not.toHaveBeenCalled();
    });
  });

  test("submit dengan kredensial valid memanggil API login", async () => {
    authApi.login.mockResolvedValue({
      data: {
        accessToken: "tok",
        refreshToken: "ref",
        user: { id: "u1", peran: "ADMIN", namaLengkap: "A" },
      },
      success: true,
    });
    renderLogin();
    fireEvent.change(screen.getByPlaceholderText(/Masukkan username/i), { target: { value: "admin" } });
    fireEvent.change(screen.getByPlaceholderText(/Masukkan password/i), { target: { value: "Admin@123!" } });
    fireEvent.click(screen.getByRole("button", { name: /Masuk/i }));
    await waitFor(() => {
      expect(authApi.login).toHaveBeenCalled();
    });
    expect(useAuthStore.getState().accessToken).toBe("tok");
  });

  test("error dari API ditampilkan ke user", async () => {
    authApi.login.mockRejectedValue({
      response: { data: { message: "Username atau password salah" } },
    });
    renderLogin();
    fireEvent.change(screen.getByPlaceholderText(/Masukkan username/i), { target: { value: "admin" } });
    fireEvent.change(screen.getByPlaceholderText(/Masukkan password/i), { target: { value: "salah" } });
    fireEvent.click(screen.getByRole("button", { name: /Masuk/i }));
    await waitFor(() => {
      expect(screen.getByText(/Username atau password salah/i)).toBeInTheDocument();
    });
  });
});
