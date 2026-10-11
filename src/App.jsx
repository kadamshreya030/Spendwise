import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

/* ==========================================================================
   SpendWise — student expense tracker (single-file MVP)
   Sections: 1 Constants · 2 Helpers · 3 Storage · 4 Small UI pieces ·
             5 Charts · 6 Transaction form · 7 Views · 8 App (state + layout)
   ========================================================================== */

/* ---------- 1. Constants ---------- */

const STORAGE_KEYS = {
  transactions: 'spendwise.transactions.v1',
  budgets: 'spendwise.budgets.v1',
}

const INCOME_CATEGORIES = ['Salary', 'Freelance', 'Scholarship', 'Allowance', 'Other Income']
const EXPENSE_CATEGORIES = [
  'Food',
  'Transport',
  'Shopping',
  'Education',
  'Entertainment',
  'Bills',
  'Health',
  'Other Expense',
]

const CATEGORY_COLORS = {
  Food: '#d97706',
  Transport: '#2563eb',
  Shopping: '#db2777',
  Education: '#7c3aed',
  Entertainment: '#0d9488',
  Bills: '#dc2626',
  Health: '#16a34a',
  'Other Expense': '#64748b',
}

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'add', label: 'Add Transaction', icon: 'plus' },
  { id: 'history', label: 'Transaction History', icon: 'list' },
  { id: 'analytics', label: 'Analytics', icon: 'chart' },
  { id: 'budget', label: 'Monthly Budget', icon: 'wallet' },
]

const DEFAULT_BUDGETS = {
  total: 12000,
  categories: { Food: 3000, Transport: 1000, Shopping: 2000, Entertainment: 1000 },
}

const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/
const MAX_AMOUNT = 1000000000

const ICON_PATHS = {
  dashboard: 'M3 3h7v7H3z M14 3h7v7h-7z M14 14h7v7h-7z M3 14h7v7H3z',
  plus: 'M12 5v14 M5 12h14',
  list: 'M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01',
  chart: 'M18 20V10 M12 20V4 M6 20v-6',
  wallet:
    'M3 7h15a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7z M3 7a3 3 0 0 1 3-3h10 M16 14h2',
  edit: 'M12 20h9 M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z',
  trash: 'M3 6h18 M8 6V4h8v2 M19 6l-1 14H6L5 6 M10 11v6 M14 11v6',
  menu: 'M3 6h18 M3 12h18 M3 18h18',
  close: 'M18 6L6 18 M6 6l12 12',
  arrowUp: 'M7 17L17 7 M8 7h9v9',
  arrowDown: 'M17 7L7 17 M16 17H7V8',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M21 21l-4.35-4.35',
  trend: 'M23 6l-9.5 9.5-5-5L1 18 M17 6h6v6',
  alert:
    'M12 9v4 M12 17h.01 M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
  check: 'M20 6L9 17l-5-5',
  reset: 'M1 4v6h6 M3.51 15a9 9 0 1 0 2.13-9.36L1 10',
  info: 'M12 16v-4 M12 8h.01 M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
}

/* ---------- 2. Helpers (pure functions) ---------- */

function pad(n) {
  return String(n).padStart(2, '0')
}

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100
}

// Local calendar date as YYYY-MM-DD (avoids the UTC shift of toISOString()).
function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function currentMonthKey() {
  return todayISO().slice(0, 7)
}

function isValidISODate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  if (y < 2000 || y > 2100) return false
  const date = new Date(y, m - 1, d)
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
}

function formatDate(value) {
  if (!isValidISODate(value)) return '—'
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatMonth(key) {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

function formatShortMonth(key) {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'short' })
}

