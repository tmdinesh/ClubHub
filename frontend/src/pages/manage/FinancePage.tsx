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
} from "lucide-react";
import Layout from "@/components/Layout";
import api from "@/lib/api";
import type { FinanceSummary } from "@/types";

interface Expense {
  id: string;
  category: string;
  title: string;
  amount: number;
  bill_url: string | null;
  notes: string | null;
  created_at: string;
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

export default function FinancePage() {
  const { eventId } = useParams<{ eventId: string }>();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = React.useState(false);

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

  return (
    <Layout eventId={eventId}>
      <div className="p-8 max-w-5xl mx-auto">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
              <Wallet size={22} className="text-amber-500" />
              Finance
            </h1>
            <p className="text-slate-500 mt-1 text-sm">Budget tracking and expenses</p>
          </div>
          <button type="button"
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
          >
            <Plus size={15} />
            Add Expense
          </button>
        </div>

        {/* Budget overview */}
        {loadingBudget ? (
          <div className="bg-white rounded-xl border border-slate-100 p-6 mb-5 animate-pulse">
            <div className="h-6 bg-slate-100 rounded w-32 mb-4" />
            <div className="h-4 bg-slate-100 rounded-full mb-2" />
            <div className="flex justify-between">
              <div className="h-3 bg-slate-100 rounded w-20" />
              <div className="h-3 bg-slate-100 rounded w-20" />
            </div>
          </div>
        ) : budget ? (
          <div className="bg-white rounded-xl border border-slate-100 p-6 mb-5">
            <div className="grid grid-cols-3 gap-4 mb-5">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Total Budget</p>
                <p className="text-2xl font-bold text-slate-800">{formatCurrency(budget.total_budget)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Spent</p>
                <p className="text-2xl font-bold text-rose-600">{formatCurrency(budget.total_spent)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Remaining</p>
                <p className={`text-2xl font-bold ${budget.remaining < 0 ? "text-red-600" : "text-emerald-600"}`}>
                  {formatCurrency(budget.remaining)}
                </p>
              </div>
            </div>
            <div className="relative h-4 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`absolute left-0 top-0 h-full rounded-full transition-all duration-700 ${
                  usedPct > 90 ? "bg-red-500" : usedPct > 70 ? "bg-amber-500" : "bg-emerald-500"
                }`}
                style={{ width: `${usedPct}%` }}
              />
            </div>
            <p className="text-xs text-slate-400 mt-1.5 text-right">{usedPct.toFixed(1)}% utilized</p>
          </div>
        ) : null}

        {/* Add expense form */}
        {showForm && (
          <div className="bg-white rounded-xl border border-indigo-100 ring-1 ring-indigo-100 p-5 mb-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <Receipt size={14} className="text-indigo-500" />
              New Expense
            </h2>
            <form onSubmit={handleSubmit((d) => addExpense.mutate(d))} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Category</label>
                  <select
                    {...register("category")}
                    className="w-full text-sm px-3 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                  >
                    <option value="">Select category…</option>
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  {errors.category && <p className="text-xs text-red-500 mt-0.5">{errors.category.message}</p>}
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    {...register("amount")}
                    placeholder="0.00"
                    className="w-full text-sm px-3 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                  {errors.amount && <p className="text-xs text-red-500 mt-0.5">{errors.amount.message}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Title</label>
                  <input
                    type="text"
                    {...register("title")}
                    placeholder="Brief title…"
                    className="w-full text-sm px-3 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                  {errors.title && <p className="text-xs text-red-500 mt-0.5">{errors.title.message}</p>}
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Bill URL (optional)</label>
                  <input
                    type="text"
                    {...register("bill_url")}
                    placeholder="https://…"
                    className="w-full text-sm px-3 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                  {errors.bill_url && <p className="text-xs text-red-500 mt-0.5">{errors.bill_url.message}</p>}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Notes (optional)</label>
                <input
                  type="text"
                  {...register("notes")}
                  placeholder="Additional notes…"
                  className="w-full text-sm px-3 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); reset(); }}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addExpense.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
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
          <div className="bg-white rounded-xl border border-slate-100 p-5 mb-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Budget vs Actual by Category</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="category" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                  formatter={(v: number) => formatCurrency(v)}
                />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="allocated" name="Allocated" fill="#e0e7ff" radius={[4, 4, 0, 0]} />
                <Bar dataKey="spent" name="Spent" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Expenses list */}
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-50">
            <h2 className="text-sm font-semibold text-slate-700">All Expenses</h2>
          </div>
          {loadingExpenses ? (
            <div className="divide-y divide-slate-50">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3.5 animate-pulse">
                  <div className="h-4 bg-slate-100 rounded w-24" />
                  <div className="h-4 bg-slate-100 rounded w-48 flex-1" />
                  <div className="h-4 bg-slate-100 rounded w-20" />
                </div>
              ))}
            </div>
          ) : !expenses || expenses.length === 0 ? (
            <div className="p-10 text-center">
              <Receipt size={32} className="text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">No expenses recorded yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {expenses.map((e) => (
                <div key={e.id} className="flex items-center gap-4 px-4 py-3.5 hover:bg-slate-50/50 transition-colors">
                  <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                    {e.category}
                  </span>
                  <p className="flex-1 text-sm text-slate-700">{e.title}</p>
                  <p className="text-xs text-slate-400">{e.notes ?? ""}</p>
                  <p className="text-sm font-semibold text-slate-800 w-24 text-right">
                    {formatCurrency(e.amount)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
