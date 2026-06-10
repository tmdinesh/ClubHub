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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl p-6 w-full max-w-md mx-4">
        <h2 className="text-base font-bold text-slate-800 mb-1 flex items-center gap-2">
          <XCircle size={18} className="text-red-500" /> Reject Event
        </h2>
        <p className="text-sm text-slate-500 mb-4">
          Provide a reason for rejecting <span className="font-semibold text-slate-700">{eventTitle}</span>
        </p>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          placeholder="Explain why this event is being rejected…"
          className="w-full text-sm px-3 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-300 resize-none mb-4 placeholder:text-slate-300"
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
          <button type="button" onClick={() => onConfirm(comment)} disabled={!comment.trim() || isPending}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors">
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
      <span className="mt-0.5 shrink-0 text-slate-400">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">{label}</p>
        <p className="text-sm text-slate-700 leading-snug">{value}</p>
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

  if (isLoading) return <div className="h-20 bg-slate-50 rounded-lg animate-pulse" />;
  if (!data) return <p className="text-xs text-slate-400">No attendance data yet.</p>;

  const pct = data.registered > 0 ? Math.round((data.present / data.registered) * 100) : 0;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Registered", value: data.registered, color: "text-indigo-600" },
          { label: "Present", value: data.present, color: "text-emerald-600" },
          { label: "Absent", value: data.absent, color: "text-red-500" },
        ].map((s) => (
          <div key={s.label} className="bg-slate-50 rounded-lg p-3 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>
      <div>
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>Attendance rate</span>
          <span className="font-semibold text-slate-700">{pct}%</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
      {present.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-600 mb-2">Present attendees ({present.length})</p>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {present.map((u) => (
              <div key={u.user_id} className="flex justify-between text-xs px-2 py-1 rounded bg-slate-50">
                <span className="font-medium text-slate-700">{u.name}</span>
                <span className="text-slate-400">{u.email}</span>
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

  if (isLoading) return <div className="h-16 bg-slate-50 rounded-lg animate-pulse" />;
  if (isError || !data) return <p className="text-xs text-slate-400">No budget set for this event.</p>;

  const usedPct = data.total_budget > 0
    ? Math.min((data.total_spent / data.total_budget) * 100, 100) : 0;
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Budget", value: fmt(data.total_budget), color: "text-slate-800" },
          { label: "Spent", value: fmt(data.total_spent), color: "text-rose-600" },
          { label: "Remaining", value: fmt(data.remaining), color: data.remaining < 0 ? "text-red-600" : "text-emerald-600" },
        ].map((s) => (
          <div key={s.label} className="bg-slate-50 rounded-lg p-3 text-center">
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>
      <div>
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>Budget utilization</span>
          <span className="font-semibold text-slate-700">{usedPct.toFixed(1)}%</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${usedPct > 90 ? "bg-red-500" : usedPct > 70 ? "bg-amber-500" : "bg-emerald-500"}`}
            style={{ width: `${usedPct}%` }} />
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

  const statusColors: Record<string, string> = {
    DRAFT: "bg-slate-100 text-slate-600 border-slate-200",
    PENDING_APPROVAL: "bg-amber-50 text-amber-700 border-amber-200",
    PUBLISHED: "bg-emerald-50 text-emerald-700 border-emerald-200",
    COMPLETED: "bg-blue-50 text-blue-700 border-blue-200",
    ARCHIVED: "bg-slate-50 text-slate-400 border-slate-100",
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-md transition-shadow">
      <div className={`h-1 ${isPending ? "bg-gradient-to-r from-amber-400 to-orange-400" : "bg-gradient-to-r from-indigo-400 to-blue-400"}`} />
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="text-lg font-bold text-slate-800 leading-tight">{event.title}</h3>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${statusColors[event.status] ?? ""}`}>
                {event.status.replace(/_/g, " ")}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Submitted {fmtDateIST(event.created_at)}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            {isPending && onApprove && onReject && (
              <>
                <button type="button" onClick={onApprove} disabled={approving}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                  {approving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                  Approve
                </button>
                <button type="button" onClick={onReject}
                  className="flex items-center gap-1.5 px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-xl text-sm font-semibold hover:bg-red-100 transition-colors">
                  <XCircle size={14} /> Reject
                </button>
              </>
            )}
            <button type="button" onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1 px-3 py-2 bg-slate-50 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-100 transition-colors">
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
          <div className="border-t border-slate-50 mt-4 pt-4">
            <button type="button" onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 mb-2 transition-colors">
              <FileText size={13} />
              {expanded ? "Hide description" : "Show description & details"}
            </button>
            {expanded && (
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line mb-4">
                {event.description}
              </p>
            )}
          </div>
        )}

        {/* Attendance + Finance panels (for non-DRAFT events) */}
        {expanded && event.status !== "DRAFT" && event.status !== "PENDING_APPROVAL" && (
          <div className="border-t border-slate-100 mt-4 pt-4">
            <div className="flex gap-1 bg-slate-50 p-1 rounded-lg mb-4 w-fit">
              {(["attendance", "finance"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setDetailTab(t)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    detailTab === t ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}>
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

  const { data: pendingEvents = [], isLoading: loadingPending, error: pendingError } = useQuery<Event[]>({
    queryKey: ["events", "pending-approval"],
    queryFn: () => api.get("/events", { params: { status: "PENDING_APPROVAL" } }).then((r) => r.data),
  });

  const { data: allEvents = [], isLoading: loadingAll } = useQuery<Event[]>({
    queryKey: ["events", "faculty-mine"],
    queryFn: () => api.get("/events/faculty/mine").then((r) => r.data),
    enabled: viewTab === "all",
  });

  const approveMutation = useMutation({
    mutationFn: (eventId: string) => api.post(`/events/${eventId}/approve`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["events", "pending-approval"] }),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ eventId, comment }: { eventId: string; comment: string }) =>
      api.post(`/events/${eventId}/reject`, { comment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events", "pending-approval"] });
      setRejectTarget(null);
    },
  });

  const events = viewTab === "pending" ? pendingEvents : allEvents;
  const isLoading = viewTab === "pending" ? loadingPending : loadingAll;

  return (
    <Layout>
      <div className="p-8 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <ClipboardCheck size={22} className="text-indigo-500" />
            Faculty Dashboard
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            {viewTab === "pending"
              ? `${pendingEvents.length} event${pendingEvents.length !== 1 ? "s" : ""} pending review`
              : `${allEvents.length} event${allEvents.length !== 1 ? "s" : ""} assigned to you`}
          </p>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-7 w-fit">
          <button type="button" onClick={() => setViewTab("pending")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${viewTab === "pending" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
            <ClipboardCheck size={14} />
            Approval Queue
            {pendingEvents.length > 0 && (
              <span className="ml-1 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {pendingEvents.length}
              </span>
            )}
          </button>
          <button type="button" onClick={() => setViewTab("all")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${viewTab === "all" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
            <BarChart3 size={14} />
            All My Events
          </button>
        </div>

        {pendingError && viewTab === "pending" && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-6 flex items-center gap-3 mb-4">
            <AlertCircle size={18} className="text-red-500 shrink-0" />
            <p className="text-sm text-red-700">Failed to load events.</p>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-100 p-6 animate-pulse h-32" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={24} className="text-emerald-500" />
            </div>
            <h3 className="text-slate-700 font-semibold mb-2">
              {viewTab === "pending" ? "All clear!" : "No events yet"}
            </h3>
            <p className="text-slate-400 text-sm">
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
