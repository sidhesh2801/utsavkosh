"use client";

import { useMemo, useState } from "react";
import { useLookups, useSociety } from "@/lib/store";
import {
  expensesByActivity,
  expensesByCategory,
  fundSummary,
  ledger,
  monthlyFlow,
  pending,
} from "@/lib/finance";
import { money, shortDate, methodLabel, humanise, flatLabel } from "@/lib/format";
import { csvName, downloadCsv, toCsv } from "@/lib/csv";
import { fundSummaryMessage } from "@/lib/messages";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  LinkButton,
  PageHeader,
  SectionTitle,
  StatTile,
} from "./ui";
import { CategoryBars, MonthlyFlowChart } from "./charts";
import { ShareButton } from "./share";
import { DonationForm, ExpenseForm, ExpenseRow } from "./entries";
import {
  AddDonationButton,
  AddExpenseButton,
  CommitteeSignInHint,
  DeleteExpenseButton,
  ExpenseSheet,
  useCommitteeSession,
} from "./ledger-admin";
import type { Donation, Expense } from "@/lib/types";

type Tab = "overview" | "donations" | "expenses";

/**
 * Downloads whatever is currently on screen — the filters applied above are
 * part of what the reader is looking at, so exporting the unfiltered set would
 * hand back something different from what they asked for.
 */
function ExportCsv({
  label,
  kind,
  headers,
  rows,
}: {
  label: string;
  kind: string;
  headers: string[];
  rows: Array<Array<unknown>>;
}) {
  const { data } = useSociety();
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={!rows.length}
      onClick={() => downloadCsv(csvName(data.society.name, kind), toCsv(headers, rows))}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M12 3v12m0 0 4-4m-4 4-4-4" stroke="currentColor" strokeWidth="1.7"
          strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 17v2.5h16V17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
      {label}
    </Button>
  );
}

/**
 * The funds screen. `only` pins it to a single section, which is how the
 * separate Donations and Ledger pages reuse these tables without a second copy.
 */
