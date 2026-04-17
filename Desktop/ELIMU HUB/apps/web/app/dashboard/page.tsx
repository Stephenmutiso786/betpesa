"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  authFetch,
  clearSession,
  getAccessExpiresAt,
  getApiBaseUrl,
  getRefreshToken,
  requireClientAuth,
  getStoredUser,
  type AuthUser
} from "../../lib/auth";

interface MeResponse {
  ok: boolean;
  user?: AuthUser;
  error?: string;
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(getStoredUser());
  const [accessExpiresAt, setAccessExpiresAt] = useState<string | null>(getAccessExpiresAt());
  const apiBase = useMemo(() => getApiBaseUrl(), []);

  useEffect(() => {
    const userFromGuard = requireClientAuth();
    if (!userFromGuard) {
      return;
    }

    authFetch("/api/auth/me")
      .then(async (response) => {
        const data = (await response.json()) as MeResponse;
        if (!response.ok || !data.ok || !data.user) {
          throw new Error(data.error || "Session invalid");
        }
        setUser(data.user);
        setAccessExpiresAt(getAccessExpiresAt());
      })
      .catch((err: Error) => {
        setError(err.message);
        clearSession();
      })
      .finally(() => {
        setLoading(false);
      });
  }, [apiBase]);

  async function signOut() {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      try {
        await fetch(`${apiBase}/api/auth/logout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken })
        });
      } catch {
        // Continue sign out locally even if API logout fails.
      }
    }
    clearSession();
    window.location.href = "/login";
  }

  if (loading) {
    return React.createElement("main", { className: "p-8" }, "Loading dashboard...");
  }

  if (error) {
    return React.createElement(
      "main",
      { className: "p-8" },
      React.createElement("p", { className: "text-red-700" }, `Session error: ${error}`),
      React.createElement(
        "button",
        { className: "mt-4 rounded bg-brand-700 px-4 py-2 text-white", onClick: () => (window.location.href = "/login") },
        "Go to Login"
      )
    );
  }

  return React.createElement(
    "main",
    { className: "mx-auto min-h-screen max-w-5xl px-6 py-10" },
    React.createElement("h1", { className: "text-3xl font-bold text-brand-700" }, "Dashboard"),
    React.createElement(
      "p",
      { className: "mt-2 text-stone-700" },
      `Welcome ${user?.fullName || "User"} (${user?.role || "unknown"})`
    ),
    React.createElement("p", { className: "mt-1 text-sm text-stone-500" }, `API: ${apiBase}`),
    React.createElement(
      "p",
      { className: "mt-1 text-xs text-stone-500" },
      `Access token expires: ${accessExpiresAt || "unknown"}`
    ),
    React.createElement(
      "section",
      { className: "mt-6 rounded-lg border border-stone-200 bg-white p-5" },
      React.createElement("h2", { className: "text-lg font-semibold" }, "Phase 5 Academic Ops Enabled"),
      React.createElement(
        "ul",
        { className: "mt-3 list-disc space-y-1 pl-5 text-sm text-stone-700" },
        React.createElement("li", null, "JWT login and token verification"),
        React.createElement("li", null, "Role-based route guards on API modules"),
        React.createElement("li", null, "Protected dashboard session check"),
        React.createElement("li", null, "Attendance, notifications, classes, and subjects lifecycle")
      )
    ),
    React.createElement(
      "section",
      { className: "mt-6 rounded-lg border border-stone-200 bg-white p-5" },
      React.createElement("h2", { className: "text-lg font-semibold" }, "Quick Links"),
      React.createElement(
        "div",
        { className: "mt-4 flex flex-wrap gap-3" },
        user?.role === "admin"
          ? React.createElement("a", { href: "/admin/users", className: "rounded bg-brand-700 px-4 py-2 text-white" }, "Users")
          : null,
        user?.role === "admin" || user?.role === "teacher"
          ? React.createElement("a", { href: "/admin/classes", className: "rounded border border-stone-300 bg-white px-4 py-2 text-stone-700" }, "Classes")
          : null,
        user?.role === "admin" || user?.role === "teacher"
          ? React.createElement("a", { href: "/admin/subjects", className: "rounded border border-stone-300 bg-white px-4 py-2 text-stone-700" }, "Subjects")
          : null,
        user?.role === "admin" || user?.role === "teacher"
          ? React.createElement("a", { href: "/admin/exams", className: "rounded border border-stone-300 bg-white px-4 py-2 text-stone-700" }, "Exams")
          : null,
        user?.role === "admin" || user?.role === "teacher"
          ? React.createElement("a", { href: "/teacher/marks-entry", className: "rounded border border-stone-300 bg-white px-4 py-2 text-stone-700" }, "Marks Entry")
          : null,
        user?.role === "admin" || user?.role === "teacher"
          ? React.createElement("a", { href: "/teacher/attendance", className: "rounded border border-stone-300 bg-white px-4 py-2 text-stone-700" }, "Attendance")
          : null,
        user?.role === "admin" || user?.role === "teacher"
          ? React.createElement("a", { href: "/dashboard/reports", className: "rounded border border-stone-300 bg-white px-4 py-2 text-stone-700" }, "Reports")
          : null,
        React.createElement("a", { href: "/dashboard/notifications", className: "rounded border border-stone-300 bg-white px-4 py-2 text-stone-700" }, "Notifications"),
        React.createElement("a", { href: "/dashboard/access-control", className: "rounded border border-stone-300 bg-white px-4 py-2 text-stone-700" }, "Access Control")
      )
    ),
    user?.role === "admin"
      ? React.createElement(
          "a",
          {
            href: "/admin/users",
            className: "mt-6 inline-flex rounded bg-brand-700 px-4 py-2 font-semibold text-white"
          },
          "Open Admin Users"
        )
      : null,
    React.createElement(
      "button",
      {
        className: "mt-6 rounded bg-stone-800 px-4 py-2 text-white",
        onClick: signOut
      },
      "Sign out"
    )
  );
}
