import { useState, useRef } from "react";
import type React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  PlusCircle, CalendarDays, ChevronRight, AlertCircle,
  Clock, CheckCircle, Send, BarChart3, Loader2, AlertTriangle, X,
  Pencil, Trash2,
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

  const inputCls = (hasError: boolean) =>
    `text-center py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 ${
      hasError
        ? "border-red-300 focus:ring-red-300"
        : "border-slate-200 focus:ring-indigo-300"
    }`;

  return (
    <div className="space-y-1.5">
      <Label>
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>

      <div className="flex items-center gap-1 flex-wrap">
        {/* DD */}
        <input
          type="text" inputMode="numeric" placeholder="DD" maxLength={2} value={dd}
          onChange={(e) => handleDd(e.target.value)}
          className={`w-10 ${inputCls(!!error)}`}
        />
        <span className="text-slate-400 text-sm font-medium">/</span>
        {/* MM */}
        <input
          ref={mmRef}
          type="text" inputMode="numeric" placeholder="MM" maxLength={2} value={mm}
          onChange={(e) => handleMm(e.target.value)}
          className={`w-10 ${inputCls(!!error)}`}
        />
        <span className="text-slate-400 text-sm font-medium">/</span>
        {/* YYYY */}
        <input
          ref={yyyyRef}
          type="text" inputMode="numeric" placeholder="YYYY" maxLength={4} value={yyyy}
          onChange={(e) => handleYyyy(e.target.value)}
          className={`w-16 ${inputCls(!!error)}`}
        />

        <span className="text-slate-300 mx-1 text-sm">·</span>

        {/* Hour */}
        <select
          value={hour} onChange={(e) => handleHour(Number(e.target.value))}
          className="py-2 px-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white w-[68px]"
        >
          {HOURS.map((h) => <option key={h} value={h}>{pad(h)}</option>)}
        </select>
        <span className="text-slate-400 font-bold text-sm">:</span>
        {/* Minute */}
        <select
          value={minute} onChange={(e) => handleMinute(Number(e.target.value))}
          className="py-2 px-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white w-[60px]"
        >
          {MINUTES.map((mi) => <option key={mi} value={mi}>{pad(mi)}</option>)}
        </select>

        {value && (
          <button type="button" onClick={clear} className="ml-1 text-slate-300 hover:text-slate-500 transition-colors" title="Clear">
            <X size={14} />
          </button>
        )}
      </div>

      {preview && !error && (
        <p className="text-xs text-indigo-600 font-medium">{preview}</p>
      )}
      {error && (
        <p className="text-xs text-red-600 flex items-center gap-1">
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

// ── Status colours ────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  DRAFT:            "bg-slate-100 text-slate-600 border-slate-200",
  PENDING_APPROVAL: "bg-amber-50 text-amber-700 border-amber-200",
  PUBLISHED:        "bg-emerald-50 text-emerald-700 border-emerald-200",
  COMPLETED:        "bg-blue-50 text-blue-700 border-blue-200",
  ARCHIVED:         "bg-slate-50 text-slate-400 border-slate-100",
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

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function ClubAdminDashboard() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [showCreate, setShowCreate] = useState(false);
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
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 flex items-start gap-3">
            <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800">No club assigned</p>
              <p className="text-sm text-amber-700 mt-1">
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
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Club Admin</p>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
              <CalendarDays size={22} className="text-indigo-500" />
              My Events
            </h1>
          </div>
          <Button type="button" onClick={() => setShowCreate((v) => !v)} className="gap-2">
            <PlusCircle size={16} />
            New Event
          </Button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {(["DRAFT", "PENDING_APPROVAL", "PUBLISHED", "COMPLETED"] as const).map((s) => (
            <div key={s} className="bg-white rounded-xl border border-slate-100 p-4">
              <p className="text-2xl font-bold text-slate-800">{counts[s]}</p>
              <p className="text-xs text-slate-500 mt-0.5 capitalize">{s.replace(/_/g, " ").toLowerCase()}</p>
            </div>
          ))}
        </div>

        {/* Create form */}
        {showCreate && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-800 mb-5">Create New Event</h2>

            <div className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="title">Title <span className="text-red-500">*</span></Label>
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
                  className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
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
              <div className="border-t border-slate-100 pt-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Team Settings</p>
                <label className="flex items-center gap-3 cursor-pointer select-none mb-4">
                  <div
                    className={`w-10 h-5 rounded-full transition-colors relative ${form.is_team_event ? "bg-indigo-600" : "bg-slate-200"}`}
                    onClick={() => setForm((f) => ({ ...f, is_team_event: !f.is_team_event }))}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.is_team_event ? "translate-x-5" : "translate-x-0"}`}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">Team Event</p>
                    <p className="text-xs text-slate-400">Participants register as teams instead of individuals</p>
                  </div>
                </label>

                {form.is_team_event && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="team_min">Min Team Size <span className="text-red-500">*</span></Label>
                      <Input
                        id="team_min" type="number" min={2}
                        value={form.team_min_size}
                        onChange={(e) => field("team_min_size", e.target.value)}
                        placeholder="2"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="team_max">Max Team Size <span className="text-red-500">*</span></Label>
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

              <div className="border-t border-slate-100 pt-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Schedule</p>
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
              <p className="text-sm text-destructive mt-4 flex items-center gap-1.5">
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
          <div className="bg-red-50 border border-red-100 rounded-xl p-6 flex items-center gap-3">
            <AlertCircle size={18} className="text-red-500 shrink-0" />
            <p className="text-sm text-red-700">Failed to load events.</p>
          </div>
        ) : isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-100 p-5 animate-pulse h-20" />
            ))}
          </div>
        ) : !events?.length ? (
          <div className="bg-white rounded-xl border border-slate-100 p-16 text-center">
            <CalendarDays size={32} className="text-slate-200 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No events yet</p>
            <p className="text-sm text-slate-400 mt-1">Click "New Event" to create your first one.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {events.map((event) => (
              <div key={event.id} className="bg-white rounded-xl border border-slate-100 p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-slate-800 truncate">{event.title}</p>
                      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLORS[event.status] ?? ""}`}>
                        {STATUS_ICON[event.status]}
                        {event.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {event.start_datetime
                        ? fmtDateTimeMedIST(event.start_datetime)
                        : "No date set"}
                      {event.venue ? ` · ${event.venue}` : ""}
                    </p>
                    {submitErrors[event.id] && (
                      <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
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
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs font-semibold hover:bg-amber-100 transition-colors disabled:opacity-50"
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
                        className="flex items-center gap-1 px-3 py-1.5 bg-slate-50 text-slate-600 border border-slate-200 rounded-lg text-xs font-semibold hover:bg-slate-100 transition-colors"
                      >
                        <Pencil size={12} />
                        Edit
                      </button>
                    )}
                    {event.status !== "ARCHIVED" && (
                      <button
                        type="button"
                        onClick={() => setCancelConfirm(event.id)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 border border-red-100 rounded-lg text-xs font-semibold hover:bg-red-100 transition-colors"
                      >
                        <Trash2 size={12} />
                        Cancel
                      </button>
                    )}
                    <Link
                      to={`/manage/${event.id}/overview`}
                      className="flex items-center gap-1 px-3 py-1.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-lg text-xs font-semibold hover:bg-indigo-100 transition-colors"
                    >
                      Manage <ChevronRight size={12} />
                    </Link>
                  </div>
                </div>

                {/* Inline edit panel */}
                {editingEventId === event.id && (
                  <div className="mt-4 border-t border-slate-100 pt-4">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Edit Event</p>
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
                        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-1.5">
                          <AlertTriangle size={12} />
                          Registered participants will receive an in-app notification about these changes.
                        </p>
                      )}
                      {submitErrors._edit && (
                        <p className="text-xs text-red-600">{submitErrors._edit}</p>
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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl p-6 w-full max-w-sm mx-4">
          <h2 className="text-base font-bold text-slate-800 mb-2 flex items-center gap-2">
            <Trash2 size={16} className="text-red-500" />
            Cancel Event
          </h2>
          <p className="text-sm text-slate-500 mb-1">
            This will permanently cancel the event. All registered participants will receive a notification.
          </p>
          <p className="text-xs text-slate-400 mb-5">This action cannot be undone.</p>
          {submitErrors._cancel && (
            <p className="text-xs text-red-600 mb-3">{submitErrors._cancel}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setCancelConfirm(null)}>
              Keep Event
            </Button>
            <Button
              type="button"
              size="sm"
              className="bg-red-600 hover:bg-red-700 text-white"
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
  </>
  );
}