export function FundsView({
  only,
  title,
  subtitle,
}: {
  only?: Tab;
  title?: string;
  subtitle?: string;
} = {}) {
  const { data, isAdmin, canCollect } = useSociety();
  const [tab, setTab] = useState<Tab>(only ?? "overview");

  const summary = useMemo(() => fundSummary(data.donations, data.expenses), [data]);

  return (
    <div>
      <PageHeader
        title={title ?? "Funds"}
        subtitle={
          subtitle ??
          "Who contributed, where every rupee went, and what is left. Open to all residents — no sign-in needed."
        }
        actions={
          <ShareButton
            size="sm"
            message={fundSummaryMessage(data.society, summary)}
            label="Share statement"
          />
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Collected" value={money(summary.collected)} tone="credit" />
        <StatTile label="Spent" value={money(summary.spent)} tone="debit" />
        <StatTile label="Balance in hand" value={money(summary.balance)} tone="brand" />
        <StatTile
          label="Awaiting handover"
          value={money(summary.pendingCollection)}
          tone={summary.pendingCollection > 0 ? "warn" : "neutral"}
          hint={
            summary.pendingCount
              ? `${summary.pendingCount} entries not yet counted in the balance`
              : "All collections accounted for"
          }
        />
      </div>

      <div
        role="tablist"
        aria-label="Fund views"
        hidden={!!only}
        className="mb-5 flex gap-1 overflow-x-auto rounded-[10px] bg-surface-sunken p-1"
      >
        {(
          [
            ["overview", "Overview"],
            ["donations", `Who contributed (${data.donations.length})`],
            ["expenses", `Where it went (${data.expenses.length})`],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            role="tab"
            type="button"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={`whitespace-nowrap rounded-lg px-3.5 py-1.5 text-[0.8125rem] font-medium transition-colors ${
              tab === value ? "bg-surface text-ink shadow-sm" : "text-ink-soft hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" ? <Overview /> : null}
      {tab === "donations" ? <DonationsTab canCollect={canCollect} isAdmin={isAdmin} /> : null}
      {tab === "expenses" ? <ExpensesTab isAdmin={isAdmin} /> : null}
    </div>
  );
}

/* ---------------------------------------------------------------- overview */

function Overview() {
  const { data } = useSociety();
  const months = useMemo(() => monthlyFlow(data.donations, data.expenses, 12), [data]);
  const categories = useMemo(() => expensesByCategory(data.expenses), [data.expenses]);
  const byActivity = useMemo(
    () => expensesByActivity(data.expenses, data.activities),
    [data.expenses, data.activities],
  );
  const pendingEntries = useMemo(() => pending(data.donations), [data.donations]);

  return (
    <div className="space-y-6">
      {pendingEntries.length ? (
        <Card className="border-warn/30 bg-warn-soft/40 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-warn">
                {money(pendingEntries.reduce((t, d) => t + d.amount, 0))} is with volunteers
              </p>
              <p className="mt-1 text-[0.8125rem] leading-snug text-ink-soft">
                {pendingEntries.length} contributions have been recorded but not yet handed to the
                treasurer, so they are not counted in the balance.
              </p>
            </div>
            <LinkButton href="/collect" size="sm" variant="secondary">
              Review handovers
            </LinkButton>
          </div>
        </Card>
      ) : null}

      <Card className="p-4 sm:p-5">
        <SectionTitle>Money in and out, last 12 months</SectionTitle>
        <MonthlyFlowChart months={months} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-4 sm:p-5">
          <SectionTitle>Where the money went — by category</SectionTitle>
          <CategoryBars slices={categories} />
        </Card>

        <Card className="p-4 sm:p-5">
          <SectionTitle>Where the money went — by activity</SectionTitle>
          {byActivity.length ? (
            <ul className="space-y-2.5">
              {byActivity.map((slice) => {
                const max = byActivity[0].amount;
                return (
                  <li key={slice.activityId ?? "general"}>
                    <div className="mb-1 flex items-baseline justify-between gap-3">
                      <span className="truncate text-[0.8125rem] text-ink">{slice.label}</span>
                      <span className="tnum shrink-0 text-[0.8125rem] font-medium text-ink">
                        {money(slice.amount)}
                        <span className="ml-1.5 text-xs font-normal text-ink-faint">
                          {slice.pct}%
                        </span>
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-series-out-wash">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${max > 0 ? (slice.amount / max) * 100 : 0}%`,
                          backgroundColor: "var(--color-series-out)",
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-ink-soft">No spending recorded yet.</p>
          )}
        </Card>
      </div>

      <Card className="p-4 sm:p-5">
        <SectionTitle
          action={
            <LinkButton href="/funds/report" size="sm" variant="secondary">
              Full report
            </LinkButton>
          }
        >
          Complete ledger, newest first
        </SectionTitle>
        <Ledger limit={25} />
      </Card>
    </div>
  );
}

function Ledger({ limit }: { limit?: number }) {
  const { data } = useSociety();
  const entries = useMemo(() => {
    const all = ledger(data.donations, data.expenses);
    return limit ? all.slice(0, limit) : all;
  }, [data, limit]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] text-left text-[0.8125rem]">
        <thead>
          <tr className="border-b border-line text-[0.6875rem] uppercase tracking-[0.05em] text-ink-faint">
            <th scope="col" className="py-2 pr-3 font-semibold">Date</th>
            <th scope="col" className="py-2 pr-3 font-semibold">Entry</th>
            <th scope="col" className="py-2 pr-3 text-right font-semibold">In</th>
            <th scope="col" className="py-2 text-right font-semibold">Out</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((item) => (
            <tr key={item.entry.id} className="border-b border-line last:border-0">
              <td className="tnum whitespace-nowrap py-2 pr-3 text-ink-soft">
                {shortDate(item.date)}
              </td>
              <td className="py-2 pr-3">
                <span className="text-ink">
                  {item.kind === "donation"
                    ? item.entry.donorName || `Contribution ${item.entry.receiptNo}`
                    : item.entry.title}
                </span>
                {item.kind === "donation" && item.entry.status === "pending" ? (
                  <Badge tone="warn" className="ml-2">
                    Pending
                  </Badge>
                ) : null}
              </td>
              <td
                className="tnum py-2 pr-3 text-right font-medium"
                style={{ color: item.kind === "donation" ? "var(--color-series-in)" : undefined }}
              >
                {item.kind === "donation" ? money(item.entry.amount) : ""}
              </td>
              <td
                className="tnum py-2 text-right font-medium"
                style={{ color: item.kind === "expense" ? "var(--color-series-out)" : undefined }}
              >
                {item.kind === "expense" ? money(item.entry.amount) : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* --------------------------------------------------------------- donations */

function DonationsTab({ canCollect }: { canCollect: boolean; isAdmin?: boolean }) {
  // Same committee session as the ledger and the receipt generator.
  const committee = useCommitteeSession();
  const { data } = useSociety();
  const [query, setQuery] = useState("");
  const [activityFilter, setActivityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "verified" | "pending">("all");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Donation | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.donations
      .filter((d) => {
        if (activityFilter === "general" && d.activityId !== null) return false;
        if (activityFilter !== "all" && activityFilter !== "general" && d.activityId !== activityFilter)
          return false;
        if (statusFilter !== "all" && d.status !== statusFilter) return false;
        if (!q) return true;
        return (
          d.donorName.toLowerCase().includes(q) ||
          `${d.wing ?? ""}-${d.flat ?? ""}`.toLowerCase().includes(q) ||
          (d.reference ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  }, [data.donations, query, activityFilter, statusFilter]);

  const total = filtered.reduce((t, d) => t + d.amount, 0);

  const { activityById } = useLookups();
  const csvRows = filtered.map((d) => [
    d.receiptNo,
    shortDate(d.receivedAt),
    d.donorName,
    flatLabel(d.wing, d.flat),
    d.isTenant ? "Tenant" : "Owner",
    d.amount,
    methodLabel(d.method),
    d.activityId ? (activityById.get(d.activityId)?.title ?? "") : "General fund",
    d.status === "verified" ? "Verified" : "Awaiting handover",
  ]);

  return (
    <div className="space-y-4">
      {/* One filter row above everything it scopes. */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="field max-w-[16rem] flex-1"
          placeholder="Search name, flat or reference"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search donations"
        />
        <select
          className="field w-auto"
          value={activityFilter}
          onChange={(e) => setActivityFilter(e.target.value)}
          aria-label="Filter by activity"
        >
          <option value="all">All activities</option>
          <option value="general">General fund</option>
          {data.activities.map((a) => (
            <option key={a.id} value={a.id}>
              {a.title}
            </option>
          ))}
        </select>
        <select
          className="field w-auto"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          aria-label="Filter by status"
        >
          <option value="all">All entries</option>
          <option value="verified">Verified only</option>
          <option value="pending">Awaiting handover</option>
        </select>
        <ExportCsv
          label="Download CSV"
          kind="donations"
          headers={[
            "Receipt no.", "Date", "Name", "Flat", "Owner/Tenant",
            "Amount (INR)", "Method", "Towards", "Status",
          ]}
          rows={csvRows}
        />
        <div className="ml-auto">
          {committee.authenticated ? (
            <AddDonationButton onSaved={() => window.location.reload()} />
          ) : null}
        </div>
      </div>

      <p className="text-[0.8125rem] text-ink-soft">
        Showing <span className="tnum font-medium text-ink">{filtered.length}</span>{" "}
        {filtered.length === 1 ? "entry" : "entries"} totalling{" "}
        <span className="tnum font-medium text-ink">{money(total)}</span>
      </p>

      {filtered.length ? (
        <Card className="overflow-x-auto">
          {/* A table rather than cards: with a hundred entries the point is
              scanning down one column, which cards make impossible. */}
          <table className="w-full min-w-[46rem] text-left text-[0.8125rem]">
            <thead>
              <tr className="border-b border-line text-[0.6875rem] uppercase tracking-[0.05em] text-ink-faint">
                <th className="px-4 py-2.5 font-semibold">Date</th>
                <th className="px-4 py-2.5 font-semibold">Name</th>
                <th className="px-4 py-2.5 font-semibold">Flat no.</th>
                <th className="px-4 py-2.5 text-right font-semibold">Amount</th>
                <th className="px-4 py-2.5 font-semibold">Towards</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold">Receipt</th>
                {canCollect ? <th className="px-4 py-2.5 font-semibold" /> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((d) => (
                <tr key={d.id} className="align-top">
                  <td className="tnum whitespace-nowrap px-4 py-2.5 text-ink-soft">
                    {shortDate(d.receivedAt)}
                  </td>
                  <td className="px-4 py-2.5 text-ink">
                    {d.donorName}
                    {d.isTenant ? (
                      <span className="ml-1.5 text-[0.6875rem] text-ink-faint">tenant</span>
                    ) : null}
                  </td>
                  <td className="tnum whitespace-nowrap px-4 py-2.5 text-ink-soft">
                    {d.wing || d.flat ? flatLabel(d.wing, d.flat) : "—"}
                  </td>
                  <td className="tnum whitespace-nowrap px-4 py-2.5 text-right font-medium text-ink">
                    {money(d.amount)}
                  </td>
                  <td className="px-4 py-2.5 text-ink-soft">
                    {d.activityId
                      ? (activityById.get(d.activityId)?.title ?? "—")
                      : "General fund"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    {d.status === "verified" ? (
                      <span className="text-credit">Verified</span>
                    ) : (
                      <span className="text-warn">Awaiting handover</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    {d.receiptSentAt ? (
                      <span className="text-credit">Sent</span>
                    ) : (
                      <span className="text-ink-faint">Not yet</span>
                    )}
                  </td>
                  {canCollect ? (
                    <td className="whitespace-nowrap px-4 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => setEditing(d)}
                        className="text-[0.6875rem] font-medium text-brand underline decoration-brand/30 underline-offset-2"
                      >
                        Edit
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <EmptyState
          title="No contributions match this filter"
          description="Try clearing the search or choosing a different activity."
        />
      )}

      {adding ? <DonationForm open onClose={() => setAdding(false)} /> : null}
      {editing ? (
        <DonationForm open existing={editing} onClose={() => setEditing(null)} />
      ) : null}
    </div>
  );
}

/**
 * The shared expense row, with a remove control for the committee.
 *
 * Wrapped rather than changed in place: the row is used elsewhere without any
 * notion of a committee session, and it shouldn't grow one.
 */
function ExpenseRowWithRemove({
  expense,
  canEdit,
  onEdit,
}: {
  expense: Expense;
  canEdit: boolean;
  onEdit?: () => void;
}) {
  return (
    <li>
      <ul>
        <ExpenseRow expense={expense} onEdit={onEdit} canSeeBill={canEdit} />
      </ul>
      {canEdit ? (
        <div className="px-4 pb-2.5 -mt-1">
          <DeleteExpenseButton id={expense.id} onDone={() => window.location.reload()} />
        </div>
      ) : null}
    </li>
  );
}

/* ---------------------------------------------------------------- expenses */

function ExpensesTab({ isAdmin }: { isAdmin: boolean }) {
  // Editing the ledger is governed by the committee session — the same
  // password as the receipt generator — rather than a separate app account.
  const committee = useCommitteeSession();
  const canEdit = committee.authenticated || isAdmin;
  const { data } = useSociety();
  const [query, setQuery] = useState("");
  const [activityFilter, setActivityFilter] = useState("all");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.expenses
      .filter((e) => {
        if (activityFilter === "general" && e.activityId !== null) return false;
        if (activityFilter !== "all" && activityFilter !== "general" && e.activityId !== activityFilter)
          return false;
        if (!q) return true;
        return (
          e.title.toLowerCase().includes(q) ||
          (e.vendor ?? "").toLowerCase().includes(q) ||
          (e.billNo ?? "").toLowerCase().includes(q) ||
          (e.paidBy ?? "").toLowerCase().includes(q) ||
          e.category.includes(q)
        );
      })
      .sort((a, b) => b.paidAt.localeCompare(a.paidAt));
  }, [data.expenses, query, activityFilter]);

  const total = filtered.reduce((t, e) => t + e.amount, 0);

  const { activityById } = useLookups();
  const csvRows = filtered.map((e) => [
    shortDate(e.paidAt),
    e.title,
    humanise(e.category),
    e.vendor ?? "",
    e.billNo ?? "",
    e.amount,
    methodLabel(e.method),
    e.paidBy ?? "",
    e.hasBill ? "yes" : "",
    e.activityId ? (activityById.get(e.activityId)?.title ?? "") : "General spending",
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="field max-w-[16rem] flex-1"
          placeholder="Search item, vendor, bill no. or who paid"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search expenses"
        />
        <select
          className="field w-auto"
          value={activityFilter}
          onChange={(e) => setActivityFilter(e.target.value)}
          aria-label="Filter by activity"
        >
          <option value="all">All activities</option>
          <option value="general">General spending</option>
          {data.activities.map((a) => (
            <option key={a.id} value={a.id}>
              {a.title}
            </option>
          ))}
        </select>
        <ExportCsv
          label="Download CSV"
          kind="expenses"
          headers={[
            "Date", "Item", "Category", "Vendor", "Bill no.",
            "Amount (INR)", "Method", "Paid by", "Bill attached", "For",
          ]}
          rows={csvRows}
        />
        <div className="ml-auto flex items-center gap-2">
          {canEdit ? (
            <AddExpenseButton onSaved={() => window.location.reload()} />
          ) : committee.checked ? (
            <CommitteeSignInHint />
          ) : null}
        </div>
      </div>

      <p className="text-[0.8125rem] text-ink-soft">
        Showing <span className="tnum font-medium text-ink">{filtered.length}</span>{" "}
        {filtered.length === 1 ? "entry" : "entries"} totalling{" "}
        <span className="tnum font-medium text-ink">{money(total)}</span>
      </p>

      {filtered.length ? (
        <Card>
          <ul className="divide-y divide-line">
            {filtered.map((e) => (
              <ExpenseRowWithRemove
                canEdit={canEdit}
                key={e.id}
                expense={e}
                onEdit={canEdit ? () => setEditing(e) : undefined}
              />
            ))}
          </ul>
        </Card>
      ) : (
        <EmptyState
          title="No expenses match this filter"
          description="Try clearing the search or choosing a different activity."
        />
      )}

      {adding ? <ExpenseForm open onClose={() => setAdding(false)} /> : null}
      {editing ? (
        committee.authenticated ? (
          // The committee login writes through the server routes; the older
          // Supabase Auth form writes with a user token and can't.
          <ExpenseSheet
            existing={editing}
            onClose={() => setEditing(null)}
            onSaved={() => window.location.reload()}
          />
        ) : (
          <ExpenseForm open existing={editing} onClose={() => setEditing(null)} />
        )
      ) : null}
    </div>
  );
}
