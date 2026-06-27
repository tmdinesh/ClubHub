import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  Wallet,
  Plus,
  AlertCircle,
  Loader2,
  Receipt,
  Lock,
  Trophy,
} from "lucide-react";
import Layout from "@/components/Layout";
import api from "@/lib/api";
import type { FinanceSummary, Event } from "@/types";

interface Expense {
  id: string;
  category: string;
  title: string;
  amount: number;
  bill_url: string | null;
  notes: string | null;
  created_at: string;
}

interface Winner {
  id: string;
  position: number;
  prize_amount: number | null;
  user_id: string;
  participant_name: string;
  participant_email: string;
  roll_number: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  upi: string | null;
}

const expenseSchema = z.object({
  category: z.string().min(1, "Category required"),
  title: z.string().min(1, "Title required"),
  amount: z.coerce.number().positive("Amount must be positive"),
  bill_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  notes: z.string().optional(),
});

type ExpenseForm = z.infer<typeof expenseSchema>;

const EXPENSE_CATEGORIES = [
  "FOOD", "VENUE", "LOGISTICS", "MARKETING", "PRIZES", "EQUIPMENT", "MISCELLANEOUS",
];

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  fontSize: 14,
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid var(--seam)",
  background: "var(--ink-muted)",
  color: "var(--cream)",
  outline: "none",
  boxSizing: "border-box",
};

