import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import {
  Search, Download, ListChecks, AlertCircle,
  ChevronUp, ChevronDown, Users, Crown, Trash2, CheckCircle2, Trophy, Plus, X,
} from "lucide-react";
import Layout from "@/components/Layout";
import api, { apiError } from "@/lib/api";
import type { Event } from "@/types";
import { fmtDateTimeMedIST } from "@/lib/dateIST";

interface RegistrationDetail {
  id: string;
  event_id: string;
  user_id: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "WAITLISTED";
  registered_at: string;
  confirmed_at: string | null;
  created_at: string;
  participant_name: string;
  participant_email: string;
  participant_roll_number: string | null;
  participant_phone_number: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  team_id: string | null;
  team_name: string | null;
  team_lead_id: string | null;
  is_checked_in: boolean;
}

interface WinnerRecord {
  id: string;
  position: number;
  prize_amount: number | null;
  expense_id: string | null;
  user_id: string;
  participant_name: string;
  participant_email: string;
  roll_number: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
}

interface AdminTeamMember {
  user_id: string;
  name: string;
  email: string;
  role: string;
}

interface AdminTeamGroup {
  team_id: string;
  team_name: string;
  lead_id: string;
  status: string;
  members: AdminTeamMember[];
}

const STATUS_STYLES: Record<RegistrationDetail["status"], React.CSSProperties> = {
  CONFIRMED: {
    background: "color-mix(in srgb, var(--jade) 15%, transparent)",
    color: "var(--jade)",
    border: "1px solid color-mix(in srgb, var(--jade) 30%, transparent)",
  },
  PENDING: {
    background: "color-mix(in srgb, var(--amber) 15%, transparent)",
    color: "var(--amber)",
    border: "1px solid color-mix(in srgb, var(--amber) 30%, transparent)",
  },
  WAITLISTED: {
    background: "color-mix(in srgb, var(--sky) 15%, transparent)",
    color: "var(--sky)",
    border: "1px solid color-mix(in srgb, var(--sky) 30%, transparent)",
  },
  CANCELLED: {
    background: "color-mix(in srgb, var(--dust) 20%, transparent)",
    color: "var(--ash)",
    border: "1px solid var(--seam)",
  },
};

const ALL_STATUSES: Array<RegistrationDetail["status"] | "ALL"> = [
  "ALL", "CONFIRMED", "PENDING", "WAITLISTED", "CANCELLED",
];

type SortField = "registered_at" | "status" | "participant_name";
type SortDir = "asc" | "desc";
type ViewMode = "list" | "teams";

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {[160, 160, 80, 120, 100, 40].map((w, i) => (
        <td key={i} style={{ padding: "14px 16px" }}>
          <div style={{ height: 16, background: "var(--ink-muted)", borderRadius: 4, width: w }} />
        </td>
      ))}
    </tr>
  );
}

function SortIcon({ field, current, dir }: { field: SortField; current: SortField; dir: SortDir }) {
  if (field !== current) return <ChevronUp size={12} style={{ color: "var(--seam)", marginLeft: 4 }} />;
  return dir === "asc"
    ? <ChevronUp size={12} style={{ color: "var(--amber)", marginLeft: 4 }} />
    : <ChevronDown size={12} style={{ color: "var(--amber)", marginLeft: 4 }} />;
}

