import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { CalendarDays, Award, Bell, ChevronRight, Ticket } from "lucide-react";
import Layout from "@/components/Layout";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import type { Registration, Certificate, Notification } from "@/types";
import { fmtDateIST, fmtMonthDayIST } from "@/lib/dateIST";

const HOUR = new Date().getHours();
const GREETING = HOUR < 12 ? "Good morning" : HOUR < 18 ? "Good afternoon" : "Good evening";

const STATUS_STYLES: Record<Registration["status"], { label: string; color: string; bg: string }> = {
  CONFIRMED:  { label: "Confirmed",  color: "var(--jade)",    bg: "rgba(61,214,140,0.1)"  },
  WAITLISTED: { label: "Waitlisted", color: "var(--sky)",     bg: "rgba(59,158,245,0.1)"  },
  PENDING:    { label: "Pending",    color: "var(--amber)",   bg: "rgba(245,166,35,0.1)"  },
  CANCELLED:  { label: "Cancelled",  color: "var(--fog)",     bg: "rgba(122,134,153,0.1)" },
};

function StatBox({ icon, value, label, accent, to }: {
  icon: React.ReactNode; value: number | string; label: string; accent: string; to?: string;
}) {
  const inner = (
    <div style={{
      background: "var(--ink-soft)", border: "1px solid var(--seam)",
      borderRadius: 12, padding: "18px 20px",
      display: "flex", alignItems: "center", gap: 14,
      transition: "border-color 150ms, transform 150ms",
      cursor: to ? "pointer" : "default",
    }}
      onMouseEnter={(e) => { if (to) { (e.currentTarget as HTMLElement).style.borderColor = accent; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; } }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--seam)"; (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
    >
      <div style={{ width: 38, height: 38, borderRadius: 10, background: `${accent}18`, display: "flex", alignItems: "center", justifyContent: "center", shrink: 0, color: accent, flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, color: "var(--cream)", lineHeight: 1, marginBottom: 3 }}>{value}</p>
        <p style={{ fontSize: 12, color: "var(--fog)" }}>{label}</p>
      </div>
      {to && <ChevronRight size={14} style={{ color: "var(--dust)", marginLeft: "auto" }} />}
    </div>
  );
  return to ? <Link to={to} style={{ textDecoration: "none" }}>{inner}</Link> : inner;
}

export default function Dashboard() {
  const { user } = useAuthStore();

  const { data: registrations } = useQuery<Registration[]>({
    queryKey: ["registrations", "me"],
    queryFn: () => api.get("/registrations/me").then((r) => r.data),
  });

  const { data: certificates } = useQuery<Certificate[]>({
    queryKey: ["certificates", "me"],
    queryFn: () => api.get("/certificates/me").then((r) => r.data),
  });

  const { data: notifications } = useQuery<Notification[]>({
    queryKey: ["notifications"],
    queryFn: () => api.get("/notifications").then((r) => r.data),
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
  });

  const unread = notifications?.filter((n) => !n.is_read).length ?? 0;
  const active = (registrations ?? []).filter((r) => r.status === "CONFIRMED" || r.status === "WAITLISTED");
  const firstName = user?.name?.split(" ")[0] ?? "there";

  return (
    <Layout>
      <div style={{ padding: "40px 40px 60px", maxWidth: 900, margin: "0 auto" }}>

        {/* Welcome */}
        <div className="animate-fade-up" style={{ marginBottom: 36 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--amber)", marginBottom: 6 }}>
            {GREETING}
          </p>
          <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 36, color: "var(--cream)", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
            {firstName}<em style={{ color: "var(--amber)" }}>.</em>
          </h1>
          <p style={{ fontSize: 14, color: "var(--fog)", marginTop: 6 }}>
            Here's your event activity.
          </p>
        </div>

        {/* Stats */}
        <div className="animate-fade-up delay-100" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 36 }}>
          <StatBox icon={<Ticket size={17} />} value={registrations?.length ?? 0} label="Registered Events" accent="var(--amber)" to="/dashboard/events" />
          <StatBox icon={<Award size={17} />} value={certificates?.length ?? 0} label="Certificates Earned" accent="var(--jade)" to="/dashboard/certificates" />
          <StatBox icon={<Bell size={17} />} value={unread} label="Unread Notifications" accent="var(--sky)" to="/dashboard/notifications" />
        </div>

        {/* Two-col */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

          {/* Active registrations */}
          <section className="animate-fade-up delay-200">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 18, color: "var(--cream)" }}>
                Active
              </h2>
              <Link to="/dashboard/events" style={{ fontSize: 12, color: "var(--amber)", textDecoration: "none" }}>View all →</Link>
            </div>
            <div style={{ background: "var(--ink-soft)", border: "1px solid var(--seam)", borderRadius: 12, overflow: "hidden" }}>
              {active.length === 0 ? (
                <div style={{ padding: "36px 20px", textAlign: "center" }}>
                  <CalendarDays size={28} style={{ color: "var(--dust)", margin: "0 auto 8px" }} />
                  <p style={{ fontSize: 12, color: "var(--fog)" }}>No active registrations</p>
                  <Link to="/" style={{ fontSize: 12, color: "var(--amber)", textDecoration: "none", marginTop: 6, display: "block" }}>Browse events →</Link>
                </div>
              ) : (
                active.slice(0, 5).map((reg, i) => {
                  const s = STATUS_STYLES[reg.status];
                  return (
                    <div key={reg.id} style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "12px 16px",
                      borderTop: i > 0 ? "1px solid var(--seam)" : "none",
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Link to={`/events/${reg.event_slug}`} style={{ textDecoration: "none" }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--cream)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{reg.event_title}</p>
                        </Link>
                        <p style={{ fontSize: 11, color: "var(--fog)", marginTop: 2 }}>
                          {reg.club_name}
                          {reg.event_start_datetime && <> · {fmtDateIST(reg.event_start_datetime)}</>}
                        </p>
                      </div>
                      <span style={{
                        fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
                        padding: "3px 8px", borderRadius: 99,
                        background: s.bg, color: s.color,
                        flexShrink: 0,
                      }}>{s.label}</span>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* Recent certificates */}
          <section className="animate-fade-up delay-250">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 18, color: "var(--cream)" }}>Certificates</h2>
              <Link to="/dashboard/certificates" style={{ fontSize: 12, color: "var(--amber)", textDecoration: "none" }}>View all →</Link>
            </div>
            <div style={{ background: "var(--ink-soft)", border: "1px solid var(--seam)", borderRadius: 12, overflow: "hidden" }}>
              {!certificates || certificates.length === 0 ? (
                <div style={{ padding: "36px 20px", textAlign: "center" }}>
                  <Award size={28} style={{ color: "var(--dust)", margin: "0 auto 8px" }} />
                  <p style={{ fontSize: 12, color: "var(--fog)" }}>No certificates yet</p>
                </div>
              ) : (
                certificates.slice(0, 5).map((cert, i) => (
                  <div key={cert.id} style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                    borderTop: i > 0 ? "1px solid var(--seam)" : "none",
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                      background: cert.certificate_type === "WINNER" ? "rgba(245,166,35,0.12)" : "rgba(61,214,140,0.1)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Award size={14} style={{ color: cert.certificate_type === "WINNER" ? "var(--amber)" : "var(--jade)" }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--cream)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {cert.event_title}
                      </p>
                      <p style={{ fontSize: 11, color: "var(--fog)", marginTop: 2, textTransform: "capitalize" }}>
                        {cert.certificate_type.toLowerCase()} · {fmtMonthDayIST(cert.issued_at)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </Layout>
  );
}
