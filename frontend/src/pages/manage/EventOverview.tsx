import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import {
  Users,
  CheckCircle,
  Activity,
  UserCheck,
  Wallet,
  Star,
  TrendingUp,
  QrCode,
  AlertCircle,
  CheckCircle2,
  X,
  Info,
  Calendar,
  Clock,
  MapPin,
  FileText,
} from "lucide-react";
import { useState } from "react";
import Layout from "@/components/Layout";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import type { Event } from "@/types";

interface EventAnalytics {
  registrations: { total: number; confirmed: number };
  attendance: { present: number; rate: number };
  teams: { total: number; avg_size: number };
  feedback: { nps: number | null };
  finance: { budget: number; spent: number; utilization: number };
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  sub?: string;
  highlight?: boolean;
}

function StatCard({ label, value, icon, iconBg, iconColor, sub, highlight }: StatCardProps) {
  return (
    <div
      style={{
        background: "var(--ink-soft)",
        border: highlight ? "1px solid var(--amber)" : "1px solid var(--seam)",
        borderRadius: 12,
        padding: 20,
        transition: "box-shadow 0.15s",
        boxShadow: highlight ? "0 0 0 1px var(--amber)" : undefined,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: iconBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <span style={{ color: iconColor }}>{icon}</span>
        </div>
        {highlight && (
          <span
            style={{
              fontSize: 10,
              background: "color-mix(in srgb, var(--amber) 15%, transparent)",
              color: "var(--amber)",
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: 999,
              border: "1px solid color-mix(in srgb, var(--amber) 30%, transparent)",
            }}
          >
            KEY
          </span>
        )}
      </div>
      <p style={{ fontSize: 30, fontWeight: 700, color: "var(--cream)", letterSpacing: "-0.02em", marginBottom: 4 }}>{value}</p>
      <p style={{ fontSize: 14, fontWeight: 500, color: "var(--fog)" }}>{label}</p>
      {sub && <p style={{ fontSize: 12, color: "var(--ash)", marginTop: 2 }}>{sub}</p>}
    </div>
  );
}

function SkeletonStat() {
  return (
    <div
      style={{
        background: "var(--ink-soft)",
        border: "1px solid var(--seam)",
        borderRadius: 12,
        padding: 20,
        animation: "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite",
      }}
    >
      <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--ink-muted)", marginBottom: 12 }} />
      <div style={{ height: 32, background: "var(--ink-muted)", borderRadius: 6, width: 80, marginBottom: 4 }} />
      <div style={{ height: 16, background: "var(--ink-muted)", borderRadius: 6, width: 112 }} />
    </div>
  );
}

interface CompleteModalProps {
  eventId: string;
  onConfirm: () => void;
  onClose: () => void;
  isPending: boolean;
  error: string;
}

const CHECKLIST = [
  "All attendance has been marked. Attendance cannot be taken hereafter.",
  "Event expenditure has been recorded in the Finance tab.",
  "Participant certificates have been issued, winners declared, and bank account details uploaded (if applicable).",
];

function CompleteModal({ onConfirm, onClose, isPending, error }: CompleteModalProps) {
  const [checked, setChecked] = useState<boolean[]>([false, false, false]);
  const allChecked = checked.every(Boolean);

  function toggle(i: number) {
    setChecked((prev) => prev.map((v, idx) => (idx === i ? !v : v)));
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "var(--ink-soft)", border: "1px solid var(--seam)",
          borderRadius: 16, padding: 28, maxWidth: 480, width: "100%",
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--cream)", marginBottom: 4 }}>
              Mark Event as Complete
            </h2>
            <p style={{ fontSize: 13, color: "var(--fog)" }}>
              Please confirm you have completed all of the following before proceeding.
            </p>
          </div>
          <button type="button" onClick={onClose} style={{ color: "var(--ash)", background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
          {CHECKLIST.map((item, i) => (
            <label
              key={i}
              style={{
                display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer",
                padding: "12px 14px", borderRadius: 10,
                background: checked[i]
                  ? "color-mix(in srgb, var(--jade) 8%, transparent)"
                  : "var(--ink-muted)",
                border: `1px solid ${checked[i] ? "color-mix(in srgb, var(--jade) 30%, transparent)" : "var(--seam)"}`,
                transition: "all 0.15s",
              }}
            >
              <input
                type="checkbox"
                checked={checked[i]}
                onChange={() => toggle(i)}
                style={{ marginTop: 2, accentColor: "var(--jade)", width: 16, height: 16, flexShrink: 0, cursor: "pointer" }}
              />
              <span style={{ fontSize: 13, color: checked[i] ? "var(--cream)" : "var(--fog)", lineHeight: 1.5 }}>
                {item}
              </span>
            </label>
          ))}
        </div>

        {!allChecked && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16,
            padding: "10px 14px", borderRadius: 8,
            background: "color-mix(in srgb, var(--amber) 8%, transparent)",
            border: "1px solid color-mix(in srgb, var(--amber) 20%, transparent)" }}>
            <Info size={14} style={{ color: "var(--amber)", flexShrink: 0 }} />
            <p style={{ fontSize: 12, color: "var(--amber)" }}>Check all items above to proceed.</p>
          </div>
        )}

        {error && (
          <p style={{ fontSize: 12, color: "var(--cinnabar)", marginBottom: 12 }}>{error}</p>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose} disabled={isPending}
            style={{
              padding: "9px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: "var(--ink-muted)", border: "1px solid var(--seam)",
              color: "var(--fog)", cursor: "pointer",
            }}>
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!allChecked || isPending}
            className="btn-primary"
            style={{ padding: "9px 20px", fontSize: 13, opacity: allChecked && !isPending ? 1 : 0.45, cursor: allChecked && !isPending ? "pointer" : "not-allowed" }}
          >
            <CheckCircle2 size={14} />
            {isPending ? "Completing…" : "Confirm & Complete"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EventOverview() {
  const { eventId } = useParams<{ eventId: string }>();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [completeError, setCompleteError] = useState("");
  const [showCompleteModal, setShowCompleteModal] = useState(false);

  const { data, isLoading, error } = useQuery<EventAnalytics>({
    queryKey: ["analytics", "event", eventId],
    queryFn: () => api.get(`/analytics/events/${eventId}`).then((r) => r.data),
    enabled: !!eventId,
  });

  const { data: eventData } = useQuery<Event>({
    queryKey: ["event", eventId],
    queryFn: () => api.get(`/events/by-id/${eventId}`).then((r) => r.data),
    enabled: !!eventId,
    staleTime: 5 * 60 * 1000,
  });

  const confirmationRate = data
    ? Math.round((data.registrations.confirmed / Math.max(data.registrations.total, 1)) * 100)
    : 0;

  const completeMutation = useMutation({
    mutationFn: () => api.post(`/events/${eventId}/complete`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event", eventId] });
      setCompleteError("");
      setShowCompleteModal(false);
    },
    onError: (err: any) => {
      setCompleteError(err?.response?.data?.detail ?? "Failed to mark complete.");
    },
  });

  const canComplete =
    eventData?.status === "PUBLISHED" &&
    (user?.role === "CLUB_ADMIN" || user?.role === "SUPER_ADMIN") &&
    (!eventData?.end_datetime || new Date(eventData.end_datetime) <= new Date());

  const attendancePct = data ? (data.attendance.rate * 100).toFixed(1) : "0.0";
  const utilizationPct = data ? (data.finance.utilization * 100).toFixed(1) : "0.0";

  return (
    <>
    <Layout eventId={eventId}>
      <div className="px-4 py-6 sm:px-8 sm:py-8" style={{ maxWidth: 960, margin: "0 auto" }}>
        <div style={{ marginBottom: 28 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "var(--ash)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
            Event Overview
          </p>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--cream)", letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: 8 }}>
                <Activity size={22} style={{ color: "var(--amber)" }} />
                {eventData?.title ?? "Event Statistics"}
              </h1>
              <p style={{ color: "var(--fog)", marginTop: 4, fontSize: 14 }}>
                Live performance snapshot for this event.
              </p>
            </div>
            {canComplete && (
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {eventData?.attendance_mode === "MASS" && (
                  <Link
                    to={`/manage/${eventId}/mass-attendance`}
                    className="btn-primary"
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", fontSize: 13, textDecoration: "none" }}
                  >
                    <QrCode size={14} />
                    Mass Attendance
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => { setCompleteError(""); setShowCompleteModal(true); }}
                  disabled={completeMutation.isPending}
                  className="btn-primary"
                  style={{ gap: 6, padding: "9px 18px", fontSize: 13 }}
                >
                  <CheckCircle2 size={14} />
                  Mark Complete
                </button>
                {completeError && (
                  <p style={{ fontSize: 12, color: "var(--cinnabar)", marginTop: 6, maxWidth: 220 }}>{completeError}</p>
                )}
              </div>
            )}
            {eventData?.status === "COMPLETED" && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                fontSize: 12, fontWeight: 700,
                color: "var(--jade)",
                background: "color-mix(in srgb, var(--jade) 12%, transparent)",
                border: "1px solid color-mix(in srgb, var(--jade) 25%, transparent)",
                padding: "5px 12px", borderRadius: 999,
              }}>
                <CheckCircle2 size={12} /> Completed
              </span>
            )}
          </div>
        </div>

        {/* Event details strip */}
        {eventData && (
          <div style={{
            background: "var(--ink-soft)", border: "1px solid var(--seam)",
            borderRadius: 12, padding: "16px 20px", marginBottom: 20,
            display: "flex", flexDirection: "column", gap: 12,
          }}>
            {eventData.description && (
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <FileText size={14} style={{ color: "var(--amber)", flexShrink: 0, marginTop: 2 }} />
                <p style={{ fontSize: 13, color: "var(--fog)", lineHeight: 1.6, margin: 0 }}>{eventData.description}</p>
              </div>
            )}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 28px" }}>
              {eventData.venue && (
                <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--fog)" }}>
                  <MapPin size={13} style={{ color: "var(--amber)", flexShrink: 0 }} />
                  {eventData.venue}
                </span>
              )}
              {eventData.start_datetime && (
                <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--fog)" }}>
                  <Calendar size={13} style={{ color: "var(--sky)", flexShrink: 0 }} />
                  <span style={{ color: "var(--ash)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", marginRight: 2 }}>Starts</span>
                  {new Date(eventData.start_datetime).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
              {eventData.end_datetime && (
                <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--fog)" }}>
                  <Clock size={13} style={{ color: "var(--sky)", flexShrink: 0 }} />
                  <span style={{ color: "var(--ash)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", marginRight: 2 }}>Ends</span>
                  {new Date(eventData.end_datetime).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
              {eventData.registration_start && (
                <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--fog)" }}>
                  <Calendar size={13} style={{ color: "var(--jade)", flexShrink: 0 }} />
                  <span style={{ color: "var(--ash)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", marginRight: 2 }}>Reg Opens</span>
                  {new Date(eventData.registration_start).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
              {eventData.registration_end && (
                <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--fog)" }}>
                  <Clock size={13} style={{ color: "var(--jade)", flexShrink: 0 }} />
                  <span style={{ color: "var(--ash)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", marginRight: 2 }}>Reg Closes</span>
                  {new Date(eventData.registration_end).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </div>
          </div>
        )}

        {error ? (
          <div
            style={{
              background: "color-mix(in srgb, var(--cinnabar) 10%, transparent)",
              border: "1px solid color-mix(in srgb, var(--cinnabar) 25%, transparent)",
              borderRadius: 12,
              padding: "20px 24px",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <AlertCircle size={18} style={{ color: "var(--cinnabar)", flexShrink: 0 }} />
            <p style={{ fontSize: 14, color: "var(--cinnabar)" }}>Failed to load analytics for this event.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => <SkeletonStat key={i} />)
            ) : data ? (
              <>
                <StatCard
                  label="Total Registrations"
                  value={data.registrations.total.toLocaleString()}
                  icon={<Users size={18} />}
                  iconBg="color-mix(in srgb, var(--amber) 15%, transparent)"
                  iconColor="var(--amber)"
                  highlight
                />
                <StatCard
                  label="Confirmed"
                  value={data.registrations.confirmed.toLocaleString()}
                  icon={<CheckCircle size={18} />}
                  iconBg="color-mix(in srgb, var(--jade) 15%, transparent)"
                  iconColor="var(--jade)"
                  sub={`${confirmationRate}% confirmation rate`}
                />
                <StatCard
                  label="Attendance Rate"
                  value={`${attendancePct}%`}
                  icon={<UserCheck size={18} />}
                  iconBg="color-mix(in srgb, var(--sky) 15%, transparent)"
                  iconColor="var(--sky)"
                  sub="of confirmed attendees"
                />
                <StatCard
                  label="Teams"
                  value={data.teams.total.toLocaleString()}
                  icon={<Users size={18} />}
                  iconBg="color-mix(in srgb, var(--sky) 12%, transparent)"
                  iconColor="var(--sky)"
                />
                <StatCard
                  label="Budget Utilization"
                  value={`${utilizationPct}%`}
                  icon={<Wallet size={18} />}
                  iconBg={
                    data.finance.utilization > 0.9
                      ? "color-mix(in srgb, var(--cinnabar) 15%, transparent)"
                      : "color-mix(in srgb, var(--amber) 15%, transparent)"
                  }
                  iconColor={
                    data.finance.utilization > 0.9 ? "var(--cinnabar)" : "var(--amber)"
                  }
                  sub={data.finance.utilization > 0.9 ? "Near limit" : "Within budget"}
                />
                <StatCard
                  label="NPS Score"
                  value={data.feedback.nps !== null ? data.feedback.nps.toFixed(1) : "—"}
                  icon={<Star size={18} />}
                  iconBg="color-mix(in srgb, var(--amber) 12%, transparent)"
                  iconColor="var(--amber)"
                  sub={data.feedback.nps !== null ? "Net Promoter Score" : "Not yet collected"}
                />
              </>
            ) : null}
          </div>
        )}

        {/* Quick progress bar */}
        {data && (
          <div
            style={{
              marginTop: 24,
              background: "var(--ink-soft)",
              border: "1px solid var(--seam)",
              borderRadius: 12,
              padding: 20,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--fog)", display: "flex", alignItems: "center", gap: 8 }}>
                <TrendingUp size={14} style={{ color: "var(--amber)" }} />
                Registration Funnel
              </h2>
              <span style={{ fontSize: 12, color: "var(--ash)" }}>Confirmed vs Total</span>
            </div>
            <div style={{ position: "relative", height: 12, background: "var(--ink-muted)", borderRadius: 999, overflow: "hidden" }}>
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  height: "100%",
                  background: "linear-gradient(to right, var(--amber), var(--amber-glow))",
                  borderRadius: 999,
                  transition: "width 0.7s",
                  width: `${Math.min(confirmationRate, 100)}%`,
                }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
              <span style={{ fontSize: 12, color: "var(--amber)", fontWeight: 500 }}>
                {data.registrations.confirmed} confirmed
              </span>
              <span style={{ fontSize: 12, color: "var(--ash)" }}>
                {data.registrations.total} total
              </span>
            </div>
          </div>
        )}
      </div>
    </Layout>

    {/* Mark Complete confirmation modal */}
    {showCompleteModal && (
      <CompleteModal
        eventId={eventId!}
        onConfirm={() => { completeMutation.mutate(); }}
        onClose={() => setShowCompleteModal(false)}
        isPending={completeMutation.isPending}
        error={completeError}
      />
    )}
    </>
  );
}
