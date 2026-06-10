import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, CalendarDays, MapPin, Users, ExternalLink } from "lucide-react";
import Layout from "@/components/Layout";
import api from "@/lib/api";
import type { Event } from "@/types";

const STATUS_TABS: { value: Event["status"] | "ALL"; label: string }[] = [
  { value: "PUBLISHED", label: "Open" },
  { value: "ALL",       label: "All" },
  { value: "COMPLETED", label: "Ended" },
];

function fmt(dt: string | null) {
  if (!dt) return null;
  return new Date(dt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function EventCard({ event }: { event: Event }) {
  return (
    <Link
      to={`/events/${event.slug}`}
      style={{ textDecoration: "none" }}
    >
      <div
        className="rounded-2xl overflow-hidden transition-shadow hover:shadow-lg"
        style={{ background: "var(--ink-soft)", border: "1px solid var(--seam)", cursor: "pointer" }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = "color-mix(in srgb, var(--amber) 40%, transparent)")}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--seam)")}
      >
        {event.banner_url ? (
          <img
            src={event.banner_url}
            alt={event.title}
            style={{ width: "100%", height: 130, objectFit: "cover", display: "block" }}
          />
        ) : (
          <div style={{
            height: 3,
            background: "linear-gradient(to right, var(--amber), var(--amber-glow))",
          }} />
        )}

        <div style={{ padding: "16px 18px 18px" }}>
          {event.category && (
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--amber)", marginBottom: 6 }}>
              {event.category}
            </p>
          )}
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--cream)", marginBottom: 8, lineHeight: 1.3 }}>
            {event.title}
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {event.start_datetime && (
              <p style={{ fontSize: 12, color: "var(--fog)", display: "flex", alignItems: "center", gap: 5 }}>
                <CalendarDays size={12} style={{ color: "var(--dust)", flexShrink: 0 }} />
                {fmt(event.start_datetime)}
              </p>
            )}
            {event.venue && (
              <p style={{ fontSize: 12, color: "var(--fog)", display: "flex", alignItems: "center", gap: 5 }}>
                <MapPin size={12} style={{ color: "var(--dust)", flexShrink: 0 }} />
                {event.venue}
              </p>
            )}
            {event.club_name && (
              <p style={{ fontSize: 12, color: "var(--fog)", display: "flex", alignItems: "center", gap: 5 }}>
                <Users size={12} style={{ color: "var(--dust)", flexShrink: 0 }} />
                {event.club_name}
              </p>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: 999,
                background: event.status === "PUBLISHED"
                  ? "color-mix(in srgb, var(--jade) 15%, transparent)"
                  : "color-mix(in srgb, var(--sky) 15%, transparent)",
                color: event.status === "PUBLISHED" ? "var(--jade)" : "var(--sky)",
              }}
            >
              {event.status === "PUBLISHED" ? "Open" : "Ended"}
            </span>
            <ExternalLink size={13} style={{ color: "var(--dust)" }} />
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function BrowseEvents() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Event["status"] | "ALL">("PUBLISHED");
  const [categoryFilter, setCategoryFilter] = useState("ALL");

  const { data: events = [], isLoading } = useQuery<Event[]>({
    queryKey: ["browse-events", statusFilter],
    queryFn: async () => {
      const params: Record<string, string> = { limit: "200" };
      if (statusFilter !== "ALL") params.status = statusFilter;
      return api.get<Event[]>("/events", { params }).then((r) => r.data);
    },
  });

  const categories = useMemo(() => {
    const cats = Array.from(new Set(events.map((e) => e.category).filter(Boolean) as string[])).sort();
    return ["ALL", ...cats];
  }, [events]);

  const filtered = useMemo(() => events.filter((e) => {
    const matchSearch = !search || e.title.toLowerCase().includes(search.toLowerCase()) || (e.club_name || "").toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === "ALL" || e.category === categoryFilter;
    return matchSearch && matchCat;
  }), [events, search, categoryFilter]);

  return (
    <Layout>
      <div style={{ padding: "32px 32px 48px", maxWidth: 1080, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "var(--ash)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
            Participant
          </p>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--cream)", letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <CalendarDays size={22} style={{ color: "var(--amber)" }} />
            Browse Events
          </h1>
          <p style={{ fontSize: 14, color: "var(--fog)" }}>Discover upcoming workshops, hackathons, and more.</p>
        </div>

        {/* Search */}
        <div style={{ position: "relative", marginBottom: 16 }}>
          <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--dust)", pointerEvents: "none" }} />
          <input
            type="text"
            placeholder="Search events or clubs…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              paddingLeft: 36,
              paddingRight: 16,
              paddingTop: 10,
              paddingBottom: 10,
              fontSize: 14,
              background: "var(--ink-soft)",
              border: "1px solid var(--seam)",
              borderRadius: 10,
              color: "var(--cream)",
              outline: "none",
              boxSizing: "border-box",
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--amber)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "var(--seam)"; }}
          />
        </div>

        {/* Filter bar */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24, alignItems: "center" }}>
          {/* Status tabs */}
          <div className="flex gap-1 p-0.5 rounded-lg" style={{ background: "var(--ink-muted)" }}>
            {STATUS_TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setStatusFilter(t.value)}
                className="px-3 py-1.5 rounded-md text-xs font-semibold transition-all"
                style={
                  statusFilter === t.value
                    ? { background: "var(--ink-soft)", color: "var(--cream)", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }
                    : { color: "var(--fog)" }
                }
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Category pills */}
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className="px-3 py-1 rounded-full text-xs font-semibold transition-all"
              style={{
                background: categoryFilter === cat
                  ? "var(--amber)"
                  : "var(--ink-soft)",
                color: categoryFilter === cat ? "var(--ink)" : "var(--fog)",
                border: "1px solid",
                borderColor: categoryFilter === cat ? "var(--amber)" : "var(--seam)",
              }}
            >
              {cat === "ALL" ? "All Categories" : cat}
            </button>
          ))}
        </div>

        {/* Results count */}
        {!isLoading && (
          <p style={{ fontSize: 12, color: "var(--dust)", marginBottom: 16 }}>
            {filtered.length} event{filtered.length !== 1 ? "s" : ""} found
          </p>
        )}

        {/* Grid */}
        {isLoading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-2xl" style={{ height: 240, background: "var(--ink-soft)", border: "1px solid var(--seam)" }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <CalendarDays size={32} style={{ color: "var(--seam)", margin: "0 auto 12px" }} />
            <p style={{ fontSize: 14, color: "var(--dust)" }}>No events found.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
            {filtered.map((ev) => (
              <EventCard key={ev.id} event={ev} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
