import { useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { AlertCircle, Loader2 } from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import { roleHomePath } from "@/lib/roleHome";

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setAuth, isAuthenticated, user } = useAuthStore();

  useEffect(() => {
    const accessToken = searchParams.get("access_token");
    const refreshToken = searchParams.get("refresh_token");
    if (accessToken && refreshToken) {
      api.get("/auth/me", { headers: { Authorization: `Bearer ${accessToken}` } })
        .then((res) => { setAuth(res.data, accessToken, refreshToken); navigate(roleHomePath(res.data.role), { replace: true }); })
        .catch(() => {});
    }
  }, [searchParams, setAuth, navigate]);

  useEffect(() => {
    if (isAuthenticated()) navigate(roleHomePath(user?.role ?? "PARTICIPANT"), { replace: true });
  }, [isAuthenticated, navigate]);

  const isPending = !!(searchParams.get("access_token") && searchParams.get("refresh_token"));
  const oauthError = searchParams.get("error");

  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      background: "var(--ink)", fontFamily: "'Outfit', sans-serif",
    }}>
      {/* ── Nav (matches EventDiscovery) ── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "#e8eef5",
        borderBottom: "1px solid #c8d5e8",
        boxShadow: "0 1px 4px rgba(30,45,74,0.08)",
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", height: 88, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link to="/" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}>
            <img
              src="https://upload.wikimedia.org/wikipedia/en/e/eb/PSG_College_of_Technology_logo.png"
              alt="PSG College of Technology"
              style={{ height: 64, width: "auto", display: "block", flexShrink: 0 }}
            />
            <div style={{ width: 1, height: 44, background: "#b0c4d8", flexShrink: 0 }} />
            <div>
              <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: 15, color: "#1e2d4a", letterSpacing: "-0.02em", lineHeight: 1.2, margin: 0 }}>
                PSG College of Technology
              </p>
              <p style={{ fontSize: 10, color: "#4a6080", margin: "2px 0 0", letterSpacing: "0.04em" }}>
                ClubHub · Event Portal
              </p>
            </div>
          </Link>
        </div>
      </header>

      {/* Background glow */}
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        width: 700, height: 400, pointerEvents: "none",
        background: "radial-gradient(ellipse, rgba(245,166,35,0.05) 0%, transparent 70%)",
      }} />

      <main style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
        <div style={{ width: "100%", maxWidth: 380 }} className="animate-fade-up">

          {/* Brand mark */}
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16, background: "var(--amber)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 20px",
              boxShadow: "0 0 32px rgba(245,166,35,0.25)",
            }}>
              <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 26, fontStyle: "italic", color: "var(--ink)" }}>C</span>
            </div>
            <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 32, color: "var(--cream)", letterSpacing: "-0.03em", lineHeight: 1.1, marginBottom: 10 }}>
              Welcome back
            </h1>
            <p style={{ fontSize: 14, color: "var(--fog)", lineHeight: 1.6 }}>
              Sign in with your institutional account<br />to access ClubHub.
            </p>
          </div>

          {/* OAuth error banner */}
          {oauthError && (
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              background: "color-mix(in srgb, var(--cinnabar) 12%, transparent)",
              border: "1px solid color-mix(in srgb, var(--cinnabar) 30%, transparent)",
              borderRadius: 10, padding: "12px 14px", marginBottom: 16,
            }}>
              <AlertCircle size={16} style={{ color: "var(--cinnabar)", flexShrink: 0 }} />
              <p style={{ fontSize: 13, color: "var(--cinnabar)" }}>
                {oauthError === "access_denied"
                  ? "Sign-in was cancelled. Please grant the required permissions to continue."
                  : "Google sign-in failed. Please try again."}
              </p>
            </div>
          )}

          {/* Card */}
          <div style={{
            background: "var(--ink-soft)", border: "1px solid var(--seam)",
            borderRadius: 16, padding: 28,
          }}>
            <button
              type="button"
              onClick={() => { window.location.href = "/api/auth/google/login"; }}
              disabled={isPending}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
                gap: 10, padding: "12px 20px", borderRadius: 10,
                background: isPending ? "var(--ink-muted)" : "var(--cream)",
                color: "var(--ink)", border: "none", cursor: isPending ? "not-allowed" : "pointer",
                fontSize: 14, fontWeight: 600, transition: "all 150ms",
              }}
              onMouseEnter={(e) => { if (!isPending) { (e.currentTarget as HTMLElement).style.background = "#fff"; (e.currentTarget as HTMLElement).style.boxShadow = "0 0 20px rgba(245,240,232,0.15)"; } }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--cream)"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
            >
              {isPending ? (
                <><Loader2 size={16} className="animate-spin" /> Signing you in…</>
              ) : (
                <>
                  <svg viewBox="0 0 48 48" width={18} height={18} aria-hidden="true">
                    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
                    <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
                    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
                    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
                  </svg>
                  Continue with Google
                </>
              )}
            </button>

            <p style={{ fontSize: 11, color: "var(--dust)", textAlign: "center", marginTop: 16 }}>
              Only institutional email domains are permitted.
            </p>
          </div>

        </div>
      </main>

      {/* ── Footer (matches EventDiscovery) ── */}
      <footer style={{
        borderTop: "1px solid var(--seam)",
        padding: "24px",
        marginTop: 48,
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ background: "#e8eef5", borderRadius: 6, padding: "3px 6px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <img src="https://upload.wikimedia.org/wikipedia/en/e/eb/PSG_College_of_Technology_logo.png" alt="PSG Tech" style={{ height: 52, width: "auto", display: "block" }} />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "var(--cream)", margin: 0 }}>PSG College of Technology</p>
              <p style={{ fontSize: 11, color: "var(--fog)", margin: "3px 0 0" }}>Peelamedu, Coimbatore – 641 004</p>
            </div>
          </div>
          <p style={{ fontSize: 11, color: "var(--dust)", textAlign: "center", margin: 0 }}>
            © All rights reserved · PSG Tech Students' Union
          </p>
          <p style={{ fontSize: 10, color: "var(--dust)", margin: 0 }}>
            Developed by Dinesh T M (23Z320)
          </p>
        </div>
      </footer>
    </div>
  );
}
