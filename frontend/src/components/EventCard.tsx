import { Link } from "react-router-dom";
import { MapPin, Calendar, Users, GraduationCap } from "lucide-react";
import type { DeptCode, Event } from "@/types";
import { fmtDateTimeMedIST } from "@/lib/dateIST";

interface EventCardProps {
  event: Event;
  deptCodes?: DeptCode[];
}

// Deterministic hue from event id — gives each card a unique accent line
function hueFromSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) { h = (h << 5) - h + seed.charCodeAt(i); h |= 0; }
  return Math.abs(h) % 360;
}

const STATUS_LABEL: Record<Event["status"], string> = {
  PUBLISHED:        "Open",
  COMPLETED:        "Ended",
  DRAFT:            "Draft",
  PENDING_APPROVAL: "Pending",
  ARCHIVED:         "Archived",
};

export function EventCard({ event, deptCodes = [] }: EventCardProps) {
  const hue = hueFromSeed(event.id);
  const accentColor = `hsl(${hue} 70% 62%)`;

  const eligibilityLabel = (() => {
    if (!event.allowed_departments || event.allowed_departments.length === 0) return null;
    const labels = event.allowed_departments.map((code) => {
      const found = deptCodes.find((d) => d.code === code);
      return found ? found.label : code;
    });
    if (labels.length <= 2) return labels.join(", ");
    return `${labels.slice(0, 2).join(", ")} +${labels.length - 2} more`;
  })();

  return (
    <Link to={`/events/${event.slug}`} className="group block animate-fade-up">
      <article style={{
        background: "var(--ink-soft)",
        border: "1px solid var(--seam)",
        borderRadius: 14,
        overflow: "hidden",
        transition: "border-color 200ms, transform 200ms, box-shadow 200ms",
        position: "relative",
      }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = accentColor;
          (e.currentTarget as HTMLElement).style.transform = "translateY(-3px)";
          (e.currentTarget as HTMLElement).style.boxShadow = `0 12px 32px -8px ${accentColor}30`;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = "var(--seam)";
          (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
          (e.currentTarget as HTMLElement).style.boxShadow = "none";
        }}
      >
        {/* Accent line top */}
        <div style={{ height: 3, background: accentColor }} />

        {/* Banner or abstract fill */}
        <div style={{ height: 140, position: "relative", overflow: "hidden" }}>
          {event.banner_url ? (
            <img src={event.banner_url} alt={event.title}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          ) : (
            <div style={{
              width: "100%", height: "100%",
              background: `radial-gradient(ellipse at 20% 50%, hsl(${hue} 55% 22%) 0%, var(--ink-muted) 70%)`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{
                fontFamily: "'DM Serif Display', serif",
                fontSize: 56, fontStyle: "italic",
                color: `hsl(${hue} 55% 40%)`,
                userSelect: "none", letterSpacing: "-0.04em",
              }}>
                {event.title.slice(0, 2)}
              </span>
            </div>
          )}
          {/* Status + team badge */}
          <div style={{ position: "absolute", top: 10, right: 10, display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
              padding: "3px 8px", borderRadius: 99, backdropFilter: "blur(8px)",
              background: "rgba(13,15,20,0.75)",
              color: event.status === "PUBLISHED" ? "var(--jade)" : "var(--fog)",
              border: `1px solid ${event.status === "PUBLISHED" ? "var(--jade-dim)" : "var(--seam)"}`,
            }}>
              {STATUS_LABEL[event.status]}
            </span>
            {event.is_team_event && (
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
                padding: "3px 8px", borderRadius: 99,
                background: `hsl(${hue} 55% 22%)`, color: accentColor,
                border: `1px solid ${accentColor}40`,
                display: "flex", alignItems: "center", gap: 4,
              }}>
                <Users size={9} />
                {event.team_min_size}–{event.team_max_size}
              </span>
            )}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "16px 18px 18px" }}>
          {event.category && (
            <p style={{
              fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
              color: accentColor, marginBottom: 6,
            }}>{event.category}</p>
          )}
          <h3 style={{
            fontFamily: "'DM Serif Display', serif", fontSize: 17, lineHeight: 1.3,
            color: "var(--cream)", marginBottom: 10,
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
          }}>
            {event.title}
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {event.venue && (
              <span style={{ fontSize: 12, color: "var(--fog)", display: "flex", alignItems: "center", gap: 5 }}>
                <MapPin size={11} style={{ color: "var(--dust)", shrink: 0 }} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{event.venue}</span>
              </span>
            )}
            {event.start_datetime && (
              <span style={{ fontSize: 12, color: "var(--fog)", display: "flex", alignItems: "center", gap: 5 }}>
                <Calendar size={11} style={{ color: "var(--dust)" }} />
                {fmtDateTimeMedIST(event.start_datetime)}
              </span>
            )}
            {event.club_name && (
              <span style={{ fontSize: 11, color: "var(--dust)", marginTop: 2 }}>
                by {event.club_name}
              </span>
            )}
            {eligibilityLabel && (
              <span style={{
                fontSize: 10, color: "var(--fog)", display: "flex", alignItems: "center", gap: 4,
                marginTop: 2,
              }}>
                <GraduationCap size={10} style={{ color: "var(--dust)", flexShrink: 0 }} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  Open to: {eligibilityLabel}
                </span>
              </span>
            )}
          </div>

          <div style={{
            marginTop: 14, padding: "8px 0 0",
            borderTop: "1px solid var(--seam)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <span style={{ fontSize: 11, color: "var(--dust)" }}>
              {event.max_participants ? `${event.max_participants} seats` : "Unlimited seats"}
            </span>
            <span style={{
              fontSize: 12, fontWeight: 600, color: accentColor,
              display: "flex", alignItems: "center", gap: 4,
            }} className="group-hover:gap-2 transition-all">
              View & Register →
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}

export default EventCard;
