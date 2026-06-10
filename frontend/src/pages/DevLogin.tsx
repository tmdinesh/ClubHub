import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import api, { apiError } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import { roleHomePath } from "@/lib/roleHome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ROLES = [
  "PARTICIPANT",
  "ATTENDANCE_TEAM",
  "CLUB_ADMIN",
  "FACULTY_ADVISOR",
  "SUPER_ADMIN",
];

const QUICK_LOGINS = [
  { label: "Super Admin", email: "admin@psgtech.ac.in", role: "SUPER_ADMIN" },
  { label: "Faculty Advisor", email: "faculty@psgtech.ac.in", role: "FACULTY_ADVISOR" },
  { label: "Club Admin", email: "clubadmin@psgtech.ac.in", role: "CLUB_ADMIN" },
  { label: "Participant", email: "student1@psgtech.ac.in", role: "PARTICIPANT" },
];

export default function DevLogin() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("PARTICIPANT");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function login(overrides?: { email: string; name: string; role: string }) {
    const payload = {
      email: overrides?.email ?? email,
      name: overrides?.name ?? (name || (overrides?.email ?? email).split("@")[0]),
      role: overrides?.role ?? role,
    };

    if (!payload.email) {
      setError("Email is required.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data } = await api.post("/auth/dev-login", payload);
      const me = await api.get("/auth/me", {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      setAuth(me.data, data.access_token, data.refresh_token);
      navigate(roleHomePath(me.data.role), { replace: true });
    } catch (err: any) {
      setError(apiError(err, "Login failed."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-primary/5 via-background to-accent/10">
      <header className="p-4">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          &larr; Back to events
        </Link>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-6">
          {/* Brand */}
          <div className="text-center">
            <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-2xl font-black text-primary-foreground shadow-lg">
              C
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              ClubOps
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Development login — not available in production.
            </p>
          </div>

          {/* Quick login buttons */}
          <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Quick login
            </p>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_LOGINS.map((q) => (
                <Button
                  key={q.email}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-xs"
                  disabled={loading}
                  onClick={() => login({ email: q.email, name: q.label, role: q.role })}
                >
                  {q.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Custom login form */}
          <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Custom login
            </p>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@psgtech.ac.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Name (optional)</Label>
              <Input
                id="name"
                placeholder="Your Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button
              className="w-full"
              onClick={() => login()}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            Want to use Google OAuth?{" "}
            <Link to="/login" className="underline underline-offset-2 hover:text-foreground">
              Sign in with Google
            </Link>
          </p>
        </div>
      </main>

      <footer className="py-6 text-center text-xs text-muted-foreground">
        &copy; {new Date().getFullYear()} ClubOps &mdash; Dev mode
      </footer>
    </div>
  );
}
