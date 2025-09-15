import type { RawRow, Operation, MonthKey, MonthlyAgg } from './types';

const isNumeric = (s?: string | null) => !!s && /^-?\d+(?:\.\d+)?$/.test(s.replace(/,/g, ""));
const toNum = (s?: string | null) => (isNumeric(s) ? Number(s!.replace(/,/g, "")) : undefined);

function parseUSDate(s?: string | null): Date | null {
  if (!s) return null;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  let [_, mm, dd, yy] = m;
  const year = Number(yy.length === 2 ? (Number(yy) + 2000) : yy);
  const month = Number(mm) - 1;
  const day = Number(dd);
  const d = new Date(Date.UTC(year, month, day));
  return isNaN(+d) ? null : d;
}

function monthKey(d: Date): MonthKey {
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}` as MonthKey;
}

export function extractOperations(raw: RawRow[]): Operation[] {
  const ops: Operation[] = [];
  let currentExecutive = "";
  const rowHas = (row: RawRow, needle: string) => row.some((c) => (c || "").toUpperCase().includes(needle.toUpperCase()));

  for (let i = 0; i < raw.length; i++) {
    const row = raw[i];
    const c2 = row[2]?.trim() || "";

    if (
      c2 &&
      !/^INV\d+/.test(c2) &&
      !/^\d{3,}$/.test(c2) &&
      i + 1 < raw.length &&
      rowHas(raw[i + 1], "SHIPMENT")
    ) {
      currentExecutive = c2;
      continue;
    }

    const isOp = /^INV\d+/.test(c2) || /^\d{3,}$/.test(c2);
    if (isOp && currentExecutive) {
      const date = parseUSDate(raw[i][5]);
      const client = (raw[i][17] || "").trim() || null;
      const income = toNum(raw[i][24]);
      const expense = toNum(raw[i][27]);
      const profit = toNum(raw[i][28]);
      const commission = toNum(raw[i][33]);

      ops.push({ executive: currentExecutive, date, client, invoiceRef: c2, income, expense, profit, commission });
      continue;
    }
  }
  return ops;
}

export function aggregateMonthly(ops: Operation[]): MonthlyAgg[] {
  const key = (ex: string, m: MonthKey) => `${ex}__${m}`;
  const map = new Map<string, MonthlyAgg & { clients: Set<string> }>();

  for (const op of ops) {
    if (!op.date) continue;
    const m = monthKey(op.date);
    const k = key(op.executive, m);
    if (!map.has(k)) {
      map.set(k, { month: m, executive: op.executive, income: 0, expense: 0, profit: 0, profitPct: null, ops: 0, activeClients: 0, quotes: 0, winrate: null, clients: new Set<string>() });
    }
    const agg = map.get(k)!;

    const isQuote = op.income === undefined && op.expense === undefined && op.profit === undefined;
    if (isQuote) {
      agg.quotes += 1;
    } else {
      agg.ops += 1;
      agg.income += op.income || 0;
      agg.expense += op.expense || 0;
      agg.profit += op.profit || 0;
      if (op.client) agg.clients.add(op.client);
    }
  }

  const out: MonthlyAgg[] = [];
  for (const agg of map.values()) {
    const denom = agg.income !== 0 ? agg.income : 0;
    agg.profitPct = denom ? (agg.profit / denom) * 100 : null;
    agg.activeClients = agg.clients.size;
    const attempts = agg.ops + agg.quotes;
    agg.winrate = attempts ? (agg.ops / attempts) * 100 : null;
    out.push(agg);
  }
  out.sort((a, b) => (a.executive === b.executive ? a.month.localeCompare(b.month) : a.executive.localeCompare(b.executive)));
  return out;
}