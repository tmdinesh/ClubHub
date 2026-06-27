import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Phone } from "lucide-react";
import api, { apiError } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import { roleHomePath } from "@/lib/roleHome";

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, setAuth, accessToken, refreshToken } = useAuthStore();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = phone.trim();
    if (!trimmed) {
      setError("Phone number is required.");
      return;
    }
    if (!/^\+?[0-9\s\-()]{7,20}$/.test(trimmed)) {
      setError("Enter a valid phone number.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await api.patch("/auth/me", { phone_number: trimmed });
      setAuth(res.data, accessToken!, refreshToken!);
      navigate(roleHomePath(res.data.role), { replace: true });
    } catch (err) {
      setError(apiError(err, "Failed to save. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--ink)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Outfit', sans-serif",
        padding: "24px 16px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          background: "var(--ink-soft)",
          border: "1px solid var(--seam)",
          borderRadius: 16,
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            background: "#e8eef5",
            borderBottom: "1px solid #c8d5e8",
            padding: "20px 28px",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <img
            src="https://upload.wikimedia.org/wikipedia/en/e/eb/PSG_College_of_Technology_logo.png"
            alt="PSG Tech"
            style={{ height: 48, width: "auto" }}
          />
          <div style={{ width: 1, height: 32, background: "#b0c4d8" }} />
          <div>
            <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: 13, color: "#1e2d4a", margin: 0 }}>
              PSG College of Technology
            </p>
            <p style={{ fontSize: 10, color: "#4a6080", margin: "2px 0 0" }}>ClubHub Portal</p>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "32px 28px" }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: "color-mix(in srgb, var(--amber) 15%, transparent)",
              border: "1px solid color-mix(in srgb, var(--amber) 30%, transparent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 20,
            }}
          >
            <Phone size={22} style={{ color: "var(--amber)" }} />
          </div>

          <h1 style={{ color: "var(--cream)", fontSize: 22, fontWeight: 700, margin: "0 0 6px", letterSpacing: "-0.02em" }}>
            One last step
          </h1>
          <p style={{ color: "var(--fog)", fontSize: 14, margin: "0 0 28px", lineHeight: 1.6 }}>
            Welcome{user?.name ? `, ${user.name.split(" ")[0]}` : ""}! Add your phone number so
            event organisers can reach you.
          </p>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label
                htmlFor="phone"
                style={{ fontSize: 12, fontWeight: 600, color: "var(--fog)", display: "block", marginBottom: 6 }}
              >
                Phone Number
              </label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => { setPhone(e.target.value); setError(""); }}
                placeholder="+91 98765 43210"
                autoFocus
                style={{
                  width: "100%",
                  background: "var(--ink-muted)",
                  border: `1px solid ${error ? "var(--cinnabar)" : "var(--seam)"}`,
                  borderRadius: 8,
                  padding: "10px 14px",
                  fontSize: 15,
                  color: "var(--cream)",
                  outline: "none",
                  boxSizing: "border-box",
                }}
                onFocus={(e) => {
                  if (!error) e.currentTarget.style.borderColor = "var(--amber)";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(245,166,35,0.12)";
                }}
                onBlur={(e) => {
                  if (!error) e.currentTarget.style.borderColor = "var(--seam)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
              {error && (
                <p style={{ fontSize: 12, color: "var(--cinnabar)", marginTop: 6 }}>{error}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                padding: "11px 0",
                background: loading ? "var(--ink-muted)" : "var(--amber)",
                color: loading ? "var(--fog)" : "var(--ink)",
                border: "none",
                borderRadius: 8,
                fontSize: 15,
                fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                transition: "opacity 0.15s",
                marginTop: 4,
              }}
            >
              {loading ? "Saving…" : "Continue"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
