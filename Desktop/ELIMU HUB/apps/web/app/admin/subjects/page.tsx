"use client";

import React, { useEffect, useMemo, useState } from "react";
import { authFetch, getApiBaseUrl, requireClientAuth } from "../../../lib/auth";

interface SubjectItem {
  id: string;
  name: string;
  code: string;
  createdAt: string;
  updatedAt: string;
}

interface SubjectsResponse {
  ok: boolean;
  subjects?: SubjectItem[];
  subject?: SubjectItem;
  deletedId?: string;
  error?: string;
}

export default function AdminSubjectsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [items, setItems] = useState<SubjectItem[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [search, setSearch] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const apiBase = useMemo(() => getApiBaseUrl(), []);

  async function loadSubjects(filters?: { search?: string }) {
    const params = new URLSearchParams();
    if (filters?.search && filters.search.trim().length > 0) {
      params.set("search", filters.search.trim());
    }

    const query = params.toString();
    const response = await authFetch(`/api/subjects${query ? `?${query}` : ""}`);
    const data = (await response.json()) as SubjectsResponse;
    if (!response.ok || !data.ok || !data.subjects) {
      throw new Error(data.error || "Unable to load subjects");
    }
    setItems(data.subjects);
  }

  useEffect(() => {
    const userFromGuard = requireClientAuth(["admin", "teacher"]);
    if (!userFromGuard) {
      return;
    }

    loadSubjects()
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [apiBase]);

  async function createSubject(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    try {
      const response = await authFetch("/api/subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, code: code.toUpperCase() })
      });
      const data = (await response.json()) as SubjectsResponse;
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Failed to create subject");
      }
      setName("");
      setCode("");
      setMessage("Subject created.");
      await loadSubjects({ search });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create subject");
    }
  }

  async function applyFilters(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    try {
      await loadSubjects({ search });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load subjects");
    }
  }

  function startEditing(item: SubjectItem) {
    setEditingId(item.id);
    setEditName(item.name);
    setEditCode(item.code);
    setError(null);
    setMessage(null);
  }

  function cancelEditing() {
    setEditingId(null);
    setEditName("");
    setEditCode("");
  }

  async function saveSubject(id: string) {
    setError(null);
    setMessage(null);
    setSavingId(id);

    try {
      const response = await authFetch(`/api/subjects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, code: editCode.toUpperCase() })
      });
      const data = (await response.json()) as SubjectsResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Failed to update subject");
      }

      setMessage("Subject updated.");
      cancelEditing();
      await loadSubjects({ search });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update subject");
    } finally {
      setSavingId(null);
    }
  }

  async function deleteSubject(id: string) {
    const confirmed = window.confirm("Delete this subject? This cannot be undone.");
    if (!confirmed) {
      return;
    }

    setError(null);
    setMessage(null);
    setDeletingId(id);

    try {
      const response = await authFetch(`/api/subjects/${id}`, { method: "DELETE" });
      const data = (await response.json()) as SubjectsResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Failed to delete subject");
      }

      if (editingId === id) {
        cancelEditing();
      }

      setMessage("Subject deleted.");
      await loadSubjects({ search });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete subject");
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return React.createElement("main", { className: "p-8" }, "Loading subjects...");
  }

  return React.createElement(
    "main",
    { className: "mx-auto min-h-screen max-w-6xl px-6 py-10" },
    React.createElement("h1", { className: "text-3xl font-bold text-brand-700" }, "Subjects"),
    React.createElement("p", { className: "mt-2 text-sm text-stone-600" }, `API: ${apiBase}`),
    error ? React.createElement("p", { className: "mt-4 rounded bg-red-50 p-3 text-sm text-red-700" }, error) : null,
    message ? React.createElement("p", { className: "mt-4 rounded bg-emerald-50 p-3 text-sm text-emerald-700" }, message) : null,
    React.createElement(
      "form",
      { className: "mt-6 grid gap-3 rounded-xl border border-stone-200 bg-white p-5 md:grid-cols-3", onSubmit: createSubject },
      React.createElement("input", { className: "rounded border border-stone-300 px-3 py-2", placeholder: "Subject name", value: name, onChange: (e: any) => setName(e.target.value), required: true }),
      React.createElement("input", { className: "rounded border border-stone-300 px-3 py-2 uppercase", placeholder: "Code", value: code, onChange: (e: any) => setCode(e.target.value.toUpperCase()), required: true }),
      React.createElement("button", { className: "rounded bg-brand-700 px-4 py-2 font-semibold text-white", type: "submit" }, "Add Subject")
    ),
    React.createElement(
      "form",
      { className: "mt-4 grid gap-3 rounded-xl border border-stone-200 bg-white p-5 md:grid-cols-3", onSubmit: applyFilters },
      React.createElement("input", {
        className: "rounded border border-stone-300 px-3 py-2 md:col-span-2",
        placeholder: "Search by subject name or code",
        value: search,
        onChange: (event: any) => setSearch(event.target.value)
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
                              onClick: () => saveSubject(item.id)
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
                              onClick: () => deleteSubject(item.id)
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
                React.createElement("td", { className: "px-4 py-8 text-center text-sm text-stone-500", colSpan: 3 }, "No subjects found")
              )
        )
      )
    ),
    React.createElement("div", { className: "mt-6 flex gap-3" }, React.createElement("a", { href: "/dashboard", className: "rounded bg-stone-800 px-4 py-2 text-white" }, "Back to Dashboard"))
  );
}
