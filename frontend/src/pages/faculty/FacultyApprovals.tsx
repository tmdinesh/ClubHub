import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ClipboardCheck, CheckCircle, XCircle, Loader2, AlertCircle,
  MapPin, Calendar, Users, Building2, Clock, Tag, FileText,
  ChevronDown, ChevronUp, Radio, Wallet, BarChart3,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState as useStateAlias } from "react";
import Layout from "@/components/Layout";
import api from "@/lib/api";
import type { Event } from "@/types";
import { fmtDateTimeIST, fmtDateTimeMedIST, fmtDateTimeCompactIST, fmtDateIST } from "@/lib/dateIST";

// ── Types ──────────────────────────────────────────────────────────────────

interface AttendanceData { registered: number; present: number; absent: number; rate: number; }
interface FinanceData { total_budget: number; total_spent: number; remaining: number; }
interface PresentUser { user_id: string; name: string; email: string; }

// ── Reject dialog (same as before) ────────────────────────────────────────

interface RejectDialogProps {
  eventTitle: string;
  onConfirm: (comment: string) => void;
  onCancel: () => void;
  isPending: boolean;
}

function RejectDialog({ eventTitle, onConfirm, onCancel, isPending }: RejectDialogProps) {
  const [comment, setComment] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm" style={{ background: "rgba(0,0,0,0.7)" }}>
      <div className="rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4" style={{ background: "var(--ink-soft)", border: "1px solid var(--seam)" }}>
        <h2 className="text-base font-bold mb-1 flex items-center gap-2" style={{ color: "var(--cream)" }}>
          <XCircle size={18} style={{ color: "var(--cinnabar)" }} /> Reject Event
        </h2>
        <p className="text-sm mb-4" style={{ color: "var(--fog)" }}>
          Provide a reason for rejecting <span className="font-semibold" style={{ color: "var(--cream)" }}>{eventTitle}</span>
        </p>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          placeholder="Explain why this event is being rejected…"
          className="w-full text-sm px-3 py-2.5 rounded-lg resize-none mb-4 focus:outline-none"
          style={{
            background: "var(--ink-muted)",
            border: "1px solid var(--seam)",
            color: "var(--cream)",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "var(--amber)";
            e.currentTarget.style.boxShadow = "0 0 0 3px rgba(245,166,35,0.12)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "var(--seam)";
            e.currentTarget.style.boxShadow = "none";
          }}
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
            style={{ color: "var(--ash)", border: "1px solid var(--seam)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--ink-muted)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(comment)}
            disabled={!comment.trim() || isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors"
            style={{ background: "var(--cinnabar)", color: "white" }}
          >
            {isPending && <Loader2 size={13} className="animate-spin" />}
            Reject Event
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Expandable event card ──────────────────────────────────────────────────

function Detail({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 shrink-0" style={{ color: "var(--ash)" }}>{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: "var(--dust)" }}>{label}</p>
        <p className="text-sm leading-snug" style={{ color: "var(--fog)" }}>{value}</p>
      </div>
    </div>
  );
}

function AttendancePanel({ eventId }: { eventId: string }) {
  const { data, isLoading } = useQuery<AttendanceData>({
    queryKey: ["faculty-attendance", eventId],
    queryFn: () => api.get(`/events/${eventId}/attendance`).then((r) => r.data),
  });
  const { data: present = [] } = useQuery<PresentUser[]>({
    queryKey: ["faculty-present", eventId],
    queryFn: () => api.get(`/events/${eventId}/attendance/present`).then((r) => r.data),
  });

  if (isLoading) return <div className="h-20 rounded-lg animate-pulse" style={{ background: "var(--ink-muted)" }} />;
  if (!data) return <p className="text-xs" style={{ color: "var(--dust)" }}>No attendance data yet.</p>;

  const pct = data.registered > 0 ? Math.round((data.present / data.registered) * 100) : 0;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Registered", value: data.registered, color: "var(--amber)" },
          { label: "Present", value: data.present, color: "var(--jade)" },
          { label: "Absent", value: data.absent, color: "var(--cinnabar)" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg p-3 text-center" style={{ background: "var(--ink-muted)" }}>
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--dust)" }}>{s.label}</p>
          </div>
        ))}
      </div>
      <div>
        <div className="flex justify-between text-xs mb-1" style={{ color: "var(--dust)" }}>
          <span>Attendance rate</span>
          <span className="font-semibold" style={{ color: "var(--fog)" }}>{pct}%</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--ink-muted)" }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: "var(--jade)" }} />
        </div>
      </div>
      {present.length > 0 && (
        <div>
          <p className="text-xs font-semibold mb-2" style={{ color: "var(--fog)" }}>Present attendees ({present.length})</p>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {present.map((u) => (
              <div key={u.user_id} className="flex justify-between text-xs px-2 py-1 rounded" style={{ background: "var(--ink-muted)" }}>
                <span className="font-medium" style={{ color: "var(--fog)" }}>{u.name}</span>
                <span style={{ color: "var(--dust)" }}>{u.email}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FinancePanel({ eventId }: { eventId: string }) {
  const { data, isLoading, isError } = useQuery<FinanceData>({
    queryKey: ["faculty-finance", eventId],
    queryFn: () => api.get(`/events/${eventId}/budget`).then((r) => r.data),
  });

  if (isLoading) return <div className="h-16 rounded-lg animate-pulse" style={{ background: "var(--ink-muted)" }} />;
  if (isError || !data) return <p className="text-xs" style={{ color: "var(--dust)" }}>No budget set for this event.</p>;

  const usedPct = data.total_budget > 0
    ? Math.min((data.total_spent / data.total_budget) * 100, 100) : 0;
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

  const barColor = usedPct > 90 ? "var(--cinnabar)" : usedPct > 70 ? "var(--amber)" : "var(--jade)";

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Budget", value: fmt(data.total_budget), color: "var(--cream)" },
          { label: "Spent", value: fmt(data.total_spent), color: "var(--cinnabar)" },
          { label: "Remaining", value: fmt(data.remaining), color: data.remaining < 0 ? "var(--cinnabar)" : "var(--jade)" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg p-3 text-center" style={{ background: "var(--ink-muted)" }}>
            <p className="text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--dust)" }}>{s.label}</p>
          </div>
        ))}
      </div>
      <div>
        <div className="flex justify-between text-xs mb-1" style={{ color: "var(--dust)" }}>
          <span>Budget utilization</span>
          <span className="font-semibold" style={{ color: "var(--fog)" }}>{usedPct.toFixed(1)}%</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--ink-muted)" }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${usedPct}%`, background: barColor }} />
        </div>
      </div>
    </div>
  );
}

