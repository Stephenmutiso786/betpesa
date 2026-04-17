"use client";

import React, { useEffect, useMemo, useState } from "react";
import { authFetch, getApiBaseUrl, requireClientAuth } from "../../../lib/auth";

interface ClassItem {
  id: string;
  name: string;
  code: string;
  level?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ClassesResponse {
  ok: boolean;
  classes?: ClassItem[];
  class?: ClassItem;
  deletedId?: string;
  error?: string;
}

export default function AdminClassesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [items, setItems] = useState<ClassItem[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [level, setLevel] = useState("");
  const [search, setSearch] = useState("");
  const [filterLevel, setFilterLevel] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editLevel, setEditLevel] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const apiBase = useMemo(() => getApiBaseUrl(), []);

  async function loadClasses(filters?: { search?: string; level?: string }) {
    const params = new URLSearchParams();
    if (filters?.search && filters.search.trim().length > 0) {
      params.set("search", filters.search.trim());
    }
    if (filters?.level && filters.level.trim().length > 0) {
      params.set("level", filters.level.trim());
    }

    const query = params.toString();
    const response = await authFetch(`/api/classes${query ? `?${query}` : ""}`);
    const data = (await response.json()) as ClassesResponse;
    if (!response.ok || !data.ok || !data.classes) {
      throw new Error(data.error || "Unable to load classes");
    }
    setItems(data.classes);
  }

