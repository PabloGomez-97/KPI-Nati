export type RawRow = string[];

export type Operation = {
  executive: string;
  date: Date | null;
  client?: string | null;
  invoiceRef?: string | null;
  income?: number;
  expense?: number;
  profit?: number;
  commission?: number;
};

export type MonthKey = `${number}-${number}`;

export type MonthlyAgg = {
  month: MonthKey;
  executive: string;
  income: number;
  expense: number;
  profit: number;
  profitPct: number | null;
  ops: number;
  activeClients: number;
  quotes: number;
  winrate: number | null;
  clients?: Set<string>;
};

export type ExecutiveTrend = {
  currentMonth: MonthlyAgg | null;
  previousMonth: MonthlyAgg | null;
  profitChange: number | null;
  profitPctChange: number | null;
  opsChange: number | null;
  trend: 'up' | 'down' | 'stable' | 'new';
};

export type ExecutiveSummary = {
  ops: number;
  income: number;
  expense: number;
  profit: number;
  commission: number;
  clients: Set<string>;
};

export type TopPerformer = {
  executive: string;
  profit: number;
  profitMargin: number;
  income: number;
  ops: number;
};

export type GlobalKPIs = {
  totalIncome: number;
  totalProfit: number;
  totalOps: number;
  totalClients: number;
  avgProfitMargin: number;
  avgDealSize: number;
  executiveCount: number;
};