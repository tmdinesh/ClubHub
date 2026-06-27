import { useState } from "react";
import type React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line, Cell,
} from "recharts";
import {
  BarChart3, Users, CalendarDays, Ticket, TrendingUp,
  Plus, Pencil, Check, X, ChevronDown, Loader2,
  Building2, ChevronRight, Activity, Download, FileSpreadsheet,
  GraduationCap, Trash2, ShieldAlert,
} from "lucide-react";
import Layout from "@/components/Layout";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import type { Club, DeptCode } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ClubSummary {
  club_id: string;
  club_name: string;
  department: string | null;
  total_events: number;
  published_events: number;
  total_registrations: number;
  events: ClubEvent[];
}

interface ClubEvent {
  id: string;
  title: string;
  status: string;
  start_datetime: string | null;
  category: string | null;
  participants?: number;
  spent?: number;
  nps?: number | null;
}

interface ClubDetail {
  club_id: string;
  club_name?: string;
  total_events: number;
  total_participants: number;
  total_spent: number;
  events: ClubEvent[];
}

interface PlatformAnalytics {
  total_events: number;
  total_users: number;
  total_registrations: number;
}

interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: string;
  club_id: string | null;
  is_active: boolean;
}

const ALL_ROLES = [
  "PARTICIPANT",
  "ATTENDANCE_TEAM",
  "CLUB_ADMIN",
  "FACULTY_ADVISOR",
  "SUPER_ADMIN",
];