  useEffect(() => {
    const userFromGuard = requireClientAuth(["admin", "teacher"]);
    if (!userFromGuard) {
      return;
    }

    loadClasses()
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [apiBase]);

  async function createClass(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    try {
      const response = await authFetch("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, code, level: level || undefined })
      });
      const data = (await response.json()) as ClassesResponse;
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Failed to create class");
      }
      setName("");
      setCode("");
      setLevel("");
      setMessage("Class created.");
      await loadClasses({ search, level: filterLevel });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create class");
    }
  }

  async function applyFilters(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    try {
      await loadClasses({ search, level: filterLevel });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load classes");
    }
  }

  function startEditing(item: ClassItem) {
    setEditingId(item.id);
    setEditName(item.name);
    setEditCode(item.code);
    setEditLevel(item.level || "");
    setError(null);
    setMessage(null);
  }

  function cancelEditing() {
    setEditingId(null);
    setEditName("");
    setEditCode("");
    setEditLevel("");
  }

  async function saveClass(id: string) {
    setError(null);
    setMessage(null);
    setSavingId(id);

    try {
      const response = await authFetch(`/api/classes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          code: editCode,
          level: editLevel || undefined
        })
      });
      const data = (await response.json()) as ClassesResponse;
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Failed to update class");
      }

      setMessage("Class updated.");
      cancelEditing();
      await loadClasses({ search, level: filterLevel });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update class");
    } finally {
      setSavingId(null);
    }
  }

  async function deleteClass(id: string) {
    const confirmed = window.confirm("Delete this class? This cannot be undone.");
    if (!confirmed) {
      return;
    }

    setError(null);
    setMessage(null);
    setDeletingId(id);

    try {
      const response = await authFetch(`/api/classes/${id}`, { method: "DELETE" });
      const data = (await response.json()) as ClassesResponse;
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Failed to delete class");
      }

      if (editingId === id) {
        cancelEditing();
      }

      setMessage("Class deleted.");
      await loadClasses({ search, level: filterLevel });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete class");
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return React.createElement("main", { className: "p-8" }, "Loading classes...");
  }

  return React.createElement(
    "main",
    { className: "mx-auto min-h-screen max-w-6xl px-6 py-10" },
    React.createElement("h1", { className: "text-3xl font-bold text-brand-700" }, "Classes"),
    React.createElement("p", { className: "mt-2 text-sm text-stone-600" }, `API: ${apiBase}`),
    error ? React.createElement("p", { className: "mt-4 rounded bg-red-50 p-3 text-sm text-red-700" }, error) : null,
    message ? React.createElement("p", { className: "mt-4 rounded bg-emerald-50 p-3 text-sm text-emerald-700" }, message) : null,
    React.createElement(
      "form",
      { className: "mt-6 grid gap-3 rounded-xl border border-stone-200 bg-white p-5 md:grid-cols-4", onSubmit: createClass },
      React.createElement("input", { className: "rounded border border-stone-300 px-3 py-2", placeholder: "Class name", value: name, onChange: (e: any) => setName(e.target.value), required: true }),
      React.createElement("input", { className: "rounded border border-stone-300 px-3 py-2 uppercase", placeholder: "Code", value: code, onChange: (e: any) => setCode(e.target.value.toUpperCase()), required: true }),
      React.createElement("input", { className: "rounded border border-stone-300 px-3 py-2", placeholder: "Level (optional)", value: level, onChange: (e: any) => setLevel(e.target.value) }),
      React.createElement("button", { className: "rounded bg-brand-700 px-4 py-2 font-semibold text-white", type: "submit" }, "Add Class")
    ),
    React.createElement(
      "form",
      { className: "mt-4 grid gap-3 rounded-xl border border-stone-200 bg-white p-5 md:grid-cols-4", onSubmit: applyFilters },
      React.createElement("input", {
        className: "rounded border border-stone-300 px-3 py-2 md:col-span-2",
        placeholder: "Search by class name or code",
        value: search,
        onChange: (event: any) => setSearch(event.target.value)
      }),
      React.createElement("input", {
        className: "rounded border border-stone-300 px-3 py-2",
        placeholder: "Filter by level",
        value: filterLevel,
        onChange: (event: any) => setFilterLevel(event.target.value)
      }),
      React.createElement("button", { className: "rounded bg-stone-800 px-4 py-2 font-semibold text-white", type: "submit" }, "Apply Filters")
    ),
    React.createElement(
      "div",
      { className: "mt-6 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm" },
      React.createElement(
        "table",
        { className: "min-w-full divide-y divide-stone-200" },
        React.createElement(
          "thead",
          { className: "bg-stone-50" },
          React.createElement(
            "tr",
            null,
            React.createElement("th", { className: "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500" }, "Name"),
            React.createElement("th", { className: "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500" }, "Code"),
            React.createElement("th", { className: "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500" }, "Level"),
            React.createElement("th", { className: "px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-stone-500" }, "Actions")
          )
        ),
        React.createElement(
          "tbody",
          { className: "divide-y divide-stone-100" },
          items.length > 0
            ? items.map((item) =>
                React.createElement(
                  "tr",
                  { key: item.id },
                  React.createElement(
                    "td",
                    { className: "px-4 py-3 text-sm font-medium text-stone-800" },
                    editingId === item.id
                      ? React.createElement("input", {
                          className: "w-full rounded border border-stone-300 px-2 py-1",
                          value: editName,
                          onChange: (event: any) => setEditName(event.target.value)
                        })
                      : item.name
                  ),
                  React.createElement(
                    "td",
                    { className: "px-4 py-3 text-sm text-stone-600" },
                    editingId === item.id
                      ? React.createElement("input", {
                          className: "w-full rounded border border-stone-300 px-2 py-1 uppercase",
                          value: editCode,
                          onChange: (event: any) => setEditCode(event.target.value.toUpperCase())
                        })
                      : item.code
                  ),
                  React.createElement(
                    "td",
                    { className: "px-4 py-3 text-sm text-stone-600" },
                    editingId === item.id
                      ? React.createElement("input", {
                          className: "w-full rounded border border-stone-300 px-2 py-1",
                          value: editLevel,
                          onChange: (event: any) => setEditLevel(event.target.value)
                        })
                      : item.level || "-"
                  ),
                  React.createElement(
                    "td",
                    { className: "px-4 py-3 text-right" },
                    editingId === item.id
                      ? React.createElement(
                          "div",
                          { className: "flex justify-end gap-2" },
                          React.createElement(
                            "button",
                            {
                              className: "rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white",
                              type: "button",
                              disabled: savingId === item.id,
                              onClick: () => saveClass(item.id)
                            },
                            savingId === item.id ? "Saving..." : "Save"
                          ),
                          React.createElement(
                            "button",
                            {
                              className: "rounded bg-stone-300 px-3 py-1 text-xs font-semibold text-stone-800",
                              type: "button",
                              onClick: cancelEditing
                            },
                            "Cancel"
                          )
                        )
                      : React.createElement(
                          "div",
                          { className: "flex justify-end gap-2" },
                          React.createElement(
                            "button",
                            {
                              className: "rounded bg-blue-600 px-3 py-1 text-xs font-semibold text-white",
                              type: "button",
                              onClick: () => startEditing(item)
                            },
                            "Edit"
                          ),
                          React.createElement(
                            "button",
                            {
                              className: "rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white",
                              type: "button",
                              disabled: deletingId === item.id,
                              onClick: () => deleteClass(item.id)
                            },
                            deletingId === item.id ? "Deleting..." : "Delete"
                          )
                        )
                  )
                )
              )
            : React.createElement(
                "tr",
                null,
                React.createElement("td", { className: "px-4 py-8 text-center text-sm text-stone-500", colSpan: 4 }, "No classes found")
              )
        )
      )
    ),
    React.createElement("div", { className: "mt-6 flex gap-3" }, React.createElement("a", { href: "/dashboard", className: "rounded bg-stone-800 px-4 py-2 text-white" }, "Back to Dashboard"))
  );
}
