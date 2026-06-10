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
    <div className="flex min-h-screen items-center justify-center bg-[#0F1117] px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 shadow-lg">
            <Radio size={30} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Attendance Login</h1>
          <p className="mt-1 text-sm text-white/40">
            Use the credentials provided by your event manager.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="att-xxxxxxxxxxxxxxxx-01"
                className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-mono text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-white/20"
                autoComplete="username"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••"
                className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autoComplete="current-password"
              />
            </div>
            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading || !username || !password}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40 transition-colors"
            >
              {loading && <Loader2 size={15} className="animate-spin" />}
              Sign In
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-white/25">
          Credentials are provided by the Club Admin for each event.
        </p>
      </div>
    </div>
  );
}
