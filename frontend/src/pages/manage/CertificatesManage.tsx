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

const CERT_TYPE_BADGES: Record<Certificate["certificate_type"], string> = {
  PARTICIPATION: "bg-blue-50 text-blue-700 border-blue-200",
  VOLUNTEER:     "bg-emerald-50 text-emerald-700 border-emerald-200",
  WINNER:        "bg-amber-50 text-amber-700 border-amber-200",
  RUNNER_UP:     "bg-orange-50 text-orange-700 border-orange-200",
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
  const headers = ["Recipient", "Type", "Code", "Issued", "PDF URL"];
  const rows = certs.map((c) => [
    c.recipient_name || c.recipient_id,
    c.certificate_type,
    c.unique_code,
    fmtDateIST(c.issued_at),
    c.pdf_url || "",
  ]);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-800">
            Upload {certType === "WINNER" ? "Winner" : "Participation"} Certificate Template
          </h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* File picker */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2">Template Image (PNG or JPEG)</label>
            <label className="flex items-center gap-3 px-4 py-3 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-colors">
              <ImageIcon size={18} className="text-slate-400" />
              <span className="text-sm text-slate-500">{file ? file.name : "Click to choose an image…"}</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </label>
          </div>

          {preview && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Canvas */}
              <div className="lg:col-span-2">
                <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-indigo-500" />
                  Click on the image to place the <strong className="text-slate-700">{PLACEHOLDER_LABELS[activeField]}</strong> field
                </p>
                <div className="relative border border-slate-200 rounded-xl overflow-hidden">
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
                        <span className="bg-indigo-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap">
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
                  <p className="text-xs font-semibold text-slate-600 mb-2">Active field</p>
                  <div className="flex flex-wrap gap-1.5">
                    {availableFields.map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setActiveField(f)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors border ${
                          activeField === f
                            ? "bg-indigo-600 text-white border-indigo-600"
                            : placeholders[f]
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {placeholders[f] ? <Check size={10} className="inline mr-1" /> : null}{f}
                      </button>
                    ))}
                  </div>
                </div>

                {placeholders[activeField] && (
                  <div className="space-y-3 bg-slate-50 rounded-xl p-3">
                    <p className="text-xs font-semibold text-slate-700">{PLACEHOLDER_LABELS[activeField]}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-xs text-slate-500">
                        X <input type="number" value={placeholders[activeField].x}
                          onChange={(e) => updateField(activeField, "x", +e.target.value)}
                          className="block w-full mt-0.5 px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                      </label>
                      <label className="text-xs text-slate-500">
                        Y <input type="number" value={placeholders[activeField].y}
                          onChange={(e) => updateField(activeField, "y", +e.target.value)}
                          className="block w-full mt-0.5 px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                      </label>
                    </div>
                    <label className="text-xs text-slate-500 block">
                      Font size
                      <input type="number" min={8} max={200} value={placeholders[activeField].font_size}
                        onChange={(e) => updateField(activeField, "font_size", +e.target.value)}
                        className="block w-full mt-0.5 px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                    </label>
                    <label className="text-xs text-slate-500 block">
                      Color
                      <input type="color" value={placeholders[activeField].color}
                        onChange={(e) => updateField(activeField, "color", e.target.value)}
                        className="block mt-0.5 w-full h-7 border border-slate-200 rounded cursor-pointer" />
                    </label>
                    <label className="text-xs text-slate-500 block">
                      Alignment
                      <select value={placeholders[activeField].align}
                        onChange={(e) => updateField(activeField, "align", e.target.value)}
                        className="block w-full mt-0.5 px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300">
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
            <p className="text-xs text-red-600 flex items-center gap-1"><AlertCircle size={12} /> {error}</p>
          )}
          {success && (
            <p className="text-sm text-emerald-600 flex items-center gap-1.5"><CheckCircle size={13} /> Template saved!</p>
          )}

          <div className="flex gap-3 justify-end pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
            <button type="button" onClick={handleSave} disabled={uploading || !file}
              className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              Save Template
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Bank Details Modal ────────────────────────────────────────────────────────

interface BankModalProps {
  winnerName: string;
  onConfirm: (details: BankDetails | null) => void;
  onCancel: () => void;
}

