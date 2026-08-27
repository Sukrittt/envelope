import Link from "next/link";
import { usePathname } from "next/navigation";
import { clearAccess, useAccessMode } from "../services/accessMode";
import { formatCurrency } from "@/lib/currency";

interface Props {
  onMoveMoney?: () => void;
  onShowCategories?: () => void;
  onBulkReturn?: () => void;
  month?: string;
  income?: number;
  totalSpent?: number;
}

export function ExpenseSidebar({
  onMoveMoney,
  onShowCategories,
  onBulkReturn,
  month,
  income,
  totalSpent,
}: Props) {
  const pathname = usePathname();
  const access = useAccessMode();
  const isBudget = pathname.startsWith("/expense");
  const left = income != null && totalSpent != null ? income - totalSpent : null;

  return (
    <nav className="erd-sidebar">
      <div>
        <div className="erd-greeting">
          Hey Sukrit <span className="erd-wave">👋</span>
        </div>
        <div className="erd-sidebar-month">
          {month ?? ""} · {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
        </div>
      </div>

      {month && (
        <div className="erd-summary-box">
          <div className="erd-summary-row">
            <span>Income</span>
            <strong>{income != null ? formatCurrency(income) : "—"}</strong>
          </div>
          <div className="erd-summary-row">
            <span>Spent</span>
            <strong>{totalSpent != null ? formatCurrency(totalSpent) : "—"}</strong>
          </div>
          <div className="erd-summary-row">
            <span>Left</span>
            <strong style={{ color: "var(--mint)" }}>
              {left != null ? formatCurrency(left) : "—"}
            </strong>
          </div>
        </div>
      )}

      <div className="erd-nav-group">
        <div className="erd-nav-label">Views</div>
        <Link
          href="/expense"
          className={`erd-nav-item ${isBudget && pathname === "/expense" ? "is-active" : ""}`}
        >
          <span className="erd-nav-dot" />
          Dashboard
        </Link>
        <Link
          href="/expense/transactions"
          className={`erd-nav-item ${pathname === "/expense/transactions" ? "is-active" : ""}`}
        >
          <span className="erd-nav-dot" />
          Transactions
        </Link>
      </div>

      <div className="erd-nav-group">
        <div className="erd-nav-label">Envelopes</div>
        {onShowCategories && (
          <button type="button" className="erd-nav-item" onClick={onShowCategories}>
            <span className="erd-nav-dot" />
            Categories
          </button>
        )}
        {onMoveMoney && (
          <button type="button" className="erd-nav-item" onClick={onMoveMoney}>
            <span className="erd-nav-dot" />
            Move money
          </button>
        )}
      </div>

      <div className="erd-nav-group">
        <div className="erd-nav-label">Settings</div>
        {onBulkReturn && (
          <button type="button" className="erd-nav-item" onClick={onBulkReturn}>
            <span className="erd-nav-dot" />
            Return all to RTA
          </button>
        )}
        <button type="button" className="erd-nav-item" onClick={clearAccess}>
          <span className="erd-nav-dot" />
          {access === "real" ? "Log out" : "Exit guest mode"}
        </button>
      </div>

      <div className="erd-sidebar-foot">Crafted for Sukrit&apos;s finances</div>
    </nav>
  );
}