const TREND_DATA = [
  { month: "Jan", events: 4, users: 38, registrations: 120 },
  { month: "Feb", events: 6, users: 55, registrations: 180 },
  { month: "Mar", events: 8, users: 82, registrations: 270 },
  { month: "Apr", events: 5, users: 60, registrations: 200 },
  { month: "May", events: 11, users: 140, registrations: 420 },
  { month: "Jun", events: 9, users: 110, registrations: 340 },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function BigStat({ value, label, icon, iconColor, accentColor }: {
  value: string | number; label: string; icon: React.ReactNode; iconColor: string; accentColor: string;
}) {
  return (
    <div className="rounded-2xl p-6 relative overflow-hidden" style={{ background: "var(--ink-soft)", border: "1px solid var(--seam)" }}>
      <div
        className="absolute top-0 right-0 w-24 h-24 rounded-full -translate-y-8 translate-x-8 opacity-10"
        style={{ background: accentColor }}
      />
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 relative z-10"
        style={{ background: `color-mix(in srgb, ${accentColor} 15%, transparent)` }}
      >
        <span style={{ color: iconColor }}>{icon}</span>
      </div>
      <p className="text-4xl font-bold tracking-tight mb-1 relative z-10" style={{ color: "var(--cream)" }}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      <p className="text-sm font-medium relative z-10" style={{ color: "var(--fog)" }}>{label}</p>
    </div>
  );
}

// ── Platform Metrics tab ──────────────────────────────────────────────────────

function MetricsTab() {
  const { data, isLoading } = useQuery<PlatformAnalytics>({
    queryKey: ["analytics", "platform"],
    queryFn: () => api.get("/analytics/platform").then((r) => r.data),
  });

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl p-6 animate-pulse h-36" style={{ background: "var(--ink-soft)", border: "1px solid var(--seam)" }} />
          ))
        ) : (
          <>
            <BigStat value={data?.total_events ?? 0} label="Total Events" icon={<CalendarDays size={20} />} iconColor="#F5A623" accentColor="#F5A623" />
            <BigStat value={data?.total_users ?? 0} label="Registered Users" icon={<Users size={20} />} iconColor="#3DD68C" accentColor="#3DD68C" />
            <BigStat value={data?.total_registrations ?? 0} label="Total Registrations" icon={<Ticket size={20} />} iconColor="#F5A623" accentColor="#F5A623" />
          </>
        )}
      </div>
      <div className="rounded-2xl p-6" style={{ background: "var(--ink-soft)", border: "1px solid var(--seam)" }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--fog)" }}>
            <TrendingUp size={15} style={{ color: "var(--amber)" }} />
            Platform Activity Trend
          </h2>
          <span
            className="text-xs px-2 py-1 rounded-full"
            style={{ color: "var(--dust)", background: "var(--ink-muted)", border: "1px solid var(--seam)" }}
          >
            Sample data
          </span>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={TREND_DATA} margin={{ top: 0, right: 0, bottom: 0, left: -15 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2A3040" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#7A8699" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#7A8699" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: "#161A23", border: "1px solid #2A3040", color: "#F5F0E8", borderRadius: 10, fontSize: 12 }} />
            <Bar dataKey="registrations" name="Registrations" fill="#F5A623" radius={[4, 4, 0, 0]} />
            <Bar dataKey="users" name="New Users" fill="#7A5210" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── User Management tab ───────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  background: "var(--ink-muted)",
  border: "1px solid var(--seam)",
  color: "var(--cream)",
};

function focusInput(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = "var(--amber)";
  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(245,166,35,0.12)";
  e.currentTarget.style.outline = "none";
}

function blurInput(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = "var(--seam)";
  e.currentTarget.style.boxShadow = "none";
}

function UserManagementTab({ clubs }: { clubs: Club[] }) {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState("");
  const [newUser, setNewUser] = useState({ email: "", name: "", role: "CLUB_ADMIN", club_id: "" });

  const { data: users, isLoading } = useQuery<UserRecord[]>({
    queryKey: ["admin", "users"],
    queryFn: () => api.get("/admin/users").then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (body: object) => api.post("/admin/users", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      setShowCreate(false);
      setNewUser({ email: "", name: "", role: "CLUB_ADMIN", club_id: "" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: string; role?: string; club_id?: string | null }) =>
      api.patch(`/admin/users/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      setEditingId(null);
    },
  });

  function startEdit(u: UserRecord) {
    setEditingId(u.id);
    setEditRole(u.role);
  }

  function saveEdit(id: string) {
    updateMutation.mutate({ id, role: editRole });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-base font-semibold" style={{ color: "var(--cream)" }}>All Users</h2>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
          style={{ background: "var(--amber)", color: "var(--ink)" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--amber-glow)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "var(--amber)")}
        >
          <Plus size={14} />
          Create User
        </button>
      </div>

      {showCreate && (
        <div className="rounded-xl p-5" style={{ background: "var(--ink-soft)", border: "1px solid var(--seam)" }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--fog)" }}>New User</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="email"
              placeholder="Email *"
              value={newUser.email}
              onChange={(e) => setNewUser((p) => ({ ...p, email: e.target.value }))}
              className="text-sm px-3 py-2 rounded-lg"
              style={inputStyle}
              onFocus={focusInput}
              onBlur={blurInput}
            />
            <input
              type="text"
              placeholder="Full name *"
              value={newUser.name}
              onChange={(e) => setNewUser((p) => ({ ...p, name: e.target.value }))}
              className="text-sm px-3 py-2 rounded-lg"
              style={inputStyle}
              onFocus={focusInput}
              onBlur={blurInput}
            />
            <select
              value={newUser.role}
              onChange={(e) => setNewUser((p) => ({ ...p, role: e.target.value }))}
              className="text-sm px-3 py-2 rounded-lg"
              style={inputStyle}
              onFocus={focusInput}
              onBlur={blurInput}
            >
              {ALL_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            {newUser.role === "CLUB_ADMIN" && (
              <select
                value={newUser.club_id}
                onChange={(e) => setNewUser((p) => ({ ...p, club_id: e.target.value }))}
                className="text-sm px-3 py-2 rounded-lg"
                style={inputStyle}
                onFocus={focusInput}
                onBlur={blurInput}
              >
                <option value="">Assign to club…</option>
                {clubs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="text-sm px-3 py-1.5 rounded-lg transition-colors"
              style={{ color: "var(--ash)", border: "1px solid var(--seam)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--ink-muted)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => createMutation.mutate({ ...newUser, club_id: newUser.club_id || null })}
              disabled={!newUser.email || !newUser.name || createMutation.isPending}
              className="flex items-center gap-1.5 text-sm font-semibold px-4 py-1.5 rounded-lg disabled:opacity-50 transition-colors"
              style={{ background: "var(--amber)", color: "var(--ink)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--amber-glow)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "var(--amber)")}
            >
              {createMutation.isPending && <Loader2 size={13} className="animate-spin" />}
              Create
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl overflow-hidden" style={{ background: "var(--ink-soft)", border: "1px solid var(--seam)" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--ink-muted)", borderBottom: "1px solid var(--seam)" }}>
                {["Name", "Email", "Role", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--dust)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse" style={{ borderBottom: "1px solid var(--seam)" }}>
                    {Array.from({ length: 4 }).map((_, j) => (
                      <td key={j} className="px-4 py-3.5"><div className="h-4 rounded w-24" style={{ background: "var(--ink-muted)" }} /></td>
                    ))}
                  </tr>
                ))
              ) : users?.map((u) => {
                const isEditing = editingId === u.id;
                return (
                  <tr
                    key={u.id}
                    className="transition-colors"
                    style={{ borderBottom: "1px solid var(--seam)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "color-mix(in srgb, var(--cream) 3%, transparent)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td className="px-4 py-3.5 font-medium" style={{ color: "var(--cream)" }}>{u.name}</td>
                    <td className="px-4 py-3.5 font-mono text-xs" style={{ color: "var(--fog)" }}>{u.email}</td>
                    <td className="px-4 py-3.5">
                      {isEditing ? (
                        <select
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value)}
                          className="text-xs px-2 py-1 rounded"
                          style={{ background: "var(--ink-muted)", border: "1px solid var(--seam)", color: "var(--cream)" }}
                        >
                          {ALL_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                      ) : (
                        <span
                          className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{
                            background: "color-mix(in srgb, var(--amber) 15%, transparent)",
                            color: "var(--amber)",
                          }}
                        >
                          {u.role}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      {isEditing ? (
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => saveEdit(u.id)}
                            disabled={updateMutation.isPending}
                            className="p-1 rounded transition-colors"
                            style={{ color: "var(--jade)" }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "color-mix(in srgb, var(--jade) 12%, transparent)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          >
                            {updateMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="p-1 rounded transition-colors"
                            style={{ color: "var(--ash)" }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--ink-muted)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEdit(u)}
                          className="p-1 rounded transition-colors"
                          style={{ color: "var(--ash)" }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = "var(--amber)";
                            e.currentTarget.style.background = "color-mix(in srgb, var(--amber) 10%, transparent)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = "var(--ash)";
                            e.currentTarget.style.background = "transparent";
                          }}
                        >
                          <Pencil size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Club Setup tab ────────────────────────────────────────────────────────────

function ClubSetupTab({ clubs }: { clubs: Club[]; }) {
  const qc = useQueryClient();
  const [editingClubId, setEditingClubId] = useState<string | null>(null);
  const [selectedAdvisorId, setSelectedAdvisorId] = useState<string>("");
  const [editingAdminClubId, setEditingAdminClubId] = useState<string | null>(null);
  const [selectedAdminId, setSelectedAdminId] = useState<string>("");
  const [showCreate, setShowCreate] = useState(false);
  const [newClub, setNewClub] = useState({ name: "", description: "", department: "" });

  const { data: advisors } = useQuery<UserRecord[]>({
    queryKey: ["admin", "users", "FACULTY_ADVISOR"],
    queryFn: () => api.get("/admin/users", { params: { role: "FACULTY_ADVISOR" } }).then((r) => r.data),
  });

  const { data: clubAdmins } = useQuery<UserRecord[]>({
    queryKey: ["admin", "users", "CLUB_ADMIN"],
    queryFn: () => api.get("/admin/users", { params: { role: "CLUB_ADMIN" } }).then((r) => r.data),
  });

  const createClubMutation = useMutation({
    mutationFn: (body: object) => api.post("/clubs", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "clubs"] });
      qc.invalidateQueries({ queryKey: ["clubs"] });
      setShowCreate(false);
      setNewClub({ name: "", description: "", department: "" });
    },
  });

  const updateClubMutation = useMutation({
    mutationFn: ({ clubId, faculty_advisor_id }: { clubId: string; faculty_advisor_id: string | null }) =>
      api.patch(`/admin/clubs/${clubId}`, { faculty_advisor_id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "clubs"] });
      setEditingClubId(null);
    },
  });

  const assignAdminMutation = useMutation({
    mutationFn: ({ userId, clubId }: { userId: string; clubId: string | null }) =>
      api.patch(`/admin/users/${userId}`, { club_id: clubId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users", "CLUB_ADMIN"] });
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      setEditingAdminClubId(null);
    },
  });

  function startEditClub(club: Club) {
    setEditingClubId(club.id);
    setSelectedAdvisorId(club.faculty_advisor_id ?? "");
  }

  function startEditAdmin(club: Club) {
    setEditingAdminClubId(club.id);
    const currentAdmin = clubAdmins?.find((u) => u.club_id === club.id);
    setSelectedAdminId(currentAdmin?.id ?? "");
  }

  function saveAdmin(clubId: string) {
    // If a new admin is selected, assign them to this club
    if (selectedAdminId) {
      // First unassign any existing admin for this club (set their club_id to null)
      const prevAdmin = clubAdmins?.find((u) => u.club_id === clubId && u.id !== selectedAdminId);
      if (prevAdmin) {
        api.patch(`/admin/users/${prevAdmin.id}`, { club_id: null });
      }
      assignAdminMutation.mutate({ userId: selectedAdminId, clubId });
    } else {
      // Removing admin — unassign current admin
      const prevAdmin = clubAdmins?.find((u) => u.club_id === clubId);
      if (prevAdmin) {
        assignAdminMutation.mutate({ userId: prevAdmin.id, clubId: null });
      } else {
        setEditingAdminClubId(null);
      }
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold" style={{ color: "var(--cream)" }}>Clubs</h2>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
          style={{ background: "var(--amber)", color: "var(--ink)" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--amber-glow)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "var(--amber)")}
        >
          <Plus size={14} />
          Create Club
        </button>
      </div>

      {showCreate && (
        <div className="rounded-xl p-5" style={{ background: "var(--ink-soft)", border: "1px solid var(--seam)" }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--fog)" }}>New Club</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="Club name *"
              value={newClub.name}
              onChange={(e) => setNewClub((p) => ({ ...p, name: e.target.value }))}
              className="text-sm px-3 py-2 rounded-lg"
              style={inputStyle}
              onFocus={focusInput}
              onBlur={blurInput}
            />
            <input
              type="text"
              placeholder="Department (e.g. CSE)"
              value={newClub.department}
              onChange={(e) => setNewClub((p) => ({ ...p, department: e.target.value }))}
              className="text-sm px-3 py-2 rounded-lg"
              style={inputStyle}
              onFocus={focusInput}
              onBlur={blurInput}
            />
            <input
              type="text"
              placeholder="Description (optional)"
              value={newClub.description}
              onChange={(e) => setNewClub((p) => ({ ...p, description: e.target.value }))}
              className="text-sm px-3 py-2 rounded-lg"
              style={inputStyle}
              onFocus={focusInput}
              onBlur={blurInput}
            />
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="text-sm px-3 py-1.5 rounded-lg transition-colors"
              style={{ color: "var(--ash)", border: "1px solid var(--seam)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--ink-muted)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => createClubMutation.mutate({
                name: newClub.name,
                description: newClub.description || null,
                department: newClub.department || null,
              })}
              disabled={!newClub.name.trim() || createClubMutation.isPending}
              className="flex items-center gap-1.5 text-sm font-semibold px-4 py-1.5 rounded-lg disabled:opacity-50 transition-colors"
              style={{ background: "var(--amber)", color: "var(--ink)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--amber-glow)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "var(--amber)")}
            >
              {createClubMutation.isPending && <Loader2 size={13} className="animate-spin" />}
              Create
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl overflow-hidden" style={{ background: "var(--ink-soft)", border: "1px solid var(--seam)" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--ink-muted)", borderBottom: "1px solid var(--seam)" }}>
                {["Club", "Department", "Club Admin", "Faculty Advisor", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--dust)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clubs.map((club) => {
                const advisorName = advisors?.find((a) => a.id === club.faculty_advisor_id)?.name;
                const currentAdmin = clubAdmins?.find((u) => u.club_id === club.id);
                const isEditing = editingClubId === club.id;
                const isEditingAdmin = editingAdminClubId === club.id;
                return (
                  <tr
                    key={club.id}
                    className="transition-colors"
                    style={{ borderBottom: "1px solid var(--seam)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "color-mix(in srgb, var(--cream) 3%, transparent)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td className="px-4 py-3.5 font-medium" style={{ color: "var(--cream)" }}>{club.name}</td>
                    <td className="px-4 py-3.5 text-xs" style={{ color: "var(--fog)" }}>{club.department ?? "—"}</td>
                    <td className="px-4 py-3.5">
                      {isEditingAdmin ? (
                        <div className="flex items-center gap-1.5">
                          <select
                            value={selectedAdminId}
                            onChange={(e) => setSelectedAdminId(e.target.value)}
                            className="text-sm px-2 py-1.5 rounded min-w-[200px]"
                            style={{ background: "var(--ink-muted)", border: "1px solid var(--seam)", color: "var(--cream)" }}
                          >
                            <option value="">No admin</option>
                            {clubAdmins?.map((a) => (
                              <option key={a.id} value={a.id}>{a.name} ({a.email})</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => saveAdmin(club.id)}
                            disabled={assignAdminMutation.isPending}
                            className="p-1 rounded transition-colors"
                            style={{ color: "var(--jade)" }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "color-mix(in srgb, var(--jade) 12%, transparent)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          >
                            {assignAdminMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingAdminClubId(null)}
                            className="p-1 rounded transition-colors"
                            style={{ color: "var(--ash)" }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--ink-muted)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : currentAdmin ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium" style={{ color: "var(--fog)" }}>{currentAdmin.name}</span>
                          <button
                            type="button"
                            onClick={() => startEditAdmin(club)}
                            className="p-1 rounded transition-colors"
                            style={{ color: "var(--ash)" }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = "var(--amber)";
                              e.currentTarget.style.background = "color-mix(in srgb, var(--amber) 10%, transparent)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = "var(--ash)";
                              e.currentTarget.style.background = "transparent";
                            }}
                          >
                            <Pencil size={13} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEditAdmin(club)}
                          className="text-xs px-2 py-0.5 rounded-full transition-colors"
                          style={{
                            background: "color-mix(in srgb, var(--sky) 15%, transparent)",
                            color: "var(--sky)",
                            border: "1px solid color-mix(in srgb, var(--sky) 30%, transparent)",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
                          onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                        >
                          Assign Admin
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      {isEditing ? (
                        <select
                          value={selectedAdvisorId}
                          onChange={(e) => setSelectedAdvisorId(e.target.value)}
                          className="text-sm px-2 py-1.5 rounded min-w-[200px]"
                          style={{ background: "var(--ink-muted)", border: "1px solid var(--seam)", color: "var(--cream)" }}
                        >
                          <option value="">No advisor</option>
                          {advisors?.map((a) => (
                            <option key={a.id} value={a.id}>{a.name} ({a.email})</option>
                          ))}
                        </select>
                      ) : advisorName ? (
                        <span className="text-sm font-medium" style={{ color: "var(--fog)" }}>{advisorName}</span>
                      ) : (
                        <span
                          className="text-xs px-2 py-0.5 rounded-full"
                          style={{
                            background: "color-mix(in srgb, var(--amber) 15%, transparent)",
                            color: "var(--amber)",
                            border: "1px solid color-mix(in srgb, var(--amber) 30%, transparent)",
                          }}
                        >
                          Not assigned
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      {isEditing ? (
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => updateClubMutation.mutate({ clubId: club.id, faculty_advisor_id: selectedAdvisorId || null })}
                            disabled={updateClubMutation.isPending}
                            className="p-1 rounded transition-colors"
                            style={{ color: "var(--jade)" }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "color-mix(in srgb, var(--jade) 12%, transparent)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          >
                            {updateClubMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingClubId(null)}
                            className="p-1 rounded transition-colors"
                            style={{ color: "var(--ash)" }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--ink-muted)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEditClub(club)}
                          className="p-1 rounded transition-colors"
                          style={{ color: "var(--ash)" }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = "var(--amber)";
                            e.currentTarget.style.background = "color-mix(in srgb, var(--amber) 10%, transparent)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = "var(--ash)";
                            e.currentTarget.style.background = "transparent";
                          }}
                        >
                          <Pencil size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {clubs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm" style={{ color: "var(--dust)" }}>No clubs found. Create clubs first.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Club Analytics tab ────────────────────────────────────────────────────────

const CHART_COLORS = ["#6366f1", "#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#8b5cf6", "#f97316", "#14b8a6"];

const EVENT_STATUS_STYLE: Record<string, React.CSSProperties> = {
  DRAFT:            { background: "color-mix(in srgb, var(--dust) 20%, transparent)", color: "var(--ash)" },
  PENDING_APPROVAL: { background: "color-mix(in srgb, var(--amber) 15%, transparent)", color: "var(--amber)" },
  PUBLISHED:        { background: "color-mix(in srgb, var(--jade) 15%, transparent)", color: "var(--jade)" },
  COMPLETED:        { background: "color-mix(in srgb, var(--sky) 15%, transparent)", color: "var(--sky)" },
  ARCHIVED:         { background: "color-mix(in srgb, var(--dust) 20%, transparent)", color: "var(--dust)" },
};

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-5" style={{ background: "var(--ink-soft)", border: "1px solid var(--seam)" }}>
      <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--dust)" }}>{title}</p>
      {children}
    </div>
  );
}

const tooltipStyle = {
  contentStyle: { background: "#1a1a2e", border: "1px solid #2d2d4a", borderRadius: 8, fontSize: 12 },
  labelStyle: { color: "#e2e8f0", fontWeight: 600 },
  itemStyle: { color: "#a5b4fc" },
};

function ClubDrillDown({ clubId, clubName }: { clubId: string; clubName: string }) {
  const { data, isLoading } = useQuery<ClubDetail>({
    queryKey: ["analytics", "club", clubId],
    queryFn: () => api.get(`/analytics/clubs/${clubId}`).then((r) => r.data),
  });

  if (isLoading) return <div className="p-6 text-sm" style={{ color: "var(--dust)" }}>Loading…</div>;
  if (!data) return null;

  const eventChartData = data.events.slice(0, 12).map((e) => ({
    name: e.title.length > 18 ? e.title.slice(0, 18) + "…" : e.title,
    Participants: e.participants ?? 0,
    Spent: e.spent ?? 0,
    NPS: e.nps ?? 0,
  }));

  return (
    <div style={{ borderTop: "1px solid var(--seam)", padding: "20px 20px 24px" }}>
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: "Events", value: data.total_events, color: "var(--amber)" },
          { label: "Participants", value: data.total_participants.toLocaleString(), color: "var(--jade)" },
          { label: "Total Spent", value: `₹${data.total_spent.toLocaleString("en-IN")}`, color: "var(--sky)" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-lg p-3 text-center" style={{ background: "var(--ink-muted)" }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--dust)" }}>{label}</p>
            <p className="text-lg font-bold" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {eventChartData.length > 0 && (
        <div className="grid grid-cols-1 gap-4">
          {/* Participants per event */}
          <ChartCard title="Participants per Event">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={eventChartData} margin={{ top: 0, right: 8, bottom: 40, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d2d4a" />
                <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="Participants" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Amount spent per event */}
          <ChartCard title="Amount Spent per Event (₹)">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={eventChartData} margin={{ top: 0, right: 8, bottom: 40, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d2d4a" />
                <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} />
                <Tooltip {...tooltipStyle} formatter={(v: number) => [`₹${v.toLocaleString("en-IN")}`, "Spent"]} />
                <Bar dataKey="Spent" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* NPS per event */}
          {eventChartData.some((e) => e.NPS !== 0) && (
            <ChartCard title="NPS Score per Event">
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={eventChartData} margin={{ top: 0, right: 8, bottom: 40, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2d2d4a" />
                  <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                  <YAxis domain={[-100, 100]} tick={{ fill: "#94a3b8", fontSize: 10 }} />
                  <Tooltip {...tooltipStyle} />
                  <Bar dataKey="NPS" radius={[4, 4, 0, 0]}>
                    {eventChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.NPS >= 0 ? "#10b981" : "#ef4444"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}
        </div>
      )}

      {/* Events table */}
      {data.events.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-lg" style={{ border: "1px solid var(--seam)" }}>
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: "var(--ink-muted)" }}>
                {["Event", "Status", "Date", "Participants", "Spent", "NPS"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left font-semibold uppercase tracking-wider" style={{ color: "var(--dust)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.events.map((ev) => (
                <tr key={ev.id} style={{ borderTop: "1px solid var(--seam)" }}>
                  <td className="px-4 py-2.5 font-medium max-w-[180px] truncate" style={{ color: "var(--cream)" }}>{ev.title}</td>
                  <td className="px-4 py-2.5">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={EVENT_STATUS_STYLE[ev.status] ?? {}}>
                      {ev.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: "var(--fog)" }}>
                    {ev.start_datetime ? new Date(ev.start_datetime).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                  </td>
                  <td className="px-4 py-2.5 font-semibold" style={{ color: "var(--jade)" }}>{ev.participants ?? "—"}</td>
                  <td className="px-4 py-2.5 font-semibold" style={{ color: "var(--amber)" }}>
                    {ev.spent != null ? `₹${ev.spent.toLocaleString("en-IN")}` : "—"}
                  </td>
                  <td className="px-4 py-2.5 font-semibold" style={{ color: ev.nps == null ? "var(--dust)" : ev.nps >= 0 ? "var(--jade)" : "var(--cinnabar)" }}>
                    {ev.nps != null ? ev.nps : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ClubCard({ club }: { club: ClubSummary }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--ink-soft)", border: "1px solid var(--seam)" }}>
      <button
        type="button"
        className="w-full flex items-center gap-4 p-5 text-left transition-colors"
        onClick={() => setExpanded((v) => !v)}
        onMouseEnter={(e) => (e.currentTarget.style.background = "color-mix(in srgb, var(--cream) 2%, transparent)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "color-mix(in srgb, var(--amber) 12%, transparent)" }}>
          <Building2 size={18} style={{ color: "var(--amber)" }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-tight truncate" style={{ color: "var(--cream)" }}>{club.club_name}</p>
          {club.department && <p className="text-xs mt-0.5" style={{ color: "var(--dust)" }}>{club.department}</p>}
        </div>
        <div className="flex items-center gap-6 shrink-0 mr-2">
          <div className="text-center">
            <p className="text-lg font-bold" style={{ color: "var(--cream)" }}>{club.total_events}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--dust)" }}>Events</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold" style={{ color: "var(--jade)" }}>{club.published_events}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--dust)" }}>Published</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold" style={{ color: "var(--sky)" }}>{club.total_registrations.toLocaleString()}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--dust)" }}>Registrations</p>
          </div>
        </div>
        <ChevronRight size={16} style={{ color: "var(--ash)", transform: expanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 200ms", flexShrink: 0 }} />
      </button>
      {expanded && <ClubDrillDown clubId={club.club_id} clubName={club.club_name} />}
    </div>
  );
}

function ClubAnalyticsTab() {
  const { data: clubs, isLoading, error } = useQuery<ClubSummary[]>({
    queryKey: ["analytics", "all-clubs"],
    queryFn: () => api.get("/analytics/clubs").then((r) => r.data),
  });

  const totalEvents = clubs?.reduce((s, c) => s + c.total_events, 0) ?? 0;
  const totalRegistrations = clubs?.reduce((s, c) => s + c.total_registrations, 0) ?? 0;

  // Data for cross-club comparison charts
  const eventsChartData = clubs?.map((c) => ({ name: c.club_name.split(" ").slice(0, 2).join(" "), value: c.total_events })) ?? [];
  const regsChartData = clubs?.map((c) => ({ name: c.club_name.split(" ").slice(0, 2).join(" "), value: c.total_registrations })) ?? [];

  return (
    <div className="space-y-5">
      {/* Summary row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: <Building2 size={14} style={{ color: "var(--amber)" }} />, label: "Clubs", value: clubs?.length ?? "—", color: "var(--cream)" },
          { icon: <CalendarDays size={14} style={{ color: "var(--jade)" }} />, label: "Total Events", value: isLoading ? "—" : totalEvents, color: "var(--cream)" },
          { icon: <Ticket size={14} style={{ color: "var(--sky)" }} />, label: "Total Registrations", value: isLoading ? "—" : totalRegistrations.toLocaleString(), color: "var(--cream)" },
        ].map(({ icon, label, value, color }) => (
          <div key={label} className="rounded-xl p-4" style={{ background: "var(--ink-soft)", border: "1px solid var(--seam)" }}>
            <div className="flex items-center gap-2 mb-1">{icon}<p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--dust)" }}>{label}</p></div>
            <p className="text-3xl font-bold" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {!isLoading && !error && clubs && clubs.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ChartCard title="Events per Club">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={eventsChartData} margin={{ top: 0, right: 8, bottom: 48, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d2d4a" />
                <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} allowDecimals={false} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="value" name="Events" radius={[4, 4, 0, 0]}>
                  {eventsChartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Registrations per Club">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={regsChartData} margin={{ top: 0, right: 8, bottom: 48, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d2d4a" />
                <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} allowDecimals={false} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="value" name="Registrations" radius={[4, 4, 0, 0]}>
                  {regsChartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}

      {error ? (
        <div className="rounded-xl p-5" style={{ background: "color-mix(in srgb, var(--cinnabar) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--cinnabar) 25%, transparent)" }}>
          <p className="text-sm" style={{ color: "var(--cinnabar)" }}>Failed to load club analytics.</p>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl h-20 animate-pulse" style={{ background: "var(--ink-soft)", border: "1px solid var(--seam)" }} />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Activity size={14} style={{ color: "var(--amber)" }} />
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--dust)" }}>Click a club for detailed charts</p>
          </div>
          {clubs?.map((club) => <ClubCard key={club.club_id} club={club} />)}
          {clubs?.length === 0 && <p className="text-sm text-center py-8" style={{ color: "var(--dust)" }}>No clubs found.</p>}
        </div>
      )}
    </div>
  );
}

// ── Bank Export tab ───────────────────────────────────────────────────────────

interface BankRow {
  event: string;
  event_date: string | null;
  position: string;
  prize_amount: number | null;
  participant_name: string;
  participant_email: string;
  roll_number: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  upi: string | null;
}

function BankExportTab() {
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 8) + "01";
  const [fromDate, setFromDate] = useState(firstOfMonth);
  const [toDate, setToDate] = useState(today);
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvError, setCsvError] = useState<string | null>(null);

  const { data: rows, isFetching, error: tableError } = useQuery<BankRow[]>({
    queryKey: ["bank-details", fromDate, toDate],
    queryFn: async () => {
      const token = useAuthStore.getState().accessToken ?? "";
      const res = await fetch(
        `/api/analytics/bank-details?from_date=${fromDate}&to_date=${toDate}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    enabled: !!fromDate && !!toDate,
  });

  async function handleExport() {
    if (!fromDate || !toDate) return;
    setCsvLoading(true);
    setCsvError(null);
    try {
      const token = useAuthStore.getState().accessToken ?? "";
      const res = await fetch(
        `/api/analytics/bank-export?from_date=${fromDate}&to_date=${toDate}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bank-details-${fromDate}-to-${toDate}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setCsvError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setCsvLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    background: "var(--ink-muted)",
    border: "1px solid var(--seam)",
    borderRadius: 8,
    padding: "8px 12px",
    fontSize: 14,
    color: "var(--cream)",
    colorScheme: "dark",
    width: "100%",
  };

  const COLS = [
    { label: "Event", key: "event" },
    { label: "Date", key: "event_date" },
    { label: "Position", key: "position" },
    { label: "Name", key: "participant_name" },
    { label: "Roll No.", key: "roll_number" },
    { label: "Prize (₹)", key: "prize_amount" },
    { label: "Bank Name", key: "bank_account_name" },
    { label: "Account Number", key: "bank_account_number" },
    { label: "IFSC", key: "bank_ifsc" },
    { label: "UPI", key: "upi" },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl p-6" style={{ background: "var(--ink-soft)", border: "1px solid var(--seam)" }}>
        <div className="flex items-center gap-2 mb-1">
          <FileSpreadsheet size={18} style={{ color: "var(--jade)" }} />
          <h2 className="text-base font-semibold" style={{ color: "var(--cream)" }}>Bank Details</h2>
        </div>
        <p className="text-sm mb-6" style={{ color: "var(--fog)" }}>
          All event winners with bank account details and prize amounts for the selected date range. Filter is based on event start date.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "var(--dust)" }}>From Date</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "var(--dust)" }}>To Date</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={inputStyle} />
          </div>
        </div>

        {csvError && (
          <p className="text-sm mb-4 px-3 py-2 rounded-lg" style={{ color: "var(--cinnabar)", background: "color-mix(in srgb, var(--cinnabar) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--cinnabar) 25%, transparent)" }}>
            {csvError}
          </p>
        )}

        <button
          type="button"
          onClick={handleExport}
          disabled={csvLoading || !fromDate || !toDate}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
          style={{ background: "var(--jade)", color: "#0D0F14" }}
        >
          {csvLoading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
          {csvLoading ? "Generating…" : "Download CSV"}
        </button>
      </div>

      {/* Live table */}
      <div className="rounded-2xl" style={{ background: "var(--ink-soft)", border: "1px solid var(--seam)" }}>
        <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: "var(--seam)" }}>
          <span className="text-sm font-semibold" style={{ color: "var(--cream)" }}>
            Winners &amp; Bank Details
          </span>
          {isFetching && <Loader2 size={14} className="animate-spin" style={{ color: "var(--fog)" }} />}
          {rows && (
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--ink-muted)", color: "var(--dust)" }}>
              {rows.length} {rows.length === 1 ? "record" : "records"}
            </span>
          )}
        </div>

        {tableError && (
          <p className="text-sm px-5 py-4" style={{ color: "var(--cinnabar)" }}>
            Failed to load data.
          </p>
        )}

        {!isFetching && rows?.length === 0 && (
          <p className="text-sm px-5 py-8 text-center" style={{ color: "var(--dust)" }}>
            No winners with bank details found for this date range.
          </p>
        )}

        {rows && rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={{ minWidth: 860 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--seam)", background: "var(--ink-muted)" }}>
                  {COLS.map((c) => (
                    <th key={c.key} className="text-left px-4 py-3 font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--dust)" }}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={i}
                    style={{ borderBottom: "1px solid var(--seam)" }}
                    className="hover:bg-white/[0.03] transition-colors"
                  >
                    <td className="px-4 py-3 font-medium max-w-[160px] truncate" style={{ color: "var(--cream)" }}>{row.event}</td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: "var(--fog)" }}>
                      {row.event_date ? new Date(row.event_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: "var(--amber)" }}>{row.position}</td>
                    <td className="px-4 py-3 max-w-[140px] truncate" style={{ color: "var(--cream)" }}>{row.participant_name}</td>
                    <td className="px-4 py-3 font-mono whitespace-nowrap" style={{ color: "var(--fog)" }}>{row.roll_number ?? "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap font-semibold" style={{ color: row.prize_amount ? "var(--jade)" : "var(--dust)" }}>
                      {row.prize_amount ? `₹${Number(row.prize_amount).toLocaleString("en-IN")}` : "—"}
                    </td>
                    <td className="px-4 py-3 max-w-[140px] truncate" style={{ color: "var(--fog)" }}>{row.bank_account_name ?? "—"}</td>
                    <td className="px-4 py-3 font-mono whitespace-nowrap" style={{ color: "var(--fog)" }}>{row.bank_account_number ?? "—"}</td>
                    <td className="px-4 py-3 font-mono whitespace-nowrap" style={{ color: "var(--fog)" }}>{row.bank_ifsc ?? "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: "var(--sky)" }}>{row.upi ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main AdminDashboard ───────────────────────────────────────────────────────

type Tab = "metrics" | "users" | "clubs" | "analytics" | "bank-export" | "departments" | "maintenance";

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "metrics",      label: "Platform Metrics", icon: <BarChart3 size={15} /> },
  { key: "analytics",   label: "Club Analytics",   icon: <Building2 size={15} /> },
  { key: "users",       label: "User Management",  icon: <Users size={15} /> },
  { key: "clubs",       label: "Club Setup",        icon: <CalendarDays size={15} /> },
  { key: "bank-export", label: "Bank Export",       icon: <FileSpreadsheet size={15} /> },
  { key: "departments", label: "Departments",       icon: <GraduationCap size={15} /> },
  { key: "maintenance", label: "Maintenance",       icon: <ShieldAlert size={15} /> },
];

// ── Departments Tab ───────────────────────────────────────────────────────────

function DepartmentsTab() {
  const qc = useQueryClient();
  const [addCode, setAddCode] = useState("");
  const [addLabel, setAddLabel] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");

  const { data: depts = [], isLoading } = useQuery<DeptCode[]>({
    queryKey: ["admin", "department-codes"],
    queryFn: async () => (await api.get<DeptCode[]>("/admin/department-codes")).data,
  });

  const createMutation = useMutation({
    mutationFn: (body: { code: string; label: string }) => api.post("/admin/department-codes", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "department-codes"] });
      qc.invalidateQueries({ queryKey: ["department-codes"] });
      setAddCode("");
      setAddLabel("");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: string; label?: string; is_active?: boolean }) =>
      api.patch(`/admin/department-codes/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "department-codes"] });
      qc.invalidateQueries({ queryKey: ["department-codes"] });
      setEditId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/department-codes/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "department-codes"] });
      qc.invalidateQueries({ queryKey: ["department-codes"] });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--cream)" }}>Department Codes</h2>
        <p className="text-sm" style={{ color: "var(--fog)" }}>
          Manage department codes and labels used for event registration eligibility. The code must match the
          letter(s) in student roll numbers (e.g. <code style={{ color: "var(--amber)" }}>Z</code> for 23Z320).
        </p>
      </div>

      {/* Add form */}
      <div style={{ background: "var(--ink-soft)", border: "1px solid var(--seam)", borderRadius: 10, padding: 16 }}>
        <p className="text-sm font-semibold mb-3" style={{ color: "var(--cream)" }}>Add Department</p>
        <div className="flex gap-3 flex-wrap">
          <input
            placeholder="Code (e.g. Z, CS, ME)"
            value={addCode}
            onChange={(e) => setAddCode(e.target.value.toUpperCase())}
            className="input-field"
            style={{ width: 140, padding: "6px 12px", fontSize: 13 }}
          />
          <input
            placeholder="Full department name"
            value={addLabel}
            onChange={(e) => setAddLabel(e.target.value)}
            className="input-field"
            style={{ flex: 1, minWidth: 200, padding: "6px 12px", fontSize: 13 }}
          />
          <button
            type="button"
            onClick={() => {
              if (!addCode.trim() || !addLabel.trim()) return;
              createMutation.mutate({ code: addCode.trim(), label: addLabel.trim() });
            }}
            disabled={createMutation.isPending || !addCode.trim() || !addLabel.trim()}
            className="btn-primary"
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, padding: "6px 16px" }}
          >
            {createMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Add
          </button>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <p style={{ color: "var(--fog)", fontSize: 13 }}>Loading…</p>
      ) : depts.length === 0 ? (
        <p style={{ color: "var(--fog)", fontSize: 13, fontStyle: "italic" }}>No department codes yet.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--seam)" }}>
                {["Code", "Label", "Active", "Actions"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: "var(--dust)", fontWeight: 600, textTransform: "uppercase", fontSize: 10, letterSpacing: "0.08em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {depts.map((d) => (
                <tr key={d.id} style={{ borderBottom: "1px solid var(--seam)" }}>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{ fontFamily: "monospace", color: "var(--amber)", fontWeight: 700, fontSize: 13 }}>{d.code}</span>
                  </td>
                  <td style={{ padding: "10px 12px", color: "var(--cream)" }}>
                    {editId === d.id ? (
                      <input
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        className="input-field"
                        style={{ padding: "4px 8px", fontSize: 13, width: "100%" }}
                        autoFocus
                      />
                    ) : d.label}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <button
                      type="button"
                      onClick={() => updateMutation.mutate({ id: d.id, is_active: !d.is_active })}
                      style={{
                        fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 99,
                        border: `1px solid ${d.is_active ? "var(--jade-dim)" : "var(--seam)"}`,
                        background: d.is_active ? "rgba(74,222,128,0.1)" : "transparent",
                        color: d.is_active ? "var(--jade)" : "var(--fog)", cursor: "pointer",
                      }}
                    >
                      {d.is_active ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      {editId === d.id ? (
                        <>
                          <button type="button" onClick={() => updateMutation.mutate({ id: d.id, label: editLabel })}
                            style={{ color: "var(--jade)", cursor: "pointer", background: "none", border: "none" }}>
                            <Check size={15} />
                          </button>
                          <button type="button" onClick={() => setEditId(null)}
                            style={{ color: "var(--fog)", cursor: "pointer", background: "none", border: "none" }}>
                            <X size={15} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button type="button" onClick={() => { setEditId(d.id); setEditLabel(d.label); }}
                            style={{ color: "var(--fog)", cursor: "pointer", background: "none", border: "none" }}>
                            <Pencil size={14} />
                          </button>
                          <button type="button" onClick={() => { if (confirm(`Delete "${d.code}"?`)) deleteMutation.mutate(d.id); }}
                            style={{ color: "var(--cinnabar)", cursor: "pointer", background: "none", border: "none" }}>
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Maintenance Tab ───────────────────────────────────────────────────────────

function MaintenanceTab() {
  const [purgeResult, setPurgeResult] = useState<number | null>(null);
  const [purgeError, setPurgeError] = useState<string | null>(null);

  const purgeMutation = useMutation({
    mutationFn: async () => (await api.post<{ deleted: number }>("/admin/maintenance/purge-inactive-users")).data,
    onSuccess: (data) => {
      setPurgeResult(data.deleted);
      setPurgeError(null);
    },
    onError: () => setPurgeError("Failed to purge inactive users."),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--cream)" }}>Maintenance</h2>
        <p className="text-sm" style={{ color: "var(--fog)" }}>Administrative operations. Use with caution — some actions are irreversible.</p>
      </div>

      <div style={{ background: "var(--ink-soft)", border: "1px solid var(--seam)", borderRadius: 10, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
          <div style={{ padding: 10, borderRadius: 8, background: "rgba(239,68,68,0.1)", flexShrink: 0 }}>
            <Trash2 size={18} style={{ color: "var(--cinnabar)" }} />
          </div>
          <div style={{ flex: 1 }}>
            <p className="font-semibold mb-1" style={{ color: "var(--cream)", fontSize: 14 }}>Purge Inactive Accounts</p>
            <p style={{ color: "var(--fog)", fontSize: 13, marginBottom: 12 }}>
              Permanently deletes participant accounts with no login activity for 6 or more years.
              Staff and admin accounts are never affected. This action cannot be undone.
            </p>
            {purgeResult !== null && (
              <div style={{ marginBottom: 10, padding: "8px 12px", borderRadius: 6, background: "rgba(74,222,128,0.1)", border: "1px solid var(--jade-dim)", color: "var(--jade)", fontSize: 13 }}>
                Done. {purgeResult} account{purgeResult !== 1 ? "s" : ""} deleted.
              </div>
            )}
            {purgeError && (
              <div style={{ marginBottom: 10, padding: "8px 12px", borderRadius: 6, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "var(--cinnabar)", fontSize: 13 }}>
                {purgeError}
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                if (confirm("This will permanently delete all participant accounts inactive for 6+ years. Continue?")) {
                  purgeMutation.mutate();
                }
              }}
              disabled={purgeMutation.isPending}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)",
                color: "var(--cinnabar)", cursor: "pointer",
              }}
            >
              {purgeMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              {purgeMutation.isPending ? "Purging…" : "Purge Inactive Accounts"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get("tab") as Tab) ?? "metrics";

  function setTab(tab: Tab) {
    setSearchParams({ tab });
  }

  const { data: clubs = [] } = useQuery<Club[]>({
    queryKey: ["admin", "clubs"],
    queryFn: () => api.get("/admin/clubs").then((r) => r.data),
  });

  return (
    <Layout>
      <div className="px-4 py-6 sm:px-8 sm:py-8 max-w-6xl mx-auto">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--dust)" }}>Admin</p>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" style={{ color: "var(--cream)" }}>
            <BarChart3 size={22} style={{ color: "var(--amber)" }} />
            Admin Dashboard
          </h1>
        </div>

        {/* Tab bar */}
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 mb-8">
          <div className="flex gap-1 p-1 rounded-xl w-max min-w-full sm:w-fit" style={{ background: "var(--ink-muted)" }}>
          {TABS.map((t) => (
            <button
              type="button"
              key={t.key}
              onClick={() => setTab(t.key)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={
                activeTab === t.key
                  ? { background: "var(--ink-soft)", color: "var(--cream)", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }
                  : { color: "var(--fog)" }
              }
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
        </div>

        {activeTab === "metrics" && <MetricsTab />}
        {activeTab === "analytics" && <ClubAnalyticsTab />}
        {activeTab === "users" && <UserManagementTab clubs={clubs} />}
        {activeTab === "clubs" && <ClubSetupTab clubs={clubs} />}
        {activeTab === "bank-export" && <BankExportTab />}
        {activeTab === "departments" && <DepartmentsTab />}
        {activeTab === "maintenance" && <MaintenanceTab />}
      </div>
    </Layout>
  );
}
