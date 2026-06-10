import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useAuthStore } from "@/store/auth.store";

const mockUser = {
  id: "user-123",
  email: "test@college.edu",
  name: "Test User",
  avatar_url: null,
  role: "PARTICIPANT",
  department: null,
  year: null,
  is_active: true,
};

describe("useAuthStore", () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
    localStorage.clear();
  });

  it("starts unauthenticated", () => {
    const { result } = renderHook(() => useAuthStore());
    expect(result.current.isAuthenticated()).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.accessToken).toBeNull();
  });

  it("setAuth stores user and tokens", () => {
    const { result } = renderHook(() => useAuthStore());
    act(() => {
      result.current.setAuth(mockUser, "access-abc", "refresh-xyz");
    });
    expect(result.current.user).toEqual(mockUser);
    expect(result.current.accessToken).toBe("access-abc");
    expect(result.current.refreshToken).toBe("refresh-xyz");
    expect(result.current.isAuthenticated()).toBe(true);
  });

  it("logout clears all state", () => {
    const { result } = renderHook(() => useAuthStore());
    act(() => {
      result.current.setAuth(mockUser, "access-abc", "refresh-xyz");
    });
    act(() => {
      result.current.logout();
    });
    expect(result.current.user).toBeNull();
    expect(result.current.accessToken).toBeNull();
    expect(result.current.refreshToken).toBeNull();
    expect(result.current.isAuthenticated()).toBe(false);
  });

  it("persists to localStorage on setAuth", () => {
    const { result } = renderHook(() => useAuthStore());
    act(() => {
      result.current.setAuth(mockUser, "access-abc", "refresh-xyz");
    });
    const stored = localStorage.getItem("ccops-auth");
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.state.accessToken).toBe("access-abc");
  });

  it("localStorage is cleared on logout", () => {
    const { result } = renderHook(() => useAuthStore());
    act(() => {
      result.current.setAuth(mockUser, "access-abc", "refresh-xyz");
    });
    act(() => {
      result.current.logout();
    });
    const stored = localStorage.getItem("ccops-auth");
    const parsed = JSON.parse(stored!);
    expect(parsed.state.accessToken).toBeNull();
  });
});