function EventCard({
  event, isPending, onApprove, onReject, approving,
}: {
  event: Event;
  isPending: boolean;
  onApprove?: () => void;
  onReject?: () => void;
  approving?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [detailTab, setDetailTab] = useState<"attendance" | "finance">("attendance");

  const fmt = fmtDateTimeIST;
  const regWindow = event.registration_start || event.registration_end
    ? `${event.registration_start ? fmtDateTimeCompactIST(event.registration_start) : "—"} → ${event.registration_end ? fmtDateTimeCompactIST(event.registration_end) : "—"}`
    : null;

  const statusStyles: Record<string, React.CSSProperties> = {
    DRAFT: {
      background: "color-mix(in srgb, var(--dust) 20%, transparent)",
      color: "var(--ash)",
    },
    PENDING_APPROVAL: {
      background: "color-mix(in srgb, var(--amber) 15%, transparent)",
      color: "var(--amber)",
    },
    PUBLISHED: {
      background: "color-mix(in srgb, var(--jade) 15%, transparent)",
      color: "var(--jade)",
    },
    COMPLETED: {
      background: "color-mix(in srgb, var(--sky) 15%, transparent)",
      color: "var(--sky)",
    },
    ARCHIVED: {
      background: "color-mix(in srgb, var(--dust) 20%, transparent)",
      color: "var(--dust)",
    },
  };

  return (
    <div className="rounded-2xl overflow-hidden transition-shadow hover:shadow-lg" style={{ background: "var(--ink-soft)", border: "1px solid var(--seam)" }}>
      <div className={`h-1 ${isPending ? "bg-gradient-to-r from-amber-400 to-orange-400" : "bg-gradient-to-r from-indigo-400 to-blue-400"}`} />
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="text-lg font-bold leading-tight" style={{ color: "var(--cream)" }}>{event.title}</h3>
              <span
                className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                style={statusStyles[event.status] ?? {}}
              >
                {event.status.replace(/_/g, " ")}
              </span>
            </div>
            <p className="text-xs" style={{ color: "var(--dust)" }}>
              Submitted {fmtDateIST(event.created_at)}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            {isPending && onApprove && onReject && (
              <>
                <button
                  type="button"
                  onClick={onApprove}
                  disabled={approving}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors"
                  style={{ background: "var(--jade)", color: "var(--ink)" }}
                >
                  {approving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                  Approve
                </button>
                <button
                  type="button"
                  onClick={onReject}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
                  style={{
                    background: "color-mix(in srgb, var(--cinnabar) 12%, transparent)",
                    color: "var(--cinnabar)",
                    border: "1px solid color-mix(in srgb, var(--cinnabar) 30%, transparent)",
                  }}
                >
                  <XCircle size={14} /> Reject
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold transition-colors"
              style={{ background: "var(--ink-muted)", border: "1px solid var(--seam)", color: "var(--ash)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--ink-muted)")}
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {expanded ? "Less" : "Details"}
            </button>
          </div>
        </div>

        {/* Core details grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Detail icon={<Building2 size={14} />} label="Organising Club" value={event.club_name || "—"} />
          <Detail icon={<Calendar size={14} />} label="From" value={event.start_datetime ? fmt(event.start_datetime) : "Not set"} />
          <Detail icon={<Calendar size={14} />} label="To" value={event.end_datetime ? fmt(event.end_datetime) : "—"} />
          {event.venue && <Detail icon={<MapPin size={14} />} label="Venue" value={event.venue} />}
          {event.category && <Detail icon={<Tag size={14} />} label="Category" value={event.category} />}
          {event.max_participants && <Detail icon={<Users size={14} />} label="Max Participants" value={event.max_participants.toLocaleString()} />}
          {regWindow && <Detail icon={<Clock size={14} />} label="Registration Window" value={regWindow} />}
        </div>

        {/* Description toggle */}
        {event.description && (
          <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--seam)" }}>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-semibold mb-2 transition-colors"
              style={{ color: "var(--amber)" }}
            >
              <FileText size={13} />
              {expanded ? "Hide description" : "Show description & details"}
            </button>
            {expanded && (
              <p className="text-sm leading-relaxed whitespace-pre-line mb-4" style={{ color: "var(--fog)" }}>
                {event.description}
              </p>
            )}
          </div>
        )}

        {/* Attendance + Finance panels (for non-DRAFT events) */}
        {expanded && event.status !== "DRAFT" && event.status !== "PENDING_APPROVAL" && (
          <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--seam)" }}>
            <div className="flex gap-1 p-1 rounded-lg mb-4 w-fit" style={{ background: "var(--ink-muted)" }}>
              {(["attendance", "finance"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setDetailTab(t)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all"
                  style={
                    detailTab === t
                      ? { background: "var(--ink-soft)", color: "var(--cream)", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }
                      : { color: "var(--fog)" }
                  }
                >
                  {t === "attendance" ? <Radio size={12} /> : <Wallet size={12} />}
                  {t === "attendance" ? "Attendance" : "Finance"}
                </button>
              ))}
            </div>
            {detailTab === "attendance" && <AttendancePanel eventId={event.id} />}
            {detailTab === "finance" && <FinancePanel eventId={event.id} />}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function FacultyApprovals() {
  const queryClient = useQueryClient();
  const [rejectTarget, setRejectTarget] = useState<{ id: string; title: string } | null>(null);
  const [viewTab, setViewTab] = useState<"pending" | "all">("pending");

  const { data: allEvents = [], isLoading: loadingAll, error: pendingError } = useQuery<Event[]>({
    queryKey: ["events", "faculty-mine"],
    queryFn: () => api.get("/events/faculty/mine").then((r) => r.data),
  });

  const pendingEvents = allEvents.filter((e) => e.status === "PENDING_APPROVAL");
  const loadingPending = loadingAll;

  const approveMutation = useMutation({
    mutationFn: (eventId: string) => api.post(`/events/${eventId}/approve`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["events", "faculty-mine"] }),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ eventId, comment }: { eventId: string; comment: string }) =>
      api.post(`/events/${eventId}/reject`, { comment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events", "faculty-mine"] });
      setRejectTarget(null);
    },
  });

  const events = viewTab === "pending" ? pendingEvents : allEvents;
  const isLoading = loadingAll;

  return (
    <Layout>
      <div className="p-8 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" style={{ color: "var(--cream)" }}>
            <ClipboardCheck size={22} style={{ color: "var(--amber)" }} />
            Faculty Dashboard
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--fog)" }}>
            {viewTab === "pending"
              ? `${pendingEvents.length} event${pendingEvents.length !== 1 ? "s" : ""} pending review`
              : `${allEvents.length} event${allEvents.length !== 1 ? "s" : ""} assigned to you`}
          </p>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 p-1 rounded-xl mb-7 w-fit" style={{ background: "var(--ink-muted)" }}>
          <button
            type="button"
            onClick={() => setViewTab("pending")}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={
              viewTab === "pending"
                ? { background: "var(--ink-soft)", color: "var(--cream)", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }
                : { color: "var(--fog)" }
            }
          >
            <ClipboardCheck size={14} />
            Approval Queue
            {pendingEvents.length > 0 && (
              <span className="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "var(--amber)", color: "var(--ink)" }}>
                {pendingEvents.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setViewTab("all")}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={
              viewTab === "all"
                ? { background: "var(--ink-soft)", color: "var(--cream)", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }
                : { color: "var(--fog)" }
            }
          >
            <BarChart3 size={14} />
            All My Events
          </button>
        </div>

        {pendingError && viewTab === "pending" && (
          <div className="rounded-xl p-6 flex items-center gap-3 mb-4" style={{ background: "color-mix(in srgb, var(--cinnabar) 12%, transparent)", border: "1px solid color-mix(in srgb, var(--cinnabar) 30%, transparent)" }}>
            <AlertCircle size={18} className="shrink-0" style={{ color: "var(--cinnabar)" }} />
            <p className="text-sm" style={{ color: "var(--cinnabar)" }}>Failed to load events.</p>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-2xl p-6 animate-pulse h-32" style={{ background: "var(--ink-soft)", border: "1px solid var(--seam)" }} />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="rounded-2xl p-16 text-center" style={{ background: "var(--ink-soft)", border: "1px solid var(--seam)" }}>
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "color-mix(in srgb, var(--jade) 15%, transparent)" }}>
              <CheckCircle size={24} style={{ color: "var(--jade)" }} />
            </div>
            <h3 className="font-semibold mb-2" style={{ color: "var(--fog)" }}>
              {viewTab === "pending" ? "All clear!" : "No events yet"}
            </h3>
            <p className="text-sm" style={{ color: "var(--dust)" }}>
              {viewTab === "pending"
                ? "No events are pending approval right now."
                : "No club events are assigned to you yet."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {events.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                isPending={event.status === "PENDING_APPROVAL" && viewTab === "pending"}
                onApprove={() => approveMutation.mutate(event.id)}
                onReject={() => setRejectTarget({ id: event.id, title: event.title })}
                approving={approveMutation.isPending && approveMutation.variables === event.id}
              />
            ))}
          </div>
        )}
      </div>

      {rejectTarget && (
        <RejectDialog
          eventTitle={rejectTarget.title}
          isPending={rejectMutation.isPending}
          onConfirm={(comment) => rejectMutation.mutate({ eventId: rejectTarget.id, comment })}
          onCancel={() => setRejectTarget(null)}
        />
      )}
    </Layout>
  );
}
