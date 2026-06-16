import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import api from "@/lib/api";
import type { Event } from "@/types";
import { EventCard } from "@/components/EventCard";
import { useAuthStore } from "@/store/auth.store";

const STATUS_OPTIONS: { value: Event["status"] | "ALL"; label: string }[] = [
  { value: "ALL",      label: "All" },
  { value: "PUBLISHED",label: "Open" },
  { value: "COMPLETED",label: "Ended" },
];

function SkeletonCard() {
  return (
    <div style={{
      background: "var(--ink-soft)", border: "1px solid var(--seam)",
      borderRadius: 14, overflow: "hidden",
    }}>
      <div style={{ height: 3, background: "var(--seam)" }} />
      <div style={{ height: 140 }} className="shimmer" />
      <div style={{ padding: "16px 18px 18px" }}>
        <div className="shimmer" style={{ height: 10, width: "40%", marginBottom: 10 }} />
        <div className="shimmer" style={{ height: 18, width: "80%", marginBottom: 6 }} />
        <div className="shimmer" style={{ height: 12, width: "60%", marginBottom: 4 }} />
        <div className="shimmer" style={{ height: 12, width: "50%" }} />
      </div>
    </div>
  );
}

export default function EventDiscovery() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
  const user = useAuthStore((s) => s.user);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<Event["status"] | "ALL">("PUBLISHED");

  const { data: events = [], isLoading, isError } = useQuery<Event[]>({
    queryKey: ["events", statusFilter],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (statusFilter !== "ALL") params.status = statusFilter;
      const res = await api.get<Event[]>("/events", { params });
      return res.data;
    },
  });

  const categories = useMemo(() => {
    const cats = Array.from(new Set(events.map((e) => e.category).filter(Boolean) as string[])).sort();
    return ["ALL", ...cats];
  }, [events]);

  const filtered = useMemo(() => events.filter((e) => {
    const matchSearch = search === "" || e.title.toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === "ALL" || e.category === categoryFilter;
    return matchSearch && matchCat;
  }), [events, search, categoryFilter]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--ink)", fontFamily: "'Outfit', sans-serif" }}>

      {/* ── Nav ── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(13,15,20,0.85)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--seam)",
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", height: 58, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link to="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--amber)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>C</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
              <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 16, color: "var(--cream)", letterSpacing: "-0.02em" }}>ClubHub</span>
              <span style={{ fontSize: 9, color: "var(--fog)", letterSpacing: "0.04em", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                <img src="https://upload.wikimedia.org/wikipedia/en/e/eb/PSG_College_of_Technology_logo.png" alt="PSG Tech" style={{ height: 10, width: "auto", opacity: 0.7 }} />
                PSG College of Technology
              </span>
            </div>
          </Link>
          <nav style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {isAuthenticated ? (
              <>
                <span className="hidden sm:inline" style={{ fontSize: 13, color: "var(--fog)" }}>{user?.name}</span>
                <Link to="/dashboard" className="btn-primary" style={{ textDecoration: "none", fontSize: 13 }}>
                  Dashboard
                </Link>
              </>
            ) : (
              <Link to="/login" className="btn-primary" style={{ textDecoration: "none", fontSize: 13 }}>
                Sign In
              </Link>
            )}
          </nav>
        </div>
      </header>

      {/* ── Hero ── */}
      <section style={{ padding: "72px 24px 48px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        {/* Radial glow */}
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%, -60%)",
          width: 600, height: 300,
          background: "radial-gradient(ellipse, rgba(245,166,35,0.08) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        <p className="animate-fade-up" style={{
          fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase",
          color: "var(--amber)", marginBottom: 16,
        }}>
          College Event Platform
        </p>
        <h1 className="animate-fade-up delay-100" style={{
          fontFamily: "'DM Serif Display', serif",
          fontSize: "clamp(36px, 6vw, 64px)",
          color: "var(--cream)",
          lineHeight: 1.1,
          letterSpacing: "-0.03em",
          marginBottom: 16,
        }}>
          Discover what's<br /><em style={{ color: "var(--amber)" }}>happening</em> on campus.
        </h1>
        <p className="animate-fade-up delay-200" style={{ fontSize: 15, color: "var(--fog)", maxWidth: 440, margin: "0 auto 36px" }}>
          Workshops, hackathons, cultural events — register in seconds, show up and make memories.
        </p>

        {/* Search */}
        <div className="animate-fade-up delay-300" style={{ maxWidth: 520, margin: "0 auto", position: "relative" }}>
          <Search size={16} style={{
            position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)",
            color: "var(--dust)", pointerEvents: "none",
          }} />
          <input
            type="text"
            placeholder="Search events…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field"
            style={{ paddingLeft: 44, paddingRight: 16, paddingTop: 13, paddingBottom: 13, fontSize: 14 }}
          />
        </div>
      </section>

      {/* ── Filter bar ── */}
      <section style={{ padding: "0 24px 28px", maxWidth: 1200, margin: "0 auto" }}>
        <div className="animate-fade-in delay-300" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "center" }}>
          {/* Status pills */}
          {STATUS_OPTIONS.map((opt) => (
            <button key={opt.value} type="button"
              onClick={() => setStatusFilter(opt.value)}
              style={{
                fontSize: 12, fontWeight: 600, padding: "6px 16px", borderRadius: 99,
                border: `1px solid ${statusFilter === opt.value ? "var(--amber)" : "var(--seam)"}`,
                background: statusFilter === opt.value ? "rgba(245,166,35,0.12)" : "transparent",
                color: statusFilter === opt.value ? "var(--amber)" : "var(--fog)",
                cursor: "pointer", transition: "all 150ms",
              }}>
              {opt.label}
            </button>
          ))}

          {/* Category pills */}
          {categories.filter((c) => c !== "ALL").map((cat) => (
            <button key={cat} type="button"
              onClick={() => setCategoryFilter(categoryFilter === cat ? "ALL" : cat)}
              style={{
                fontSize: 12, fontWeight: 600, padding: "6px 16px", borderRadius: 99,
                border: `1px solid ${categoryFilter === cat ? "var(--sky)" : "var(--seam)"}`,
                background: categoryFilter === cat ? "rgba(59,158,245,0.12)" : "transparent",
                color: categoryFilter === cat ? "var(--sky)" : "var(--fog)",
                cursor: "pointer", transition: "all 150ms",
              }}>
              {cat}
            </button>
          ))}
        </div>
      </section>

      {/* ── Grid ── */}
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px 72px" }}>
        {isError && (
          <p style={{ textAlign: "center", color: "var(--cinnabar)", padding: "40px 0" }}>
            Failed to load events.
          </p>
        )}

        {isLoading ? (
          <div style={{ display: "grid", gap: 20, gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
            {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "72px 0" }}>
            <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, color: "var(--dust)", marginBottom: 8 }}>
              No events found
            </p>
            <p style={{ fontSize: 13, color: "var(--fog)" }}>Try adjusting your search or filters.</p>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 12, color: "var(--fog)", marginBottom: 20 }}>
              {filtered.length} event{filtered.length !== 1 ? "s" : ""}
            </p>
            <div style={{ display: "grid", gap: 20, gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
              {filtered.map((event, i) => (
                <div key={event.id} style={{ animationDelay: `${Math.min(i * 40, 400)}ms` }}>
                  <EventCard event={event} />
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      {/* ── Footer ── */}
      <footer style={{
        borderTop: "1px solid var(--seam)",
        padding: "24px",
        marginTop: 48,
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <img src="https://upload.wikimedia.org/wikipedia/en/e/eb/PSG_College_of_Technology_logo.png" alt="PSG Tech" style={{ height: 32, width: "auto", opacity: 0.85 }} />
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--cream)", margin: 0 }}>PSG College of Technology</p>
              <p style={{ fontSize: 10, color: "var(--fog)", margin: "2px 0 0" }}>Peelamedu, Coimbatore – 641 004</p>
            </div>
          </div>
          <p style={{ fontSize: 11, color: "var(--dust)", textAlign: "center", margin: 0 }}>
            © All rights reserved · PSG Tech Students' Union
          </p>
          <p style={{ fontSize: 10, color: "var(--dust)", margin: 0 }}>
            Developed by Dinesh T M (23Z320)
          </p>
        </div>
      </footer>
    </div>
  );
}
