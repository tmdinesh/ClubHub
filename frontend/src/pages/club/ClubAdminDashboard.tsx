import { useState, useRef } from "react";
import type React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  PlusCircle, CalendarDays, ChevronRight, AlertCircle,
  Clock, CheckCircle, Send, BarChart3, Loader2, AlertTriangle, X,
  Pencil, Trash2, FileDown,
} from "lucide-react";
import { toISO, previewIST, fmtDateTimeMedIST } from "@/lib/dateIST";
import Layout from "@/components/Layout";
import api, { apiError } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import type { Event } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ── Date-time picker ──────────────────────────────────────────────────────────

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 15, 30, 45];

function pad(n: number) { return String(n).padStart(2, "0"); }

interface DateTimePickerProps {
  label: string;
  value: string;        // "" | "YYYY-MM-DDTHH:MM"
  onChange: (v: string) => void;
  required?: boolean;
  error?: string;
}

function DateTimePicker({ label, value, onChange, required, error }: DateTimePickerProps) {
  // Internal state holds partial input separately from the committed value.
  // Initialised once at mount; parent resets via `key` prop.
  const [dd, setDd]     = useState(value ? value.slice(8, 10) : "");
  const [mm, setMm]     = useState(value ? value.slice(5, 7)  : "");
  const [yyyy, setYyyy] = useState(value ? value.slice(0, 4)  : "");
  const [hour, setHour] = useState(value ? Number(value.slice(11, 13)) : 9);
  const [minute, setMinute] = useState(value ? Number(value.slice(14, 16)) : 0);

  const mmRef   = useRef<HTMLInputElement>(null);
  const yyyyRef = useRef<HTMLInputElement>(null);

  function emit(d: string, mo: string, y: string, h: number, mi: number) {
    if (d && mo && y && y.length === 4) {
      onChange(`${y}-${mo.padStart(2,"0")}-${d.padStart(2,"0")}T${pad(h)}:${pad(mi)}`);
    } else {
      onChange("");
    }
  }

  function handleDd(raw: string) {
    const v = raw.replace(/\D/g, "").slice(0, 2);
    setDd(v);
    emit(v, mm, yyyy, hour, minute);
    if (v.length === 2) mmRef.current?.focus();
  }

  function handleMm(raw: string) {
    const v = raw.replace(/\D/g, "").slice(0, 2);
    setMm(v);
    emit(dd, v, yyyy, hour, minute);
    if (v.length === 2) yyyyRef.current?.focus();
  }

  function handleYyyy(raw: string) {
    const v = raw.replace(/\D/g, "").slice(0, 4);
    setYyyy(v);
    emit(dd, mm, v, hour, minute);
  }

  function handleHour(h: number) {
    setHour(h);
    emit(dd, mm, yyyy, h, minute);
  }

  function handleMinute(mi: number) {
    setMinute(mi);
    emit(dd, mm, yyyy, hour, mi);
  }

  function clear() {
    setDd(""); setMm(""); setYyyy(""); setHour(9); setMinute(0);
    onChange("");
  }

  const preview = value ? previewIST(value) : "";

  const inputStyle = (hasError: boolean): React.CSSProperties => ({
    textAlign: "center",
    padding: "8px 0",
    fontSize: "14px",
    borderRadius: "8px",
    background: "var(--ink-muted)",
    border: `1px solid ${hasError ? "var(--cinnabar)" : "var(--seam)"}`,
    color: "var(--cream)",
    outline: "none",
  });

  const selectStyle: React.CSSProperties = {
    padding: "8px 6px",
    fontSize: "14px",
    borderRadius: "8px",
    border: "1px solid var(--seam)",
    background: "var(--ink-muted)",
    color: "var(--cream)",
    colorScheme: "dark",
    outline: "none",
  };

  return (
    <div className="space-y-1.5">
      <Label>
        {label}{required && <span style={{ color: "var(--cinnabar)", marginLeft: "2px" }}>*</span>}
      </Label>

      <div className="flex items-center gap-1 flex-wrap">
        {/* DD */}
        <input
          type="text" inputMode="numeric" placeholder="DD" maxLength={2} value={dd}
          onChange={(e) => handleDd(e.target.value)}
          style={{ ...inputStyle(!!error), width: "40px" }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "var(--amber)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(245,166,35,0.12)"; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = error ? "var(--cinnabar)" : "var(--seam)"; e.currentTarget.style.boxShadow = "none"; }}
        />
        <span style={{ color: "var(--ash)", fontSize: "14px", fontWeight: 500 }}>/</span>
        {/* MM */}
        <input
          ref={mmRef}
          type="text" inputMode="numeric" placeholder="MM" maxLength={2} value={mm}
          onChange={(e) => handleMm(e.target.value)}
          style={{ ...inputStyle(!!error), width: "40px" }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "var(--amber)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(245,166,35,0.12)"; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = error ? "var(--cinnabar)" : "var(--seam)"; e.currentTarget.style.boxShadow = "none"; }}
        />
        <span style={{ color: "var(--ash)", fontSize: "14px", fontWeight: 500 }}>/</span>
        {/* YYYY */}
        <input
          ref={yyyyRef}
          type="text" inputMode="numeric" placeholder="YYYY" maxLength={4} value={yyyy}
          onChange={(e) => handleYyyy(e.target.value)}
          style={{ ...inputStyle(!!error), width: "64px" }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "var(--amber)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(245,166,35,0.12)"; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = error ? "var(--cinnabar)" : "var(--seam)"; e.currentTarget.style.boxShadow = "none"; }}
        />

        <span style={{ color: "var(--seam)", margin: "0 4px", fontSize: "14px" }}>·</span>

        {/* Hour */}
        <select
          value={hour} onChange={(e) => handleHour(Number(e.target.value))}
          style={{ ...selectStyle, width: "68px" }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "var(--amber)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(245,166,35,0.12)"; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "var(--seam)"; e.currentTarget.style.boxShadow = "none"; }}
        >
          {HOURS.map((h) => <option key={h} value={h}>{pad(h)}</option>)}
        </select>
        <span style={{ color: "var(--ash)", fontWeight: 700, fontSize: "14px" }}>:</span>
        {/* Minute */}
        <select
          value={minute} onChange={(e) => handleMinute(Number(e.target.value))}
          style={{ ...selectStyle, width: "60px" }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "var(--amber)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(245,166,35,0.12)"; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "var(--seam)"; e.currentTarget.style.boxShadow = "none"; }}
        >
          {MINUTES.map((mi) => <option key={mi} value={mi}>{pad(mi)}</option>)}
        </select>

        {value && (
          <button
            type="button"
            onClick={clear}
            style={{ marginLeft: "4px", color: "var(--ash)", background: "none", border: "none", cursor: "pointer", transition: "color 0.15s" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--fog)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ash)")}
            title="Clear"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {preview && !error && (
        <p style={{ fontSize: "12px", color: "var(--amber)", fontWeight: 500 }}>{preview}</p>
      )}
      {error && (
        <p style={{ fontSize: "12px", color: "var(--cinnabar)", display: "flex", alignItems: "center", gap: "4px" }}>
          <AlertCircle size={11} /> {error}
        </p>
      )}
    </div>
  );
}

