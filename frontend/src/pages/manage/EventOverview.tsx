import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import {
  Users,
  CheckCircle,
  Activity,
  UserCheck,
  Wallet,
  Star,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import Layout from "@/components/Layout";
import api from "@/lib/api";

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

export default function EventOverview() {
  const { eventId } = useParams<{ eventId: string }>();

  const { data, isLoading, error } = useQuery<EventAnalytics>({
    queryKey: ["analytics", "event", eventId],
    queryFn: () => api.get(`/analytics/events/${eventId}`).then((r) => r.data),
    enabled: !!eventId,
  });

  const confirmationRate = data
    ? Math.round((data.registrations.confirmed / Math.max(data.registrations.total, 1)) * 100)
    : 0;

  const attendancePct = data ? (data.attendance.rate * 100).toFixed(1) : "0.0";
  const utilizationPct = data ? (data.finance.utilization * 100).toFixed(1) : "0.0";

  return (
    <Layout eventId={eventId}>
      <div style={{ padding: 32, maxWidth: 960, margin: "0 auto" }}>
        <div style={{ marginBottom: 28 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "var(--ash)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
            Event Overview
          </p>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--cream)", letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: 8 }}>
            <Activity size={22} style={{ color: "var(--amber)" }} />
            Event Statistics
          </h1>
          <p style={{ color: "var(--fog)", marginTop: 4, fontSize: 14 }}>
            Live snapshot for event{" "}
            <span style={{ fontFamily: "monospace", color: "var(--dust)" }}>{eventId}</span>.
          </p>
        </div>

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
  );
}
