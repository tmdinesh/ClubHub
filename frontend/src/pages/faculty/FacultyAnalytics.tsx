import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";
import { BarChart3, CalendarDays, Users, TrendingUp, DollarSign, Trophy, Download } from "lucide-react";
import Layout from "@/components/Layout";
import api from "@/lib/api";

interface ClubEvent {
  id: string;
  title: string;
  status: string;
  start_datetime: string | null;
  category: string | null;
  participants: number;
  spent: number;
  nps: number | null;
}

interface WinnerRow {
  event: string;
  event_date: string | null;
  position: number;
  prize_amount: number | null;
  participant_name: string;
  participant_email: string;
  roll_number: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  upi: string | null;
}

interface ClubDetail {
  club_id: string;
  club_name?: string;
  total_events: number;
  total_participants: number;
  total_spent: number;
  events: ClubEvent[];
}

const tooltipStyle = {
  contentStyle: { background: "#1a1a2e", border: "1px solid #2d2d4a", borderRadius: 8, fontSize: 12 },
  labelStyle: { color: "#e2e8f0", fontWeight: 600 },
  itemStyle: { color: "#a5b4fc" },
};

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

import type React from "react";

export default function FacultyAnalytics() {
  const today = new Date().toISOString().slice(0, 10);
  const yearStart = `${new Date().getFullYear()}-01-01`;
  const [fromDate, setFromDate] = useState(yearStart);
  const [toDate, setToDate] = useState(today);

  const { data, isLoading, error } = useQuery<ClubDetail>({
    queryKey: ["analytics", "my-club"],
    queryFn: () => api.get("/analytics/my-club").then((r) => r.data),
  });

  const { data: winners } = useQuery<WinnerRow[]>({
    queryKey: ["analytics", "my-club", "bank-details", fromDate, toDate],
    queryFn: () =>
      api.get(`/analytics/my-club/bank-details?from_date=${fromDate}&to_date=${toDate}`).then((r) => r.data),
    enabled: !!fromDate && !!toDate,
  });

  function downloadBankExport() {
    if (!fromDate || !toDate) return;
    api.get(`/analytics/my-club/bank-export?from_date=${fromDate}&to_date=${toDate}`, { responseType: "blob" })
      .then((res) => {
        const url = URL.createObjectURL(res.data);
        const a = document.createElement("a");
        a.href = url;
        a.download = `bank-details-${fromDate}-to-${toDate}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      });
  }

  const eventChartData = (data?.events ?? []).slice(0, 12).map((e) => ({
    name: e.title.length > 18 ? e.title.slice(0, 18) + "…" : e.title,
    Participants: e.participants ?? 0,
    Spent: e.spent ?? 0,
    NPS: e.nps ?? 0,
  }));

  return (
    <Layout>
      <div className="px-4 py-6 sm:px-8 sm:py-8 max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" style={{ color: "var(--cream)" }}>
            <BarChart3 size={22} style={{ color: "var(--amber)" }} />
            Club Analytics
          </h1>
          {data?.club_name && (
            <p className="mt-1 text-sm" style={{ color: "var(--fog)" }}>{data.club_name}</p>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl h-24 animate-pulse" style={{ background: "var(--ink-soft)", border: "1px solid var(--seam)" }} />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl p-5" style={{ background: "color-mix(in srgb, var(--cinnabar) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--cinnabar) 25%, transparent)" }}>
            <p className="text-sm" style={{ color: "var(--cinnabar)" }}>Failed to load analytics. Make sure a club is assigned to your account.</p>
          </div>
        ) : data ? (
          <>
            {/* Summary stats */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
              {[
                { icon: <CalendarDays size={16} style={{ color: "var(--amber)" }} />, label: "Total Events", value: data.total_events, color: "var(--amber)" },
                { icon: <Users size={16} style={{ color: "var(--jade)" }} />, label: "Total Participants", value: data.total_participants.toLocaleString(), color: "var(--jade)" },
                { icon: <DollarSign size={16} style={{ color: "var(--sky)" }} />, label: "Total Spent", value: `₹${data.total_spent.toLocaleString("en-IN")}`, color: "var(--sky)" },
                { icon: <TrendingUp size={16} style={{ color: "var(--indigo)" }} />, label: "Avg Participants", value: data.total_events ? Math.round(data.total_participants / data.total_events) : 0, color: "var(--indigo)" },
              ].map(({ icon, label, value, color }) => (
                <div key={label} className="rounded-xl p-4" style={{ background: "var(--ink-soft)", border: "1px solid var(--seam)" }}>
                  <div className="flex items-center gap-2 mb-1">{icon}<p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--dust)" }}>{label}</p></div>
                  <p className="text-2xl font-bold" style={{ color }}>{value}</p>
                </div>
              ))}
            </div>

            {eventChartData.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <ChartCard title="Participants per Event">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={eventChartData} margin={{ top: 0, right: 8, bottom: 48, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2d2d4a" />
                      <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                      <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} allowDecimals={false} />
                      <Tooltip {...tooltipStyle} />
                      <Bar dataKey="Participants" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Amount Spent per Event (₹)">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={eventChartData} margin={{ top: 0, right: 8, bottom: 48, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2d2d4a" />
                      <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                      <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} />
                      <Tooltip {...tooltipStyle} formatter={(v: number) => [`₹${v.toLocaleString("en-IN")}`, "Spent"]} />
                      <Bar dataKey="Spent" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                {eventChartData.some((e) => e.NPS !== 0) && (
                  <ChartCard title="NPS Score per Event">
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={eventChartData} margin={{ top: 0, right: 8, bottom: 48, left: 0 }}>
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
            <div className="rounded-xl overflow-hidden" style={{ background: "var(--ink-soft)", border: "1px solid var(--seam)" }}>
              <p className="px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--dust)", borderBottom: "1px solid var(--seam)" }}>
                Event Breakdown
              </p>
              {data.events.length === 0 ? (
                <p className="px-5 py-8 text-sm text-center" style={{ color: "var(--dust)" }}>No events yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ background: "var(--ink-muted)" }}>
                        {["Event", "Status", "Date", "Participants", "Spent", "NPS"].map((h) => (
                          <th key={h} className="px-5 py-2.5 text-left font-semibold uppercase tracking-wider" style={{ color: "var(--dust)" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.events.map((ev) => (
                        <tr key={ev.id} style={{ borderTop: "1px solid var(--seam)" }}>
                          <td className="px-5 py-3 font-medium max-w-[200px] truncate" style={{ color: "var(--cream)" }}>{ev.title}</td>
                          <td className="px-5 py-3">
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={EVENT_STATUS_STYLE[ev.status] ?? {}}>
                              {ev.status.replace(/_/g, " ")}
                            </span>
                          </td>
                          <td className="px-5 py-3 whitespace-nowrap" style={{ color: "var(--fog)" }}>
                            {ev.start_datetime ? new Date(ev.start_datetime).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                          </td>
                          <td className="px-5 py-3 font-semibold" style={{ color: "var(--jade)" }}>{ev.participants}</td>
                          <td className="px-5 py-3 font-semibold" style={{ color: "var(--amber)" }}>
                            {ev.spent ? `₹${ev.spent.toLocaleString("en-IN")}` : "—"}
                          </td>
                          <td className="px-5 py-3 font-semibold" style={{ color: ev.nps == null ? "var(--dust)" : ev.nps >= 0 ? "var(--jade)" : "var(--cinnabar)" }}>
                            {ev.nps != null ? ev.nps : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Winners & Bank Details */}
            <div className="rounded-xl overflow-hidden mt-5" style={{ background: "var(--ink-soft)", border: "1px solid var(--seam)" }}>
              <div className="px-5 py-3 flex flex-wrap items-center gap-3" style={{ borderBottom: "1px solid var(--seam)" }}>
                <Trophy size={14} style={{ color: "var(--amber)" }} />
                <p className="text-xs font-semibold uppercase tracking-wider flex-1" style={{ color: "var(--dust)" }}>
                  Winners & Bank Details
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--seam)", background: "var(--ink-muted)", color: "var(--fog)", colorScheme: "dark" }}
                  />
                  <span style={{ color: "var(--dust)", fontSize: 12 }}>to</span>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--seam)", background: "var(--ink-muted)", color: "var(--fog)", colorScheme: "dark" }}
                  />
                  <button
                    onClick={downloadBankExport}
                    style={{ background: "var(--amber)", color: "var(--ink)", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--amber-glow)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "var(--amber)")}
                  >
                    <Download size={12} />
                    Export CSV
                  </button>
                </div>
              </div>
              {!winners || winners.length === 0 ? (
                <p className="px-5 py-8 text-sm text-center" style={{ color: "var(--dust)" }}>
                  No winner records in this date range.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ background: "var(--ink-muted)" }}>
                        {["Event", "Date", "Position", "Name", "Email", "Roll No.", "Prize (₹)", "Bank Name", "Account No.", "IFSC", "UPI"].map((h) => (
                          <th key={h} className="px-4 py-2.5 text-left font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--dust)" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {winners.map((w, i) => (
                        <tr key={i} style={{ borderTop: "1px solid var(--seam)" }}>
                          <td className="px-4 py-3 font-medium max-w-[160px] truncate" style={{ color: "var(--cream)" }}>{w.event}</td>
                          <td className="px-4 py-3 whitespace-nowrap" style={{ color: "var(--fog)" }}>
                            {w.event_date ? new Date(w.event_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                          </td>
                          <td className="px-4 py-3 font-semibold" style={{ color: "var(--amber)" }}>
                            {["", "1st", "2nd", "3rd", "4th"][w.position] ?? `${w.position}th`}
                          </td>
                          <td className="px-4 py-3" style={{ color: "var(--cream)" }}>{w.participant_name}</td>
                          <td className="px-4 py-3" style={{ color: "var(--fog)" }}>{w.participant_email}</td>
                          <td className="px-4 py-3" style={{ color: "var(--fog)" }}>{w.roll_number ?? "—"}</td>
                          <td className="px-4 py-3 font-semibold" style={{ color: w.prize_amount ? "var(--jade)" : "var(--dust)" }}>
                            {w.prize_amount ? `₹${w.prize_amount.toLocaleString("en-IN")}` : "—"}
                          </td>
                          <td className="px-4 py-3" style={{ color: "var(--fog)" }}>{w.bank_account_name ?? "—"}</td>
                          <td className="px-4 py-3 font-mono" style={{ color: "var(--fog)" }}>{w.bank_account_number ?? "—"}</td>
                          <td className="px-4 py-3 font-mono" style={{ color: "var(--fog)" }}>{w.bank_ifsc ?? "—"}</td>
                          <td className="px-4 py-3" style={{ color: "var(--sky)" }}>{w.upi ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </Layout>
  );
}