function shiftMonth(key, delta) {
  const [y, m] = key.split('-').map(Number)
  const date = new Date(y, m - 1 + delta, 1)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`
}

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

function formatINR(value) {
  return inrFormatter.format(Number.isFinite(value) ? value : 0)
}

// Short amounts for chart axes, e.g. ₹12.5k
function formatCompact(value) {
  if (value >= 10000000) return `₹${Number((value / 10000000).toFixed(1))}Cr`
  if (value >= 100000) return `₹${Number((value / 100000).toFixed(1))}L`
  if (value >= 1000) return `₹${Number((value / 1000).toFixed(1))}k`
  return `₹${Math.round(value)}`
}

function niceCeil(value) {
  if (value <= 0) return 1000
  const power = Math.pow(10, Math.floor(Math.log10(value)))
  const n = value / power
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10
  return nice * power
}

function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `tx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function categoriesFor(type) {
  return type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

// Totals for one calendar month (YYYY-MM). Only expenses feed byCategory.
function getMonthStats(transactions, monthKey) {
  let income = 0
  let expense = 0
  let count = 0
  const byCategory = {}
  transactions.forEach((tx) => {
    if (tx.date.slice(0, 7) !== monthKey) return
    count += 1
    if (tx.type === 'income') {
      income += tx.amount
    } else {
      expense += tx.amount
      byCategory[tx.category] = (byCategory[tx.category] || 0) + tx.amount
    }
  })
  Object.keys(byCategory).forEach((key) => {
    byCategory[key] = round2(byCategory[key])
  })
  const categories = Object.keys(byCategory)
    .map((category) => ({ category, amount: byCategory[category] }))
    .sort((a, b) => b.amount - a.amount)
  return {
    income: round2(income),
    expense: round2(expense),
    savings: round2(income - expense),
    count,
    byCategory,
    categories,
  }
}

function budgetStatus(spent, limit) {
  const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0
  const remaining = round2(limit - spent)
  let tone = 'ok'
  if (spent > limit) tone = 'over'
  else if (pct >= 80) tone = 'warn'
  return { pct, remaining, tone }
}

function validateTransaction(values) {
  const errors = {}
  const title = values.title.trim()
  if (!title) errors.title = 'Please enter a title for this transaction.'
  else if (title.length > 60) errors.title = 'Keep the title under 60 characters.'

  const amount = values.amount.trim()
  if (!amount) {
    errors.amount = 'Enter an amount in rupees.'
  } else if (!AMOUNT_PATTERN.test(amount)) {
    errors.amount = 'Enter a valid number such as 250 or 250.50 (no symbols, max 2 decimals).'
  } else if (Number(amount) <= 0) {
    errors.amount = 'Amount must be greater than zero.'
  } else if (Number(amount) > MAX_AMOUNT) {
    errors.amount = 'That amount is too large.'
  }

  if (!values.category || !categoriesFor(values.type).includes(values.category)) {
    errors.category = 'Choose a category.'
  }

  if (!values.date) errors.date = 'Choose a date.'
  else if (!isValidISODate(values.date)) errors.date = 'Enter a valid date between 2000 and 2100.'

  if (values.notes.length > 200) errors.notes = 'Notes can be up to 200 characters.'
  return errors
}

function validateBudgetDraft(draft) {
  const errors = {}
  const check = (key, raw) => {
    const text = (raw || '').trim()
    if (text === '') return
    if (!AMOUNT_PATTERN.test(text)) {
      errors[key] = 'Use a positive number (max 2 decimals) or leave blank.'
    } else if (Number(text) <= 0) {
      errors[key] = 'Must be greater than zero. Leave blank for no limit.'
    } else if (Number(text) > MAX_AMOUNT) {
      errors[key] = 'That amount is too large.'
    }
  }
  check('total', draft.total)
  EXPENSE_CATEGORIES.forEach((category) => check(category, draft.categories[category]))
  return errors
}

function controlProps(name, error) {
  return {
    id: `sw-field-${name}`,
    'aria-invalid': error ? 'true' : 'false',
    'aria-describedby': error ? `sw-error-${name}` : undefined,
  }
}

/* ---------- 3. Sample data and storage ---------- */

function buildSampleTransactions() {
  const baseKey = currentMonthKey()
  const today = new Date().getDate()
  const rows = []
  const add = (ago, day, title, amount, type, category, notes) =>
    rows.push([ago, day, title, amount, type, category, notes || ''])

  // This month
  add(0, 1, 'Monthly allowance', 15000, 'income', 'Allowance', 'From home')
  add(0, 3, 'Freelance logo design', 6500, 'income', 'Freelance', '')
  add(0, 2, 'Hostel mess fees', 3500, 'expense', 'Bills', '')
  add(0, 4, 'Groceries and snacks', 1240, 'expense', 'Food', '')
  add(0, 5, 'Metro card recharge', 500, 'expense', 'Transport', '')
  add(0, 6, 'Data structures textbook', 899, 'expense', 'Education', '')
  add(0, 7, 'Movie night', 650, 'expense', 'Entertainment', '')
  add(0, 8, 'Canteen lunches', 780, 'expense', 'Food', '')
  add(0, 9, 'Mobile recharge', 299, 'expense', 'Bills', '')
  add(0, 10, 'Sneakers (sale)', 2499, 'expense', 'Shopping', '')
  add(0, 11, 'Pharmacy', 340, 'expense', 'Health', '')

  // Previous five months: [monthsAgo, freelance, food, transport, shopping, fun, bills, education]
  const history = [
    [1, 4000, 4200, 1100, 1800, 900, 3800, 1500],
    [2, 0, 3900, 950, 2600, 1200, 3800, 0],
    [3, 7500, 4500, 1200, 900, 1500, 3900, 2200],
    [4, 2500, 3600, 800, 1400, 700, 3800, 600],
    [5, 5000, 4100, 1000, 2200, 1100, 3800, 1800],
  ]
  history.forEach(([ago, freelance, food, transport, shopping, fun, bills, education]) => {
    add(ago, 1, 'Monthly allowance', 15000, 'income', 'Allowance')
    if (freelance > 0) add(ago, 12, 'Freelance project', freelance, 'income', 'Freelance')
    add(ago, 5, 'Food and groceries', food, 'expense', 'Food')
    add(ago, 8, 'Commute and cab rides', transport, 'expense', 'Transport')
    add(ago, 14, 'Clothes and accessories', shopping, 'expense', 'Shopping')
    add(ago, 18, 'Streaming and outings', fun, 'expense', 'Entertainment')
    add(ago, 3, 'Mess fees and phone', bills, 'expense', 'Bills')
    if (education > 0) add(ago, 20, 'Course materials', education, 'expense', 'Education')
  })

  return rows
    .map(([ago, day, title, amount, type, category, notes]) => {
      const safeDay = ago === 0 ? Math.min(day, today) : Math.min(day, 28)
      return {
        id: createId(),
        title,
        amount,
        type,
        category,
        date: `${shiftMonth(baseKey, -ago)}-${pad(safeDay)}`,
        notes,
        sample: true,
      }
    })
    .sort((a, b) => b.date.localeCompare(a.date))
}

function cloneDefaultBudgets() {
  return { total: DEFAULT_BUDGETS.total, categories: { ...DEFAULT_BUDGETS.categories } }
}

function storageAvailable() {
  try {
    const probe = 'spendwise.__probe__'
    window.localStorage.setItem(probe, '1')
    window.localStorage.removeItem(probe)
    return true
  } catch {
    return false
  }
}

function saveJSON(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

function sanitizeTransaction(raw) {
  if (!raw || typeof raw !== 'object') return null
  const amount = Number(raw.amount)
  if (typeof raw.id !== 'string' || !raw.id) return null
  if (typeof raw.title !== 'string' || !raw.title.trim()) return null
  if (!Number.isFinite(amount) || amount <= 0) return null
  if (raw.type !== 'income' && raw.type !== 'expense') return null
  if (!categoriesFor(raw.type).includes(raw.category)) return null
  if (!isValidISODate(raw.date)) return null
  return {
    id: raw.id,
    title: raw.title.trim(),
    amount: round2(amount),
    type: raw.type,
    category: raw.category,
    date: raw.date,
    notes: typeof raw.notes === 'string' ? raw.notes : '',
    sample: raw.sample === true,
  }
}

// Sample data is used ONLY when nothing has ever been saved (or the saved text is unreadable,
// in which case the unreadable text is copied to a backup key first).
function loadTransactions() {
  let raw = null
  try {
    raw = window.localStorage.getItem(STORAGE_KEYS.transactions)
  } catch {
    return buildSampleTransactions()
  }
  if (raw === null) return buildSampleTransactions()
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) throw new Error('Stored transactions are not a list')
    const seen = new Set()
    const clean = []
    parsed.forEach((item) => {
      const tx = sanitizeTransaction(item)
      if (tx && !seen.has(tx.id)) {
        seen.add(tx.id)
        clean.push(tx)
      }
    })
    return clean
  } catch {
    try {
      window.localStorage.setItem(`${STORAGE_KEYS.transactions}.backup`, raw)
    } catch {
      // Storage is unavailable; nothing more we can do.
    }
    return buildSampleTransactions()
  }
}

function sanitizeBudgetAmount(value) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 && n <= MAX_AMOUNT ? round2(n) : null
}

function loadBudgets() {
  let raw = null
  try {
    raw = window.localStorage.getItem(STORAGE_KEYS.budgets)
  } catch {
    return cloneDefaultBudgets()
  }
  if (raw === null) return cloneDefaultBudgets()
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') throw new Error('Stored budgets are invalid')
    const categories = {}
    EXPENSE_CATEGORIES.forEach((category) => {
      const value = sanitizeBudgetAmount(parsed.categories ? parsed.categories[category] : null)
      if (value !== null) categories[category] = value
    })
    return { total: sanitizeBudgetAmount(parsed.total), categories }
  } catch {
    return { total: null, categories: {} }
  }
}

/* ---------- 4. Small UI pieces ---------- */

function Icon({ name, size = 20 }) {
  return (
    <svg
      className="sw-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={ICON_PATHS[name]} />
    </svg>
  )
}

function PageHeader({ title, subtitle, children }) {
  return (
    <header className="sw-page-header">
      <div className="sw-page-title">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children && <div className="sw-page-actions">{children}</div>}
    </header>
  )
}

function MonthPicker({ id, value, months, onChange }) {
  return (
    <div className="sw-month-picker">
      <label htmlFor={id}>Month</label>
      <select id={id} className="sw-select" value={value} onChange={(e) => onChange(e.target.value)}>
        {months.map((key) => (
          <option key={key} value={key}>
            {formatMonth(key)}
          </option>
        ))}
      </select>
    </div>
  )
}

function StatCard({ label, value, hint, icon, tone }) {
  return (
    <article className="sw-card sw-stat">
      <div className="sw-stat-top">
        <h3 className="sw-stat-label">{label}</h3>
        <span className={`sw-stat-icon is-${tone}`}>
          <Icon name={icon} size={18} />
        </span>
      </div>
      <p className={`sw-stat-value is-${tone}`}>{value}</p>
      <p className="sw-stat-hint">{hint}</p>
    </article>
  )
}

