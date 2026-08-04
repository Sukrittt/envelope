import Link from "next/link";
import { usePathname } from "next/navigation";
import { clearAccess, useAccessMode } from "../services/accessMode";

interface Props {
  onMoveMoney?: () => void;
  onShowCategories?: () => void;
  onBulkReturn?: () => void;
  month?: string;
  income?: number;
  totalSpent?: number;
}

function formatCurrency(value: number): string {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

function daysLeftInMonth(): string {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const left = lastDay - now.getDate();
  return `${left} day${left !== 1 ? "s" : ""} left`;
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
  const isInvestments = pathname === "/investments";

  return (
    <nav className="expense-sidebar">
      {month && (
        <div className="expense-sidebar-summary">
          <span className="ess-month">{month}</span>
          <div className="ess-row">
            <span className="ess-label">Income</span>
            <span className="ess-value">
              {income != null ? formatCurrency(income) : "—"}
            </span>
          </div>
          <div className="ess-row">
            <span className="ess-label">Spent</span>
            <span className="ess-value">
              {totalSpent != null ? formatCurrency(totalSpent) : "—"}
            </span>
          </div>
          <div className="ess-row">
            <span className="ess-label">Left</span>
            <span className="ess-value">{daysLeftInMonth()}</span>
          </div>
        </div>
      )}

      <div>
        <div className="expense-sidebar-group-label">Views</div>
        <Link
          href="/expense"
          className={`expense-sidebar-link ${isBudget && pathname === "/expense" ? "is-active" : ""}`}
        >
          <span className="expense-sidebar-link-icon">◈</span>
          Dashboard
        </Link>
        <Link
          href="/expense/transactions"
          className={`expense-sidebar-link ${pathname === "/expense/transactions" ? "is-active" : ""}`}
        >
          <span className="expense-sidebar-link-icon">↕</span>
          Transactions
        </Link>
      </div>

      <div>
        <div className="expense-sidebar-group-label">Finance</div>
        <Link
          href="/investments"
          className={`expense-sidebar-link ${isInvestments ? "is-active" : ""}`}
        >
          <span className="expense-sidebar-link-icon">◆</span>
          Investments
        </Link>
      </div>

      {onMoveMoney && onShowCategories && (
        <div>
          <div className="expense-sidebar-group-label">Envelopes</div>
          <button
            type="button"
            className="expense-sidebar-link"
            onClick={onShowCategories}
          >
            <span className="expense-sidebar-link-icon">▤</span>
            Categories
          </button>
          <button
            type="button"
            className="expense-sidebar-link"
            onClick={onMoveMoney}
          >
            <span className="expense-sidebar-link-icon">⇄</span>
            Move money
          </button>
        </div>
      )}
      <div>
        <div className="expense-sidebar-group-label">Settings</div>
        {onBulkReturn && (
          <button
            type="button"
            className="expense-sidebar-link"
            onClick={onBulkReturn}
          >
            <span className="expense-sidebar-link-icon">⟲</span>
            Return all to RTA
          </button>
        )}
        <button
          type="button"
          className="expense-sidebar-link"
          onClick={clearAccess}
        >
          <span className="expense-sidebar-link-icon">⏻</span>
          {access === "real" ? "Log out" : "Exit guest mode"}
        </button>
      </div>
    </nav>
  );
}
