import { NavLink, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth.store";
import {
  LayoutDashboard, CalendarDays, Users, Award, Bell, LogOut,
  ChevronRight, Settings, ShieldCheck, ClipboardCheck, Megaphone,
  BarChart3, Wallet, ListChecks, Radio, KeyRound,
} from "lucide-react";
import api from "@/lib/api";
import type { Event } from "@/types";

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  exact?: boolean;
}

function getNavItems(role: string, eventId?: string): NavItem[] {
  if (role === "SUPER_ADMIN") {
    return [
      { to: "/admin",           label: "Metrics",        icon: <BarChart3 size={15} />, exact: true },
      { to: "/admin?tab=users", label: "Users",          icon: <Users size={15} /> },
      { to: "/admin?tab=clubs", label: "Clubs",          icon: <Settings size={15} /> },
      { to: "/faculty/approvals", label: "Approvals",   icon: <ShieldCheck size={15} /> },
      { to: "/dashboard",       label: "Dashboard",      icon: <LayoutDashboard size={15} /> },
    ];
  }
  if (role === "FACULTY_ADVISOR") {
    return [
      { to: "/faculty/approvals", label: "Approval Queue", icon: <ClipboardCheck size={15} /> },
    ];
  }
  if (role === "CLUB_ADMIN") {
    const base: NavItem[] = [
      { to: "/club", label: "My Events", icon: <CalendarDays size={15} />, exact: true },
    ];
    if (eventId) base.push(
      { to: `/manage/${eventId}/overview`,          label: "Overview",           icon: <BarChart3 size={15} /> },
      { to: `/manage/${eventId}/registrations`,     label: "Registrations",      icon: <ListChecks size={15} /> },
      { to: `/manage/${eventId}/attendance`,        label: "Attendance",         icon: <Radio size={15} /> },
      { to: `/manage/${eventId}/attendance-takers`, label: "Att. Credentials",   icon: <KeyRound size={15} /> },
      { to: `/manage/${eventId}/finance`,           label: "Finance",            icon: <Wallet size={15} /> },
      { to: `/manage/${eventId}/certificates`,      label: "Certificates",       icon: <Award size={15} /> },
      { to: `/manage/${eventId}/announcements`,     label: "Announcements",      icon: <Megaphone size={15} /> },
    );
    return base;
  }
  if (role === "ATTENDANCE_TEAM") {
    const base: NavItem[] = [
      { to: "/organizer", label: "Events", icon: <CalendarDays size={15} />, exact: true },
    ];
    if (eventId) base.push(
      { to: `/manage/${eventId}/attendance`, label: "Attendance", icon: <Radio size={15} /> },
    );
    return base;
  }
  return [
    { to: "/dashboard",              label: "Overview",      icon: <LayoutDashboard size={15} />, exact: true },
    { to: "/dashboard/events",       label: "My Events",     icon: <CalendarDays size={15} /> },
    { to: "/dashboard/teams",        label: "Teams",         icon: <Users size={15} /> },
    { to: "/dashboard/certificates", label: "Certificates",  icon: <Award size={15} /> },
    { to: "/dashboard/notifications",label: "Notifications", icon: <Bell size={15} /> },
  ];
}

const SECTION_LABEL: Record<string, string> = {
  SUPER_ADMIN:      "Admin",
  FACULTY_ADVISOR:  "Faculty",
  CLUB_ADMIN:       "Club Admin",
  ATTENDANCE_TEAM:  "Organiser",
  PARTICIPANT:      "Participant",
};

interface LayoutProps {
  children: React.ReactNode;
  eventId?: string;
}

export default function Layout({ children, eventId }: LayoutProps) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const role = user?.role ?? "PARTICIPANT";
  const navItems = getNavItems(role, eventId);
  const section = eventId ? "Event" : (SECTION_LABEL[role] ?? "Portal");

  const { data: eventData } = useQuery<Event>({
    queryKey: ["event", eventId],
    queryFn: () => api.get(`/events/by-id/${eventId}`).then((r) => r.data),
    enabled: !!eventId,
    staleTime: 5 * 60 * 1000,
  });

  const initials = user?.name
    ? user.name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  function handleLogout() {
    logout();
    navigate("/");
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--ink)", fontFamily: "'Outfit', sans-serif" }}>

      {/* ── Sidebar ── */}
      <aside className="w-56 shrink-0 flex flex-col h-full" style={{
        background: "var(--ink-soft)",
        borderRight: "1px solid var(--seam)",
      }}>

        {/* Logo */}
        <div className="px-5 pt-6 pb-5" style={{ borderBottom: "1px solid var(--seam)" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: "var(--amber)" }}>
              <span style={{ color: "var(--ink)", fontFamily: "'DM Serif Display', serif", fontSize: 13, fontWeight: 700, lineHeight: 1 }}>C</span>
            </div>
            <span style={{ color: "var(--cream)", fontFamily: "'DM Serif Display', serif", fontSize: 15, letterSpacing: "-0.02em" }}>
              ClubHub
            </span>
          </div>
        </div>

        {/* Section */}
        <div className="px-5 pt-5 pb-2">
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: "0.12em",
            textTransform: "uppercase", color: "var(--dust)",
          }}>{section}</span>
        </div>

        {/* Event name banner */}
        {eventId && (
          <div style={{
            margin: "0 12px 8px",
            padding: "10px 12px",
            background: "color-mix(in srgb, var(--amber) 8%, transparent)",
            border: "1px solid color-mix(in srgb, var(--amber) 25%, transparent)",
            borderRadius: 10,
          }}>
            {eventData ? (
              <p style={{
                fontSize: 13,
                fontWeight: 700,
                color: "var(--cream)",
                lineHeight: 1.3,
                wordBreak: "break-word",
              }}>
                {eventData.title}
              </p>
            ) : (
              <div style={{ height: 14, background: "var(--ink-muted)", borderRadius: 4, width: "80%" }} />
            )}
            <p style={{ fontSize: 10, color: "var(--amber)", marginTop: 3, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>
              Managing event
            </p>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto pb-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
            >
              {({ isActive }) => (
                <>
                  <span style={{ color: isActive ? "var(--amber)" : "var(--dust)", transition: "color 150ms" }}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                  {isActive && (
                    <ChevronRight size={11} className="ml-auto" style={{ color: "var(--amber-dim)" }} />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Divider */}
        <div className="mx-3 mb-2" style={{ borderTop: "1px solid var(--seam)" }} />

        {/* User footer */}
        <div className="px-3 pb-5">
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
            style={{ background: "var(--ink-muted)", border: "1px solid var(--seam)" }}>
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt={user.name}
                className="w-7 h-7 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                style={{ background: "var(--amber-dim)" }}>
                <span style={{ color: "var(--amber)", fontSize: 10, fontWeight: 700 }}>{initials}</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p style={{ color: "var(--cream)", fontSize: 12, fontWeight: 600 }} className="truncate">
                {user?.name ?? "User"}
              </p>
              <p style={{ color: "var(--fog)", fontSize: 10 }} className="truncate">
                {user?.role?.toLowerCase().replace("_", " ")}
              </p>
            </div>
            <button type="button" onClick={handleLogout}
              className="p-1 rounded transition-colors"
              style={{ color: "var(--dust)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--cinnabar)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--dust)")}
              title="Sign out">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-y-auto min-w-0 dot-grid">
        {children}
      </main>
    </div>
  );
}
