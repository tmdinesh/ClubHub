import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { KeyRound, RefreshCw, Loader2, Copy, Check, Eye, EyeOff, Trash2, FileDown } from "lucide-react";
import Layout from "@/components/Layout";
import api from "@/lib/api";

interface Cred {
  id: string;
  event_id: string;
  username: string;
  label: string;
  is_active: boolean;
  plain_password?: string;
}

export default function AttendanceTakersPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const qc = useQueryClient();
  const [newCreds, setNewCreds] = useState<Cred[]>([]);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<Record<string, boolean>>({});

  const { data: existing = [], isLoading } = useQuery<Cred[]>({
    queryKey: ["attendance-creds", eventId],
    queryFn: () => api.get(`/events/${eventId}/attendance-credentials`).then((r) => r.data),
    enabled: !!eventId,
  });

  const generateMutation = useMutation({
    mutationFn: () => api.post<Cred[]>(`/events/${eventId}/attendance-credentials`),
    onSuccess: (res) => {
      setNewCreds(res.data);
      qc.invalidateQueries({ queryKey: ["attendance-creds", eventId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/events/${eventId}/attendance-credentials`),
    onSuccess: () => {
      setNewCreds([]);
      qc.invalidateQueries({ queryKey: ["attendance-creds", eventId] });
    },
  });

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied((p) => ({ ...p, [key]: true }));
    setTimeout(() => setCopied((p) => ({ ...p, [key]: false })), 1500);
  }

  function exportPdf() {
    const cards = newCreds.map((c) => `
      <div style="border:1px solid #cbd5e1;border-radius:8px;padding:16px 20px;page-break-inside:avoid;margin-bottom:12px;font-family:monospace">
        <div style="font-size:11px;color:#64748b;font-family:sans-serif;margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:.5px">${c.label}</div>
        <div style="margin-bottom:4px"><span style="color:#94a3b8;font-size:11px">Username:</span> <strong>${c.username}</strong></div>
        <div><span style="color:#94a3b8;font-size:11px">Password:</span> <strong>${c.plain_password ?? "—"}</strong></div>
      </div>`).join("");

    const html = `<!DOCTYPE html><html><head><title>Attendance Credentials</title>
      <style>
        body{margin:32px;font-family:sans-serif;color:#1e293b}
        h2{font-size:16px;margin-bottom:4px;font-weight:700}
        p{font-size:12px;color:#64748b;margin-bottom:20px}
        .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        @media print{body{margin:16px}}
      </style></head>
      <body>
        <h2>Attendance Taker Credentials</h2>
        <p>Distribute one card per volunteer. Passwords are single-use secrets — keep secure.</p>
        <div class="grid">${cards}</div>
      </body></html>`;

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  }

  const displayCreds = newCreds.length > 0 ? newCreds : existing;
  const hasGenerated = existing.length > 0;

  return (
    <Layout eventId={eventId}>
      <div className="px-4 py-6 sm:px-8 sm:py-8 max-w-3xl mx-auto">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1
              className="text-2xl font-bold tracking-tight flex items-center gap-2"
              style={{ color: "var(--cream)" }}
            >
              <KeyRound size={22} style={{ color: "var(--amber)" }} />
              Attendance Taker Credentials
            </h1>
            <p className="mt-1 text-sm" style={{ color: "var(--fog)" }}>
              Generate 10 login credentials for attendance takers at this event.
            </p>
          </div>
          <div className="flex gap-2">
            {hasGenerated && (
              <button
                type="button"
                onClick={() => {
                  if (confirm("Delete all credentials for this event?")) deleteMutation.mutate();
                }}
                disabled={deleteMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
                style={{
                  background: "color-mix(in srgb, var(--cinnabar) 10%, transparent)",
                  color: "var(--cinnabar)",
                  border: "1px solid color-mix(in srgb, var(--cinnabar) 30%, transparent)",
                  opacity: deleteMutation.isPending ? 0.4 : 1,
                }}
              >
                {deleteMutation.isPending ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Trash2 size={13} />
                )}
                Delete All
              </button>
            )}
            <button
              type="button"
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending || (hasGenerated && existing.length >= 10)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
              style={{
                background: "var(--amber)",
                color: "var(--ink)",
                opacity:
                  generateMutation.isPending || (hasGenerated && existing.length >= 10) ? 0.4 : 1,
              }}
              onMouseEnter={(e) => {
                if (!generateMutation.isPending)
                  e.currentTarget.style.background = "var(--amber-glow)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "var(--amber)";
              }}
            >
              {generateMutation.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <RefreshCw size={14} />
              )}
              {hasGenerated ? "Regenerate" : "Generate 10 Credentials"}
            </button>
          </div>
        </div>

        {newCreds.length > 0 && (
          <div
            className="flex items-center gap-3 rounded-xl p-4 mb-5"
            style={{
              background: "color-mix(in srgb, var(--amber) 10%, transparent)",
              border: "1px solid color-mix(in srgb, var(--amber) 30%, transparent)",
            }}
          >
            <p className="flex-1 text-sm" style={{ color: "var(--amber)" }}>
              <strong>Save these passwords now.</strong> They cannot be retrieved after you leave this page.
            </p>
            <button
              type="button"
              onClick={exportPdf}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold shrink-0 transition-colors"
              style={{
                background: "var(--amber)",
                color: "var(--ink)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--amber-glow)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "var(--amber)";
              }}
            >
              <FileDown size={13} />
              Export PDF
            </button>
          </div>
        )}

        <div
          className="rounded-xl overflow-hidden"
          style={{
            background: "var(--ink-soft)",
            border: "1px solid var(--seam)",
          }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "var(--ink-muted)", borderBottom: "1px solid var(--seam)" }}>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                    style={{ color: "var(--dust)" }}
                  >
                    Label
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                    style={{ color: "var(--dust)" }}
                  >
                    Username
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                    style={{ color: "var(--dust)" }}
                  >
                    Password
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                    style={{ color: "var(--dust)" }}
                  >
                    Copy
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse" style={{ borderBottom: "1px solid var(--seam)" }}>
                      {[1, 2, 3, 4].map((j) => (
                        <td key={j} className="px-4 py-3.5">
                          <div
                            className="h-4 rounded w-24"
                            style={{ background: "var(--ink-muted)" }}
                          />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : displayCreds.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-12 text-center text-sm"
                      style={{ color: "var(--fog)" }}
                    >
                      No credentials yet. Click "Generate 10 Credentials" to create them.
                    </td>
                  </tr>
                ) : (
                  displayCreds.map((cred) => (
                    <tr
                      key={cred.id}
                      style={{ borderBottom: "1px solid var(--seam)" }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background =
                          "color-mix(in srgb, var(--cream) 3%, transparent)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                      }}
                    >
                      <td className="px-4 py-3.5 text-sm font-medium" style={{ color: "var(--cream)" }}>
                        {cred.label}
                      </td>
                      <td
                        className="px-4 py-3.5 font-mono text-xs"
                        style={{ color: "var(--fog)" }}
                      >
                        {cred.username}
                      </td>
                      <td className="px-4 py-3.5">
                        {cred.plain_password ? (
                          <div className="flex items-center gap-2">
                            <span
                              className="font-mono text-xs"
                              style={{
                                color: revealed[cred.id] ? "var(--jade)" : "var(--dust)",
                              }}
                            >
                              {revealed[cred.id] ? cred.plain_password : "••••••••••"}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setRevealed((p) => ({ ...p, [cred.id]: !p[cred.id] }))
                              }
                              style={{ color: "var(--fog)" }}
                            >
                              {revealed[cred.id] ? <EyeOff size={13} /> : <Eye size={13} />}
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs italic" style={{ color: "var(--dust)" }}>
                            Hidden
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {cred.plain_password && (
                          <button
                            type="button"
                            onClick={() =>
                              copyText(
                                `Username: ${cred.username}\nPassword: ${cred.plain_password}`,
                                cred.id
                              )
                            }
                            className="flex items-center gap-1 text-xs font-medium transition-colors"
                            style={{
                              color: copied[cred.id] ? "var(--jade)" : "var(--amber)",
                            }}
                            onMouseEnter={(e) => {
                              if (!copied[cred.id])
                                e.currentTarget.style.color = "var(--amber-glow)";
                            }}
                            onMouseLeave={(e) => {
                              if (!copied[cred.id])
                                e.currentTarget.style.color = "var(--amber)";
                            }}
                          >
                            {copied[cred.id] ? (
                              <Check size={13} style={{ color: "var(--jade)" }} />
                            ) : (
                              <Copy size={13} />
                            )}
                            {copied[cred.id] ? "Copied" : "Copy"}
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

        {!isLoading && displayCreds.length > 0 && (
          <p className="mt-3 text-xs text-center" style={{ color: "var(--dust)" }}>
            Attendance takers log in at{" "}
            <span className="font-mono" style={{ color: "var(--fog)" }}>
              /attendance-login
            </span>{" "}
            with these credentials.
          </p>
        )}
      </div>
    </Layout>
  );
}