export default function FinancePage() {
  const { eventId } = useParams<{ eventId: string }>();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = React.useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const { data: eventData } = useQuery<Event>({
    queryKey: ["event", eventId],
    queryFn: () => api.get(`/events/by-id/${eventId}`).then((r) => r.data),
    enabled: !!eventId,
    staleTime: 5 * 60 * 1000,
  });
  const isCompleted = eventData?.status === "COMPLETED";

  const { data: budget, isLoading: loadingBudget } = useQuery<FinanceSummary>({
    queryKey: ["budget", eventId],
    queryFn: () => api.get(`/events/${eventId}/budget`).then((r) => r.data),
    enabled: !!eventId,
  });

  const { data: expenses, isLoading: loadingExpenses } = useQuery<Expense[]>({
    queryKey: ["expenses", eventId],
    queryFn: () => api.get(`/events/${eventId}/expenses`).then((r) => r.data),
    enabled: !!eventId,
  });

  const { data: winners } = useQuery<Winner[]>({
    queryKey: ["winners", eventId],
    queryFn: () => api.get(`/events/${eventId}/winners`).then((r) => r.data),
    enabled: !!eventId,
    staleTime: 0,
  });

  const addExpense = useMutation({
    mutationFn: (data: ExpenseForm) =>
      api.post(`/events/${eventId}/expenses`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses", eventId] });
      queryClient.invalidateQueries({ queryKey: ["budget", eventId] });
      setShowForm(false);
      reset();
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ExpenseForm>({ resolver: zodResolver(expenseSchema) });

  const usedPct = budget
    ? Math.min((budget.total_spent / Math.max(budget.total_budget, 1)) * 100, 100)
    : 0;

  const chartData = budget?.by_category ?? [];

  const progressFill = usedPct > 90 ? "var(--cinnabar)" : usedPct > 70 ? "var(--amber)" : "var(--jade)";

  function focusStyle(fieldName: string): React.CSSProperties {
    return focusedField === fieldName
      ? { ...inputStyle, border: "1px solid var(--amber)", boxShadow: "0 0 0 2px color-mix(in srgb, var(--amber) 20%, transparent)" }
      : inputStyle;
  }

  return (
    <Layout eventId={eventId}>
      <div className="px-4 py-6 sm:px-8 sm:py-8 max-w-5xl mx-auto">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 style={{ color: "var(--cream)" }} className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Wallet size={22} style={{ color: "var(--amber)" }} />
              Finance
            </h1>
            <p style={{ color: "var(--dust)" }} className="mt-1 text-sm">Budget tracking and expenses</p>
          </div>
          <button
            type="button"
            onClick={() => !isCompleted && setShowForm(!showForm)}
            disabled={isCompleted}
            style={{ background: "var(--amber)", color: "var(--ink)", opacity: isCompleted ? 0.4 : 1, cursor: isCompleted ? "not-allowed" : "pointer" }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
            onMouseEnter={(e) => { if (!isCompleted) e.currentTarget.style.background = "var(--amber-glow)"; }}
            onMouseLeave={(e) => (e.currentTarget.style.background = "var(--amber)")}
          >
            <Plus size={15} />
            Add Expense
          </button>
        </div>

        {isCompleted && (
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            background: "color-mix(in srgb, var(--amber) 8%, transparent)",
            border: "1px solid color-mix(in srgb, var(--amber) 25%, transparent)",
            borderRadius: 10, padding: "12px 16px", marginBottom: 20,
          }}>
            <Lock size={14} style={{ color: "var(--amber)", flexShrink: 0 }} />
            <p style={{ fontSize: 13, color: "var(--amber)" }}>
              This event is completed. Finance records are read-only.
            </p>
          </div>
        )}

        {/* Budget overview */}
        {loadingBudget ? (
          <div
            style={{ background: "var(--ink-soft)", border: "1px solid var(--seam)" }}
            className="rounded-xl p-6 mb-5 animate-pulse"
          >
            <div style={{ background: "var(--ink-muted)" }} className="h-6 rounded w-32 mb-4" />
            <div style={{ background: "var(--ink-muted)" }} className="h-4 rounded-full mb-2" />
            <div className="flex justify-between">
              <div style={{ background: "var(--ink-muted)" }} className="h-3 rounded w-20" />
              <div style={{ background: "var(--ink-muted)" }} className="h-3 rounded w-20" />
            </div>
          </div>
        ) : budget ? (
          <div
            style={{ background: "var(--ink-soft)", border: "1px solid var(--seam)" }}
            className="rounded-xl p-6 mb-5"
          >
            <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-5">
              <div>
                <p style={{ color: "var(--dust)" }} className="text-xs uppercase tracking-wider font-semibold mb-1">Total Budget</p>
                <p style={{ color: "var(--cream)" }} className="text-2xl font-bold">{formatCurrency(budget.total_budget)}</p>
              </div>
              <div>
                <p style={{ color: "var(--dust)" }} className="text-xs uppercase tracking-wider font-semibold mb-1">Spent</p>
                <p style={{ color: "var(--cinnabar)" }} className="text-2xl font-bold">{formatCurrency(budget.total_spent)}</p>
              </div>
              <div>
                <p style={{ color: "var(--dust)" }} className="text-xs uppercase tracking-wider font-semibold mb-1">Remaining</p>
                <p
                  style={{ color: budget.remaining < 0 ? "var(--cinnabar)" : "var(--jade)" }}
                  className="text-2xl font-bold"
                >
                  {formatCurrency(budget.remaining)}
                </p>
              </div>
            </div>
            <div
              style={{ background: "var(--ink-muted)" }}
              className="relative h-4 rounded-full overflow-hidden"
            >
              <div
                style={{ width: `${usedPct}%`, background: progressFill }}
                className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
              />
            </div>
            <p style={{ color: "var(--dust)" }} className="text-xs mt-1.5 text-right">{usedPct.toFixed(1)}% utilized</p>
          </div>
        ) : null}

        {/* Add expense form */}
        {showForm && !isCompleted && (
          <div
            style={{ background: "var(--ink-soft)", border: "1px solid var(--amber)", boxShadow: "0 0 0 1px var(--amber)" }}
            className="rounded-xl p-5 mb-5"
          >
            <h2 style={{ color: "var(--cream)" }} className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Receipt size={14} style={{ color: "var(--amber)" }} />
              New Expense
            </h2>
            <form onSubmit={handleSubmit((d) => addExpense.mutate(d))} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label style={{ color: "var(--fog)" }} className="text-xs font-semibold block mb-1">Category</label>
                  <select
                    {...register("category")}
                    style={{
                      ...focusStyle("category"),
                      colorScheme: "dark",
                    }}
                    onFocus={() => setFocusedField("category")}
                    onBlur={() => setFocusedField(null)}
                  >
                    <option value="">Select category…</option>
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  {errors.category && <p style={{ color: "var(--cinnabar)" }} className="text-xs mt-0.5">{errors.category.message}</p>}
                </div>
                <div>
                  <label style={{ color: "var(--fog)" }} className="text-xs font-semibold block mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    {...register("amount")}
                    placeholder="0.00"
                    style={focusStyle("amount")}
                    onFocus={() => setFocusedField("amount")}
                    onBlur={() => setFocusedField(null)}
                  />
                  {errors.amount && <p style={{ color: "var(--cinnabar)" }} className="text-xs mt-0.5">{errors.amount.message}</p>}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label style={{ color: "var(--fog)" }} className="text-xs font-semibold block mb-1">Title</label>
                  <input
                    type="text"
                    {...register("title")}
                    placeholder="Brief title…"
                    style={focusStyle("title")}
                    onFocus={() => setFocusedField("title")}
                    onBlur={() => setFocusedField(null)}
                  />
                  {errors.title && <p style={{ color: "var(--cinnabar)" }} className="text-xs mt-0.5">{errors.title.message}</p>}
                </div>
                <div>
                  <label style={{ color: "var(--fog)" }} className="text-xs font-semibold block mb-1">Bill URL (optional)</label>
                  <input
                    type="text"
                    {...register("bill_url")}
                    placeholder="https://…"
                    style={focusStyle("bill_url")}
                    onFocus={() => setFocusedField("bill_url")}
                    onBlur={() => setFocusedField(null)}
                  />
                  {errors.bill_url && <p style={{ color: "var(--cinnabar)" }} className="text-xs mt-0.5">{errors.bill_url.message}</p>}
                </div>
              </div>
              <div>
                <label style={{ color: "var(--fog)" }} className="text-xs font-semibold block mb-1">Notes (optional)</label>
                <input
                  type="text"
                  {...register("notes")}
                  placeholder="Additional notes…"
                  style={focusStyle("notes")}
                  onFocus={() => setFocusedField("notes")}
                  onBlur={() => setFocusedField(null)}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); reset(); }}
                  style={{ color: "var(--fog)", background: "transparent", border: "none" }}
                  className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--ink-muted)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addExpense.isPending}
                  style={{ background: "var(--amber)", color: "var(--ink)" }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors"
                  onMouseEnter={(e) => { if (!addExpense.isPending) e.currentTarget.style.background = "var(--amber-glow)"; }}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "var(--amber)")}
                >
                  {addExpense.isPending && <Loader2 size={14} className="animate-spin" />}
                  Add Expense
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Category chart */}
        {chartData.length > 0 && (
          <div
            style={{ background: "var(--ink-soft)", border: "1px solid var(--seam)" }}
            className="rounded-xl p-5 mb-5"
          >
            <h2 style={{ color: "var(--fog)" }} className="text-sm font-semibold mb-4">Budget vs Actual by Category</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A3040" vertical={false} />
                <XAxis dataKey="category" tick={{ fontSize: 11, fill: "#7A8699" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#7A8699" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "#161A23", border: "1px solid #2A3040", color: "#F5F0E8", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => formatCurrency(v)}
                />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="allocated" name="Allocated" fill="#2A3040" radius={[4, 4, 0, 0]} />
                <Bar dataKey="spent" name="Spent" fill="#F5A623" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Expenses list */}
        <div
          style={{ background: "var(--ink-soft)", border: "1px solid var(--seam)" }}
          className="rounded-xl overflow-hidden"
        >
          <div style={{ borderBottom: "1px solid var(--seam)" }} className="px-4 py-3">
            <h2 style={{ color: "var(--fog)" }} className="text-sm font-semibold">All Expenses</h2>
          </div>
          {loadingExpenses ? (
            <div className="divide-y" style={{ borderColor: "var(--seam)" }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3.5 animate-pulse">
                  <div style={{ background: "var(--ink-muted)" }} className="h-4 rounded w-24" />
                  <div style={{ background: "var(--ink-muted)" }} className="h-4 rounded w-48 flex-1" />
                  <div style={{ background: "var(--ink-muted)" }} className="h-4 rounded w-20" />
                </div>
              ))}
            </div>
          ) : !expenses || expenses.length === 0 ? (
            <div className="p-10 text-center">
              <Receipt size={32} style={{ color: "var(--dust)" }} className="mx-auto mb-3" />
              <p style={{ color: "var(--dust)" }} className="text-sm">No expenses recorded yet.</p>
            </div>
          ) : (
            <div>
              {expenses.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center gap-4 px-4 py-3.5 transition-colors"
                  style={{ borderTop: "1px solid var(--seam)" }}
                  onMouseEnter={(el) => (el.currentTarget.style.background = "color-mix(in srgb, var(--cream) 3%, transparent)")}
                  onMouseLeave={(el) => (el.currentTarget.style.background = "transparent")}
                >
                  <span
                    style={{ background: "var(--ink-muted)", color: "var(--ash)" }}
                    className="text-xs font-semibold px-2 py-0.5 rounded"
                  >
                    {e.category}
                  </span>
                  <p style={{ color: "var(--cream)" }} className="flex-1 text-sm">{e.title}</p>
                  <p style={{ color: "var(--fog)" }} className="text-xs">{e.notes ?? ""}</p>
                  <p style={{ color: "var(--cream)" }} className="text-sm font-semibold w-24 text-right">
                    {formatCurrency(e.amount)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Winners & Bank Details */}
        {winners && winners.length > 0 && (
          <div
            style={{ background: "var(--ink-soft)", border: "1px solid var(--seam)" }}
            className="rounded-xl overflow-hidden mt-5"
          >
            <div style={{ borderBottom: "1px solid var(--seam)" }} className="px-4 py-3 flex items-center gap-2">
              <Trophy size={14} style={{ color: "var(--amber)" }} />
              <h2 style={{ color: "var(--fog)" }} className="text-sm font-semibold">Winners & Bank Details</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background: "var(--ink-muted)" }}>
                    {["Position", "Name", "Email", "Roll No.", "Prize (₹)", "Bank Name", "Account No.", "IFSC", "UPI"].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--dust)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {winners.map((w) => (
                    <tr key={w.id} style={{ borderTop: "1px solid var(--seam)" }}>
                      <td className="px-4 py-3 font-semibold" style={{ color: "var(--amber)" }}>
                        {["", "1st", "2nd", "3rd", "4th"][w.position] ?? `${w.position}th`}
                      </td>
                      <td className="px-4 py-3 font-medium" style={{ color: "var(--cream)" }}>{w.participant_name}</td>
                      <td className="px-4 py-3" style={{ color: "var(--fog)" }}>{w.participant_email}</td>
                      <td className="px-4 py-3" style={{ color: "var(--fog)" }}>{w.roll_number ?? "—"}</td>
                      <td className="px-4 py-3 font-semibold" style={{ color: w.prize_amount ? "var(--jade)" : "var(--dust)" }}>
                        {w.prize_amount ? formatCurrency(w.prize_amount) : "—"}
                      </td>
                      <td className="px-4 py-3" style={{ color: "var(--fog)" }}>{w.bank_account_name ?? "—"}</td>
                      <td className="px-4 py-3 font-mono" style={{ color: "var(--fog)" }}>{w.bank_account_number ?? "—"}</td>
                      <td className="px-4 py-3 font-mono" style={{ color: "var(--fog)" }}>{w.bank_ifsc ?? "—"}</td>
                      <td className="px-4 py-3" style={{ color: "var(--sky)" }}>{w.upi ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
