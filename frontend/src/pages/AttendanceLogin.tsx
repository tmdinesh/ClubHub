import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Radio } from "lucide-react";
import api, { apiError } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";

export default function AttendanceLogin() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!username || !password) return;
    setLoading(true);
    setError("");
    try {
      const { data } = await api.post<{ access_token: string; event_id: string }>(
        "/attendance-login",
        { username, password }
      );

      // Store the attendance-taker session
      setAuth(
        {
          id: username,
          email: `${username}@attendance`,
          name: username,
          avatar_url: null,
          role: "ATTENDANCE_TEAM",
          department: null,
          year: null,
          is_active: true,
          club_id: null,
        },
        data.access_token,
        ""
      );

      // Redirect to the dedicated scan page for this event
      navigate(`/attendance/${data.event_id}`);
    } catch (err) {
      setError(apiError(err, "Invalid username or password."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{ background: "var(--ink)" }}
    >
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div
            className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg"
            style={{ background: "var(--amber)" }}
          >
            <Radio size={30} style={{ color: "var(--ink)" }} />
          </div>
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: "var(--cream)" }}
          >
            Attendance Login
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--fog)" }}>
            Use the credentials provided by your event manager.
          </p>
        </div>

        <div
          className="rounded-2xl p-6"
          style={{
            background: "var(--ink-soft)",
            border: "1px solid var(--seam)",
          }}
        >
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: "var(--dust)" }}
              >
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="att-xxxxxxxxxxxxxxxx-01"
                className="w-full rounded-xl px-4 py-3 text-sm font-mono focus:outline-none"
                style={{
                  background: "var(--ink-muted)",
                  border: "1px solid var(--seam)",
                  color: "var(--cream)",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--amber)";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(245,166,35,0.12)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--seam)";
                  e.currentTarget.style.boxShadow = "none";
                }}
                autoComplete="username"
              />
            </div>
            <div className="space-y-1.5">
              <label
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: "var(--dust)" }}
              >
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••"
                className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none"
                style={{
                  background: "var(--ink-muted)",
                  border: "1px solid var(--seam)",
                  color: "var(--cream)",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--amber)";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(245,166,35,0.12)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--seam)";
                  e.currentTarget.style.boxShadow = "none";
                }}
                autoComplete="current-password"
              />
            </div>
            {error && (
              <p className="text-sm" style={{ color: "var(--cinnabar)" }}>
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading || !username || !password}
              className="w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors"
              style={{
                background: "var(--amber)",
                color: "var(--ink)",
                opacity: loading || !username || !password ? 0.4 : 1,
              }}
              onMouseEnter={(e) => {
                if (!loading && username && password)
                  e.currentTarget.style.background = "var(--amber-glow)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "var(--amber)";
              }}
            >
              {loading && <Loader2 size={15} className="animate-spin" />}
              Sign In
            </button>
          </form>
        </div>

        <p className="text-center text-xs" style={{ color: "var(--dust)" }}>
          Credentials are provided by the Club Admin for each event.
        </p>
      </div>
    </div>
  );
}