function AmountText({ tx }) {
  const isIncome = tx.type === 'income'
  return (
    <span className={`sw-amount ${isIncome ? 'is-positive' : 'is-negative'}`}>
      {isIncome ? '+' : '−'}
      {formatINR(tx.amount)}
    </span>
  )
}

function EmptyState({ title, text, actionLabel, onAction }) {
  return (
    <div className="sw-empty">
      <span className="sw-empty-icon">
        <Icon name="info" size={22} />
      </span>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {actionLabel && (
        <button type="button" className="sw-btn sw-btn-secondary" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  )
}

function ProgressBar({ pct, tone, label }) {
  const width = Math.max(0, Math.min(pct, 100))
  return (
    <div
      className="sw-progress"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={width}
    >
      <div className={`sw-progress-fill is-${tone}`} style={{ width: `${width}%` }} />
    </div>
  )
}

function Field({ name, label, optional, error, hint, children }) {
  return (
    <div className="sw-field">
      <label htmlFor={`sw-field-${name}`}>
        {label}
        {optional && <span className="sw-optional"> (optional)</span>}
      </label>
      {children}
      {hint && !error && <p className="sw-field-hint">{hint}</p>}
      {error && (
        <p className="sw-field-error" id={`sw-error-${name}`}>
          {error}
        </p>
      )}
    </div>
  )
}

function TransactionItem({ tx }) {
  return (
    <li className="sw-tx-item">
      <span className={`sw-tx-icon is-${tx.type}`}>
        <Icon name={tx.type === 'income' ? 'arrowUp' : 'arrowDown'} size={16} />
      </span>
      <span className="sw-tx-main">
        <span className="sw-tx-title">
          {tx.title}
          {tx.sample && <span className="sw-badge">Sample</span>}
        </span>
        <span className="sw-tx-meta">
          {tx.category} · {formatDate(tx.date)}
        </span>
      </span>
      <AmountText tx={tx} />
    </li>
  )
}

function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel }) {
  const cancelRef = useRef(null)
  const dialogRef = useRef(null)

  useEffect(() => {
    const previous = document.activeElement
    if (cancelRef.current) cancelRef.current.focus()
    const onKey = (event) => {
      if (event.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      if (previous && typeof previous.focus === 'function') previous.focus()
    }
  }, [onCancel])

  // Keep Tab focus inside the dialog.
  const handleKeyDown = (event) => {
    if (event.key !== 'Tab' || !dialogRef.current) return
    const buttons = dialogRef.current.querySelectorAll('button')
    if (buttons.length === 0) return
    const first = buttons[0]
    const last = buttons[buttons.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div
      className="sw-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <div
        className="sw-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="sw-modal-title"
        aria-describedby="sw-modal-text"
        ref={dialogRef}
        onKeyDown={handleKeyDown}
      >
        <h2 id="sw-modal-title">{title}</h2>
        <p id="sw-modal-text">{message}</p>
        <div className="sw-modal-actions">
          <button type="button" className="sw-btn sw-btn-secondary" ref={cancelRef} onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="sw-btn sw-btn-danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ---------- 5. Charts (CSS + inline SVG only) ---------- */

function MonthlyBars({ trend, selected }) {
  const max = Math.max(...trend.map((m) => Math.max(m.income, m.expense)), 0)
  if (max === 0) {
    return (
      <EmptyState
        title="No activity yet"
        text="Add a few transactions and your monthly income versus expenses will appear here."
      />
    )
  }
  const heightFor = (value) => (value > 0 ? Math.max((value / max) * 100, 2) : 0)
  return (
    <div>
      <div className="sw-bars">
        {trend.map((m) => (
          <div
            key={m.key}
            className={`sw-bars-group${m.key === selected ? ' is-selected' : ''}`}
            role="group"
            aria-label={`${formatMonth(m.key)}: income ${formatINR(m.income)}, expenses ${formatINR(m.expense)}`}
          >
            <div className="sw-bars-pair">
              <span
                className="sw-bar is-income"
                style={{ height: `${heightFor(m.income)}%` }}
                title={`Income ${formatINR(m.income)}`}
              />
              <span
                className="sw-bar is-expense"
                style={{ height: `${heightFor(m.expense)}%` }}
                title={`Expenses ${formatINR(m.expense)}`}
              />
            </div>
            <span className="sw-bars-label">{formatShortMonth(m.key)}</span>
          </div>
        ))}
      </div>
      <ul className="sw-legend-inline" aria-hidden="true">
        <li>
          <span className="sw-dot is-income" /> Income
        </li>
        <li>
          <span className="sw-dot is-expense" /> Expenses
        </li>
      </ul>
    </div>
  )
}

function CategoryBreakdown({ categories, total }) {
  if (categories.length === 0 || total <= 0) {
    return (
      <EmptyState
        title="No expenses this month"
        text="Expenses you add for the selected month will be broken down by category here."
      />
    )
  }
  const radius = 46
  const circumference = 2 * Math.PI * radius
  const segments = []
  let running = 0
  categories.forEach((item) => {
    const length = (item.amount / total) * circumference
    segments.push({ ...item, length, offset: running })
    running += length
  })
  return (
    <div className="sw-breakdown">
      <svg className="sw-donut" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
        <circle cx="60" cy="60" r={radius} className="sw-donut-track" fill="none" strokeWidth="14" />
        {segments.map((segment) => (
          <circle
            key={segment.category}
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke={CATEGORY_COLORS[segment.category] || '#64748b'}
            strokeWidth="14"
            strokeDasharray={`${segment.length} ${circumference - segment.length}`}
            strokeDashoffset={-segment.offset}
            transform="rotate(-90 60 60)"
          />
        ))}
        <text x="60" y="58" textAnchor="middle" className="sw-donut-value">
          {formatCompact(total)}
        </text>
        <text x="60" y="73" textAnchor="middle" className="sw-donut-label">
          spent
        </text>
      </svg>
      <ul className="sw-legend">
        {categories.map((item) => (
          <li key={item.category}>
            <span className="sw-dot" style={{ background: CATEGORY_COLORS[item.category] || '#64748b' }} />
            <span className="sw-legend-name">{item.category}</span>
            <span className="sw-legend-value">{formatINR(item.amount)}</span>
            <span className="sw-legend-pct">{Math.round((item.amount / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function TrendLine({ trend, selected }) {
  const width = 640
  const height = 260
  const left = 56
  const right = 16
  const top = 16
  const bottom = 36
  const plotW = width - left - right
  const plotH = height - top - bottom
  const rawMax = Math.max(...trend.map((m) => Math.max(m.income, m.expense)), 0)
  const max = niceCeil(rawMax)
  const x = (i) => left + (plotW * i) / (trend.length - 1)
  const y = (value) => top + plotH - (value / max) * plotH
  const pointsFor = (key) => trend.map((m, i) => `${x(i)},${y(m[key])}`).join(' ')
  const summary = trend
    .map((m) => `${formatShortMonth(m.key)}: income ${formatINR(m.income)}, expenses ${formatINR(m.expense)}`)
    .join('; ')

  return (
    <div>
      <svg className="sw-trend" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Six month trend. ${summary}`}>
        {[0, 1, 2, 3, 4].map((i) => {
          const value = (max * i) / 4
          return (
            <g key={i}>
              <line x1={left} x2={width - right} y1={y(value)} y2={y(value)} className="sw-grid-line" />
              <text x={left - 8} y={y(value) + 4} textAnchor="end" className="sw-axis-text">
                {formatCompact(value)}
              </text>
            </g>
          )
        })}
        <polyline points={pointsFor('income')} fill="none" className="sw-line is-income" />
        <polyline points={pointsFor('expense')} fill="none" className="sw-line is-expense" />
        {trend.map((m, i) => (
          <g key={m.key}>
            <circle cx={x(i)} cy={y(m.income)} r={m.key === selected ? 6 : 4} className="sw-point is-income">
              <title>{`${formatMonth(m.key)} income ${formatINR(m.income)}`}</title>
            </circle>
            <circle cx={x(i)} cy={y(m.expense)} r={m.key === selected ? 6 : 4} className="sw-point is-expense">
              <title>{`${formatMonth(m.key)} expenses ${formatINR(m.expense)}`}</title>
            </circle>
            <text
              x={x(i)}
              y={height - 12}
              textAnchor="middle"
              className={`sw-axis-text${m.key === selected ? ' is-selected' : ''}`}
            >
              {formatShortMonth(m.key)}
            </text>
          </g>
        ))}
      </svg>
      <ul className="sw-legend-inline" aria-hidden="true">
        <li>
          <span className="sw-dot is-income" /> Income
        </li>
        <li>
          <span className="sw-dot is-expense" /> Expenses
        </li>
      </ul>
    </div>
  )
}

/* ---------- 6. Transaction form (used for both Add and Edit) ---------- */

function getInitialValues(initial) {
  if (initial) {
    return {
      title: initial.title,
      amount: String(initial.amount),
      type: initial.type,
      category: initial.category,
      date: initial.date,
      notes: initial.notes || '',
    }
  }
  return { title: '', amount: '', type: 'expense', category: '', date: todayISO(), notes: '' }
}

function TransactionForm({ initial, mode, onSave, onCancel }) {
  const [values, setValues] = useState(() => getInitialValues(initial))
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const lockRef = useRef(false)
  const timerRef = useRef(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const clearError = (field) => {
    setErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  const handleChange = (field) => (event) => {
    const value = event.target.value
    setValues((current) => ({ ...current, [field]: value }))
    clearError(field)
  }

  const handleTypeChange = (event) => {
    const type = event.target.value
    setValues((current) => ({
      ...current,
      type,
      category: categoriesFor(type).includes(current.category) ? current.category : '',
    }))
    clearError('category')
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (lockRef.current) return // blocks accidental double submission

    const found = validateTransaction(values)
    if (Object.keys(found).length > 0) {
      setErrors(found)
      const firstField = Object.keys(found)[0]
      const element = document.getElementById(`sw-field-${firstField}`)
      if (element) element.focus()
      return
    }

    lockRef.current = true
    setSaving(true)
    onSave({
      title: values.title.trim(),
      amount: round2(Number(values.amount.trim())),
      type: values.type,
      category: values.category,
      date: values.date,
      notes: values.notes.trim(),
    })
    if (mode === 'add') {
      setValues(getInitialValues(null))
      setErrors({})
    }
    timerRef.current = setTimeout(() => {
      lockRef.current = false
      setSaving(false)
    }, 600)
  }

  const categoryOptions = categoriesFor(values.type)

  return (
    <form className="sw-form" onSubmit={handleSubmit} noValidate>
      <div className="sw-form-grid">
        <div className="sw-form-full">
          <Field name="title" label="Transaction title" error={errors.title}>
            <input
              {...controlProps('title', errors.title)}
              className="sw-input"
              type="text"
              value={values.title}
              onChange={handleChange('title')}
              placeholder="e.g. Canteen lunch"
              maxLength={80}
              autoComplete="off"
            />
          </Field>
        </div>

        <fieldset className="sw-segment sw-form-full">
          <legend>Type</legend>
          <label className="sw-segment-option">
            <input
              type="radio"
              name="sw-type"
              value="expense"
              checked={values.type === 'expense'}
              onChange={handleTypeChange}
            />
            <span className="sw-segment-label is-expense">
              <Icon name="arrowDown" size={16} /> Expense
            </span>
          </label>
          <label className="sw-segment-option">
            <input
              type="radio"
              name="sw-type"
              value="income"
              checked={values.type === 'income'}
              onChange={handleTypeChange}
            />
            <span className="sw-segment-label is-income">
              <Icon name="arrowUp" size={16} /> Income
            </span>
          </label>
        </fieldset>

        <Field name="amount" label="Amount (INR)" error={errors.amount}>
          <div className="sw-input-prefix">
            <span aria-hidden="true">₹</span>
            <input
              {...controlProps('amount', errors.amount)}
              className="sw-input"
              type="text"
              inputMode="decimal"
              value={values.amount}
              onChange={handleChange('amount')}
              placeholder="0.00"
              autoComplete="off"
            />
          </div>
        </Field>

        <Field name="category" label="Category" error={errors.category}>
          <select
            {...controlProps('category', errors.category)}
            className="sw-select"
            value={values.category}
            onChange={handleChange('category')}
          >
            <option value="">Select a category</option>
            {categoryOptions.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </Field>

        <Field name="date" label="Date" error={errors.date}>
          <input
            {...controlProps('date', errors.date)}
            className="sw-input"
            type="date"
            value={values.date}
            onChange={handleChange('date')}
            min="2000-01-01"
            max="2100-12-31"
          />
        </Field>

        <div className="sw-form-full">
          <Field
            name="notes"
            label="Notes"
            optional
            error={errors.notes}
            hint={`${values.notes.length}/200 characters`}
          >
            <textarea
              {...controlProps('notes', errors.notes)}
              className="sw-input sw-textarea"
              rows={3}
              value={values.notes}
              onChange={handleChange('notes')}
              placeholder="Anything worth remembering?"
            />
          </Field>
        </div>
      </div>

      <div className="sw-form-actions">
        <button type="submit" className="sw-btn sw-btn-primary" disabled={saving}>
          <Icon name="check" size={18} />
          {saving ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Save transaction'}
        </button>
        <button type="button" className="sw-btn sw-btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}

/* ---------- 7. Views ---------- */

function DashboardView({
  transactions,
  totals,
  month,
  months,
  onMonthChange,
  monthStats,
  trend,
  budgets,
  hasSample,
  onNavigate,
}) {
  const recent = useMemo(
    () => [...transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6),
    [transactions],
  )
  const monthLabel = formatMonth(month)
  const totalStatus = budgets.total ? budgetStatus(monthStats.expense, budgets.total) : null
  const overCategories = EXPENSE_CATEGORIES.filter(
    (category) => budgets.categories[category] && (monthStats.byCategory[category] || 0) > budgets.categories[category],
  )

  return (
    <>
      <PageHeader title="Dashboard" subtitle={`Your money at a glance · ${monthLabel}`}>
        <MonthPicker id="sw-month-dashboard" value={month} months={months} onChange={onMonthChange} />
        <button type="button" className="sw-btn sw-btn-primary" onClick={() => onNavigate('add')}>
          <Icon name="plus" size={18} /> Quick add
        </button>
      </PageHeader>

      {hasSample && (
        <div className="sw-note" role="note">
          <Icon name="info" size={18} />
          <p>
            <strong>Illustrative sample data.</strong> The transactions and budgets marked “Sample” are examples so you
            can explore. Edit or delete them any time, or use “Reset demo data” in the sidebar.
          </p>
        </div>
      )}

      <section className="sw-stat-grid" aria-label="Summary figures">
        <StatCard
          label="Total Balance"
          value={formatINR(totals.balance)}
          hint="All time · income minus expenses"
          icon="wallet"
          tone={totals.balance < 0 ? 'negative' : 'neutral'}
        />
        <StatCard
          label="Total Income"
          value={formatINR(totals.income)}
          hint="All time"
          icon="arrowUp"
          tone="positive"
        />
        <StatCard
          label="Total Expenses"
          value={formatINR(totals.expense)}
          hint="All time"
          icon="arrowDown"
          tone="negative"
        />
        <StatCard
          label="Monthly Savings"
          value={formatINR(monthStats.savings)}
          hint={`${monthLabel} · ${formatINR(monthStats.income)} in, ${formatINR(monthStats.expense)} out`}
          icon="trend"
          tone={monthStats.savings < 0 ? 'negative' : 'positive'}
        />
      </section>

      <div className="sw-grid sw-grid-2-1">
        <section className="sw-card" aria-labelledby="sw-h-bars">
          <div className="sw-card-head">
            <div>
              <h2 id="sw-h-bars">Income vs expenses</h2>
              <p className="sw-card-sub">Six months ending {monthLabel}</p>
            </div>
          </div>
          <MonthlyBars trend={trend} selected={month} />
        </section>

        <section className="sw-card" aria-labelledby="sw-h-budget">
          <div className="sw-card-head">
            <div>
              <h2 id="sw-h-budget">Monthly budget</h2>
              <p className="sw-card-sub">{monthLabel}</p>
            </div>
            <button type="button" className="sw-link-btn" onClick={() => onNavigate('budget')}>
              Manage
            </button>
          </div>
          {totalStatus ? (
            <div className="sw-budget-mini">
              <p className="sw-budget-figures">
                <strong>{formatINR(monthStats.expense)}</strong> of {formatINR(budgets.total)}
              </p>
              <ProgressBar pct={totalStatus.pct} tone={totalStatus.tone} label="Total monthly budget used" />
              <p className={`sw-budget-line is-${totalStatus.tone}`}>
                {totalStatus.tone === 'over' ? (
                  <>
                    <Icon name="alert" size={16} /> Over budget by {formatINR(Math.abs(totalStatus.remaining))}
                  </>
                ) : (
                  <>
                    {formatINR(totalStatus.remaining)} left · {totalStatus.pct}% used
                  </>
                )}
              </p>
              {overCategories.length > 0 && (
                <p className="sw-budget-line is-over">
                  <Icon name="alert" size={16} /> Over limit: {overCategories.join(', ')}
                </p>
              )}
            </div>
          ) : (
            <EmptyState
              title="No monthly budget yet"
              text="Set a spending limit to see how much of it you have used."
              actionLabel="Set a budget"
              onAction={() => onNavigate('budget')}
            />
          )}
        </section>
      </div>

      <div className="sw-grid sw-grid-1-1">
        <section className="sw-card" aria-labelledby="sw-h-cat">
          <div className="sw-card-head">
            <div>
              <h2 id="sw-h-cat">Expense breakdown</h2>
              <p className="sw-card-sub">{monthLabel}</p>
            </div>
          </div>
          <CategoryBreakdown categories={monthStats.categories} total={monthStats.expense} />
        </section>

        <section className="sw-card" aria-labelledby="sw-h-recent">
          <div className="sw-card-head">
            <div>
              <h2 id="sw-h-recent">Recent transactions</h2>
              <p className="sw-card-sub">Latest across all months</p>
            </div>
            <button type="button" className="sw-link-btn" onClick={() => onNavigate('history')}>
              View all
            </button>
          </div>
          {recent.length === 0 ? (
            <EmptyState
              title="No transactions yet"
              text="Add your first income or expense to get started."
              actionLabel="Add transaction"
              onAction={() => onNavigate('add')}
            />
          ) : (
            <ul className="sw-tx-list">
              {recent.map((tx) => (
                <TransactionItem key={tx.id} tx={tx} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  )
}

function AddView({ editingTx, onSave, onCancel }) {
  return (
    <>
      <PageHeader
        title={editingTx ? 'Edit transaction' : 'Add transaction'}
        subtitle={
          editingTx
            ? 'Update the details below. Nothing changes until you save.'
            : 'Record income or an expense. Your dashboard updates instantly.'
        }
      />
      <section className="sw-card sw-form-card">
        <TransactionForm
          key={editingTx ? editingTx.id : 'new'}
          initial={editingTx}
          mode={editingTx ? 'edit' : 'add'}
          onSave={onSave}
          onCancel={onCancel}
        />
      </section>
    </>
  )
}

function HistoryView({ transactions, onEdit, onDelete, onNavigate }) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [sort, setSort] = useState('newest')

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase()
    const filtered = transactions.filter((tx) => {
      if (query && !tx.title.toLowerCase().includes(query)) return false
      if (typeFilter !== 'all' && tx.type !== typeFilter) return false
      if (categoryFilter !== 'all' && tx.category !== categoryFilter) return false
      return true
    })
    // filter() returned a new array, so sorting it never touches the original state.
    return filtered.sort((a, b) =>
      sort === 'newest' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date),
    )
  }, [transactions, search, typeFilter, categoryFilter, sort])

  const hasFilters = search.trim() !== '' || typeFilter !== 'all' || categoryFilter !== 'all'

  const clearFilters = () => {
    setSearch('')
    setTypeFilter('all')
    setCategoryFilter('all')
  }

  const handleTypeFilter = (value) => {
    setTypeFilter(value)
    setCategoryFilter('all')
  }

  return (
    <>
      <PageHeader
        title="Transaction history"
        subtitle={`Showing ${rows.length} of ${transactions.length} transaction${transactions.length === 1 ? '' : 's'}`}
      >
        <button type="button" className="sw-btn sw-btn-primary" onClick={() => onNavigate('add')}>
          <Icon name="plus" size={18} /> Add transaction
        </button>
      </PageHeader>

      <section className="sw-card sw-filters" aria-label="Search and filter">
        <div className="sw-field sw-filter-search">
          <label htmlFor="sw-history-search">Search by title</label>
          <div className="sw-input-icon">
            <Icon name="search" size={18} />
            <input
              id="sw-history-search"
              className="sw-input"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search transactions"
              autoComplete="off"
            />
          </div>
        </div>
        <div className="sw-field">
          <label htmlFor="sw-history-type">Type</label>
          <select
            id="sw-history-type"
            className="sw-select"
            value={typeFilter}
            onChange={(e) => handleTypeFilter(e.target.value)}
          >
            <option value="all">All types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
        </div>
        <div className="sw-field">
          <label htmlFor="sw-history-category">Category</label>
          <select
            id="sw-history-category"
            className="sw-select"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all">All categories</option>
            {typeFilter === 'all' ? (
              <>
                <optgroup label="Income">
                  {INCOME_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Expense">
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </optgroup>
              </>
            ) : (
              categoriesFor(typeFilter).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))
            )}
          </select>
        </div>
        <div className="sw-field">
          <label htmlFor="sw-history-sort">Sort by date</label>
          <select id="sw-history-sort" className="sw-select" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>
      </section>

      <section className="sw-card sw-table-card" aria-label="Transactions">
        {transactions.length === 0 ? (
          <EmptyState
            title="No transactions yet"
            text="Your history will show up here once you add a transaction."
            actionLabel="Add transaction"
            onAction={() => onNavigate('add')}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No transactions match"
            text="Try a different search term or clear your filters."
            actionLabel={hasFilters ? 'Clear filters' : undefined}
            onAction={clearFilters}
          />
        ) : (
          <table className="sw-table">
            <thead>
              <tr>
                <th scope="col">Title</th>
                <th scope="col">Category</th>
                <th scope="col">Date</th>
                <th scope="col">Type</th>
                <th scope="col" className="sw-num">
                  Amount
                </th>
                <th scope="col">
                  <span className="sw-visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((tx) => (
                <tr key={tx.id}>
                  <td data-label="Title" className="sw-cell-title">
                    <span className="sw-tx-title">
                      {tx.title}
                      {tx.sample && <span className="sw-badge">Sample</span>}
                    </span>
                    {tx.notes && <span className="sw-tx-meta">{tx.notes}</span>}
                  </td>
                  <td data-label="Category">{tx.category}</td>
                  <td data-label="Date">{formatDate(tx.date)}</td>
                  <td data-label="Type">
                    <span className={`sw-pill is-${tx.type}`}>{tx.type === 'income' ? 'Income' : 'Expense'}</span>
                  </td>
                  <td data-label="Amount" className="sw-num">
                    <AmountText tx={tx} />
                  </td>
                  <td className="sw-cell-actions">
                    <button
                      type="button"
                      className="sw-icon-btn"
                      onClick={() => onEdit(tx.id)}
                      aria-label={`Edit ${tx.title}`}
                      title="Edit"
                    >
                      <Icon name="edit" size={18} />
                    </button>
                    <button
                      type="button"
                      className="sw-icon-btn is-danger"
                      onClick={() => onDelete(tx)}
                      aria-label={`Delete ${tx.title}`}
                      title="Delete"
                    >
                      <Icon name="trash" size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  )
}

function AnalyticsView({ month, months, onMonthChange, monthStats, trend }) {
  const monthLabel = formatMonth(month)
  const compareMax = Math.max(monthStats.income, monthStats.expense)
  const monthsWithData = trend.filter((m) => m.count > 0).length
  const savingsRate = monthStats.income > 0 ? Math.round((monthStats.savings / monthStats.income) * 100) : null
  const topCategory = monthStats.categories[0]

  return (
    <>
      <PageHeader title="Analytics" subtitle={`Insights for ${monthLabel}`}>
        <MonthPicker id="sw-month-analytics" value={month} months={months} onChange={onMonthChange} />
      </PageHeader>

      <section className="sw-stat-grid sw-stat-grid-3" aria-label="Monthly totals">
        <StatCard
          label="Total income"
          value={formatINR(monthStats.income)}
          hint={monthLabel}
          icon="arrowUp"
          tone="positive"
        />
        <StatCard
          label="Total expenses"
          value={formatINR(monthStats.expense)}
          hint={monthLabel}
          icon="arrowDown"
          tone="negative"
        />
        <StatCard
          label="Net savings"
          value={formatINR(monthStats.savings)}
          hint={savingsRate === null ? `${monthLabel} · no income recorded` : `${monthLabel} · ${savingsRate}% of income`}
          icon="trend"
          tone={monthStats.savings < 0 ? 'negative' : 'positive'}
        />
      </section>

      <div className="sw-grid sw-grid-1-1">
        <section className="sw-card" aria-labelledby="sw-h-compare">
          <div className="sw-card-head">
            <div>
              <h2 id="sw-h-compare">Income vs expenses</h2>
              <p className="sw-card-sub">{monthLabel}</p>
            </div>
          </div>
          {compareMax === 0 ? (
            <EmptyState
              title={`No transactions in ${monthLabel}`}
              text="Choose another month or add a transaction dated in this month."
            />
          ) : (
            <div className="sw-compare">
              <div className="sw-compare-row">
                <div className="sw-compare-head">
                  <span>Income</span>
                  <strong className="is-positive">{formatINR(monthStats.income)}</strong>
                </div>
                <div className="sw-compare-track">
                  <div
                    className="sw-compare-fill is-income"
                    style={{ width: `${(monthStats.income / compareMax) * 100}%` }}
                  />
                </div>
              </div>
              <div className="sw-compare-row">
                <div className="sw-compare-head">
                  <span>Expenses</span>
                  <strong className="is-negative">{formatINR(monthStats.expense)}</strong>
                </div>
                <div className="sw-compare-track">
                  <div
                    className="sw-compare-fill is-expense"
                    style={{ width: `${(monthStats.expense / compareMax) * 100}%` }}
                  />
                </div>
              </div>
              <p className="sw-insight">
                {monthStats.savings >= 0
                  ? `You kept ${formatINR(monthStats.savings)} this month.`
                  : `You spent ${formatINR(Math.abs(monthStats.savings))} more than you earned this month.`}
              </p>
            </div>
          )}
        </section>

        <section className="sw-card" aria-labelledby="sw-h-dist">
          <div className="sw-card-head">
            <div>
              <h2 id="sw-h-dist">Expense distribution</h2>
              <p className="sw-card-sub">
                {topCategory ? `Top category: ${topCategory.category}` : monthLabel}
              </p>
            </div>
          </div>
          <CategoryBreakdown categories={monthStats.categories} total={monthStats.expense} />
        </section>
      </div>

      <section className="sw-card" aria-labelledby="sw-h-trend">
        <div className="sw-card-head">
          <div>
            <h2 id="sw-h-trend">Monthly trend</h2>
            <p className="sw-card-sub">Six months ending {monthLabel}</p>
          </div>
        </div>
        {monthsWithData < 2 ? (
          <EmptyState
            title="Not enough data for a trend"
            text="Transactions in at least two of these six months are needed to draw a trend."
          />
        ) : (
          <TrendLine trend={trend} selected={month} />
        )}
      </section>
    </>
  )
}

function BudgetView({ month, months, onMonthChange, monthStats, budgets, onSaveBudgets, storageOk }) {
  const monthLabel = formatMonth(month)
  const [draft, setDraft] = useState(() => {
    const categories = {}
    EXPENSE_CATEGORIES.forEach((category) => {
      categories[category] = budgets.categories[category] ? String(budgets.categories[category]) : ''
    })
    return { total: budgets.total ? String(budgets.total) : '', categories }
  })
  const [errors, setErrors] = useState({})

  const totalStatus = budgets.total ? budgetStatus(monthStats.expense, budgets.total) : null

  const categoryRows = EXPENSE_CATEGORIES.map((category) => {
    const spent = monthStats.byCategory[category] || 0
    const limit = budgets.categories[category] || null
    return { category, spent, limit, status: limit ? budgetStatus(spent, limit) : null }
  }).filter((row) => row.limit || row.spent > 0)

  const draftCategorySum = EXPENSE_CATEGORIES.reduce((sum, category) => {
    const text = (draft.categories[category] || '').trim()
    return AMOUNT_PATTERN.test(text) ? sum + Number(text) : sum
  }, 0)
  const draftTotal = AMOUNT_PATTERN.test(draft.total.trim()) ? Number(draft.total.trim()) : 0

  const setTotal = (value) => {
    setDraft((current) => ({ ...current, total: value }))
    setErrors((current) => ({ ...current, total: undefined }))
  }

  const setCategory = (category, value) => {
    setDraft((current) => ({ ...current, categories: { ...current.categories, [category]: value } }))
    setErrors((current) => ({ ...current, [category]: undefined }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    const found = validateBudgetDraft(draft)
    if (Object.keys(found).length > 0) {
      setErrors(found)
      const firstKey = Object.keys(found)[0]
      const element = document.getElementById(
        firstKey === 'total' ? 'sw-field-budget-total' : `sw-field-budget-${slugify(firstKey)}`,
      )
      if (element) element.focus()
      return
    }
    setErrors({})
    const categories = {}
    EXPENSE_CATEGORIES.forEach((category) => {
      const text = (draft.categories[category] || '').trim()
      if (text !== '') categories[category] = round2(Number(text))
    })
    const totalText = draft.total.trim()
    onSaveBudgets({ total: totalText === '' ? null : round2(Number(totalText)), categories })
  }

  return (
    <>
      <PageHeader title="Monthly budget" subtitle={`Spending against your limits · ${monthLabel}`}>
        <MonthPicker id="sw-month-budget" value={month} months={months} onChange={onMonthChange} />
      </PageHeader>

      <section className="sw-card" aria-labelledby="sw-h-overview">
        <div className="sw-card-head">
          <div>
            <h2 id="sw-h-overview">Total spending</h2>
            <p className="sw-card-sub">Expenses only · income is not counted</p>
          </div>
          {totalStatus && (
            <span className={`sw-status is-${totalStatus.tone}`}>
              {totalStatus.tone === 'over' ? 'Over budget' : totalStatus.tone === 'warn' ? 'Nearly there' : 'On track'}
            </span>
          )}
        </div>
        {totalStatus ? (
          <div className="sw-budget-overview">
            {totalStatus.tone === 'over' && (
              <div className="sw-alert" role="alert">
                <Icon name="alert" size={18} />
                <p>
                  You have exceeded your {monthLabel} budget by <strong>{formatINR(Math.abs(totalStatus.remaining))}</strong>.
                </p>
              </div>
            )}
            <div className="sw-budget-numbers">
              <div>
                <span className="sw-budget-caption">Spent</span>
                <strong>{formatINR(monthStats.expense)}</strong>
              </div>
              <div>
                <span className="sw-budget-caption">Budget</span>
                <strong>{formatINR(budgets.total)}</strong>
              </div>
              <div>
                <span className="sw-budget-caption">{totalStatus.remaining < 0 ? 'Over by' : 'Remaining'}</span>
                <strong className={totalStatus.remaining < 0 ? 'is-negative' : 'is-positive'}>
                  {formatINR(Math.abs(totalStatus.remaining))}
                </strong>
              </div>
              <div>
                <span className="sw-budget-caption">Used</span>
                <strong>{totalStatus.pct}%</strong>
              </div>
            </div>
            <ProgressBar pct={totalStatus.pct} tone={totalStatus.tone} label="Total monthly budget used" />
          </div>
        ) : (
          <EmptyState
            title="No total budget set"
            text="Enter a monthly spending limit in the form below to start tracking."
          />
        )}
      </section>

      <div className="sw-grid sw-grid-1-1">
        <section className="sw-card" aria-labelledby="sw-h-cats">
          <div className="sw-card-head">
            <div>
              <h2 id="sw-h-cats">Category limits</h2>
              <p className="sw-card-sub">{monthLabel}</p>
            </div>
          </div>
          {categoryRows.length === 0 ? (
            <EmptyState
              title="Nothing to show"
              text="Set a category limit or add an expense in this month to see category progress."
            />
          ) : (
            <ul className="sw-cat-budgets">
              {categoryRows.map((row) => (
                <li key={row.category}>
                  <div className="sw-cat-head">
                    <span className="sw-cat-name">
                      <span className="sw-dot" style={{ background: CATEGORY_COLORS[row.category] }} />
                      {row.category}
                    </span>
                    <span className="sw-cat-figures">
                      {formatINR(row.spent)}
                      {row.limit ? ` of ${formatINR(row.limit)}` : ''}
                    </span>
                  </div>
                  {row.status ? (
                    <>
                      <ProgressBar pct={row.status.pct} tone={row.status.tone} label={`${row.category} budget used`} />
                      <p className={`sw-budget-line is-${row.status.tone}`}>
                        {row.status.tone === 'over' ? (
                          <>
                            <Icon name="alert" size={16} /> Over by {formatINR(Math.abs(row.status.remaining))} ·{' '}
                            {row.status.pct}% used
                          </>
                        ) : (
                          <>
                            {formatINR(row.status.remaining)} left · {row.status.pct}% used
                          </>
                        )}
                      </p>
                    </>
                  ) : (
                    <p className="sw-budget-line">No limit set for this category</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="sw-card" aria-labelledby="sw-h-set">
          <div className="sw-card-head">
            <div>
              <h2 id="sw-h-set">Set budgets</h2>
              <p className="sw-card-sub">Applies to every month · leave blank for no limit</p>
            </div>
          </div>
          <form className="sw-form" onSubmit={handleSubmit} noValidate>
            <Field name="budget-total" label="Total monthly budget (INR)" error={errors.total}>
              <div className="sw-input-prefix">
                <span aria-hidden="true">₹</span>
                <input
                  {...controlProps('budget-total', errors.total)}
                  className="sw-input"
                  type="text"
                  inputMode="decimal"
                  value={draft.total}
                  onChange={(e) => setTotal(e.target.value)}
                  placeholder="e.g. 12000"
                  autoComplete="off"
                />
              </div>
            </Field>
            <h3 className="sw-subhead">Category limits (optional)</h3>
            <div className="sw-form-grid">
              {EXPENSE_CATEGORIES.map((category) => {
                const name = `budget-${slugify(category)}`
                return (
                  <Field key={category} name={name} label={category} error={errors[category]}>
                    <div className="sw-input-prefix">
                      <span aria-hidden="true">₹</span>
                      <input
                        {...controlProps(name, errors[category])}
                        className="sw-input"
                        type="text"
                        inputMode="decimal"
                        value={draft.categories[category]}
                        onChange={(e) => setCategory(category, e.target.value)}
                        placeholder="No limit"
                        autoComplete="off"
                      />
                    </div>
                  </Field>
                )
              })}
            </div>
            {draftTotal > 0 && draftCategorySum > draftTotal && (
              <p className="sw-field-hint">
                Heads-up: your category limits add up to {formatINR(draftCategorySum)}, which is more than your total
                budget.
              </p>
            )}
            {!storageOk && (
              <p className="sw-field-error">Browser storage is unavailable, so budgets will not survive a refresh.</p>
            )}
            <div className="sw-form-actions">
              <button type="submit" className="sw-btn sw-btn-primary">
                <Icon name="check" size={18} /> Save budgets
              </button>
            </div>
          </form>
        </section>
      </div>
    </>
  )
}

/* ---------- 8. App: state, persistence and layout ---------- */

function App() {
  // The two sources of truth. Everything else on screen is derived from these.
  const [transactions, setTransactions] = useState(loadTransactions)
  const [budgets, setBudgets] = useState(loadBudgets)
  const [storageOk, setStorageOk] = useState(storageAvailable)

  const [view, setView] = useState('dashboard')
  const [month, setMonth] = useState(currentMonthKey)
  const [editingId, setEditingId] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [toast, setToast] = useState(null)
  const [dataVersion, setDataVersion] = useState(0)
  const toastTimerRef = useRef(null)

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!menuOpen) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [menuOpen])

  const closeDialogs = useCallback(() => {
    setPendingDelete(null)
    setConfirmReset(false)
  }, [])

  const showToast = (message, tone = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ message, tone })
    toastTimerRef.current = setTimeout(() => setToast(null), 3500)
  }

  // Update state and write to localStorage in the same step.
  const commitTransactions = (next) => {
    setTransactions(next)
    setStorageOk(saveJSON(STORAGE_KEYS.transactions, next))
  }

  const commitBudgets = (next) => {
    setBudgets(next)
    setStorageOk(saveJSON(STORAGE_KEYS.budgets, next))
  }

  /* ----- derived values (never stored separately) ----- */
  const editingTx = editingId ? transactions.find((tx) => tx.id === editingId) || null : null

  const totals = useMemo(() => {
    let income = 0
    let expense = 0
    transactions.forEach((tx) => {
      if (tx.type === 'income') income += tx.amount
      else expense += tx.amount
    })
    return { income: round2(income), expense: round2(expense), balance: round2(income - expense) }
  }, [transactions])

  const monthStats = useMemo(() => getMonthStats(transactions, month), [transactions, month])

  const trend = useMemo(() => {
    const keys = [-5, -4, -3, -2, -1, 0].map((offset) => shiftMonth(month, offset))
    return keys.map((key) => ({ key, ...getMonthStats(transactions, key) }))
  }, [transactions, month])

  const months = useMemo(() => {
    const set = new Set([currentMonthKey(), month])
    transactions.forEach((tx) => set.add(tx.date.slice(0, 7)))
    return Array.from(set).sort().reverse()
  }, [transactions, month])

  const hasSample = transactions.some((tx) => tx.sample)

  /* ----- navigation ----- */
  const navigate = (target) => {
    if (target === 'add') setEditingId(null)
    setView(target)
    setMenuOpen(false)
    window.scrollTo(0, 0)
  }

  /* ----- transaction actions ----- */
  const handleSaveTransaction = (data) => {
    if (editingTx) {
      commitTransactions(
        transactions.map((tx) => (tx.id === editingTx.id ? { ...tx, ...data, sample: false } : tx)),
      )
      setEditingId(null)
      setView('history')
      window.scrollTo(0, 0)
      showToast('Transaction updated.')
    } else {
      commitTransactions([{ id: createId(), ...data, sample: false }, ...transactions])
      const key = data.date.slice(0, 7)
      showToast(key === month ? 'Transaction added.' : `Transaction added to ${formatMonth(key)}.`)
    }
  }

  const handleCancelForm = () => {
    const wasEditing = Boolean(editingTx)
    setEditingId(null)
    setView(wasEditing ? 'history' : 'dashboard')
    window.scrollTo(0, 0)
  }

  const handleStartEdit = (id) => {
    setEditingId(id)
    setView('add')
    window.scrollTo(0, 0)
  }

  const handleConfirmDelete = () => {
    if (!pendingDelete) return
    const id = pendingDelete.id
    commitTransactions(transactions.filter((tx) => tx.id !== id))
    if (editingId === id) setEditingId(null)
    setPendingDelete(null)
    showToast('Transaction deleted.')
  }

  const handleSaveBudgets = (next) => {
    commitBudgets(next)
    showToast('Budgets saved.')
  }

  const handleConfirmReset = () => {
    const samples = buildSampleTransactions()
    const defaults = cloneDefaultBudgets()
    setTransactions(samples)
    setBudgets(defaults)
    const okTx = saveJSON(STORAGE_KEYS.transactions, samples)
    const okBudget = saveJSON(STORAGE_KEYS.budgets, defaults)
    setStorageOk(okTx && okBudget)
    setEditingId(null)
    setMonth(currentMonthKey())
    setDataVersion((version) => version + 1)
    setConfirmReset(false)
    setView('dashboard')
    window.scrollTo(0, 0)
    showToast('Demo data restored.')
  }

  /* ----- choose the active view ----- */
  let content = null
  if (view === 'dashboard') {
    content = (
      <DashboardView
        transactions={transactions}
        totals={totals}
        month={month}
        months={months}
        onMonthChange={setMonth}
        monthStats={monthStats}
        trend={trend}
        budgets={budgets}
        hasSample={hasSample}
        onNavigate={navigate}
      />
    )
  } else if (view === 'add') {
    content = <AddView editingTx={editingTx} onSave={handleSaveTransaction} onCancel={handleCancelForm} />
  } else if (view === 'history') {
    content = (
      <HistoryView
        transactions={transactions}
        onEdit={handleStartEdit}
        onDelete={setPendingDelete}
        onNavigate={navigate}
      />
    )
  } else if (view === 'analytics') {
    content = (
      <AnalyticsView
        month={month}
        months={months}
        onMonthChange={setMonth}
        monthStats={monthStats}
        trend={trend}
      />
    )
  } else {
    content = (
      <BudgetView
        month={month}
        months={months}
        onMonthChange={setMonth}
        monthStats={monthStats}
        budgets={budgets}
        onSaveBudgets={handleSaveBudgets}
        storageOk={storageOk}
      />
    )
  }

  return (
    <div className="sw-app">
      <a className="sw-skip-link" href="#sw-main">
        Skip to content
      </a>

      <div className="sw-topbar">
        <span className="sw-brand sw-brand-light">
          <span className="sw-brand-mark" aria-hidden="true">
            ₹
          </span>
          SpendWise
        </span>
        <button
          type="button"
          className="sw-icon-btn"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          aria-controls="sw-sidebar"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <Icon name={menuOpen ? 'close' : 'menu'} size={22} />
        </button>
      </div>

      {menuOpen && <div className="sw-overlay" onClick={() => setMenuOpen(false)} aria-hidden="true" />}

      <aside id="sw-sidebar" className={`sw-sidebar${menuOpen ? ' is-open' : ''}`} aria-label="Sidebar">
        <div className="sw-brand">
          <span className="sw-brand-mark" aria-hidden="true">
            ₹
          </span>
          SpendWise
        </div>
        <nav aria-label="Main navigation">
          <ul className="sw-nav">
            {NAV_ITEMS.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`sw-nav-item${view === item.id ? ' is-active' : ''}`}
                  aria-current={view === item.id ? 'page' : undefined}
                  onClick={() => navigate(item.id)}
                >
                  <Icon name={item.icon} size={20} />
                  <span>{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="sw-sidebar-footer">
          <p>Your data stays in this browser.</p>
          <button type="button" className="sw-nav-item sw-nav-item-small" onClick={() => setConfirmReset(true)}>
            <Icon name="reset" size={18} />
            <span>Reset demo data</span>
          </button>
        </div>
      </aside>

      <main id="sw-main" className="sw-main" tabIndex={-1}>
        <div className="sw-content" key={`${view}-${dataVersion}`}>
          {!storageOk && (
            <div className="sw-alert" role="alert">
              <Icon name="alert" size={18} />
              <p>
                Your browser is blocking local storage, so changes will be lost when you refresh or close this tab.
              </p>
            </div>
          )}
          {content}
        </div>
      </main>

      <div className="sw-toast-region" aria-live="polite">
        {toast && (
          <div className={`sw-toast is-${toast.tone}`}>
            <Icon name="check" size={18} />
            <span>{toast.message}</span>
          </div>
        )}
      </div>

      {pendingDelete && (
        <ConfirmDialog
          title="Delete this transaction?"
          message={`“${pendingDelete.title}” (${formatINR(pendingDelete.amount)}) will be removed permanently. This can’t be undone.`}
          confirmLabel="Delete"
          onConfirm={handleConfirmDelete}
          onCancel={closeDialogs}
        />
      )}

      {confirmReset && (
        <ConfirmDialog
          title="Reset demo data?"
          message="This replaces ALL of your transactions and budgets with the illustrative sample data. Your current entries will be lost."
          confirmLabel="Reset data"
          onConfirm={handleConfirmReset}
          onCancel={closeDialogs}
        />
      )}
    </div>
  )
}

export default App