/** Validate all date rules, return a map of field→error message */
function validateDates(f: CreateEventForm): Record<string, string> {
  const now = new Date();
  const errs: Record<string, string> = {};

  const start = f.start_datetime ? new Date(f.start_datetime) : null;
  const end   = f.end_datetime   ? new Date(f.end_datetime)   : null;
  const regS  = f.registration_start ? new Date(f.registration_start) : null;
  const regE  = f.registration_end   ? new Date(f.registration_end)   : null;

  if (!f.start_datetime) {
    errs.start_datetime = "Required.";
  } else if (start! <= now) {
    errs.start_datetime = "Must be in the future.";
  }

  if (end) {
    if (start && end <= start) {
      errs.end_datetime = "Must be after start date.";
    } else if (end <= now) {
      errs.end_datetime = "Must be in the future.";
    }
  }

  if (regS) {
    if (regS <= now) {
      errs.registration_start = "Must be in the future.";
    } else if (start && regS >= start) {
      errs.registration_start = "Must be before event start.";
    }
  }

  if (regE) {
    if (regE <= now) {
      errs.registration_end = "Must be in the future.";
    } else if (regS && regE <= regS) {
      errs.registration_end = "Must be after registration open date.";
    } else if (start && regE > start) {
      errs.registration_end = "Must be on or before event start.";
    }
  }

  return errs;
}

// ── Status styles ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, React.CSSProperties> = {
  DRAFT: {
    background: "color-mix(in srgb, var(--dust) 20%, transparent)",
    color: "var(--ash)",
    border: "1px solid color-mix(in srgb, var(--dust) 30%, transparent)",
  },
  PENDING_APPROVAL: {
    background: "color-mix(in srgb, var(--amber) 15%, transparent)",
    color: "var(--amber)",
    border: "1px solid color-mix(in srgb, var(--amber) 30%, transparent)",
  },
  PUBLISHED: {
    background: "color-mix(in srgb, var(--jade) 15%, transparent)",
    color: "var(--jade)",
    border: "1px solid color-mix(in srgb, var(--jade) 30%, transparent)",
  },
  COMPLETED: {
    background: "color-mix(in srgb, var(--sky) 15%, transparent)",
    color: "var(--sky)",
    border: "1px solid color-mix(in srgb, var(--sky) 30%, transparent)",
  },
  ARCHIVED: {
    background: "color-mix(in srgb, var(--dust) 20%, transparent)",
    color: "var(--dust)",
    border: "1px solid color-mix(in srgb, var(--dust) 20%, transparent)",
  },
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  DRAFT:            <Clock size={12} />,
  PENDING_APPROVAL: <Send size={12} />,
  PUBLISHED:        <CheckCircle size={12} />,
  COMPLETED:        <BarChart3 size={12} />,
};

