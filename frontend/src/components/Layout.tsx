import { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth.store";
import {
  LayoutDashboard, CalendarDays, Users, Award, Bell, LogOut,
  ChevronRight, Settings, ShieldCheck, ClipboardCheck, Megaphone,
  BarChart3, Wallet, ListChecks, Radio, KeyRound, Building2,
  Menu, X,
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
      { to: "/admin",              label: "Metrics",        icon: <BarChart3 size={15} />, exact: true },
      { to: "/admin?tab=analytics",label: "Club Analytics", icon: <Building2 size={15} /> },
      { to: "/admin?tab=users",    label: "Users",          icon: <Users size={15} /> },
      { to: "/admin?tab=clubs",    label: "Club Setup",     icon: <Settings size={15} /> },
      { to: "/faculty/approvals",  label: "Approvals",      icon: <ShieldCheck size={15} /> },
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
    { to: "/",                       label: "Browse Events", icon: <CalendarDays size={15} />, exact: true },
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
  const [mobileOpen, setMobileOpen] = useState(false);

  const { data: eventData } = useQuery<Event>({
    queryKey: ["event", eventId],
    queryFn: () => api.get(`/events/by-id/${eventId}`).then((r) => r.data),
    enabled: !!eventId,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    document.body.classList.toggle("drawer-open", mobileOpen);
    return () => { document.body.classList.remove("drawer-open"); };
  }, [mobileOpen]);

  const initials = user?.name
    ? user.name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  function handleLogout() {
    logout();
    navigate("/");
  }

  function SidebarContents({ onNavClick }: { onNavClick?: () => void }) {
    return (
      <>
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
              onClick={onNavClick}
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
      </>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden relative" style={{ background: "var(--ink)", fontFamily: "'Outfit', sans-serif" }}>

      {/* ── Desktop Sidebar (hidden on mobile) ── */}
      <aside className="hidden md:flex md:w-56 md:shrink-0 flex-col h-full" style={{
        background: "var(--ink-soft)",
        borderRight: "1px solid var(--seam)",
      }}>
        {/* Logo */}
        <div className="px-5 pt-6 pb-5" style={{ borderBottom: "1px solid var(--seam)" }}>
          <div className="flex items-center gap-2">
            <div style={{ background: "#ffffff", borderRadius: 5, padding: "2px 5px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <img src="https://upload.wikimedia.org/wikipedia/en/e/eb/PSG_College_of_Technology_logo.png" alt="PSG College of Technology" style={{ height: 18, width: "auto", display: "block" }} />
            </div>
            <span style={{ color: "var(--cream)", fontFamily: "'DM Serif Display', serif", fontSize: 15, letterSpacing: "-0.02em" }}>
              PSG Tech
            </span>
            <span style={{ color: "var(--seam)", fontSize: 16, fontWeight: 200, margin: "0 1px" }}>|</span>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: "var(--amber)" }}>
              <span style={{ color: "var(--ink)", fontFamily: "'DM Serif Display', serif", fontSize: 13, fontWeight: 700, lineHeight: 1 }}>C</span>
            </div>
            <span style={{ color: "var(--cream)", fontFamily: "'DM Serif Display', serif", fontSize: 15, letterSpacing: "-0.02em" }}>
              ClubHub
            </span>
          </div>
        </div>

        <SidebarContents />
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-y-auto min-w-0 dot-grid">
        {/* Mobile top bar */}
        <div className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4"
          style={{
            height: 52,
            background: "var(--ink-soft)",
            borderBottom: "1px solid var(--seam)",
          }}>
          <div className="flex items-center gap-2">
            <div style={{ background: "#ffffff", borderRadius: 5, padding: "2px 4px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <img src="https://upload.wikimedia.org/wikipedia/en/e/eb/PSG_College_of_Technology_logo.png" alt="PSG College of Technology" style={{ height: 16, width: "auto", display: "block" }} />
            </div>
            <span style={{ color: "var(--cream)", fontFamily: "'DM Serif Display', serif", fontSize: 13, letterSpacing: "-0.02em" }}>PSG Tech</span>
            <span style={{ color: "var(--seam)", fontSize: 14, fontWeight: 200, margin: "0 1px" }}>|</span>
            <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
              style={{ background: "var(--amber)" }}>
              <span style={{ color: "var(--ink)", fontFamily: "'DM Serif Display', serif", fontSize: 11, fontWeight: 700, lineHeight: 1 }}>C</span>
            </div>
            <span style={{ color: "var(--cream)", fontFamily: "'DM Serif Display', serif", fontSize: 14, letterSpacing: "-0.02em" }}>ClubHub</span>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex items-center justify-center rounded-lg transition-colors"
            style={{ color: "var(--dust)", minHeight: 44, minWidth: 44 }}
            aria-label="Open navigation"
          >
            <Menu size={20} />
          </button>
        </div>

        {children}

        {/* ── Page footer ── */}
        <footer style={{
          borderTop: "1px solid var(--seam)",
          padding: "16px 24px",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <img src="https://upload.wikimedia.org/wikipedia/en/e/eb/PSG_College_of_Technology_logo.png" alt="PSG Tech" style={{ height: 22, width: "auto", opacity: 0.8 }} />
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: "var(--fog)", margin: 0 }}>PSG College of Technology</p>
              <p style={{ fontSize: 9, color: "var(--dust)", margin: 0 }}>© All rights reserved · PSG Tech Students' Union</p>
            </div>
          </div>
          <p style={{ fontSize: 9, color: "var(--dust)", margin: 0 }}>
            Developed by Dinesh T M (23Z320)
          </p>
        </footer>
      </main>

      {/* ── Mobile drawer backdrop ── */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(2px)" }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Mobile drawer panel ── */}
      <aside
        className="md:hidden fixed inset-y-0 left-0 z-50 w-64 flex flex-col h-full"
        style={{
          background: "var(--ink-soft)",
          borderRight: "1px solid var(--seam)",
          transform: mobileOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 250ms cubic-bezier(.22,.68,0,1.2)",
        }}
      >
        {/* Drawer header with logo + close */}
        <div className="flex items-center justify-between px-5 pt-5 pb-5" style={{ borderBottom: "1px solid var(--seam)" }}>
          <div className="flex items-center gap-2">
            <div style={{ background: "#ffffff", borderRadius: 5, padding: "2px 5px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <img src="https://upload.wikimedia.org/wikipedia/en/e/eb/PSG_College_of_Technology_logo.png" alt="PSG College of Technology" style={{ height: 18, width: "auto", display: "block" }} />
            </div>
            <span style={{ color: "var(--cream)", fontFamily: "'DM Serif Display', serif", fontSize: 15, letterSpacing: "-0.02em" }}>PSG Tech</span>
            <span style={{ color: "var(--seam)", fontSize: 16, fontWeight: 200, margin: "0 1px" }}>|</span>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: "var(--amber)" }}>
              <span style={{ color: "var(--ink)", fontFamily: "'DM Serif Display', serif", fontSize: 13, fontWeight: 700, lineHeight: 1 }}>C</span>
            </div>
            <span style={{ color: "var(--cream)", fontFamily: "'DM Serif Display', serif", fontSize: 15, letterSpacing: "-0.02em" }}>ClubHub</span>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="flex items-center justify-center rounded-lg transition-colors"
            style={{ color: "var(--dust)", minHeight: 36, minWidth: 36 }}
            aria-label="Close navigation"
          >
            <X size={16} />
          </button>
        </div>

        <SidebarContents onNavClick={() => setMobileOpen(false)} />
      </aside>
    </div>
  );
}
