import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CalendarDays, ChevronRight, AlertCircle, Clock, CheckCircle, Send, BarChart3 } from "lucide-react";
import Layout from "@/components/Layout";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import type { Event } from "@/types";
import { fmtDateTimeMedIST } from "@/lib/dateIST";

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

const ROLE_LABEL: Record<string, string> = {
  ATTENDANCE_TEAM: "Attendance Team",
};

export default function OrganizerDashboard() {
  const { user } = useAuthStore();
  const roleLabel = ROLE_LABEL[user?.role ?? ""] ?? user?.role ?? "";

  const { data: events, isLoading, error } = useQuery<Event[]>({
    queryKey: ["events", "assigned"],
    queryFn: () => api.get("/events/assigned").then((r) => r.data),
  });

  return (
    <Layout>
      <div className="p-8 max-w-5xl mx-auto">
        <div className="mb-8">
          <p style={{ color: "var(--dust)", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "4px" }}>
            {roleLabel}
          </p>
          <h1 style={{ color: "var(--cream)", fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: "8px" }}>
            <CalendarDays size={22} style={{ color: "var(--amber)" }} />
            Assigned Events
          </h1>
          <p style={{ color: "var(--fog)", marginTop: "4px", fontSize: "14px" }}>
            Events where you have been assigned as an organizer.
          </p>
        </div>

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
            <p style={{ fontSize: "14px", color: "var(--cinnabar)" }}>Failed to load assigned events.</p>
          </div>
        ) : isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
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
            <p style={{ color: "var(--fog)", fontWeight: 500 }}>No events assigned yet</p>
            <p style={{ fontSize: "13px", color: "var(--ash)", marginTop: "4px" }}>
              A Club Admin needs to assign you to an event before it appears here.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {events.map((event) => (
              <div
                key={event.id}
                style={{
                  background: "var(--ink-soft)",
                  borderRadius: "12px",
                  border: "1px solid var(--seam)",
                  padding: "16px",
                  transition: "border-color 0.15s",
                }}
              >
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
                        {event.status.replace("_", " ")}
                      </span>
                    </div>
                    <p style={{ fontSize: "12px", color: "var(--ash)", marginTop: "2px" }}>
                      {event.start_datetime
                        ? fmtDateTimeMedIST(event.start_datetime)
                        : "No date set"}
                      {event.venue ? ` · ${event.venue}` : ""}
                    </p>
                  </div>
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
                      flexShrink: 0,
                      textDecoration: "none",
                      boxShadow: "0 0 18px rgba(245,166,35,0.35)",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--amber-glow)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "var(--amber)")}
                  >
                    Manage
                    <ChevronRight size={12} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