function TeamsView({ eventId, isTeamEvent, registrations }: { eventId: string; isTeamEvent: boolean; registrations: RegistrationDetail[] }) {
  const { data: groups = [], isLoading } = useQuery<AdminTeamGroup[]>({
    queryKey: ["event-teams-admin", eventId],
    queryFn: () => api.get(`/events/${eventId}/teams/admin`).then((r) => r.data),
    enabled: isTeamEvent,
  });

  // Users in teams (by user_id from team_members)
  const inTeamUserIds = useMemo(() => {
    const ids = new Set<string>();
    for (const g of groups) for (const m of g.members) ids.add(m.user_id);
    return ids;
  }, [groups]);

  // Registered participants not in any team
  const ungrouped = useMemo(
    () => registrations.filter((r) => !inTeamUserIds.has(r.user_id)),
    [registrations, inTeamUserIds]
  );

  const sorted = useMemo(
    () => [...groups].sort((a, b) => a.team_name.localeCompare(b.team_name)),
    [groups]
  );

  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            style={{
              background: "var(--ink-soft)",
              border: "1px solid var(--seam)",
              borderRadius: 12,
              padding: 20,
              height: 96,
              animation: "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite",
            }}
          />
        ))}
      </div>
    );
  }

  if (sorted.length === 0 && ungrouped.length === 0) {
    return (
      <div
        style={{
          background: "var(--ink-soft)",
          border: "1px solid var(--seam)",
          borderRadius: 12,
          padding: "48px 24px",
          textAlign: "center",
        }}
      >
        <Users size={32} style={{ color: "var(--seam)", margin: "0 auto 12px" }} />
        <p style={{ color: "var(--ash)", fontSize: 14 }}>No teams yet.</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {sorted.map((group) => (
        <div
          key={group.team_id}
          style={{
            background: "var(--ink-soft)",
            border: "1px solid var(--seam)",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "12px 16px",
              background: "var(--ink-muted)",
              borderBottom: "1px solid var(--seam)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: "var(--amber)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Users size={13} style={{ color: "var(--ink)" }} />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "var(--cream)" }}>{group.team_name}</p>
              <p style={{ fontSize: 12, color: "var(--fog)" }}>
                {group.members.length} member{group.members.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <table style={{ width: "100%", fontSize: 14 }}>
            <tbody>
              {group.members.map((member) => (
                <tr
                  key={member.user_id}
                  style={{ borderTop: "1px solid var(--seam)", transition: "background 0.1s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "color-mix(in srgb, var(--cream) 3%, transparent)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <td style={{ padding: "10px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <p style={{ fontWeight: 500, color: "var(--cream)", fontSize: 14 }}>{member.name}</p>
                      {member.user_id === group.lead_id && (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 2,
                            fontSize: 10,
                            fontWeight: 700,
                            background: "color-mix(in srgb, var(--amber) 15%, transparent)",
                            color: "var(--amber)",
                            border: "1px solid color-mix(in srgb, var(--amber) 30%, transparent)",
                            padding: "2px 6px",
                            borderRadius: 999,
                          }}
                        >
                          <Crown size={9} /> Lead
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: "10px 16px", color: "var(--fog)", fontSize: 12 }}>{member.email}</td>
                  <td style={{ padding: "10px 16px" }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "3px 10px",
                        borderRadius: 999,
                        border: "1px solid var(--seam)",
                        background: "var(--ink-muted)",
                        color: "var(--fog)",
                      }}
                    >
                      {member.role}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      {ungrouped.length > 0 && (
        <div
          style={{
            background: "var(--ink-soft)",
            border: "1px solid var(--seam)",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "12px 16px",
              background: "var(--ink-muted)",
              borderBottom: "1px solid var(--seam)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--fog)" }}>No Team Yet</p>
            <span style={{ fontSize: 12, color: "var(--ash)" }}>({ungrouped.length})</span>
          </div>
          <table style={{ width: "100%", fontSize: 14 }}>
            <tbody>
              {ungrouped.map((r) => (
                <tr
                  key={r.id}
                  style={{ borderTop: "1px solid var(--seam)", transition: "background 0.1s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "color-mix(in srgb, var(--cream) 3%, transparent)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <td style={{ padding: "10px 16px" }}>
                    <p style={{ fontWeight: 500, color: "var(--cream)", fontSize: 14 }}>{r.participant_name}</p>
                  </td>
                  <td style={{ padding: "10px 16px", color: "var(--fog)", fontSize: 12 }}>{r.participant_email}</td>
                  <td style={{ padding: "10px 16px" }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "3px 10px",
                        borderRadius: 999,
                        ...STATUS_STYLES[r.status],
                      }}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td style={{ padding: "10px 16px", color: "var(--fog)", fontSize: 12, whiteSpace: "nowrap" }}>
                    {fmtDateTimeMedIST(r.registered_at)}
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

export default function RegistrationList() {
  const { eventId } = useParams<{ eventId: string }>();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<RegistrationDetail["status"] | "ALL">("ALL");
  const [sortField, setSortField] = useState<SortField>("registered_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const { data: event } = useQuery<Event>({
    queryKey: ["event-detail-manage", eventId],
    queryFn: () => api.get(`/events/by-id/${eventId}`).then((r) => r.data),
    enabled: !!eventId,
  });

  const { data: registrations = [], isLoading, error } = useQuery<RegistrationDetail[]>({
    queryKey: ["event-registrations", eventId],
    queryFn: () => api.get(`/events/${eventId}/registrations`).then((r) => r.data),
    enabled: !!eventId,
  });

  const deleteMutation = useMutation({
    mutationFn: (regId: string) => api.delete(`/registrations/${regId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["event-registrations", eventId] });
      setConfirmDeleteId(null);
    },
  });

  const isTeamEvent = event?.is_team_event ?? false;

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  }

  const filtered = useMemo(() => {
    let list = [...registrations];
    if (statusFilter !== "ALL") list = list.filter((r) => r.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.participant_name.toLowerCase().includes(q) ||
          r.participant_email.toLowerCase().includes(q) ||
          (r.team_name ?? "").toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === "registered_at") {
        cmp = new Date(a.registered_at).getTime() - new Date(b.registered_at).getTime();
      } else if (sortField === "status") {
        cmp = a.status.localeCompare(b.status);
      } else if (sortField === "participant_name") {
        cmp = a.participant_name.localeCompare(b.participant_name);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [registrations, statusFilter, search, sortField, sortDir]);

  function exportCSV() {
    const cols = ["name", "roll_number", "phone", "email", "status"];
    if (isTeamEvent) cols.push("team");
    cols.push("bank_account_name", "bank_account_number", "bank_ifsc", "registered_at");
    const headers = cols.join(",");
    const rows = filtered.map((r) => {
      const row: string[] = [
        `"${r.participant_name}"`,
        r.participant_roll_number ?? "",
        r.participant_phone_number ?? "",
        r.participant_email,
        r.status,
      ];
      if (isTeamEvent) row.push(`"${r.team_name ?? ""}"`);
      row.push(
        `"${r.bank_account_name ?? ""}"`,
        r.bank_account_number ?? "",
        r.bank_ifsc ?? "",
        r.registered_at,
      );
      return row.join(",");
    });
    const csv = [headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `registrations-${event?.title ?? eventId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Layout eventId={eventId}>
      <div className="px-4 py-6 sm:px-8 sm:py-8" style={{ maxWidth: 960, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h1
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: "var(--cream)",
                letterSpacing: "-0.02em",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <ListChecks size={22} style={{ color: "var(--amber)" }} />
              Registrations
            </h1>
            <p style={{ color: "var(--fog)", marginTop: 4, fontSize: 14 }}>
              {isLoading
                ? "Loading…"
                : `${filtered.length} of ${registrations.length} registration${registrations.length !== 1 ? "s" : ""}`}
              {statusFilter !== "ALL" ? ` · ${statusFilter}` : ""}
              {isTeamEvent && (
                <span style={{ marginLeft: 8, display: "inline-flex", alignItems: "center", gap: 4, color: "var(--amber)", fontWeight: 500 }}>
                  <Users size={12} /> Team Event
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={exportCSV}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 16px",
              background: "transparent",
              border: "1px solid var(--seam)",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 500,
              color: "var(--ash)",
              cursor: "pointer",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--ink-muted)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <Download size={15} />
            Export CSV
          </button>
        </div>

        {/* View mode toggle */}
        <div
          style={{
            display: "flex",
            gap: 2,
            background: "var(--ink-muted)",
            padding: 2,
            borderRadius: 8,
            marginBottom: 16,
            width: "fit-content",
          }}
        >
          {(["list", ...(isTeamEvent ? ["teams"] : [])] as ViewMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setViewMode(m)}
              style={{
                padding: "6px 16px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                transition: "all 0.15s",
                background: viewMode === m ? "var(--ink-soft)" : "transparent",
                color: viewMode === m ? "var(--cream)" : "var(--fog)",
                boxShadow: viewMode === m ? "0 1px 3px rgba(0,0,0,0.3)" : "none",
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              {m === "list" ? "All Participants" : "By Team"}
            </button>
          ))}
        </div>

        {/* Filters (list view only) */}
        {viewMode === "list" && (
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{ position: "relative" }}>
              <Search
                size={14}
                style={{
                  position: "absolute",
                  left: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--ash)",
                }}
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, email or team…"
                style={{
                  paddingLeft: 32,
                  paddingRight: 16,
                  paddingTop: 8,
                  paddingBottom: 8,
                  fontSize: 14,
                  background: "var(--ink-muted)",
                  border: "1px solid var(--seam)",
                  borderRadius: 8,
                  color: "var(--cream)",
                  outline: "none",
                  width: 256,
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--amber)";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(245,166,35,0.12)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--seam)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
              {ALL_STATUSES.map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => setStatusFilter(s as RegistrationDetail["status"] | "ALL")}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    border: "none",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    background: statusFilter === s ? "var(--amber)" : "var(--ink-muted)",
                    color: statusFilter === s ? "var(--ink)" : "var(--fog)",
                  }}
                >
                  {s}
                </button>
              ))}
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
            <p style={{ fontSize: 14, color: "var(--cinnabar)" }}>Failed to load registrations.</p>
          </div>
        ) : viewMode === "teams" ? (
          <TeamsView eventId={eventId!} isTeamEvent={isTeamEvent} registrations={registrations} />
        ) : (
          <div
            style={{
              background: "var(--ink-soft)",
              border: "1px solid var(--seam)",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", fontSize: 14, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--ink-muted)", borderBottom: "1px solid var(--seam)" }}>
                    <th
                      style={{
                        padding: "12px 16px",
                        textAlign: "left",
                        fontSize: 11,
                        fontWeight: 600,
                        color: "var(--dust)",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        cursor: "pointer",
                        userSelect: "none",
                      }}
                      onClick={() => toggleSort("participant_name")}
                    >
                      <span style={{ display: "flex", alignItems: "center" }}>
                        Name <SortIcon field="participant_name" current={sortField} dir={sortDir} />
                      </span>
                    </th>
                    {isTeamEvent && (
                      <th
                        style={{
                          padding: "12px 16px",
                          textAlign: "left",
                          fontSize: 11,
                          fontWeight: 600,
                          color: "var(--dust)",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                        }}
                      >
                        Team
                      </th>
                    )}
                    <th
                      style={{
                        padding: "12px 16px",
                        textAlign: "left",
                        fontSize: 11,
                        fontWeight: 600,
                        color: "var(--dust)",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        cursor: "pointer",
                        userSelect: "none",
                      }}
                      onClick={() => toggleSort("status")}
                    >
                      <span style={{ display: "flex", alignItems: "center" }}>
                        Status <SortIcon field="status" current={sortField} dir={sortDir} />
                      </span>
                    </th>
                    <th
                      style={{
                        padding: "12px 16px",
                        textAlign: "left",
                        fontSize: 11,
                        fontWeight: 600,
                        color: "var(--dust)",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        cursor: "pointer",
                        userSelect: "none",
                      }}
                      onClick={() => toggleSort("registered_at")}
                    >
                      <span style={{ display: "flex", alignItems: "center" }}>
                        Registered <SortIcon field="registered_at" current={sortField} dir={sortDir} />
                      </span>
                    </th>
                    <th style={{ padding: "12px 16px" }} />
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td
                        colSpan={isTeamEvent ? 5 : 4}
                        style={{ padding: "48px 16px", textAlign: "center" }}
                      >
                        <ListChecks size={32} style={{ color: "var(--seam)", margin: "0 auto 12px" }} />
                        <p style={{ color: "var(--ash)", fontSize: 14 }}>
                          {search ? `No registrations match "${search}".` : "No registrations found."}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filtered.map((reg) => (
                      <tr
                        key={reg.id}
                        style={{ borderTop: "1px solid var(--seam)", transition: "background 0.1s" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "color-mix(in srgb, var(--cream) 3%, transparent)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <td style={{ padding: "14px 16px" }}>
                          <p style={{ fontWeight: 600, color: "var(--cream)", fontSize: 14 }}>{reg.participant_name}</p>
                          <p style={{ fontSize: 12, color: "var(--ash)", marginTop: 2 }}>{reg.participant_email}</p>
                          {reg.participant_phone_number && (
                            <p style={{ fontSize: 12, color: "var(--fog)", marginTop: 1 }}>{reg.participant_phone_number}</p>
                          )}
                        </td>
                        {isTeamEvent && (
                          <td style={{ padding: "14px 16px" }}>
                            {reg.team_name ? (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color: "var(--amber)",
                                  background: "color-mix(in srgb, var(--amber) 12%, transparent)",
                                  border: "1px solid color-mix(in srgb, var(--amber) 25%, transparent)",
                                  padding: "2px 8px",
                                  borderRadius: 999,
                                }}
                              >
                                <Users size={10} /> {reg.team_name}
                              </span>
                            ) : (
                              <span style={{ fontSize: 12, color: "var(--ash)" }}>No team yet</span>
                            )}
                          </td>
                        )}
                        <td style={{ padding: "14px 16px" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                padding: "3px 10px",
                                borderRadius: 999,
                                width: "fit-content",
                                ...STATUS_STYLES[reg.status],
                              }}
                            >
                              {reg.status}
                            </span>
                            {reg.is_checked_in && (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  fontSize: 11,
                                  fontWeight: 600,
                                  color: "var(--jade)",
                                  background: "color-mix(in srgb, var(--jade) 15%, transparent)",
                                  border: "1px solid color-mix(in srgb, var(--jade) 30%, transparent)",
                                  padding: "3px 10px",
                                  borderRadius: 999,
                                  width: "fit-content",
                                }}
                              >
                                <CheckCircle2 size={10} /> Checked In
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: "14px 16px", color: "var(--fog)", fontSize: 12, whiteSpace: "nowrap" }}>
                          {fmtDateTimeMedIST(reg.registered_at)}
                        </td>
                        <td style={{ padding: "14px 16px" }}>
                          {confirmDeleteId === reg.id ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontSize: 12, color: "var(--fog)" }}>Delete?</span>
                              <button
                                type="button"
                                onClick={() => deleteMutation.mutate(reg.id)}
                                disabled={deleteMutation.isPending}
                                style={{
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color: "var(--cinnabar)",
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  opacity: deleteMutation.isPending ? 0.5 : 1,
                                }}
                              >
                                Yes
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                style={{
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color: "var(--fog)",
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                }}
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(reg.id)}
                              style={{
                                padding: 6,
                                borderRadius: 8,
                                color: "var(--ash)",
                                background: "transparent",
                                border: "none",
                                cursor: "pointer",
                                transition: "all 0.15s",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.color = "var(--cinnabar)";
                                e.currentTarget.style.background = "color-mix(in srgb, var(--cinnabar) 10%, transparent)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.color = "var(--ash)";
                                e.currentTarget.style.background = "transparent";
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
}

const POSITION_LABELS: Record<number, string> = { 1: "1st", 2: "2nd", 3: "3rd" };
function posLabel(n: number) { return POSITION_LABELS[n] ?? `${n}th`; }

function WinnersPanel({ eventId, registrations }: { eventId: string; registrations: RegistrationDetail[] }) {
  const qc = useQueryClient();
  const [position, setPosition] = useState(1);
  const [userId, setUserId] = useState("");
  const [prizeAmount, setPrizeAmount] = useState("");
  const [formError, setFormError] = useState("");

  const { data: winners = [], isLoading } = useQuery<WinnerRecord[]>({
    queryKey: ["winners", eventId],
    queryFn: () => api.get(`/events/${eventId}/winners`).then((r) => r.data),
    enabled: !!eventId,
  });

  const confirmed = registrations.filter((r) => r.status === "CONFIRMED");

  const setMutation = useMutation({
    mutationFn: () => api.post(`/events/${eventId}/winners`, {
      user_id: userId,
      position,
      prize_amount: prizeAmount ? parseFloat(prizeAmount) : null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["winners", eventId] });
      qc.invalidateQueries({ queryKey: ["expenses", eventId] });
      setUserId(""); setPrizeAmount(""); setFormError("");
    },
    onError: (err) => setFormError(apiError(err, "Failed to set winner.")),
  });

  const removeMutation = useMutation({
    mutationFn: (pos: number) => api.delete(`/events/${eventId}/winners/${pos}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["winners", eventId] });
      qc.invalidateQueries({ queryKey: ["expenses", eventId] });
    },
  });

  function exportWinnersCSV() {
    const headers = "position,name,roll_number,email,bank_account_name,bank_account_number,bank_ifsc,prize_amount";
    const rows = winners.map((w) => [
      posLabel(w.position),
      `"${w.participant_name}"`,
      w.roll_number ?? "",
      w.participant_email,
      `"${w.bank_account_name ?? ""}"`,
      w.bank_account_number ?? "",
      w.bank_ifsc ?? "",
      w.prize_amount ?? "",
    ].join(","));
    const csv = [headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `winners-${eventId}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Add winner form */}
      <div style={{ background: "var(--ink-soft)", border: "1px solid var(--seam)", borderRadius: 12, padding: 20 }}>
        <h3 style={{ color: "var(--cream)", fontWeight: 700, fontSize: 15, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
          <Trophy size={15} style={{ color: "var(--amber)" }} /> Set Winner
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr", gap: 10, marginBottom: 10 }}>
          <div>
            <label style={{ fontSize: 11, color: "var(--fog)", fontWeight: 600, display: "block", marginBottom: 4 }}>Position</label>
            <select
              value={position}
              onChange={(e) => setPosition(Number(e.target.value))}
              style={{ width: "100%", background: "var(--ink-muted)", border: "1px solid var(--seam)", color: "var(--cream)", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}
            >
              {[1, 2, 3, 4, 5].map((p) => (
                <option key={p} value={p} style={{ background: "var(--ink-muted)" }}>{posLabel(p)} Place</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--fog)", fontWeight: 600, display: "block", marginBottom: 4 }}>Participant</label>
            <select
              value={userId}
              onChange={(e) => { setUserId(e.target.value); setFormError(""); }}
              style={{ width: "100%", background: "var(--ink-muted)", border: "1px solid var(--seam)", color: userId ? "var(--cream)" : "var(--ash)", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}
            >
              <option value="" disabled style={{ background: "var(--ink-muted)" }}>Select participant…</option>
              {confirmed.map((r) => (
                <option key={r.user_id} value={r.user_id} style={{ background: "var(--ink-muted)" }}>
                  {r.participant_name}{r.participant_roll_number ? ` (${r.participant_roll_number})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--fog)", fontWeight: 600, display: "block", marginBottom: 4 }}>Cash Prize (₹)</label>
            <input
              type="number"
              min="0"
              step="1"
              value={prizeAmount}
              onChange={(e) => setPrizeAmount(e.target.value)}
              placeholder="Optional"
              style={{ width: "100%", background: "var(--ink-muted)", border: "1px solid var(--seam)", color: "var(--cream)", borderRadius: 8, padding: "8px 10px", fontSize: 13, boxSizing: "border-box" }}
            />
          </div>
        </div>
        {formError && (
          <p style={{ fontSize: 12, color: "var(--cinnabar)", marginBottom: 8, display: "flex", alignItems: "center", gap: 4 }}>
            <AlertCircle size={12} /> {formError}
          </p>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            disabled={!userId || setMutation.isPending}
            onClick={() => setMutation.mutate()}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "8px 16px",
              background: "var(--amber)", color: "var(--ink)", border: "none", borderRadius: 8,
              fontSize: 13, fontWeight: 600, cursor: !userId ? "not-allowed" : "pointer", opacity: !userId ? 0.5 : 1,
            }}
          >
            <Plus size={13} /> Set Winner
          </button>
          {prizeAmount && Number(prizeAmount) > 0 && (
            <p style={{ fontSize: 12, color: "var(--fog)" }}>
              ₹{Number(prizeAmount).toLocaleString()} will be added as a PRIZES expense automatically.
            </p>
          )}
        </div>
      </div>

      {/* Winners list */}
      <div style={{ background: "var(--ink-soft)", border: "1px solid var(--seam)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid var(--seam)" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--fog)" }}>{winners.length} winner{winners.length !== 1 ? "s" : ""}</span>
          {winners.length > 0 && (
            <button
              type="button"
              onClick={exportWinnersCSV}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", background: "transparent", border: "1px solid var(--seam)", borderRadius: 7, fontSize: 12, color: "var(--ash)", cursor: "pointer" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--ink-muted)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <Download size={12} /> Export Winners CSV
            </button>
          )}
        </div>
        {isLoading ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--fog)", fontSize: 13 }}>Loading…</div>
        ) : winners.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            <Trophy size={32} style={{ color: "var(--ash)", margin: "0 auto 8px" }} />
            <p style={{ color: "var(--ash)", fontSize: 13 }}>No winners set yet.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "color-mix(in srgb, var(--ink-muted) 60%, transparent)" }}>
                  {["Position", "Name", "Roll No.", "Bank Account", "IFSC", "Prize", ""].map((h) => (
                    <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "var(--fog)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {winners.map((w) => (
                  <tr key={w.id} style={{ borderTop: "1px solid var(--seam)" }}>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{
                        fontWeight: 700, fontSize: 13,
                        color: w.position === 1 ? "#FFD700" : w.position === 2 ? "#C0C0C0" : w.position === 3 ? "#CD7F32" : "var(--fog)",
                        display: "flex", alignItems: "center", gap: 5,
                      }}>
                        {w.position <= 3 && <Trophy size={12} />}{posLabel(w.position)}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <p style={{ color: "var(--cream)", fontWeight: 600 }}>{w.participant_name}</p>
                      <p style={{ color: "var(--fog)", fontSize: 11, marginTop: 1 }}>{w.participant_email}</p>
                    </td>
                    <td style={{ padding: "12px 16px", color: "var(--fog)", fontSize: 12 }}>{w.roll_number ?? "—"}</td>
                    <td style={{ padding: "12px 16px" }}>
                      {w.bank_account_number ? (
                        <>
                          <p style={{ color: "var(--cream)", fontSize: 12 }}>{w.bank_account_name}</p>
                          <p style={{ color: "var(--fog)", fontSize: 11, fontFamily: "monospace" }}>{w.bank_account_number}</p>
                        </>
                      ) : <span style={{ color: "var(--ash)", fontSize: 12 }}>—</span>}
                    </td>
                    <td style={{ padding: "12px 16px", color: "var(--fog)", fontSize: 12, fontFamily: "monospace" }}>{w.bank_ifsc ?? "—"}</td>
                    <td style={{ padding: "12px 16px" }}>
                      {w.prize_amount ? (
                        <span style={{ color: "var(--jade)", fontWeight: 600, fontSize: 13 }}>₹{w.prize_amount.toLocaleString()}</span>
                      ) : <span style={{ color: "var(--ash)", fontSize: 12 }}>—</span>}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <button
                        type="button"
                        onClick={() => removeMutation.mutate(w.position)}
                        disabled={removeMutation.isPending}
                        style={{ padding: 5, background: "none", border: "none", cursor: "pointer", color: "var(--ash)", borderRadius: 6 }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = "var(--cinnabar)"; e.currentTarget.style.background = "color-mix(in srgb, var(--cinnabar) 10%, transparent)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = "var(--ash)"; e.currentTarget.style.background = "none"; }}
                      >
                        <X size={14} />
                      </button>
                    </td>
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
