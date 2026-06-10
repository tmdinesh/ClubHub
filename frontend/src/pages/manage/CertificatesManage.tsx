import { useRef, useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import {
  Award, Download, ShieldCheck, Loader2, Users, Trophy,
  Search, Check, X, AlertCircle, CheckCircle, Upload, ImageIcon,
  CreditCard,
} from "lucide-react";
import Layout from "@/components/Layout";
import api, { apiError } from "@/lib/api";
import type { Certificate } from "@/types";
import { fmtDateIST } from "@/lib/dateIST";

// Cert type badge styles using design system CSS vars
const CERT_TYPE_BADGE_STYLES: Record<Certificate["certificate_type"], React.CSSProperties> = {
  PARTICIPATION: { background: "color-mix(in srgb, var(--sky) 15%, transparent)", color: "var(--sky)", border: "1px solid color-mix(in srgb, var(--sky) 35%, transparent)" },
  VOLUNTEER:     { background: "color-mix(in srgb, var(--jade) 15%, transparent)", color: "var(--jade)", border: "1px solid color-mix(in srgb, var(--jade) 35%, transparent)" },
  WINNER:        { background: "var(--amber-dim)", color: "var(--amber)", border: "1px solid color-mix(in srgb, var(--amber) 35%, transparent)" },
  RUNNER_UP:     { background: "color-mix(in srgb, var(--fog) 15%, transparent)", color: "var(--fog)", border: "1px solid color-mix(in srgb, var(--fog) 35%, transparent)" },
};

const POSITIONS = ["1st", "2nd", "3rd", "4th"] as const;
type Position = typeof POSITIONS[number];

const POSITION_LABELS: Record<Position, string> = {
  "1st": "🥇 1st Place",
  "2nd": "🥈 2nd Place",
  "3rd": "🥉 3rd Place",
  "4th": "4th Place",
};

// Placeholder fields supported in templates
const PLACEHOLDER_FIELDS = ["name", "position", "date", "event_name", "club_name"] as const;
type PlaceholderField = typeof PLACEHOLDER_FIELDS[number];

const PLACEHOLDER_LABELS: Record<PlaceholderField, string> = {
  name: "Recipient Name",
  position: "Position (winner only)",
  date: "Issue Date",
  event_name: "Event Name",
  club_name: "Club Name",
};

interface PlaceholderConfig {
  x: number;
  y: number;
  font_size: number;
  color: string;
  align: "left" | "center" | "right";
}

interface CertTemplate {
  id: string;
  type: string;
  template_file_url: string;
  placeholders: Record<string, PlaceholderConfig> | null;
}

interface PresentUser {
  user_id: string;
  name: string;
  email: string;
}

interface WinnerAssignment {
  user_id: string;
  name: string;
  position: Position;
  bank_account?: string;
  bank_name?: string;
  ifsc?: string;
  upi?: string;
}

interface BankDetails {
  bank_account: string;
  bank_name: string;
  ifsc: string;
  upi: string;
}

function exportCertsCsv(certs: Certificate[]) {
  const headers = ["Recipient", "Type", "Position", "Account Number", "Bank Name", "IFSC", "UPI", "Code", "Issued", "PDF URL"];
  const rows = certs.map((c) => {
    const m = c.metadata_ ?? {};
    return [
      c.recipient_name || c.recipient_id,
      c.certificate_type,
      m.position || "",
      m.bank_account || "",
      m.bank_name || "",
      m.ifsc || "",
      m.upi || "",
      c.unique_code,
      fmtDateIST(c.issued_at),
      c.pdf_url || "",
    ];
  });
  const csv = [headers, ...rows]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "certificates.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ── Template Placeholder Editor ───────────────────────────────────────────────

interface PlaceholderEditorProps {
  certType: "PARTICIPATION" | "WINNER";
  onClose: () => void;
  eventId: string;
}

function TemplateEditor({ certType, onClose, eventId }: PlaceholderEditorProps) {
  const qc = useQueryClient();
  const imgRef = useRef<HTMLImageElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [placeholders, setPlaceholders] = useState<Record<string, PlaceholderConfig>>({});
  const [activeField, setActiveField] = useState<PlaceholderField>("name");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [fileDragOver, setFileDragOver] = useState(false);

  const availableFields: PlaceholderField[] = certType === "WINNER"
    ? ["name", "position", "date", "event_name", "club_name"]
    : ["name", "date", "event_name", "club_name"];

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(f);
    setPlaceholders({});
    setImgLoaded(false);
  }

  function handleImageClick(e: React.MouseEvent<HTMLImageElement>) {
    const img = imgRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    // Coordinates relative to actual image pixel dimensions
    const scaleX = img.naturalWidth / rect.width;
    const scaleY = img.naturalHeight / rect.height;
    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);
    setPlaceholders((prev) => ({
      ...prev,
      [activeField]: {
        x,
        y,
        font_size: prev[activeField]?.font_size ?? 48,
        color: prev[activeField]?.color ?? "#000000",
        align: prev[activeField]?.align ?? "center",
      },
    }));
  }

  function updateField(field: PlaceholderField, key: keyof PlaceholderConfig, value: string | number) {
    setPlaceholders((prev) => ({
      ...prev,
      [field]: { ...(prev[field] ?? { x: 0, y: 0, font_size: 48, color: "#000000", align: "center" }), [key]: value },
    }));
  }

  async function handleSave() {
    if (!file) { setError("Please select a template image."); return; }
    if (Object.keys(placeholders).length === 0) { setError("Place at least one placeholder on the template."); return; }
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("certificate_type", certType);
      fd.append("placeholders", JSON.stringify(placeholders));
      fd.append("file", file);
      await api.post(`/events/${eventId}/certificate-templates`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      qc.invalidateQueries({ queryKey: ["cert-templates", eventId] });
      setSuccess(true);
      setTimeout(onClose, 1200);
    } catch (err) {
      setError(apiError(err, "Upload failed."));
    } finally {
      setUploading(false);
    }
  }

  const fieldConfigInputStyle: React.CSSProperties = {
    display: "block",
    width: "100%",
    marginTop: 2,
    padding: "4px 8px",
    border: "1px solid var(--seam)",
    borderRadius: 6,
    fontSize: 12,
    background: "var(--ink)",
    color: "var(--cream)",
    outline: "none",
    boxSizing: "border-box",
  };

  return (
    <div
      style={{ background: "rgba(0,0,0,0.8)" }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        style={{ background: "var(--ink-soft)", border: "1px solid var(--seam)", color: "var(--cream)" }}
        className="rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
      >
        <div style={{ borderBottom: "1px solid var(--seam)" }} className="flex items-center justify-between px-6 py-4">
          <h2 style={{ color: "var(--cream)" }} className="text-base font-bold">
            Upload {certType === "WINNER" ? "Winner" : "Participation"} Certificate Template
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{ color: "var(--fog)" }}
            className="transition-colors"
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--cream)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--fog)")}
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* File picker */}
          <div>
            <label style={{ color: "var(--fog)" }} className="block text-xs font-semibold mb-2">Template Image (PNG or JPEG)</label>
            <label
              style={{
                border: fileDragOver ? "2px dashed var(--amber)" : "2px dashed var(--seam)",
                background: fileDragOver ? "color-mix(in srgb, var(--amber) 5%, transparent)" : "transparent",
                transition: "border-color 0.15s, background 0.15s",
              }}
              className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer"
              onMouseEnter={() => setFileDragOver(true)}
              onMouseLeave={() => setFileDragOver(false)}
            >
              <ImageIcon size={18} style={{ color: "var(--dust)" }} />
              <span style={{ color: "var(--dust)" }} className="text-sm">{file ? file.name : "Click to choose an image…"}</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </label>
          </div>

          {preview && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Canvas */}
              <div className="lg:col-span-2">
                <p style={{ color: "var(--dust)" }} className="text-xs mb-2 flex items-center gap-1">
                  <span style={{ background: "var(--amber)" }} className="inline-block w-2 h-2 rounded-full" />
                  Click on the image to place the <strong style={{ color: "var(--cream)" }}>{PLACEHOLDER_LABELS[activeField]}</strong> field
                </p>
                <div style={{ border: "1px solid var(--seam)" }} className="relative rounded-xl overflow-hidden">
                  <img
                    ref={imgRef}
                    src={preview}
                    alt="Template"
                    onClick={handleImageClick}
                    onLoad={() => setImgLoaded(true)}
                    className="w-full cursor-crosshair"
                  />
                  {/* Render placed markers */}
                  {imgLoaded && imgRef.current && Object.entries(placeholders).map(([field, cfg]) => {
                    const img = imgRef.current!;
                    const scaleX = img.getBoundingClientRect().width / img.naturalWidth;
                    const scaleY = img.getBoundingClientRect().height / img.naturalHeight;
                    const left = cfg.x * scaleX;
                    const top = cfg.y * scaleY;
                    return (
                      <div
                        key={field}
                        style={{ left, top, transform: "translate(-50%,-50%)", color: cfg.color }}
                        className="absolute pointer-events-none"
                      >
                        <span
                          style={{ background: "var(--amber)", color: "var(--ink)" }}
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap"
                        >
                          {field}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Field config panel */}
              <div className="space-y-4">
                <div>
                  <p style={{ color: "var(--fog)" }} className="text-xs font-semibold mb-2">Active field</p>
                  <div className="flex flex-wrap gap-1.5">
                    {availableFields.map((f) => {
                      const isActive = activeField === f;
                      const isPlaced = !!placeholders[f];
                      let btnStyle: React.CSSProperties;
                      if (isActive) {
                        btnStyle = { background: "var(--amber)", color: "var(--ink)", border: "1px solid var(--amber)" };
                      } else if (isPlaced) {
                        btnStyle = { background: "color-mix(in srgb, var(--jade) 15%, transparent)", color: "var(--jade)", border: "1px solid color-mix(in srgb, var(--jade) 35%, transparent)" };
                      } else {
                        btnStyle = { background: "var(--ink-muted)", color: "var(--fog)", border: "1px solid var(--seam)" };
                      }
                      return (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setActiveField(f)}
                          style={btnStyle}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors"
                        >
                          {placeholders[f] ? <Check size={10} className="inline mr-1" /> : null}{f}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {placeholders[activeField] && (
                  <div style={{ background: "var(--ink-muted)", borderRadius: 12 }} className="space-y-3 p-3">
                    <p style={{ color: "var(--cream)" }} className="text-xs font-semibold">{PLACEHOLDER_LABELS[activeField]}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <label style={{ color: "var(--fog)" }} className="text-xs">
                        X <input type="number" value={placeholders[activeField].x}
                          onChange={(e) => updateField(activeField, "x", +e.target.value)}
                          style={fieldConfigInputStyle} />
                      </label>
                      <label style={{ color: "var(--fog)" }} className="text-xs">
                        Y <input type="number" value={placeholders[activeField].y}
                          onChange={(e) => updateField(activeField, "y", +e.target.value)}
                          style={fieldConfigInputStyle} />
                      </label>
                    </div>
                    <label style={{ color: "var(--fog)" }} className="text-xs block">
                      Font size
                      <input type="number" min={8} max={200} value={placeholders[activeField].font_size}
                        onChange={(e) => updateField(activeField, "font_size", +e.target.value)}
                        style={fieldConfigInputStyle} />
                    </label>
                    <label style={{ color: "var(--fog)" }} className="text-xs block">
                      Color
                      <input type="color" value={placeholders[activeField].color}
                        onChange={(e) => updateField(activeField, "color", e.target.value)}
                        style={{ display: "block", marginTop: 2, width: "100%", height: 28, border: "1px solid var(--seam)", borderRadius: 6, cursor: "pointer", background: "transparent" }} />
                    </label>
                    <label style={{ color: "var(--fog)" }} className="text-xs block">
                      Alignment
                      <select value={placeholders[activeField].align}
                        onChange={(e) => updateField(activeField, "align", e.target.value)}
                        style={{ ...fieldConfigInputStyle, colorScheme: "dark" }}>
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                      </select>
                    </label>
                  </div>
                )}
              </div>
            </div>
          )}

          {error && (
            <p style={{ color: "var(--cinnabar)" }} className="text-xs flex items-center gap-1"><AlertCircle size={12} /> {error}</p>
          )}
          {success && (
            <p style={{ color: "var(--jade)" }} className="text-sm flex items-center gap-1.5"><CheckCircle size={13} /> Template saved!</p>
          )}

          <div style={{ borderTop: "1px solid var(--seam)" }} className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              style={{ border: "1px solid var(--seam)", color: "var(--fog)", background: "transparent" }}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-colors"
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--ink-muted)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={uploading || !file}
              style={{ background: "var(--amber)", color: "var(--ink)" }}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors"
              onMouseEnter={(e) => { if (!uploading && file) e.currentTarget.style.background = "var(--amber-glow)"; }}
              onMouseLeave={(e) => (e.currentTarget.style.background = "var(--amber)")}
            >
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              Save Template
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Indian bank list ──────────────────────────────────────────────────────────

const INDIAN_BANKS = [
  "State Bank of India", "Bank of Baroda", "Bank of India", "Bank of Maharashtra",
  "Canara Bank", "Central Bank of India", "Indian Bank", "Indian Overseas Bank",
  "Punjab & Sind Bank", "Punjab National Bank", "UCO Bank", "Union Bank of India",
  "HDFC Bank", "ICICI Bank", "Axis Bank", "Kotak Mahindra Bank", "IndusInd Bank",
  "Yes Bank", "IDFC First Bank", "Federal Bank", "South Indian Bank",
  "Karnataka Bank", "Karur Vysya Bank", "City Union Bank", "Lakshmi Vilas Bank",
  "Dhanlaxmi Bank", "Jammu & Kashmir Bank", "Tamilnad Mercantile Bank",
  "CSB Bank", "RBL Bank", "Bandhan Bank", "AU Small Finance Bank",
  "Ujjivan Small Finance Bank", "Equitas Small Finance Bank",
  "ESAF Small Finance Bank", "Suryoday Small Finance Bank",
  "PayTm Payments Bank", "Airtel Payments Bank", "India Post Payments Bank",
  "Fino Payments Bank", "NSDL Payments Bank",
];

// ── Bank Details Modal ────────────────────────────────────────────────────────

interface BankModalProps {
  winnerName: string;
  onConfirm: (details: BankDetails | null) => void;
  onCancel: () => void;
}

function BankModal({ winnerName, onConfirm, onCancel }: BankModalProps) {
  const [details, setDetails] = useState<BankDetails>({ bank_account: "", bank_name: "", ifsc: "", upi: "" });
  const [bankSearch, setBankSearch] = useState("");
  const [showBankList, setShowBankList] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof BankDetails, string>>>({});

  function set(k: keyof BankDetails, v: string) {
    setDetails((prev) => ({ ...prev, [k]: v }));
    setErrors((prev) => { const n = { ...prev }; delete n[k]; return n; });
  }

  const filteredBanks = bankSearch.trim()
    ? INDIAN_BANKS.filter((b) => b.toLowerCase().includes(bankSearch.toLowerCase()))
    : INDIAN_BANKS;

  function selectBank(name: string) {
    set("bank_name", name);
    setBankSearch(name);
    setShowBankList(false);
  }

  const hasAny = details.bank_account || details.bank_name || details.ifsc || details.upi;
  const hasBankFields = details.bank_account || details.bank_name || details.ifsc;

  function validate(): boolean {
    const errs: Partial<Record<keyof BankDetails, string>> = {};

    if (hasBankFields) {
      if (!details.bank_account.trim()) {
        errs.bank_account = "Required when providing bank details.";
      } else if (!/^\d{9,18}$/.test(details.bank_account.replace(/\s/g, ""))) {
        errs.bank_account = "Must be 9–18 digits.";
      }
      if (!details.bank_name.trim()) {
        errs.bank_name = "Required when providing bank details.";
      }
      if (!details.ifsc.trim()) {
        errs.ifsc = "Required when providing bank details.";
      } else if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(details.ifsc.trim())) {
        errs.ifsc = "Invalid IFSC — format: XXXX0XXXXXX (e.g. SBIN0001234).";
      }
    }

    if (details.upi.trim() && !/^[\w.\-+]+@[\w.\-]+$/.test(details.upi.trim())) {
      errs.upi = "Invalid UPI ID — format: handle@provider (e.g. name@upi).";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleConfirm() {
    if (!hasAny) { onConfirm(null); return; }
    if (!validate()) return;
    onConfirm(details);
  }

  const modalInputStyle: React.CSSProperties = {
    display: "block",
    width: "100%",
    marginTop: 4,
    padding: "8px 12px",
    border: "1px solid var(--seam)",
    borderRadius: 8,
    fontSize: 14,
    background: "var(--ink-muted)",
    color: "var(--cream)",
    outline: "none",
    boxSizing: "border-box",
  };

  function inputStyle(hasError: boolean): React.CSSProperties {
    return { ...modalInputStyle, borderColor: hasError ? "var(--cinnabar)" : "var(--seam)" };
  }

  return (
    <div
      style={{ background: "rgba(0,0,0,0.8)" }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        style={{ background: "var(--ink-soft)", border: "1px solid var(--seam)", color: "var(--cream)" }}
        className="rounded-2xl shadow-2xl w-full max-w-md"
      >
        <div style={{ borderBottom: "1px solid var(--seam)" }} className="px-6 py-4">
          <h2 style={{ color: "var(--cream)" }} className="text-base font-bold">Bank Details for {winnerName}</h2>
          <p style={{ color: "var(--dust)" }} className="text-xs mt-0.5">
            Optional — only fill if this winner has a cash prize. If any bank field is filled, all three (account, bank, IFSC) are required.
          </p>
        </div>
        <div className="p-6 space-y-4">

          {/* Account Number */}
          <div>
            <label style={{ color: "var(--fog)", fontSize: 12, fontWeight: 600 }}>Account Number</label>
            <input
              type="text"
              value={details.bank_account}
              onChange={(e) => set("bank_account", e.target.value.replace(/\D/g, ""))}
              placeholder="9–18 digit account number"
              style={inputStyle(!!errors.bank_account)}
              onFocus={(e) => { if (!errors.bank_account) e.currentTarget.style.borderColor = "var(--amber)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(245,166,35,0.12)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = errors.bank_account ? "var(--cinnabar)" : "var(--seam)"; e.currentTarget.style.boxShadow = "none"; }}
            />
            {errors.bank_account && (
              <p style={{ color: "var(--cinnabar)", fontSize: 11, marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}>
                <AlertCircle size={10} /> {errors.bank_account}
              </p>
            )}
          </div>

          {/* Bank Name — searchable */}
          <div style={{ position: "relative" }}>
            <label style={{ color: "var(--fog)", fontSize: 12, fontWeight: 600 }}>Bank Name</label>
            <div style={{ position: "relative" }}>
              <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--dust)", pointerEvents: "none" }} />
              <input
                type="text"
                value={bankSearch}
                onChange={(e) => { setBankSearch(e.target.value); set("bank_name", e.target.value); setShowBankList(true); }}
                onFocus={() => setShowBankList(true)}
                onBlur={() => setTimeout(() => setShowBankList(false), 150)}
                placeholder="Search Indian banks…"
                style={{ ...inputStyle(!!errors.bank_name), paddingLeft: 30 }}
              />
            </div>
            {showBankList && filteredBanks.length > 0 && (
              <div style={{
                position: "absolute",
                zIndex: 10,
                top: "100%",
                left: 0,
                right: 0,
                background: "var(--ink-soft)",
                border: "1px solid var(--seam)",
                borderRadius: 8,
                maxHeight: 180,
                overflowY: "auto",
                boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                marginTop: 2,
              }}>
                {filteredBanks.map((bank) => (
                  <button
                    key={bank}
                    type="button"
                    onMouseDown={() => selectBank(bank)}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 12px",
                      fontSize: 13,
                      color: details.bank_name === bank ? "var(--amber)" : "var(--fog)",
                      background: details.bank_name === bank ? "color-mix(in srgb, var(--amber) 8%, transparent)" : "transparent",
                      border: "none",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => { if (details.bank_name !== bank) e.currentTarget.style.background = "var(--ink-muted)"; }}
                    onMouseLeave={(e) => { if (details.bank_name !== bank) e.currentTarget.style.background = "transparent"; }}
                  >
                    {bank}
                  </button>
                ))}
              </div>
            )}
            {errors.bank_name && (
              <p style={{ color: "var(--cinnabar)", fontSize: 11, marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}>
                <AlertCircle size={10} /> {errors.bank_name}
              </p>
            )}
          </div>

          {/* IFSC */}
          <div>
            <label style={{ color: "var(--fog)", fontSize: 12, fontWeight: 600 }}>IFSC Code</label>
            <input
              type="text"
              value={details.ifsc}
              onChange={(e) => set("ifsc", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
              placeholder="e.g. SBIN0001234"
              maxLength={11}
              style={{ ...inputStyle(!!errors.ifsc), fontFamily: "monospace", letterSpacing: "0.05em" }}
              onFocus={(e) => { if (!errors.ifsc) e.currentTarget.style.borderColor = "var(--amber)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(245,166,35,0.12)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = errors.ifsc ? "var(--cinnabar)" : "var(--seam)"; e.currentTarget.style.boxShadow = "none"; }}
            />
            {details.ifsc && !errors.ifsc && /^[A-Z]{4}0[A-Z0-9]{6}$/.test(details.ifsc) && (
              <p style={{ color: "var(--jade)", fontSize: 11, marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}>
                <CheckCircle size={10} /> Valid IFSC format
              </p>
            )}
            {errors.ifsc && (
              <p style={{ color: "var(--cinnabar)", fontSize: 11, marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}>
                <AlertCircle size={10} /> {errors.ifsc}
              </p>
            )}
          </div>

          {/* Divider */}
          <div style={{ borderTop: "1px solid var(--seam)", paddingTop: 4 }}>
            <p style={{ color: "var(--dust)", fontSize: 11, marginBottom: 8 }}>— or —</p>
          </div>

          {/* UPI */}
          <div>
            <label style={{ color: "var(--fog)", fontSize: 12, fontWeight: 600 }}>UPI ID</label>
            <input
              type="text"
              value={details.upi}
              onChange={(e) => set("upi", e.target.value)}
              placeholder="e.g. name@okicici"
              style={inputStyle(!!errors.upi)}
              onFocus={(e) => { if (!errors.upi) e.currentTarget.style.borderColor = "var(--amber)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(245,166,35,0.12)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = errors.upi ? "var(--cinnabar)" : "var(--seam)"; e.currentTarget.style.boxShadow = "none"; }}
            />
            {details.upi && !errors.upi && /^[\w.\-+]+@[\w.\-]+$/.test(details.upi.trim()) && (
              <p style={{ color: "var(--jade)", fontSize: 11, marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}>
                <CheckCircle size={10} /> Valid UPI format
              </p>
            )}
            {errors.upi && (
              <p style={{ color: "var(--cinnabar)", fontSize: 11, marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}>
                <AlertCircle size={10} /> {errors.upi}
              </p>
            )}
          </div>
        </div>

        <div style={{ borderTop: "1px solid var(--seam)" }} className="px-6 py-4 flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            style={{ border: "1px solid var(--seam)", color: "var(--fog)", background: "transparent" }}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--ink-muted)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(null)}
            style={{ border: "1px solid var(--seam)", color: "var(--fog)", background: "transparent" }}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--ink-muted)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            Skip
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            style={{ background: "var(--amber)", color: "var(--ink)" }}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-colors"
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--amber-glow)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "var(--amber)")}
          >
            <CreditCard size={14} /> Save & Issue
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function CertificatesManage() {
  const { eventId } = useParams<{ eventId: string }>();
  const qc = useQueryClient();

  const [tab, setTab] = useState<"participation" | "winner" | "template">("participation");
  const [winnerSearch, setWinnerSearch] = useState("");
  const [winners, setWinners] = useState<WinnerAssignment[]>([]);
  const [pendingWinnerIdx, setPendingWinnerIdx] = useState<number | null>(null);
  const [partError, setPartError] = useState("");
  const [winError, setWinError] = useState("");
  const [templateEditorType, setTemplateEditorType] = useState<"PARTICIPATION" | "WINNER" | null>(null);

  const { data: certificates = [], isLoading: loadingCerts } = useQuery<Certificate[]>({
    queryKey: ["certificates", "event", eventId],
    queryFn: () => api.get(`/events/${eventId}/certificates`).then((r) => r.data),
    enabled: !!eventId,
  });

  const { data: present = [], isLoading: loadingPresent } = useQuery<PresentUser[]>({
    queryKey: ["present-users", eventId],
    queryFn: () => api.get(`/events/${eventId}/attendance/present`).then((r) => r.data),
    enabled: !!eventId,
  });

  const { data: templates = [] } = useQuery<CertTemplate[]>({
    queryKey: ["cert-templates", eventId],
    queryFn: () => api.get(`/events/${eventId}/certificate-templates`).then((r) => r.data),
    enabled: !!eventId,
  });

  const participationMutation = useMutation({
    mutationFn: () => api.post(`/events/${eventId}/certificates/generate-participation`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["certificates", "event", eventId] });
      setPartError("");
    },
    onError: (err) => setPartError(apiError(err, "Failed to generate participation certificates.")),
  });

  const winnersMutation = useMutation({
    mutationFn: (data: { winners: WinnerAssignment[] }) =>
      api.post(`/events/${eventId}/certificates/generate-winners`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["certificates", "event", eventId] });
      setWinners([]);
      setWinnerSearch("");
      setWinError("");
    },
    onError: (err) => setWinError(apiError(err, "Failed to generate winner certificates.")),
  });

  const filteredPresent = useMemo(() => {
    if (!winnerSearch.trim()) return present;
    const q = winnerSearch.toLowerCase();
    return present.filter((u) =>
      u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }, [present, winnerSearch]);

  function addWinner(user: PresentUser, position: Position) {
    setWinners((prev) => {
      const filtered = prev.filter((w) => w.position !== position && w.user_id !== user.user_id);
      return [...filtered, { user_id: user.user_id, name: user.name, position }];
    });
  }

  function removeWinner(userId: string) {
    setWinners((prev) => prev.filter((w) => w.user_id !== userId));
  }

  function getAssignedPosition(userId: string): Position | null {
    return winners.find((w) => w.user_id === userId)?.position ?? null;
  }

  const alreadyHasParticipation = (userId: string) =>
    certificates.some((c) => c.recipient_id === userId && c.certificate_type === "PARTICIPATION");

  const alreadyHasWinner = (userId: string) =>
    certificates.some((c) => c.recipient_id === userId && c.certificate_type === "WINNER");

  const participationCount = certificates.filter((c) => c.certificate_type === "PARTICIPATION").length;

  function handleIssueWinnersClick() {
    if (winners.length === 0) return;
    // Show bank modal for first winner; chain through if multiple
    setPendingWinnerIdx(0);
  }

  function handleBankConfirm(details: BankDetails | null) {
    if (pendingWinnerIdx === null) return;
    if (details) {
      setWinners((prev) => prev.map((w, i) => i === pendingWinnerIdx ? { ...w, ...details } : w));
    }
    // Move to next winner or submit
    const next = pendingWinnerIdx + 1;
    if (next < winners.length) {
      setPendingWinnerIdx(next);
    } else {
      setPendingWinnerIdx(null);
      // Submit with whatever bank details were collected
      setWinners((current) => {
        winnersMutation.mutate({ winners: current });
        return current;
      });
    }
  }

  const participationTemplate = templates.find((t) => t.type === "PARTICIPATION");
  const winnerTemplate = templates.find((t) => t.type === "WINNER");

  return (
    <Layout eventId={eventId}>
      <div className="p-8 max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 style={{ color: "var(--cream)" }} className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Award size={22} style={{ color: "var(--amber)" }} />
            Certificates
          </h1>
          <p style={{ color: "var(--dust)" }} className="mt-1 text-sm">
            {certificates.length} issued · {present.length} attendees present
          </p>
        </div>

        {/* Tab bar */}
        <div
          style={{ background: "var(--ink-muted)" }}
          className="flex gap-1 p-1 rounded-xl mb-6 w-fit"
        >
          {([
            { id: "participation", label: "Participation", icon: <Users size={14} /> },
            { id: "winner",        label: "Winners",       icon: <Trophy size={14} /> },
            { id: "template",      label: "Templates",     icon: <ImageIcon size={14} /> },
          ] as const).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              style={
                tab === t.id
                  ? { background: "var(--ink-soft)", color: "var(--cream)", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }
                  : { background: "transparent", color: "var(--fog)" }
              }
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* ── Participation tab ──────────────────────────────────── */}
        {tab === "participation" && (
          <div className="space-y-5">
            <div style={{ background: "var(--ink-soft)", border: "1px solid var(--seam)" }} className="rounded-xl p-6">
              <h2 style={{ color: "var(--cream)" }} className="text-sm font-semibold mb-1">Issue Participation Certificates</h2>
              <p style={{ color: "var(--dust)" }} className="text-xs mb-5">
                Automatically issues a certificate to every attendee marked present ({present.length} people).
                Already-issued certificates are skipped.
              </p>

              {participationTemplate && (
                <div
                  style={{ color: "var(--jade)", background: "color-mix(in srgb, var(--jade) 12%, transparent)", border: "1px solid color-mix(in srgb, var(--jade) 30%, transparent)" }}
                  className="flex items-center gap-2 text-xs rounded-lg px-3 py-2 mb-4"
                >
                  <CheckCircle size={13} /> Custom template active — certificates will use your design.
                </div>
              )}

              {present.length === 0 ? (
                <div
                  style={{ color: "var(--amber)", background: "var(--amber-dim)", border: "1px solid color-mix(in srgb, var(--amber) 30%, transparent)" }}
                  className="flex items-center gap-2 text-sm rounded-lg px-4 py-3"
                >
                  <AlertCircle size={15} />
                  No attendees are marked present yet. Scan QR codes at the event first.
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <div style={{ color: "var(--amber)" }} className="text-3xl font-bold">{present.length}</div>
                    <div>
                      <p style={{ color: "var(--cream)" }} className="text-sm font-semibold">attendees present</p>
                      <p style={{ color: "var(--dust)" }} className="text-xs">{participationCount} certificates already issued</p>
                    </div>
                  </div>
                  {partError && (
                    <p style={{ color: "var(--cinnabar)" }} className="text-xs mb-3 flex items-center gap-1">
                      <AlertCircle size={12} /> {partError}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => participationMutation.mutate()}
                    disabled={participationMutation.isPending || present.length === 0}
                    style={{ background: "var(--amber)", color: "var(--ink)" }}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors"
                    onMouseEnter={(e) => { if (!participationMutation.isPending) e.currentTarget.style.background = "var(--amber-glow)"; }}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "var(--amber)")}
                  >
                    {participationMutation.isPending
                      ? <Loader2 size={15} className="animate-spin" />
                      : <Award size={15} />}
                    Generate {present.length - participationCount > 0 ? `${present.length - participationCount} ` : ""}Participation Certificates
                  </button>
                  {participationMutation.isSuccess && (
                    <p style={{ color: "var(--jade)" }} className="mt-3 text-sm flex items-center gap-1.5">
                      <CheckCircle size={13} /> Certificates generated successfully!
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Winners tab ────────────────────────────────────────── */}
        {tab === "winner" && (
          <div className="space-y-5">
            {winnerTemplate && (
              <div
                style={{ color: "var(--jade)", background: "color-mix(in srgb, var(--jade) 12%, transparent)", border: "1px solid color-mix(in srgb, var(--jade) 30%, transparent)" }}
                className="flex items-center gap-2 text-xs rounded-lg px-3 py-2"
              >
                <CheckCircle size={13} /> Custom winner template active.
              </div>
            )}

            {winners.length > 0 && (
              <div
                style={{
                  background: "color-mix(in srgb, var(--amber) 10%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--amber) 30%, transparent)",
                }}
                className="rounded-xl p-4"
              >
                <h3 style={{ color: "var(--amber)" }} className="text-xs font-semibold uppercase tracking-wider mb-3">
                  Declared Winners
                </h3>
                <div className="space-y-2">
                  {[...winners].sort((a, b) => POSITIONS.indexOf(a.position) - POSITIONS.indexOf(b.position)).map((w) => (
                    <div
                      key={w.user_id}
                      style={{ background: "var(--ink-muted)", border: "1px solid var(--seam)" }}
                      className="flex items-center justify-between rounded-lg px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span style={{ color: "var(--amber)" }} className="text-xs font-bold mr-1">{POSITION_LABELS[w.position]}</span>
                        <span style={{ color: "var(--cream)" }} className="text-sm font-medium">{w.name}</span>
                        {(w.bank_account || w.upi) && (
                          <span
                            style={{ color: "var(--jade)", background: "color-mix(in srgb, var(--jade) 12%, transparent)", border: "1px solid color-mix(in srgb, var(--jade) 30%, transparent)" }}
                            className="flex items-center gap-0.5 text-[10px] rounded px-1.5 py-0.5"
                          >
                            <CreditCard size={9} /> Bank
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeWinner(w.user_id)}
                        style={{ color: "var(--seam)" }}
                        className="transition-colors"
                        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--cinnabar)")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--seam)")}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                {winError && (
                  <p style={{ color: "var(--cinnabar)" }} className="text-xs mt-3 flex items-center gap-1">
                    <AlertCircle size={12} /> {winError}
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleIssueWinnersClick}
                  disabled={winnersMutation.isPending}
                  style={{ background: "var(--amber)", color: "var(--ink)" }}
                  className="mt-3 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors"
                  onMouseEnter={(e) => { if (!winnersMutation.isPending) e.currentTarget.style.background = "var(--amber-glow)"; }}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "var(--amber)")}
                >
                  {winnersMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trophy size={14} />}
                  Issue {winners.length} Winner Certificate{winners.length !== 1 ? "s" : ""}
                </button>
                {winnersMutation.isSuccess && (
                  <p style={{ color: "var(--jade)" }} className="mt-2 text-sm flex items-center gap-1.5">
                    <CheckCircle size={13} /> Winner certificates issued!
                  </p>
                )}
              </div>
            )}

            <div style={{ background: "var(--ink-soft)", border: "1px solid var(--seam)" }} className="rounded-xl overflow-hidden">
              <div style={{ borderBottom: "1px solid var(--seam)" }} className="p-4">
                <p style={{ color: "var(--cream)" }} className="text-sm font-semibold mb-3">
                  Search attendees and assign positions
                </p>
                <div className="relative">
                  <Search size={14} style={{ color: "var(--dust)" }} className="absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={winnerSearch}
                    onChange={(e) => setWinnerSearch(e.target.value)}
                    placeholder="Search by name or email…"
                    style={{
                      width: "100%",
                      paddingLeft: 32,
                      paddingRight: 16,
                      paddingTop: 8,
                      paddingBottom: 8,
                      fontSize: 14,
                      border: "1px solid var(--seam)",
                      borderRadius: 8,
                      background: "var(--ink-muted)",
                      color: "var(--cream)",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                    onFocus={(e) => { e.currentTarget.style.border = "1px solid var(--amber)"; e.currentTarget.style.boxShadow = "0 0 0 2px color-mix(in srgb, var(--amber) 20%, transparent)"; }}
                    onBlur={(e) => { e.currentTarget.style.border = "1px solid var(--seam)"; e.currentTarget.style.boxShadow = "none"; }}
                  />
                </div>
              </div>

              {loadingPresent ? (
                <div style={{ color: "var(--dust)" }} className="p-8 text-center text-sm animate-pulse">Loading attendees…</div>
              ) : present.length === 0 ? (
                <div className="p-8 text-center">
                  <AlertCircle size={28} style={{ color: "var(--dust)" }} className="mx-auto mb-2" />
                  <p style={{ color: "var(--dust)" }} className="text-sm">No attendees marked present yet.</p>
                </div>
              ) : filteredPresent.length === 0 ? (
                <div style={{ color: "var(--dust)" }} className="p-6 text-center text-sm">No attendees match "{winnerSearch}"</div>
              ) : (
                <div>
                  {filteredPresent.map((user) => {
                    const assigned = getAssignedPosition(user.user_id);
                    const hasWinnerCert = alreadyHasWinner(user.user_id);
                    return (
                      <div
                        key={user.user_id}
                        style={{ borderTop: "1px solid var(--seam)", opacity: hasWinnerCert ? 0.5 : 1 }}
                        className="flex items-center justify-between px-4 py-3 transition-colors"
                        onMouseEnter={(e) => (e.currentTarget.style.background = "color-mix(in srgb, var(--cream) 3%, transparent)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <div>
                          <p style={{ color: "var(--cream)" }} className="text-sm font-medium">{user.name}</p>
                          <p style={{ color: "var(--dust)" }} className="text-xs">{user.email}</p>
                        </div>
                        <div className="flex gap-1.5 flex-wrap justify-end">
                          {hasWinnerCert ? (
                            <span style={{ color: "var(--amber)" }} className="text-xs font-semibold flex items-center gap-1">
                              <Check size={12} /> Certificate issued
                            </span>
                          ) : (
                            POSITIONS.map((pos) => {
                              const isActive = assigned === pos;
                              return (
                                <button
                                  key={pos}
                                  type="button"
                                  onClick={() => isActive ? removeWinner(user.user_id) : addWinner(user, pos)}
                                  style={
                                    isActive
                                      ? { background: "var(--amber)", color: "var(--ink)", border: "1px solid var(--amber)" }
                                      : { background: "var(--ink-muted)", color: "var(--fog)", border: "1px solid var(--seam)" }
                                  }
                                  className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors"
                                  onMouseEnter={(e) => {
                                    if (!isActive) {
                                      e.currentTarget.style.background = "color-mix(in srgb, var(--amber) 15%, transparent)";
                                      e.currentTarget.style.color = "var(--amber)";
                                      e.currentTarget.style.borderColor = "color-mix(in srgb, var(--amber) 40%, transparent)";
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    if (!isActive) {
                                      e.currentTarget.style.background = "var(--ink-muted)";
                                      e.currentTarget.style.color = "var(--fog)";
                                      e.currentTarget.style.borderColor = "var(--seam)";
                                    }
                                  }}
                                >
                                  {pos}
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Templates tab ─────────────────────────────────────── */}
        {tab === "template" && (
          <div className="space-y-4">
            {(["PARTICIPATION", "WINNER"] as const).map((type) => {
              const t = templates.find((x) => x.type === type);
              return (
                <div
                  key={type}
                  style={{ background: "var(--ink-soft)", border: "1px solid var(--seam)" }}
                  className="rounded-xl p-5 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-4">
                    {t?.template_file_url ? (
                      <img
                        src={t.template_file_url}
                        alt="template preview"
                        style={{ border: "1px solid var(--seam)" }}
                        className="w-24 h-16 object-cover rounded-lg"
                      />
                    ) : (
                      <div
                        style={{ background: "color-mix(in srgb, var(--amber) 10%, transparent)", border: "2px dashed var(--seam)" }}
                        className="w-24 h-16 rounded-lg flex items-center justify-center"
                      >
                        <ImageIcon size={20} style={{ color: "var(--dust)" }} />
                      </div>
                    )}
                    <div>
                      <p style={{ color: "var(--cream)" }} className="text-sm font-semibold">{type === "WINNER" ? "Winner" : "Participation"} Template</p>
                      {t ? (
                        <p style={{ color: "var(--jade)" }} className="text-xs flex items-center gap-1 mt-0.5">
                          <CheckCircle size={11} /> Uploaded · {Object.keys(t.placeholders ?? {}).length} placeholder(s) configured
                        </p>
                      ) : (
                        <p style={{ color: "var(--dust)" }} className="text-xs mt-0.5">No template — uses default plain layout</p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTemplateEditorType(type)}
                    style={{ background: "var(--amber)", color: "var(--ink)" }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors shrink-0"
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--amber-glow)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "var(--amber)")}
                  >
                    <Upload size={12} /> {t ? "Replace" : "Upload"}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Issued certificates list */}
        <div style={{ background: "var(--ink-soft)", border: "1px solid var(--seam)" }} className="rounded-xl overflow-hidden mt-6">
          <div style={{ borderBottom: "1px solid var(--seam)" }} className="px-4 py-3 flex items-center justify-between">
            <h2 style={{ color: "var(--fog)" }} className="text-sm font-semibold">Issued Certificates ({certificates.length})</h2>
            {certificates.length > 0 && (
              <button
                type="button"
                onClick={() => exportCertsCsv(certificates)}
                style={{ background: "var(--ink-muted)", border: "1px solid var(--seam)", color: "var(--ash)" }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                onMouseEnter={(e) => (e.currentTarget.style.background = "color-mix(in srgb, var(--cream) 5%, transparent)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "var(--ink-muted)")}
              >
                <Download size={12} /> Export CSV
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "var(--ink-muted)", borderBottom: "1px solid var(--seam)" }}>
                  {["Recipient", "Type", "Bank / UPI", "Code", "Issued", ""].map((h) => (
                    <th key={h} style={{ color: "var(--dust)" }} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loadingCerts ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} style={{ borderTop: "1px solid var(--seam)" }} className="animate-pulse">
                      {[1,2,3,4,5,6].map((j) => (
                        <td key={j} className="px-4 py-3.5">
                          <div style={{ background: "var(--ink-muted)" }} className="h-4 rounded w-20" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : certificates.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ color: "var(--dust)" }} className="px-4 py-10 text-center text-sm">
                      No certificates issued yet.
                    </td>
                  </tr>
                ) : (
                  certificates.map((cert) => {
                    const meta = cert.metadata_ ?? {};
                    const hasBankDetails = meta.bank_account || meta.upi;
                    return (
                    <tr
                      key={cert.id}
                      style={{ borderTop: "1px solid var(--seam)" }}
                      className="transition-colors"
                      onMouseEnter={(e) => (e.currentTarget.style.background = "color-mix(in srgb, var(--cream) 3%, transparent)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ color: "var(--cream)" }} className="px-4 py-3.5 font-medium text-sm">
                        {cert.recipient_name || cert.recipient_id.slice(0, 12) + "…"}
                        {meta.position && (
                          <span style={{ color: "var(--amber)" }} className="ml-2 text-xs font-normal">{meta.position}</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          style={{ ...CERT_TYPE_BADGE_STYLES[cert.certificate_type], fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999 }}
                        >
                          {cert.certificate_type}
                        </span>
                      </td>
                      <td className="px-4 py-3.5" style={{ minWidth: 180 }}>
                        {hasBankDetails ? (
                          <div style={{ fontSize: 12 }}>
                            {meta.bank_account && (
                              <div style={{ color: "var(--cream)", fontFamily: "monospace" }}>
                                {meta.bank_account}
                                {meta.bank_name && <span style={{ color: "var(--ash)", fontFamily: "sans-serif" }}> · {meta.bank_name}</span>}
                              </div>
                            )}
                            {meta.ifsc && (
                              <div style={{ color: "var(--fog)", fontFamily: "monospace", fontSize: 11, marginTop: 2 }}>
                                IFSC: {meta.ifsc}
                              </div>
                            )}
                            {meta.upi && (
                              <div style={{ color: "var(--sky)", fontSize: 11, marginTop: 2 }}>
                                UPI: {meta.upi}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: "var(--seam)", fontSize: 12 }}>—</span>
                        )}
                      </td>
                      <td style={{ color: "var(--fog)", fontFamily: "monospace", fontSize: 12 }} className="px-4 py-3.5">{cert.unique_code}</td>
                      <td style={{ color: "var(--fog)", fontSize: 12 }} className="px-4 py-3.5">{fmtDateIST(cert.issued_at)}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          {cert.pdf_url && (
                            <a
                              href={cert.pdf_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ background: "var(--ink-muted)", color: "var(--ash)", border: "none" }}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                              onMouseEnter={(e) => (e.currentTarget.style.background = "color-mix(in srgb, var(--cream) 5%, transparent)")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "var(--ink-muted)")}
                            >
                              <Download size={11} /> PDF
                            </a>
                          )}
                          <a
                            href={`/verify/${cert.unique_code}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ background: "var(--ink-muted)", color: "var(--sky)", border: "none" }}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                            onMouseEnter={(e) => (e.currentTarget.style.background = "color-mix(in srgb, var(--sky) 12%, transparent)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "var(--ink-muted)")}
                          >
                            <ShieldCheck size={11} /> Verify
                          </a>
                        </div>
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modals */}
      {templateEditorType && eventId && (
        <TemplateEditor
          certType={templateEditorType}
          eventId={eventId}
          onClose={() => setTemplateEditorType(null)}
        />
      )}

      {pendingWinnerIdx !== null && winners[pendingWinnerIdx] && (
        <BankModal
          winnerName={winners[pendingWinnerIdx].name}
          onConfirm={handleBankConfirm}
          onCancel={() => setPendingWinnerIdx(null)}
        />
      )}
    </Layout>
  );
}
