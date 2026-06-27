import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import {
  Radio, UserCheck, UserX, Users, AlertCircle,
  Plus, MapPin, Loader2, Download, Lock,
} from "lucide-react";
import Layout from "@/components/Layout";
import api, { apiError } from "@/lib/api";
import type { AttendanceDashboard as AttendanceData, Event } from "@/types";

interface Checkpoint {
  id: string;
  event_id: string;
  name: string;
  description: string | null;
  order: number;
}

interface AttendanceResponse extends AttendanceData {
  checkpoints?: Checkpoint[];
}

interface PresentUser {
  user_id: string;
  name: string;
  email: string;
  team_name?: string;
}

function MiniStat({ icon, value, label, color, bg }: {
  icon: React.ReactNode; value: number | string;
  label: string; color: string; bg: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: 16,
        borderRadius: 12,
        background: "var(--ink-muted)",
        border: "1px solid var(--seam)",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: bg,
          color: color,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <p style={{ fontSize: 24, fontWeight: 700, color: "var(--cream)", lineHeight: 1 }}>{value}</p>
        <p style={{ fontSize: 12, color: "var(--fog)", marginTop: 2 }}>{label}</p>
      </div>
    </div>
  );
}

function exportXlsx(present: PresentUser[], eventTitle: string) {
  const headers = ["Name", "Email", "Team"];
  const rows = present.map((p) => [p.name, p.email, p.team_name ?? ""]);
  const csvContent = [headers, ...rows]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csvContent], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `attendance-${eventTitle || "event"}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AttendanceDashboard() {
  const { eventId } = useParams<{ eventId: string }>();
  const qc = useQueryClient();

  const [newCpName, setNewCpName] = useState("");
  const [cpError, setCpError] = useState("");

  const { data: eventData } = useQuery<Event>({
    queryKey: ["event", eventId],
    queryFn: () => api.get(`/events/by-id/${eventId}`).then((r) => r.data),
    enabled: !!eventId,
    staleTime: 5 * 60 * 1000,
  });
  const isCompleted = eventData?.status === "COMPLETED";

  const { data, isLoading, error, dataUpdatedAt } = useQuery<AttendanceResponse>({
    queryKey: ["attendance", eventId],
    queryFn: () => api.get(`/events/${eventId}/attendance`).then((r) => r.data),
    enabled: !!eventId,
    refetchInterval: 30_000,
  });

  const { data: checkpoints = [], isLoading: loadingCps } = useQuery<Checkpoint[]>({
    queryKey: ["checkpoints", eventId],
    queryFn: () =>
      api.get(`/events/${eventId}/checkpoints`)
        .then((r) => r.data.sort((a: Checkpoint, b: Checkpoint) => a.order - b.order)),
    enabled: !!eventId,
  });

  const { data: present = [], isLoading: loadingPresent } = useQuery<PresentUser[]>({
    queryKey: ["present-users", eventId],
    queryFn: () => api.get(`/events/${eventId}/attendance/present`).then((r) => r.data),
    enabled: !!eventId,
    refetchInterval: 30_000,
  });

  const createCpMutation = useMutation({
    mutationFn: (name: string) =>
      api.post(`/events/${eventId}/checkpoints`, { name, order: checkpoints.length + 1 }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["checkpoints", eventId] });
      setNewCpName("");
      setCpError("");
    },
    onError: (err) => setCpError(apiError(err, "Failed to create checkpoint.")),
  });

  function handleCreateCp(e: React.FormEvent) {
    e.preventDefault();
    if (!newCpName.trim()) return;
    createCpMutation.mutate(newCpName.trim());
  }

  const attendanceRate = data
    ? ((data.present / Math.max(data.registered, 1)) * 100).toFixed(1)
    : "0.0";
  const progressPct = data
    ? Math.min((data.present / Math.max(data.registered, 1)) * 100, 100)
    : 0;
  const lastUpdate = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString()
    : "—";

  return (
    <Layout eventId={eventId}>
      <div className="px-4 py-6 sm:px-8 sm:py-8" style={{ maxWidth: 960, margin: "0 auto" }}>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3" style={{ marginBottom: 28 }}>
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
              <Radio size={22} style={{ color: "var(--jade)" }} />
              Live Attendance
            </h1>
            <p style={{ color: "var(--fog)", marginTop: 4, fontSize: 14 }}>
              Refreshes every 30s · Last updated: {lastUpdate}
            </p>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              color: "var(--jade)",
              fontWeight: 500,
              background: "color-mix(in srgb, var(--jade) 10%, transparent)",
              border: "1px solid color-mix(in srgb, var(--jade) 30%, transparent)",
              borderRadius: 999,
              padding: "6px 12px",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "var(--jade)",
                animation: "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite",
              }}
            />
            Live
          </div>
        </div>

        {error && (
          <div
            style={{
              background: "color-mix(in srgb, var(--cinnabar) 10%, transparent)",
              border: "1px solid color-mix(in srgb, var(--cinnabar) 25%, transparent)",
              borderRadius: 12,
              padding: "20px 24px",
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 24,
            }}
          >
            <AlertCircle size={18} style={{ color: "var(--cinnabar)", flexShrink: 0 }} />
            <p style={{ fontSize: 14, color: "var(--cinnabar)" }}>Failed to load attendance data.</p>
          </div>
        )}

        {isCompleted && (
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            background: "color-mix(in srgb, var(--amber) 8%, transparent)",
            border: "1px solid color-mix(in srgb, var(--amber) 25%, transparent)",
            borderRadius: 10, padding: "12px 16px", marginBottom: 20,
          }}>
            <Lock size={14} style={{ color: "var(--amber)", flexShrink: 0 }} />
            <p style={{ fontSize: 13, color: "var(--amber)" }}>
              This event is completed. Attendance records are read-only.
            </p>
          </div>
        )}

        {/* Checkpoints */}
        <div
          style={{
            background: "var(--ink-soft)",
            border: "1px solid var(--seam)",
            borderRadius: 12,
            padding: 20,
            marginBottom: 20,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <h2
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--cream)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <MapPin size={14} style={{ color: "var(--amber)" }} />
                Checkpoints
              </h2>
              <p style={{ fontSize: 12, color: "var(--ash)", marginTop: 2 }}>
                Attendance takers must select a checkpoint before scanning.
              </p>
            </div>
          </div>
          <form onSubmit={handleCreateCp} style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <input
              type="text"
              value={newCpName}
              onChange={(e) => { setNewCpName(e.target.value); setCpError(""); }}
              placeholder="e.g. Main Entrance, Hall A, Gate 2…"
              disabled={isCompleted}
              style={{
                flex: 1,
                fontSize: 14,
                padding: "8px 12px",
                borderRadius: 8,
                background: "var(--ink-muted)",
                border: "1px solid var(--seam)",
                color: "var(--cream)",
                outline: "none",
                opacity: isCompleted ? 0.5 : 1,
              }}
              onFocus={(e) => {
                if (isCompleted) return;
                e.currentTarget.style.borderColor = "var(--amber)";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(245,166,35,0.12)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--seam)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
            <button
              type="submit"
              disabled={!newCpName.trim() || createCpMutation.isPending || isCompleted}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 16px",
                background: "var(--amber)",
                color: "var(--ink)",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                flexShrink: 0,
                opacity: (!newCpName.trim() || createCpMutation.isPending || isCompleted) ? 0.5 : 1,
                transition: "opacity 0.15s",
              }}
            >
              {createCpMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Add
            </button>
          </form>
          {cpError && (
            <p style={{ fontSize: 12, color: "var(--cinnabar)", marginBottom: 12, display: "flex", alignItems: "center", gap: 4 }}>
              <AlertCircle size={11} /> {cpError}
            </p>
          )}
          {loadingCps ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {Array.from({ length: 2 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    height: 40,
                    background: "var(--ink-muted)",
                    borderRadius: 8,
                    animation: "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite",
                  }}
                />
              ))}
            </div>
          ) : checkpoints.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "24px 16px",
                background: "color-mix(in srgb, var(--amber) 8%, transparent)",
                border: "1px solid color-mix(in srgb, var(--amber) 20%, transparent)",
                borderRadius: 12,
              }}
            >
              <MapPin size={24} style={{ color: "var(--amber)", margin: "0 auto 8px" }} />
              <p style={{ fontSize: 14, fontWeight: 500, color: "var(--amber)" }}>No checkpoints yet</p>
              <p style={{ fontSize: 12, color: "color-mix(in srgb, var(--amber) 70%, var(--fog))", marginTop: 4 }}>
                Add at least one — attendance takers need a checkpoint to scan against.
              </p>
            </div>
          ) : (
            <div>
              {checkpoints.map((cp, idx) => (
                <div
                  key={cp.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 0",
                    borderTop: idx === 0 ? "none" : "1px solid var(--seam)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        background: "color-mix(in srgb, var(--amber) 15%, transparent)",
                        color: "var(--amber)",
                        fontSize: 12,
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {idx + 1}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 500, color: "var(--cream)" }}>{cp.name}</span>
                  </div>
                  <span style={{ fontSize: 12, color: "var(--ash)" }}>Checkpoint {idx + 1}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Overall stats */}
        <div
          style={{
            background: "var(--ink-soft)",
            border: "1px solid var(--seam)",
            borderRadius: 12,
            padding: 24,
            marginBottom: 20,
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "var(--fog)" }}>Overall Attendance</p>
              <p style={{ fontSize: 12, color: "var(--ash)", marginTop: 2 }}>
                {isLoading ? "…" : `${data?.present ?? 0} present out of ${data?.registered ?? 0} registered`}
              </p>
            </div>
            <span style={{ fontSize: 30, fontWeight: 700, color: "var(--cream)" }}>
              {isLoading ? "—" : `${attendanceRate}%`}
            </span>
          </div>
          {isLoading ? (
            <div
              style={{
                height: 20,
                background: "var(--ink-muted)",
                borderRadius: 999,
                animation: "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite",
              }}
            />
          ) : (
            <div style={{ position: "relative", height: 20, background: "var(--ink-muted)", borderRadius: 999, overflow: "hidden" }}>
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  height: "100%",
                  background: "linear-gradient(to right, var(--jade), #2ec87a)",
                  borderRadius: 999,
                  transition: "width 0.7s",
                  width: `${progressPct}%`,
                }}
              />
              {progressPct >= 20 && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>
                    {attendanceRate}%
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                style={{
                  height: 80,
                  background: "var(--ink-muted)",
                  borderRadius: 12,
                  animation: "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite",
                }}
              />
            ))
          ) : (
            <>
              <MiniStat
                icon={<UserCheck size={16} />}
                value={data?.present ?? 0}
                label="Present"
                color="var(--jade)"
                bg="color-mix(in srgb, var(--jade) 15%, transparent)"
              />
              <MiniStat
                icon={<UserX size={16} />}
                value={data?.absent ?? 0}
                label="Absent"
                color="var(--cinnabar)"
                bg="color-mix(in srgb, var(--cinnabar) 15%, transparent)"
              />
              <MiniStat
                icon={<Users size={16} />}
                value={data?.registered ?? 0}
                label="Registered"
                color="var(--amber)"
                bg="color-mix(in srgb, var(--amber) 15%, transparent)"
              />
            </>
          )}
        </div>

        {/* Present participants list */}
        <div
          style={{
            background: "var(--ink-soft)",
            border: "1px solid var(--seam)",
            borderRadius: 12,
          }}
        >
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid var(--seam)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <h2
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--fog)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <UserCheck size={14} style={{ color: "var(--jade)" }} />
              Present Participants ({present.length})
            </h2>
            {present.length > 0 && (
              <button
                type="button"
                onClick={() => exportXlsx(present, `event-${eventId}`)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  background: "transparent",
                  border: "1px solid var(--seam)",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--ash)",
                  cursor: "pointer",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--ink-muted)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <Download size={13} /> Export CSV
              </button>
            )}
          </div>
          {loadingPresent ? (
            <div>
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    padding: "12px 16px",
                    display: "flex",
                    gap: 12,
                    borderTop: i > 0 ? "1px solid var(--seam)" : "none",
                    animation: "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite",
                  }}
                >
                  <div style={{ height: 16, background: "var(--ink-muted)", borderRadius: 4, width: 128 }} />
                  <div style={{ height: 16, background: "var(--ink-muted)", borderRadius: 4, width: 160 }} />
                </div>
              ))}
            </div>
          ) : present.length === 0 ? (
            <div style={{ padding: "40px 16px", textAlign: "center", color: "var(--ash)", fontSize: 14 }}>
              No participants scanned present yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
            <table style={{ width: "100%", minWidth: 480, fontSize: 14, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--ink-muted)", borderBottom: "1px solid var(--seam)" }}>
                  <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "var(--dust)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Name</th>
                  <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "var(--dust)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Email</th>
                  <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "var(--dust)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Team</th>
                </tr>
              </thead>
              <tbody>
                {present.map((p) => (
                  <tr
                    key={p.user_id}
                    style={{ borderTop: "1px solid var(--seam)", transition: "background 0.1s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "color-mix(in srgb, var(--cream) 3%, transparent)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "12px 16px", fontWeight: 500, color: "var(--cream)", fontSize: 14 }}>{p.name}</td>
                    <td style={{ padding: "12px 16px", color: "var(--fog)", fontSize: 12 }}>{p.email}</td>
                    <td style={{ padding: "12px 16px", color: "var(--fog)", fontSize: 12 }}>{p.team_name ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