function BankModal({ winnerName, onConfirm, onCancel }: BankModalProps) {
  const [details, setDetails] = useState<BankDetails>({ bank_account: "", bank_name: "", ifsc: "", upi: "" });

  function set(k: keyof BankDetails, v: string) {
    setDetails((prev) => ({ ...prev, [k]: v }));
  }

  const hasAny = details.bank_account || details.bank_name || details.ifsc || details.upi;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-800">Bank Details for {winnerName}</h2>
          <p className="text-xs text-slate-400 mt-0.5">Optional — only if this winner has a cash prize.</p>
        </div>
        <div className="p-6 space-y-4">
          <label className="block text-xs font-semibold text-slate-600">
            Account Number
            <input type="text" value={details.bank_account} onChange={(e) => set("bank_account", e.target.value)}
              placeholder="e.g. 123456789012"
              className="block w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            Bank Name
            <input type="text" value={details.bank_name} onChange={(e) => set("bank_name", e.target.value)}
              placeholder="e.g. State Bank of India"
              className="block w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            IFSC Code
            <input type="text" value={details.ifsc} onChange={(e) => set("ifsc", e.target.value.toUpperCase())}
              placeholder="e.g. SBIN0001234"
              className="block w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            UPI ID
            <input type="text" value={details.upi} onChange={(e) => set("upi", e.target.value)}
              placeholder="e.g. name@upi"
              className="block w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </label>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex gap-3 justify-end">
          <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
          <button type="button" onClick={() => onConfirm(null)}
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
            Skip
          </button>
          <button type="button" onClick={() => onConfirm(hasAny ? details : null)}
            className="flex items-center gap-2 px-5 py-2 bg-amber-600 text-white rounded-xl text-sm font-semibold hover:bg-amber-700 transition-colors">
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
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Award size={22} className="text-amber-500" />
            Certificates
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            {certificates.length} issued · {present.length} attendees present
          </p>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-6 w-fit">
          {([
            { id: "participation", label: "Participation", icon: <Users size={14} /> },
            { id: "winner",        label: "Winners",       icon: <Trophy size={14} /> },
            { id: "template",      label: "Templates",     icon: <ImageIcon size={14} /> },
          ] as const).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t.id ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* ── Participation tab ──────────────────────────────────── */}
        {tab === "participation" && (
          <div className="space-y-5">
            <div className="bg-white rounded-xl border border-slate-100 p-6">
              <h2 className="text-sm font-semibold text-slate-700 mb-1">Issue Participation Certificates</h2>
              <p className="text-xs text-slate-400 mb-5">
                Automatically issues a certificate to every attendee marked present ({present.length} people).
                Already-issued certificates are skipped.
              </p>

              {participationTemplate && (
                <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 mb-4">
                  <CheckCircle size={13} /> Custom template active — certificates will use your design.
                </div>
              )}

              {present.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                  <AlertCircle size={15} />
                  No attendees are marked present yet. Scan QR codes at the event first.
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="text-3xl font-bold text-indigo-600">{present.length}</div>
                    <div>
                      <p className="text-sm font-semibold text-slate-700">attendees present</p>
                      <p className="text-xs text-slate-400">{participationCount} certificates already issued</p>
                    </div>
                  </div>
                  {partError && (
                    <p className="text-xs text-red-600 mb-3 flex items-center gap-1">
                      <AlertCircle size={12} /> {partError}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => participationMutation.mutate()}
                    disabled={participationMutation.isPending || present.length === 0}
                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    {participationMutation.isPending
                      ? <Loader2 size={15} className="animate-spin" />
                      : <Award size={15} />}
                    Generate {present.length - participationCount > 0 ? `${present.length - participationCount} ` : ""}Participation Certificates
                  </button>
                  {participationMutation.isSuccess && (
                    <p className="mt-3 text-sm text-emerald-600 flex items-center gap-1.5">
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
              <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                <CheckCircle size={13} /> Custom winner template active.
              </div>
            )}

            {winners.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <h3 className="text-xs font-semibold text-amber-800 uppercase tracking-wider mb-3">
                  Declared Winners
                </h3>
                <div className="space-y-2">
                  {[...winners].sort((a, b) => POSITIONS.indexOf(a.position) - POSITIONS.indexOf(b.position)).map((w) => (
                    <div key={w.user_id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-amber-100">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-amber-700 mr-1">{POSITION_LABELS[w.position]}</span>
                        <span className="text-sm font-medium text-slate-800">{w.name}</span>
                        {(w.bank_account || w.upi) && (
                          <span className="flex items-center gap-0.5 text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5">
                            <CreditCard size={9} /> Bank
                          </span>
                        )}
                      </div>
                      <button type="button" onClick={() => removeWinner(w.user_id)} className="text-slate-300 hover:text-red-500 transition-colors">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                {winError && (
                  <p className="text-xs text-red-600 mt-3 flex items-center gap-1">
                    <AlertCircle size={12} /> {winError}
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleIssueWinnersClick}
                  disabled={winnersMutation.isPending}
                  className="mt-3 flex items-center gap-2 px-5 py-2.5 bg-amber-600 text-white rounded-xl text-sm font-semibold hover:bg-amber-700 disabled:opacity-50 transition-colors"
                >
                  {winnersMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trophy size={14} />}
                  Issue {winners.length} Winner Certificate{winners.length !== 1 ? "s" : ""}
                </button>
                {winnersMutation.isSuccess && (
                  <p className="mt-2 text-sm text-emerald-600 flex items-center gap-1.5">
                    <CheckCircle size={13} /> Winner certificates issued!
                  </p>
                )}
              </div>
            )}

            <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
              <div className="p-4 border-b border-slate-50">
                <p className="text-sm font-semibold text-slate-700 mb-3">
                  Search attendees and assign positions
                </p>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={winnerSearch}
                    onChange={(e) => setWinnerSearch(e.target.value)}
                    placeholder="Search by name or email…"
                    className="w-full pl-8 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>
              </div>

              {loadingPresent ? (
                <div className="p-8 text-center text-slate-400 text-sm animate-pulse">Loading attendees…</div>
              ) : present.length === 0 ? (
                <div className="p-8 text-center">
                  <AlertCircle size={28} className="text-slate-200 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">No attendees marked present yet.</p>
                </div>
              ) : filteredPresent.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-400">No attendees match "{winnerSearch}"</div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {filteredPresent.map((user) => {
                    const assigned = getAssignedPosition(user.user_id);
                    const hasWinnerCert = alreadyHasWinner(user.user_id);
                    return (
                      <div key={user.user_id} className={`flex items-center justify-between px-4 py-3 ${hasWinnerCert ? "opacity-50" : ""}`}>
                        <div>
                          <p className="text-sm font-medium text-slate-800">{user.name}</p>
                          <p className="text-xs text-slate-400">{user.email}</p>
                        </div>
                        <div className="flex gap-1.5 flex-wrap justify-end">
                          {hasWinnerCert ? (
                            <span className="text-xs text-amber-600 font-semibold flex items-center gap-1">
                              <Check size={12} /> Certificate issued
                            </span>
                          ) : (
                            POSITIONS.map((pos) => (
                              <button
                                key={pos}
                                type="button"
                                onClick={() => assigned === pos ? removeWinner(user.user_id) : addWinner(user, pos)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors border ${
                                  assigned === pos
                                    ? "bg-amber-600 text-white border-amber-600"
                                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200"
                                }`}
                              >
                                {pos}
                              </button>
                            ))
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
                <div key={type} className="bg-white rounded-xl border border-slate-100 p-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    {t?.template_file_url ? (
                      <img src={t.template_file_url} alt="template preview" className="w-24 h-16 object-cover rounded-lg border border-slate-200" />
                    ) : (
                      <div className="w-24 h-16 bg-slate-50 rounded-lg border border-dashed border-slate-200 flex items-center justify-center">
                        <ImageIcon size={20} className="text-slate-300" />
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{type === "WINNER" ? "Winner" : "Participation"} Template</p>
                      {t ? (
                        <p className="text-xs text-emerald-600 flex items-center gap-1 mt-0.5">
                          <CheckCircle size={11} /> Uploaded · {Object.keys(t.placeholders ?? {}).length} placeholder(s) configured
                        </p>
                      ) : (
                        <p className="text-xs text-slate-400 mt-0.5">No template — uses default plain layout</p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTemplateEditorType(type)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors shrink-0"
                  >
                    <Upload size={12} /> {t ? "Replace" : "Upload"}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Issued certificates list */}
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden mt-6">
          <div className="px-4 py-3 border-b border-slate-50 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Issued Certificates ({certificates.length})</h2>
            {certificates.length > 0 && (
              <button
                type="button"
                onClick={() => exportCertsCsv(certificates)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Download size={12} /> Export CSV
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/60 border-b border-slate-100">
                  {["Recipient", "Type", "Code", "Issued", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loadingCerts ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      {[1,2,3,4,5].map((j) => <td key={j} className="px-4 py-3.5"><div className="h-4 bg-slate-100 rounded w-20" /></td>)}
                    </tr>
                  ))
                ) : certificates.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-slate-400 text-sm">
                      No certificates issued yet.
                    </td>
                  </tr>
                ) : (
                  certificates.map((cert) => (
                    <tr key={cert.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3.5 font-medium text-slate-800 text-sm">
                        {cert.recipient_name || cert.recipient_id.slice(0, 12) + "…"}
                        {cert.metadata_?.position && (
                          <span className="ml-2 text-xs text-amber-600 font-normal">{cert.metadata_.position}</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${CERT_TYPE_BADGES[cert.certificate_type]}`}>
                          {cert.certificate_type}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs text-slate-500">{cert.unique_code}</td>
                      <td className="px-4 py-3.5 text-xs text-slate-500">{fmtDateIST(cert.issued_at)}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          {cert.pdf_url && (
                            <a href={cert.pdf_url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-50 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-medium transition-colors">
                              <Download size={11} /> PDF
                            </a>
                          )}
                          <a href={`/verify/${cert.unique_code}`} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-medium transition-colors">
                            <ShieldCheck size={11} /> Verify
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))
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