// ── Form state ────────────────────────────────────────────────────────────────

interface CreateEventForm {
  title: string;
  description: string;
  venue: string;
  category: string;
  max_participants: string;
  start_datetime: string;
  end_datetime: string;
  registration_start: string;
  registration_end: string;
  is_team_event: boolean;
  team_min_size: string;
  team_max_size: string;
}

const EMPTY_FORM: CreateEventForm = {
  title: "", description: "", venue: "", category: "",
  max_participants: "", start_datetime: "", end_datetime: "",
  registration_start: "", registration_end: "",
  is_team_event: false, team_min_size: "2", team_max_size: "5",
};

// ── Report modal ─────────────────────────────────────────────────────────────

function ReportModal({ onClose }: { onClose: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const yearStart = `${new Date().getFullYear()}-01-01`;
  const [startDate, setStartDate] = useState(yearStart);
  const [endDate, setEndDate] = useState(today);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleDownload() {
    if (!startDate || !endDate) { setError("Please select both dates."); return; }
    if (startDate > endDate) { setError("Start date must be before end date."); return; }
    setError("");
    setLoading(true);
    try {
      const res = await api.get("/events/report/download", {
        params: { start_date: startDate, end_date: endDate },
        responseType: "blob",
      });
      const url = URL.createObjectURL(new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `Club_Report_${startDate}_${endDate}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onClose();
    } catch (e: unknown) {
      setError(apiError(e, "Failed to generate report."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm" style={{ background: "rgba(0,0,0,0.7)" }}>
      <div className="rounded-2xl shadow-2xl w-full max-w-sm mx-4" style={{ background: "var(--ink-soft)", border: "1px solid var(--seam)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--seam)" }}>
          <div className="flex items-center gap-2">
            <FileDown size={18} style={{ color: "var(--amber)" }} />
            <h2 className="text-base font-bold" style={{ color: "var(--cream)" }}>Generate Club Report</h2>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded transition-colors" style={{ color: "var(--ash)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--cream)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ash)")}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm" style={{ color: "var(--fog)" }}>
            Download a Word document summarising all events in the selected period, including registration, attendance, and finance data.
          </p>
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--dust)" }}>From</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full text-sm px-3 py-2 rounded-lg"
              style={{ background: "var(--ink-muted)", border: "1px solid var(--seam)", color: "var(--cream)" }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--amber)"; e.currentTarget.style.outline = "none"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "var(--seam)"; }}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--dust)" }}>To</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full text-sm px-3 py-2 rounded-lg"
              style={{ background: "var(--ink-muted)", border: "1px solid var(--seam)", color: "var(--cream)" }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--amber)"; e.currentTarget.style.outline = "none"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "var(--seam)"; }}
            />
          </div>
          {error && (
            <div className="flex items-center gap-2 text-sm" style={{ color: "var(--cinnabar)" }}>
              <AlertCircle size={14} />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4" style={{ borderTop: "1px solid var(--seam)" }}>
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
            style={{ color: "var(--ash)", border: "1px solid var(--seam)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--ink-muted)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
            Cancel
          </button>
          <button type="button" onClick={handleDownload} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors"
            style={{ background: "var(--amber)", color: "var(--ink)" }}
            onMouseEnter={(e) => !loading && (e.currentTarget.style.background = "var(--amber-glow)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "var(--amber)")}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
            {loading ? "Generating…" : "Download .docx"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function ClubAdminDashboard() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [showCreate, setShowCreate] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [form, setForm] = useState<CreateEventForm>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [submitErrors, setSubmitErrors] = useState<Record<string, string>>({});
  // Incrementing this key forces DateTimePickers to remount (clearing their internal state)
  const [pickerKey, setPickerKey] = useState(0);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<CreateEventForm>>({});
  const [editPickerKey, setEditPickerKey] = useState(0);
  const [cancelConfirm, setCancelConfirm] = useState<string | null>(null);

  const clubId = user?.club_id ?? null;

  const { data: events, isLoading, error } = useQuery<Event[]>({
    queryKey: ["events", "club", clubId],
    queryFn: () =>
      api.get("/events", { params: { club_id: clubId, limit: 100 } }).then((r) => r.data),
    enabled: !!clubId,
  });

  const createMutation = useMutation({
    mutationFn: (payload: object) => api.post("/events", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events", "club", clubId] });
      setShowCreate(false);
      setForm(EMPTY_FORM);
      setFieldErrors({});
      setFormError("");
      setPickerKey((k) => k + 1);   // remount pickers so they're blank
    },
    onError: (err: unknown) => {
      setFormError(apiError(err, "Failed to create event."));
    },
  });

  const submitMutation = useMutation({
    mutationFn: (eventId: string) =>
      api.patch(`/events/${eventId}/submit-for-review`, {}),
    onSuccess: (_data, eventId) => {
      qc.invalidateQueries({ queryKey: ["events", "club", clubId] });
      setSubmitErrors((prev) => { const n = { ...prev }; delete n[eventId]; return n; });
    },
    onError: (err: unknown, eventId) => {
      setSubmitErrors((prev) => ({
        ...prev,
        [eventId]: apiError(err, "Submit failed. Ensure a faculty advisor is assigned to your club."),
      }));
    },
  });

  const editMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: object }) =>
      api.patch(`/events/${id}`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events", "club", clubId] });
      setEditingEventId(null);
      setEditForm({});
      setEditPickerKey((k) => k + 1);
    },
    onError: (err: unknown) => {
      setSubmitErrors((prev) => ({ ...prev, _edit: apiError(err, "Failed to save changes.") }));
    },
  });

  const cancelEventMutation = useMutation({
    mutationFn: (id: string) => api.post(`/events/${id}/cancel`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events", "club", clubId] });
      setCancelConfirm(null);
    },
    onError: (err: unknown) => {
      setSubmitErrors((prev) => ({ ...prev, _cancel: apiError(err, "Failed to cancel event.") }));
    },
  });

  function startEdit(event: Event) {
    setEditingEventId(event.id);
    // Pre-fill form from current event values (strip TZ offset for picker)
    const strip = (iso: string | null) =>
      iso ? iso.slice(0, 16).replace("+05:30", "").replace("Z", "").replace(/\+\d\d:\d\d$/, "") : "";
    setEditForm({
      title: event.title,
      description: event.description ?? "",
      venue: event.venue ?? "",
      category: event.category ?? "",
      max_participants: event.max_participants ? String(event.max_participants) : "",
      start_datetime: strip(event.start_datetime),
      end_datetime: strip(event.end_datetime),
      registration_start: strip(event.registration_start),
      registration_end: strip(event.registration_end),
    });
    setEditPickerKey((k) => k + 1);
  }

  function saveEdit(eventId: string) {
    const payload: Record<string, unknown> = {};
    if (editForm.title) payload.title = editForm.title;
    if (editForm.description !== undefined) payload.description = editForm.description || null;
    if (editForm.venue !== undefined) payload.venue = editForm.venue || null;
    if (editForm.category !== undefined) payload.category = editForm.category || null;
    if (editForm.max_participants !== undefined)
      payload.max_participants = editForm.max_participants ? parseInt(editForm.max_participants) : null;
    if (editForm.start_datetime) payload.start_datetime = toISO(editForm.start_datetime);
    if (editForm.end_datetime !== undefined) payload.end_datetime = toISO(editForm.end_datetime ?? "");
    if (editForm.registration_start !== undefined) payload.registration_start = toISO(editForm.registration_start ?? "");
    if (editForm.registration_end !== undefined) payload.registration_end = toISO(editForm.registration_end ?? "");
    editMutation.mutate({ id: eventId, payload });
  }

  function field(key: keyof CreateEventForm, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    // Clear the field error as the user edits
    if (fieldErrors[key]) setFieldErrors((e) => { const n = { ...e }; delete n[key]; return n; });
  }

  function handleCreate(e?: React.MouseEvent) {
    e?.preventDefault();
    if (!form.title.trim()) {
      setFormError("Title is required.");
      return;
    }
    const dateErrs = validateDates(form);
    if (Object.keys(dateErrs).length > 0) {
      setFieldErrors(dateErrs);
      setFormError("Please fix the date errors below.");
      return;
    }
    setFieldErrors({});
    setFormError("");
    createMutation.mutate({
      title: form.title,
      description: form.description || null,
      venue: form.venue || null,
      category: form.category || null,
      max_participants: form.max_participants ? parseInt(form.max_participants) : null,
      start_datetime: toISO(form.start_datetime),
      end_datetime: toISO(form.end_datetime),
      registration_start: toISO(form.registration_start),
      registration_end: toISO(form.registration_end),
      event_type: "INTERNAL",
      is_team_event: form.is_team_event,
      team_min_size: form.is_team_event ? parseInt(form.team_min_size) || 2 : 2,
      team_max_size: form.is_team_event ? parseInt(form.team_max_size) || 5 : 5,
    });
  }

  function handleCancelCreate() {
    setShowCreate(false);
    setForm(EMPTY_FORM);
    setFieldErrors({});
    setFormError("");
    setPickerKey((k) => k + 1);
  }

  const counts = {
    DRAFT:            events?.filter((e) => e.status === "DRAFT").length ?? 0,
    PENDING_APPROVAL: events?.filter((e) => e.status === "PENDING_APPROVAL").length ?? 0,
    PUBLISHED:        events?.filter((e) => e.status === "PUBLISHED").length ?? 0,
    COMPLETED:        events?.filter((e) => e.status === "COMPLETED").length ?? 0,
  };

  if (!clubId) {
    return (
      <Layout>
        <div className="p-8 max-w-2xl mx-auto">
          <div style={{
            background: "color-mix(in srgb, var(--amber) 10%, transparent)",
            border: "1px solid color-mix(in srgb, var(--amber) 30%, transparent)",
            borderRadius: "12px",
            padding: "24px",
            display: "flex",
            alignItems: "flex-start",
            gap: "12px",
          }}>
            <AlertTriangle size={20} style={{ color: "var(--amber)", flexShrink: 0, marginTop: "2px" }} />
            <div>
              <p style={{ fontWeight: 600, color: "var(--amber)" }}>No club assigned</p>
              <p style={{ fontSize: "14px", color: "var(--amber)", marginTop: "4px", opacity: 0.85 }}>
                Your account is not mapped to a club yet. Contact a Super Admin to assign you to your club.
              </p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <>
    <Layout>
      <div className="p-8 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--dust)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "4px" }}>Club Admin</p>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--cream)", letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: "8px" }}>
              <CalendarDays size={22} style={{ color: "var(--amber)" }} />
              My Events
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowReport(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
              style={{ background: "var(--ink-soft)", border: "1px solid var(--seam)", color: "var(--fog)" }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--cream)"; e.currentTarget.style.borderColor = "var(--amber)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--fog)"; e.currentTarget.style.borderColor = "var(--seam)"; }}
            >
              <FileDown size={15} />
              Generate Report
            </button>
            <Button type="button" onClick={() => setShowCreate((v) => !v)} className="gap-2">
              <PlusCircle size={16} />
              New Event
            </Button>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {(["DRAFT", "PENDING_APPROVAL", "PUBLISHED", "COMPLETED"] as const).map((s) => (
            <div key={s} style={{
              background: "var(--ink-soft)",
              borderRadius: "12px",
              border: "1px solid var(--seam)",
              padding: "16px",
            }}>
              <p style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--cream)" }}>{counts[s]}</p>
              <p style={{ fontSize: "12px", color: "var(--fog)", marginTop: "2px", textTransform: "capitalize" }}>{s.replace(/_/g, " ").toLowerCase()}</p>
            </div>
          ))}
        </div>

        {/* Create form */}
        {showCreate && (
          <div style={{
            background: "var(--ink-soft)",
            borderRadius: "16px",
            border: "1px solid var(--seam)",
            padding: "24px",
            marginBottom: "24px",
          }}>
            <h2 style={{ fontSize: "15px", fontWeight: 700, color: "var(--cream)", marginBottom: "20px" }}>Create New Event</h2>

            <div className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="title">Title <span style={{ color: "var(--cinnabar)" }}>*</span></Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => field("title", e.target.value)}
                  placeholder="Event title"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="desc">Description</Label>
                <textarea
                  id="desc"
                  value={form.description}
                  onChange={(e) => field("description", e.target.value)}
                  placeholder="Short description of the event"
                  rows={2}
                  style={{
                    width: "100%",
                    fontSize: "14px",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    background: "var(--ink-muted)",
                    border: "1px solid var(--seam)",
                    color: "var(--cream)",
                    outline: "none",
                    resize: "none",
                    boxSizing: "border-box",
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "var(--amber)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(245,166,35,0.12)"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "var(--seam)"; e.currentTarget.style.boxShadow = "none"; }}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="venue">Venue</Label>
                  <Input id="venue" value={form.venue} onChange={(e) => field("venue", e.target.value)} placeholder="e.g. Main Auditorium" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="category">Category</Label>
                  <Input id="category" value={form.category} onChange={(e) => field("category", e.target.value)} placeholder="e.g. Hackathon, Workshop, Talk" />
                </div>
              </div>

              <div className="sm:w-1/2 space-y-1.5">
                <Label htmlFor="max">Max Participants</Label>
                <Input
                  id="max" type="number" min={1}
                  value={form.max_participants}
                  onChange={(e) => field("max_participants", e.target.value)}
                  placeholder="Leave blank for unlimited"
                />
              </div>

              {/* Team event toggle */}
              <div style={{ borderTop: "1px solid var(--seam)", paddingTop: "16px" }}>
                <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--dust)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "16px" }}>Team Settings</p>
                <label className="flex items-center gap-3 cursor-pointer select-none mb-4">
                  <div
                    style={{
                      width: "40px",
                      height: "20px",
                      borderRadius: "999px",
                      background: form.is_team_event ? "var(--amber)" : "var(--seam)",
                      position: "relative",
                      transition: "background 0.2s",
                      cursor: "pointer",
                    }}
                    onClick={() => setForm((f) => ({ ...f, is_team_event: !f.is_team_event }))}
                  >
                    <span
                      style={{
                        position: "absolute",
                        top: "2px",
                        left: "2px",
                        width: "16px",
                        height: "16px",
                        borderRadius: "50%",
                        background: "white",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                        transition: "transform 0.2s",
                        transform: form.is_team_event ? "translateX(20px)" : "translateX(0)",
                      }}
                    />
                  </div>
                  <div>
                    <p style={{ fontSize: "14px", fontWeight: 500, color: "var(--cream)" }}>Team Event</p>
                    <p style={{ fontSize: "12px", color: "var(--ash)" }}>Participants register as teams instead of individuals</p>
                  </div>
                </label>

                {form.is_team_event && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="team_min">Min Team Size <span style={{ color: "var(--cinnabar)" }}>*</span></Label>
                      <Input
                        id="team_min" type="number" min={2}
                        value={form.team_min_size}
                        onChange={(e) => field("team_min_size", e.target.value)}
                        placeholder="2"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="team_max">Max Team Size <span style={{ color: "var(--cinnabar)" }}>*</span></Label>
                      <Input
                        id="team_max" type="number" min={2}
                        value={form.team_max_size}
                        onChange={(e) => field("team_max_size", e.target.value)}
                        placeholder="5"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div style={{ borderTop: "1px solid var(--seam)", paddingTop: "16px" }}>
                <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--dust)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "16px" }}>Schedule</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <DateTimePicker
                    key={`start-${pickerKey}`}
                    label="Start Date & Time"
                    value={form.start_datetime}
                    onChange={(v) => field("start_datetime", v)}
                    required
                    error={fieldErrors.start_datetime}
                  />
                  <DateTimePicker
                    key={`end-${pickerKey}`}
                    label="End Date & Time"
                    value={form.end_datetime}
                    onChange={(v) => field("end_datetime", v)}
                    error={fieldErrors.end_datetime}
                  />
                  <DateTimePicker
                    key={`reg_start-${pickerKey}`}
                    label="Registration Opens"
                    value={form.registration_start}
                    onChange={(v) => field("registration_start", v)}
                    error={fieldErrors.registration_start}
                  />
                  <DateTimePicker
                    key={`reg_end-${pickerKey}`}
                    label="Registration Closes"
                    value={form.registration_end}
                    onChange={(v) => field("registration_end", v)}
                    error={fieldErrors.registration_end}
                  />
                </div>
              </div>
            </div>

            {formError && (
              <p style={{ fontSize: "14px", color: "var(--cinnabar)", marginTop: "16px", display: "flex", alignItems: "center", gap: "6px" }}>
                <AlertCircle size={14} /> {formError}
              </p>
            )}

            <div className="flex justify-end gap-2 mt-5">
              <Button type="button" variant="outline" onClick={handleCancelCreate}>Cancel</Button>
              <Button type="button" onClick={(e) => handleCreate(e)} disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Event
              </Button>
            </div>
          </div>
        )}

        {/* Event list */}
        {error ? (
          <div style={{
            background: "color-mix(in srgb, var(--cinnabar) 10%, transparent)",
            border: "1px solid color-mix(in srgb, var(--cinnabar) 30%, transparent)",
            borderRadius: "12px",
            padding: "24px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}>
            <AlertCircle size={18} style={{ color: "var(--cinnabar)", flexShrink: 0 }} />
            <p style={{ fontSize: "14px", color: "var(--cinnabar)" }}>Failed to load events.</p>
          </div>
        ) : isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ background: "var(--ink-soft)", borderRadius: "12px", border: "1px solid var(--seam)", padding: "20px", height: "80px" }} className="animate-pulse" />
            ))}
          </div>
        ) : !events?.length ? (
          <div style={{
            background: "var(--ink-soft)",
            borderRadius: "12px",
            border: "1px solid var(--seam)",
            padding: "64px 24px",
            textAlign: "center",
          }}>
            <CalendarDays size={32} style={{ color: "var(--dust)", margin: "0 auto 12px" }} />
            <p style={{ color: "var(--fog)", fontWeight: 500 }}>No events yet</p>
            <p style={{ fontSize: "13px", color: "var(--ash)", marginTop: "4px" }}>Click "New Event" to create your first one.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {events.map((event) => (
              <div key={event.id} style={{
                background: "var(--ink-soft)",
                borderRadius: "12px",
                border: "1px solid var(--seam)",
                padding: "16px",
                transition: "border-color 0.15s",
              }}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--cream)" }} className="truncate">{event.title}</p>
                      <span style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        fontSize: "11px",
                        fontWeight: 600,
                        padding: "2px 8px",
                        borderRadius: "999px",
                        ...(STATUS_STYLES[event.status] ?? {}),
                      }}>
                        {STATUS_ICON[event.status]}
                        {event.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    <p style={{ fontSize: "12px", color: "var(--ash)", marginTop: "2px" }}>
                      {event.start_datetime
                        ? fmtDateTimeMedIST(event.start_datetime)
                        : "No date set"}
                      {event.venue ? ` · ${event.venue}` : ""}
                    </p>
                    {submitErrors[event.id] && (
                      <p style={{ fontSize: "12px", color: "var(--cinnabar)", marginTop: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
                        <AlertTriangle size={11} /> {submitErrors[event.id]}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {event.status === "DRAFT" && (
                      <button
                        type="button"
                        onClick={() => submitMutation.mutate(event.id)}
                        disabled={submitMutation.isPending && submitMutation.variables === event.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "6px 12px",
                          background: "color-mix(in srgb, var(--amber) 15%, transparent)",
                          color: "var(--amber)",
                          border: "1px solid color-mix(in srgb, var(--amber) 30%, transparent)",
                          borderRadius: "8px",
                          fontSize: "12px",
                          fontWeight: 600,
                          cursor: "pointer",
                          transition: "background 0.15s",
                          opacity: (submitMutation.isPending && submitMutation.variables === event.id) ? 0.5 : 1,
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "color-mix(in srgb, var(--amber) 22%, transparent)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "color-mix(in srgb, var(--amber) 15%, transparent)")}
                      >
                        {submitMutation.isPending && submitMutation.variables === event.id
                          ? <Loader2 size={12} className="animate-spin" />
                          : <Send size={12} />}
                        Submit for Review
                      </button>
                    )}
                    {(event.status === "DRAFT" || event.status === "PUBLISHED") && (
                      <button
                        type="button"
                        onClick={() => editingEventId === event.id ? setEditingEventId(null) : startEdit(event)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          padding: "6px 12px",
                          background: "transparent",
                          color: "var(--ash)",
                          border: "1px solid var(--seam)",
                          borderRadius: "8px",
                          fontSize: "12px",
                          fontWeight: 600,
                          cursor: "pointer",
                          transition: "background 0.15s",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--ink-muted)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <Pencil size={12} />
                        Edit
                      </button>
                    )}
                    {event.status !== "ARCHIVED" && (
                      <button
                        type="button"
                        onClick={() => setCancelConfirm(event.id)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          padding: "6px 12px",
                          background: "color-mix(in srgb, var(--cinnabar) 10%, transparent)",
                          color: "var(--cinnabar)",
                          border: "1px solid color-mix(in srgb, var(--cinnabar) 30%, transparent)",
                          borderRadius: "8px",
                          fontSize: "12px",
                          fontWeight: 600,
                          cursor: "pointer",
                          transition: "background 0.15s",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "color-mix(in srgb, var(--cinnabar) 18%, transparent)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "color-mix(in srgb, var(--cinnabar) 10%, transparent)")}
                      >
                        <Trash2 size={12} />
                        Cancel
                      </button>
                    )}
                    <Link
                      to={`/manage/${event.id}/overview`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        padding: "6px 12px",
                        background: "var(--amber)",
                        color: "var(--ink)",
                        borderRadius: "8px",
                        fontSize: "12px",
                        fontWeight: 600,
                        textDecoration: "none",
                        boxShadow: "0 0 18px rgba(245,166,35,0.35)",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--amber-glow)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "var(--amber)")}
                    >
                      Manage <ChevronRight size={12} />
                    </Link>
                  </div>
                </div>

                {/* Inline edit panel */}
                {editingEventId === event.id && (
                  <div style={{ marginTop: "16px", borderTop: "1px solid var(--seam)", paddingTop: "16px" }}>
                    <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--dust)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px" }}>Edit Event</p>
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="sm:col-span-2">
                          <Label>Title</Label>
                          <Input value={editForm.title ?? ""}
                            onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} />
                        </div>
                        <div>
                          <Label>Venue</Label>
                          <Input value={editForm.venue ?? ""}
                            onChange={(e) => setEditForm((f) => ({ ...f, venue: e.target.value }))}
                            placeholder="e.g. Main Auditorium" />
                        </div>
                        <div>
                          <Label>Category</Label>
                          <Input value={editForm.category ?? ""}
                            onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))} />
                        </div>
                        <div>
                          <Label>Max Participants</Label>
                          <Input type="number" min={1} value={editForm.max_participants ?? ""}
                            onChange={(e) => setEditForm((f) => ({ ...f, max_participants: e.target.value }))} />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                        <DateTimePicker key={`es-${editPickerKey}-${event.id}`} label="Start Date & Time"
                          value={editForm.start_datetime ?? ""}
                          onChange={(v) => setEditForm((f) => ({ ...f, start_datetime: v }))} />
                        <DateTimePicker key={`ee-${editPickerKey}-${event.id}`} label="End Date & Time"
                          value={editForm.end_datetime ?? ""}
                          onChange={(v) => setEditForm((f) => ({ ...f, end_datetime: v }))} />
                        <DateTimePicker key={`ers-${editPickerKey}-${event.id}`} label="Registration Opens"
                          value={editForm.registration_start ?? ""}
                          onChange={(v) => setEditForm((f) => ({ ...f, registration_start: v }))} />
                        <DateTimePicker key={`ere-${editPickerKey}-${event.id}`} label="Registration Closes"
                          value={editForm.registration_end ?? ""}
                          onChange={(v) => setEditForm((f) => ({ ...f, registration_end: v }))} />
                      </div>
                      {event.status === "PUBLISHED" && (
                        <p style={{
                          fontSize: "12px",
                          color: "var(--amber)",
                          background: "color-mix(in srgb, var(--amber) 10%, transparent)",
                          border: "1px solid color-mix(in srgb, var(--amber) 30%, transparent)",
                          borderRadius: "8px",
                          padding: "8px 12px",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}>
                          <AlertTriangle size={12} />
                          Registered participants will receive an in-app notification about these changes.
                        </p>
                      )}
                      {submitErrors._edit && (
                        <p style={{ fontSize: "12px", color: "var(--cinnabar)" }}>{submitErrors._edit}</p>
                      )}
                    </div>
                    <div className="flex justify-end gap-2 mt-3">
                      <Button type="button" variant="outline" size="sm"
                        onClick={() => { setEditingEventId(null); setEditForm({}); }}>
                        Discard
                      </Button>
                      <Button type="button" size="sm"
                        onClick={() => saveEdit(event.id)}
                        disabled={editMutation.isPending}>
                        {editMutation.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                        Save Changes
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>

    {/* Cancel confirmation dialog */}
    {cancelConfirm && (
      <div style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(4px)",
      }}>
        <div style={{
          background: "var(--ink-soft)",
          border: "1px solid var(--seam)",
          borderRadius: "16px",
          padding: "24px",
          width: "100%",
          maxWidth: "384px",
          margin: "0 16px",
        }}>
          <h2 style={{ fontSize: "15px", fontWeight: 700, color: "var(--cream)", marginBottom: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
            <Trash2 size={16} style={{ color: "var(--cinnabar)" }} />
            Cancel Event
          </h2>
          <p style={{ fontSize: "14px", color: "var(--fog)", marginBottom: "4px" }}>
            This will permanently cancel the event. All registered participants will receive a notification.
          </p>
          <p style={{ fontSize: "12px", color: "var(--ash)", marginBottom: "20px" }}>This action cannot be undone.</p>
          {submitErrors._cancel && (
            <p style={{ fontSize: "12px", color: "var(--cinnabar)", marginBottom: "12px" }}>{submitErrors._cancel}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setCancelConfirm(null)}>
              Keep Event
            </Button>
            <Button
              type="button"
              size="sm"
              style={{ background: "var(--cinnabar)", color: "white" }}
              onClick={() => cancelEventMutation.mutate(cancelConfirm)}
              disabled={cancelEventMutation.isPending}
            >
              {cancelEventMutation.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Yes, Cancel Event
            </Button>
          </div>
        </div>
      </div>
    )}
    {showReport && <ReportModal onClose={() => setShowReport(false)} />}
  </>
  );
}
