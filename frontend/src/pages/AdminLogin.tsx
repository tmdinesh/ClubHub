import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Loader2, ShieldAlert } from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";

export default function AdminLogin() {
  const navigate = useNavigate();
  const { setAuth, isAuthenticated } = useAuthStore();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated()) navigate("/admin", { replace: true });
  }, [isAuthenticated, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data } = await api.post<{ access_token: string; refresh_token: string }>(
        "/auth/admin-login",
        { username, password }
      );
      const me = await api.get("/auth/me", {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      setAuth(me.data, data.access_token, data.refresh_token);
      navigate("/admin", { replace: true });
    } catch {
      setError("Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      background: "var(--ink)", fontFamily: "'Outfit', sans-serif",
      position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "fixed", top: "30%", left: "50%", transform: "translate(-50%, -50%)",
        width: 600, height: 350, pointerEvents: "none",
        background: "radial-gradient(ellipse, rgba(245,166,35,0.04) 0%, transparent 70%)",
      }} />

      <header style={{ padding: "20px 28px" }}>
        <Link to="/" style={{ fontSize: 13, color: "var(--fog)", textDecoration: "none" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--cream)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--fog)")}
        >
          ← Back to events
        </Link>
      </header>

      <main style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 20px" }}>
        <div style={{ width: "100%", maxWidth: 380 }} className="animate-fade-up">

          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16,
              background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
              border: "1px solid var(--seam)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 20px",
              boxShadow: "0 0 32px rgba(245,166,35,0.12)",
            }}>
              <ShieldAlert size={26} color="var(--amber)" />
            </div>
            <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 30, color: "var(--cream)", letterSpacing: "-0.03em", lineHeight: 1.1, marginBottom: 10 }}>
              Administrator Login
            </h1>
            <p style={{ fontSize: 13, color: "var(--fog)", lineHeight: 1.6 }}>
              Restricted access. Super admin credentials only.
            </p>
          </div>

          <div style={{
            background: "var(--ink-soft)", border: "1px solid var(--seam)",
            borderRadius: 16, padding: 28,
          }}>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--fog)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                  placeholder="Enter username"
                  style={{
                    background: "var(--ink)", border: "1px solid var(--seam)", borderRadius: 8,
                    padding: "10px 14px", fontSize: 14, color: "var(--cream)", outline: "none",
                    transition: "border-color 150ms",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "var(--amber)")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "var(--seam)")}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--fog)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="Enter password"
                  style={{
                    background: "var(--ink)", border: "1px solid var(--seam)", borderRadius: 8,
                    padding: "10px 14px", fontSize: 14, color: "var(--cream)", outline: "none",
                    transition: "border-color 150ms",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "var(--amber)")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "var(--seam)")}
                />
              </div>

              {error && (
                <p style={{ fontSize: 13, color: "var(--red, #ef4444)", textAlign: "center", margin: 0 }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || !username || !password}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
                  gap: 8, padding: "12px 20px", borderRadius: 10,
                  background: loading || !username || !password ? "var(--ink-muted)" : "var(--amber)",
                  color: "var(--ink)", border: "none",
                  cursor: loading || !username || !password ? "not-allowed" : "pointer",
                  fontSize: 14, fontWeight: 600, transition: "all 150ms",
                  marginTop: 4,
                }}
              >
                {loading ? <><Loader2 size={16} className="animate-spin" /> Signing in…</> : "Sign in"}
              </button>
            </form>

            <p style={{ fontSize: 11, color: "var(--dust)", textAlign: "center", marginTop: 16 }}>
              This login is exclusively for system administrators.
            </p>
          </div>

          <p style={{ textAlign: "center", marginTop: 24, fontSize: 13, color: "var(--fog)" }}>
            Regular user?{" "}
            <Link to="/login" style={{ color: "var(--amber)", textDecoration: "none", fontWeight: 500 }}>
              Sign in with Google →
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
