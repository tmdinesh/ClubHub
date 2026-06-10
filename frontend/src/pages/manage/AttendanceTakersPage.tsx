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
      <div className="p-8 max-w-3xl mx-auto">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
              <KeyRound size={22} className="text-indigo-500" />
              Attendance Taker Credentials
            </h1>
            <p className="text-slate-500 mt-1 text-sm">
              Generate 10 login credentials for attendance takers at this event.
            </p>
          </div>
          <div className="flex gap-2">
            {hasGenerated && (
              <button type="button"
                onClick={() => { if (confirm("Delete all credentials for this event?")) deleteMutation.mutate(); }}
                disabled={deleteMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 border border-red-100 rounded-lg text-xs font-semibold hover:bg-red-100 disabled:opacity-50 transition-colors"
              >
                {deleteMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                Delete All
              </button>
            )}
            <button type="button"
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending || (hasGenerated && existing.length >= 10)}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {generateMutation.isPending
                ? <Loader2 size={14} className="animate-spin" />
                : <RefreshCw size={14} />}
              {hasGenerated ? "Regenerate" : "Generate 10 Credentials"}
            </button>
          </div>
        </div>

        {newCreds.length > 0 && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
            <p className="flex-1 text-sm text-amber-800">
              <strong>Save these passwords now.</strong> They cannot be retrieved after you leave this page.
            </p>
            <button
              type="button"
              onClick={exportPdf}
              className="flex items-center gap-1.5 px-3 py-2 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700 transition-colors shrink-0"
            >
              <FileDown size={13} />
              Export PDF
            </button>
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/60 border-b border-slate-100">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Label</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Username</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Password</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Copy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      {[1, 2, 3, 4].map((j) => (
                        <td key={j} className="px-4 py-3.5">
                          <div className="h-4 bg-slate-100 rounded w-24" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : displayCreds.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-slate-400 text-sm">
                      No credentials yet. Click "Generate 10 Credentials" to create them.
                    </td>
                  </tr>
                ) : (
                  displayCreds.map((cred) => (
                    <tr key={cred.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3.5 text-slate-700 text-sm font-medium">{cred.label}</td>
                      <td className="px-4 py-3.5 font-mono text-xs text-slate-600">{cred.username}</td>
                      <td className="px-4 py-3.5">
                        {cred.plain_password ? (
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-slate-800">
                              {revealed[cred.id] ? cred.plain_password : "••••••••••"}
                            </span>
                            <button type="button"
                              onClick={() => setRevealed((p) => ({ ...p, [cred.id]: !p[cred.id] }))}
                              className="text-slate-400 hover:text-slate-700"
                            >
                              {revealed[cred.id] ? <EyeOff size={13} /> : <Eye size={13} />}
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-300 text-xs italic">Hidden</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {cred.plain_password && (
                          <button type="button"
                            onClick={() => copyText(`Username: ${cred.username}\nPassword: ${cred.plain_password}`, cred.id)}
                            className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                          >
                            {copied[cred.id] ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
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
          <p className="mt-3 text-xs text-slate-400 text-center">
            Attendance takers log in at <span className="font-mono">/attendance-login</span> with these credentials.
          </p>
        )}
      </div>
    </Layout>
  );
}
