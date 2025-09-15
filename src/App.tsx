import React, { useMemo, useState } from "react";
import Papa from "papaparse";
import "bootstrap/dist/css/bootstrap.min.css";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ComposedChart
} from "recharts";
import { TrendingUp, TrendingDown, Users, DollarSign, Target, Award, Calendar, BarChart3, Upload } from "lucide-react";

type RawRow = string[];

type Operation = {
  executive: string;
  date: Date | null;
  client?: string | null;
  invoiceRef?: string | null;
  income?: number;
  expense?: number;
  profit?: number;
  commission?: number;
};

type MonthKey = `${number}-${number}`;

type MonthlyAgg = {
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

function extractOperations(raw: RawRow[]): Operation[] {
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

function aggregateMonthly(ops: Operation[]): MonthlyAgg[] {
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

function formatMoney(n?: number | null) {
  if (n === undefined || n === null) return "—";
  return new Intl.NumberFormat('es-CL', { 
    style: 'currency', 
    currency: 'CLP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(n);
}

function formatPct(n?: number | null) {
  if (n === undefined || n === null) return "—";
  return `${n.toFixed(1)}%`;
}

function truncateText(text: string | null | undefined, maxLength: number = 20): string {
  if (!text || typeof text !== 'string') return 'N/A';
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

function getFirstWord(text: string | null | undefined): string {
  if (!text || typeof text !== 'string') return 'N/A';
  const words = text.trim().split(/\s+/);
  return words[0] || 'N/A';
}

const KPICard = ({ title, value, subtitle, icon: Icon, trend, bgColor = "primary" }: {
  title: string;
  value: string;
  subtitle?: string;
  icon: any;
  trend?: { value: number; isPositive: boolean };
  bgColor?: string;
}) => {
  return (
    <div className={`card h-100 border-${bgColor} shadow-sm`} style={{ borderWidth: '2px' }}>
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-start mb-3">
          <div className={`p-2 rounded bg-${bgColor} bg-opacity-10`}>
            <Icon size={32} className={`text-${bgColor}`} />
          </div>
          {trend && (
            <div className={`d-flex align-items-center small fw-bold ${trend.isPositive ? 'text-success' : 'text-danger'}`}>
              {trend.isPositive ? <TrendingUp size={16} className="me-1" /> : <TrendingDown size={16} className="me-1" />}
              {Math.abs(trend.value).toFixed(1)}%
            </div>
          )}
        </div>
        <div>
          <p className="text-muted small mb-1">{title}</p>
          <h3 className="fw-bold mb-1">{value}</h3>
          {subtitle && <p className="text-muted small mb-0">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
};

const TrendIndicator = ({ trend, profitPctChange }: { trend: string; profitPctChange: number | null }) => {
  if (trend === 'new') return <span className="badge bg-info">Nuevo</span>;
  if (trend === 'stable') return <span className="badge bg-secondary">Estable</span>;
  if (trend === 'up') return (
    <span className="badge bg-success">
      <TrendingUp size={12} className="me-1" />
      +{profitPctChange?.toFixed(1)}%
    </span>
  );
  if (trend === 'down') return (
    <span className="badge bg-danger">
      <TrendingDown size={12} className="me-1" />
      {profitPctChange?.toFixed(1)}%
    </span>
  );
  return null;
};

const COLORS = ['#0d6efd', '#198754', '#ffc107', '#dc3545', '#6f42c1', '#20c997'];

export default function App() {
  const [ops, setOps] = useState<Operation[] | null>(null);
  const [selectedExecutive, setSelectedExecutive] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [modalExecutive, setModalExecutive] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  
  // PASO 1: Datos base sin filtros
  const monthly = useMemo(() => (ops ? aggregateMonthly(ops) : []), [ops]);
  
  const totals = useMemo(() => {
    if (!ops) return null;
    const byExec: Record<string, { ops: number; income: number; expense: number; profit: number; commission: number; clients: Set<string> }> = {};
    for (const o of ops) {
      if (!byExec[o.executive]) byExec[o.executive] = { ops: 0, income: 0, expense: 0, profit: 0, commission: 0, clients: new Set() };
      byExec[o.executive].ops += 1;
      byExec[o.executive].income += o.income || 0;
      byExec[o.executive].expense += o.expense || 0;
      byExec[o.executive].profit += o.profit || 0;
      byExec[o.executive].commission += o.commission || 0;
      if (o.client) byExec[o.executive].clients.add(o.client);
    }
    return byExec;
  }, [ops]);

  // PASO 2: Opciones para dropdowns
  const availableMonths = useMemo(() => {
    if (!monthly) return [];
    return Array.from(new Set(monthly.map(m => m.month))).sort();
  }, [monthly]);

  const executiveOptions = useMemo(() => {
    if (!ops) return [];
    return Array.from(new Set(ops.map(op => op.executive).filter(exec => exec && exec.trim())));
  }, [ops]);

  // PASO 3: LÓGICA DE FILTRADO CORREGIDA
  // Para el RESUMEN EJECUTIVO: usar datos mensuales agregados filtrados
  const summaryData = useMemo(() => {
    if (!monthly) return null;

    // Filtrar los datos mensuales según los filtros seleccionados
    let filteredMonthlyData = monthly;

    if (selectedMonth !== "all") {
      filteredMonthlyData = filteredMonthlyData.filter(m => m.month === selectedMonth);
    }

    if (selectedExecutive !== "all") {
      filteredMonthlyData = filteredMonthlyData.filter(m => m.executive === selectedExecutive);
    }

    // Agrupar por ejecutivo
    const byExec: Record<string, { ops: number; income: number; expense: number; profit: number; commission: number; clients: Set<string> }> = {};
    
    for (const monthData of filteredMonthlyData) {
      if (!byExec[monthData.executive]) {
        byExec[monthData.executive] = { ops: 0, income: 0, expense: 0, profit: 0, commission: 0, clients: new Set() };
      }
      byExec[monthData.executive].ops += monthData.ops;
      byExec[monthData.executive].income += monthData.income;
      byExec[monthData.executive].expense += monthData.expense;
      byExec[monthData.executive].profit += monthData.profit;
      byExec[monthData.executive].clients = new Set([...byExec[monthData.executive].clients, ...Array.from(monthData.clients || [])]);
    }

    return byExec;
  }, [monthly, selectedMonth, selectedExecutive]);

  // PASO 4: Datos para gráficos
  const chartData = useMemo(() => {
    if (!monthly) return [];
    
    let filteredForCharts = monthly;
    
    if (selectedExecutive !== "all") {
      filteredForCharts = filteredForCharts.filter(m => m.executive === selectedExecutive);
    }
    
    if (selectedMonth !== "all") {
      filteredForCharts = filteredForCharts.filter(m => m.month === selectedMonth);
    }

    const monthMap = new Map<string, any>();
    
    filteredForCharts.forEach(m => {
      const existing = monthMap.get(m.month) || { month: m.month, income: 0, profit: 0, ops: 0, profitPct: 0 };
      existing.income += m.income;
      existing.profit += m.profit;
      existing.ops += m.ops;
      existing.profitPct = existing.income > 0 ? (existing.profit / existing.income) * 100 : 0;
      monthMap.set(m.month, existing);
    });
    
    return Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month));
  }, [monthly, selectedExecutive, selectedMonth]);

  // PASO 5: KPIs globales basados en datos filtrados
  const globalKPIs = useMemo(() => {
    if (!summaryData) return null;
    
    const totalIncome = Object.values(summaryData).reduce((sum, exec) => sum + exec.income, 0);
    const totalProfit = Object.values(summaryData).reduce((sum, exec) => sum + exec.profit, 0);
    const totalOps = Object.values(summaryData).reduce((sum, exec) => sum + exec.ops, 0);
    const allClients = new Set<string>();
    Object.values(summaryData).forEach(exec => {
      exec.clients.forEach(client => allClients.add(client));
    });
    const totalClients = allClients.size;
    const avgProfitMargin = totalIncome > 0 ? (totalProfit / totalIncome) * 100 : 0;
    const avgDealSize = totalOps > 0 ? totalIncome / totalOps : 0;
    
    return {
      totalIncome,
      totalProfit,
      totalOps,
      totalClients,
      avgProfitMargin,
      avgDealSize,
      executiveCount: Object.keys(summaryData).length
    };
  }, [summaryData]);

  // PASO 6: Top performers
  const topPerformers = useMemo(() => {
    if (!summaryData || Object.keys(summaryData).length === 0) return [];
    return Object.entries(summaryData)
      .map(([exec, data]) => ({
        executive: exec || 'Sin nombre',
        profit: data.profit || 0,
        profitMargin: data.income > 0 ? (data.profit / data.income) * 100 : 0,
        income: data.income || 0,
        ops: data.ops || 0
      }))
      .filter(performer => performer.executive && performer.executive !== 'Sin nombre')
      .sort((a, b) => b.profit - a.profit);
  }, [summaryData]);

  // PASO 7: Análisis de tendencias (solo cuando no hay filtro de mes)
  const executiveTrends = useMemo(() => {
    if (!monthly || availableMonths.length < 2 || selectedMonth !== "all") return {};
    
    const trends: Record<string, {
      currentMonth: MonthlyAgg | null;
      previousMonth: MonthlyAgg | null;
      profitChange: number | null;
      profitPctChange: number | null;
      opsChange: number | null;
      trend: 'up' | 'down' | 'stable' | 'new';
    }> = {};

    const executives = Array.from(new Set(monthly.map(m => m.executive)));
    
    executives.forEach(exec => {
      const execMonthly = monthly.filter(m => m.executive === exec).sort((a, b) => a.month.localeCompare(b.month));
      
      if (execMonthly.length >= 2) {
        const current = execMonthly[execMonthly.length - 1];
        const previous = execMonthly[execMonthly.length - 2];
        
        const profitChange = current.profit - previous.profit;
        const profitPctChange = previous.profit !== 0 ? ((current.profit - previous.profit) / Math.abs(previous.profit)) * 100 : null;
        const opsChange = current.ops - previous.ops;
        
        let trend: 'up' | 'down' | 'stable' | 'new';
        if (profitPctChange === null) trend = 'new';
        else if (Math.abs(profitPctChange) < 5) trend = 'stable';
        else if (profitPctChange > 0) trend = 'up';
        else trend = 'down';
        
        trends[exec] = {
          currentMonth: current,
          previousMonth: previous,
          profitChange,
          profitPctChange,
          opsChange,
          trend
        };
      } else if (execMonthly.length === 1) {
        trends[exec] = {
          currentMonth: execMonthly[0],
          previousMonth: null,
          profitChange: null,
          profitPctChange: null,
          opsChange: null,
          trend: 'new'
        };
      }
    });
    
    return trends;
  }, [monthly, availableMonths, selectedMonth]);

  // PASO 8: Modal operations (respetando filtros)
  const modalOperations = useMemo(() => {
    if (!ops || !modalExecutive) return [];
    
    let filtered = ops.filter(op => op.executive === modalExecutive);
    
    if (selectedMonth !== "all") {
      filtered = filtered.filter(op => {
        if (!op.date) return false;
        const opMonth = monthKey(op.date);
        return opMonth === selectedMonth;
      });
    }
    
    return filtered.sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
  }, [ops, modalExecutive, selectedMonth]);

  function handleFile(file: File) {
    Papa.parse(file, {
      complete: (res) => {
        try {
          const rows = (res.data as any[]).map((r) => 
            Array.isArray(r) ? (r as string[]).map((c) => (c == null ? "" : String(c))) : []
          );
          const parsedOps = extractOperations(rows);
          
          if (parsedOps.length === 0) {
            alert("No se encontraron operaciones válidas en el CSV. Verifica el formato del archivo.");
            return;
          }
          
          console.log(`Operaciones encontradas: ${parsedOps.length}`);
          setOps(parsedOps);
        } catch (error) {
          console.error("Error procesando CSV:", error);
          alert("Error procesando el archivo CSV. Verifica el formato.");
        }
      },
      error: (error) => {
        console.error("Error leyendo CSV:", error);
        alert("No se pudo leer el CSV. Revisa el formato.");
      },
      delimiter: ",",
      skipEmptyLines: true,
      encoding: "latin1",
    });
  }

  return (
    <div style={{ backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
      {/* Header */}
      <nav className="navbar navbar-expand-lg bg-white shadow-sm mb-4">
        <div className="container-fluid">
          <div className="d-flex align-items-center">
            <BarChart3 size={32} className="text-primary me-3" />
            <div>
              <h1 className="navbar-brand fw-bold mb-0 fs-3">Dashboard Comercial</h1>
              <small className="text-muted">Análisis de KPIs y Comisiones</small>
            </div>
          </div>
          <div className="d-flex align-items-center text-muted">
            <Calendar size={20} className="me-2" />
            <span className="small">{new Date().toLocaleDateString('es-CL')}</span>
          </div>
        </div>
      </nav>

      <div className="container-fluid px-4">
        {/* Upload Section */}
        <div className="card shadow-sm mb-4">
          <div className="card-body">
            <div className="d-flex align-items-center mb-3">
              <div className="p-2 rounded bg-primary bg-opacity-10 me-3">
                <Upload size={24} className="text-primary" />
              </div>
              <div>
                <h5 className="card-title mb-1">Cargar Datos</h5>
                <small className="text-muted">Sube tu archivo CSV para analizar los KPIs</small>
              </div>
            </div>
            
            <div className="border border-3 border-dashed rounded p-4 text-center" style={{ borderColor: '#dee2e6' }}>
              <input 
                type="file" 
                className="form-control" 
                accept=".csv" 
                onChange={(e) => { 
                  const f = e.target.files?.[0]; 
                  if (f) handleFile(f); 
                }} 
              />
              <small className="text-muted mt-2 d-block">El archivo debe mantener la estructura del reporte original</small>
            </div>
          </div>
        </div>

        {!ops && (
          <div className="alert alert-warning d-flex align-items-center" role="alert">
            <Target size={20} className="me-2" />
            <strong>Sube un archivo CSV para ver el análisis de KPIs</strong>
          </div>
        )}

        {ops && globalKPIs && (
          <>
            {/* KPIs Globales */}
            <div className="row g-4 mb-4">
              <div className="col-lg-3 col-md-6">
                <KPICard
                  title="Facturación Total"
                  value={formatMoney(globalKPIs.totalIncome)}
                  subtitle={`${globalKPIs.totalOps} operaciones`}
                  icon={DollarSign}
                  bgColor="primary"
                />
              </div>
              <div className="col-lg-3 col-md-6">
                <KPICard
                  title="Profit Total"
                  value={formatMoney(globalKPIs.totalProfit)}
                  subtitle={`Margen: ${formatPct(globalKPIs.avgProfitMargin)}`}
                  icon={TrendingUp}
                  bgColor="success"
                />
              </div>
              <div className="col-lg-3 col-md-6">
                <KPICard
                  title="Clientes Activos"
                  value={globalKPIs.totalClients.toString()}
                  subtitle={`${globalKPIs.executiveCount} ejecutivos`}
                  icon={Users}
                  bgColor="info"
                />
              </div>
              <div className="col-lg-3 col-md-6">
                <KPICard
                  title="Ticket Promedio"
                  value={formatMoney(globalKPIs.avgDealSize)}
                  subtitle="Por operación"
                  icon={Award}
                  bgColor="warning"
                />
              </div>
            </div>

            {/* Controles y Top Performers */}
            <div className="row g-4 mb-4">
              {/* Filtros */}
              <div className="col-lg-4">
                <div className="card shadow-sm h-100">
                  <div className="card-body">
                    <h5 className="card-title mb-3">Filtros</h5>
                    <div className="mb-3">
                      <label className="form-label fw-semibold">Ejecutivo</label>
                      <select
                        value={selectedExecutive}
                        onChange={(e) => setSelectedExecutive(e.target.value)}
                        className="form-select"
                      >
                        <option value="all">Todos los ejecutivos</option>
                        {executiveOptions.map(exec => (
                          <option key={exec} value={exec}>{truncateText(exec, 30)}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="mb-3">
                      <label className="form-label fw-semibold">Período</label>
                      <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="form-select"
                      >
                        <option value="all">Todos los meses</option>
                        {availableMonths.map(month => (
                          <option key={month} value={month}>{month}</option>
                        ))}
                      </select>
                    </div>
                    
                    {(selectedExecutive !== "all" || selectedMonth !== "all") && (
                      <button 
                        className="btn btn-outline-secondary btn-sm"
                        onClick={() => {
                          setSelectedExecutive("all");
                          setSelectedMonth("all");
                        }}
                      >
                        Limpiar filtros
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Top Performers */}
              <div className="col-lg-8">
                <div className="card shadow-sm h-100">
                  <div className="card-body">
                    <h5 className="card-title mb-3">Top Performers</h5>
                    {topPerformers.length > 0 ? (
                      <div className="row g-2">
                        {topPerformers.slice(0, 3).map((performer, index) => (
                          <div key={performer.executive + index} className="col-12">
                            <div className="d-flex align-items-center justify-content-between p-3 bg-light rounded">
                              <div className="d-flex align-items-center">
                                <div 
                                  className={`rounded-circle d-flex align-items-center justify-content-center text-white fw-bold me-3`}
                                  style={{ 
                                    width: '40px', 
                                    height: '40px',
                                    backgroundColor: index === 0 ? '#ffc107' : index === 1 ? '#6c757d' : '#fd7e14'
                                  }}
                                >
                                  {index + 1}
                                </div>
                                <div>
                                  <div className="fw-semibold" title={performer.executive}>
                                    {truncateText(performer.executive, 25)}
                                  </div>
                                  <small className="text-muted">{performer.ops} operaciones</small>
                                </div>
                              </div>
                              <div className="text-end">
                                <div className="fw-bold">{formatMoney(performer.profit)}</div>
                                <small className="text-muted">{formatPct(performer.profitMargin)}</small>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center text-muted py-4">
                        <p>No hay datos suficientes para mostrar el ranking</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Gráficos Principales */}
            <div className="row g-4 mb-4">
              <div className="col-lg-6">
                <div className="card shadow-sm h-100">
                  <div className="card-body">
                    <h5 className="card-title mb-3">Facturación vs Profit</h5>
                    <div style={{ height: 350 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="month" />
                          <YAxis />
                          <Tooltip 
                            formatter={(value: any, name: string) => [
                              typeof value === 'number' ? formatMoney(value) : value, 
                              name === 'income' ? 'Facturación' : name === 'profit' ? 'Profit' : name
                            ]}
                          />
                          <Legend />
                          <Bar dataKey="income" fill="#0d6efd" name="Facturación" />
                          <Bar dataKey="profit" fill="#198754" name="Profit" />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-lg-6">
                <div className="card shadow-sm h-100">
                  <div className="card-body">
                    <h5 className="card-title mb-3">Margen de Profit</h5>
                    <div style={{ height: 350 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="month" />
                          <YAxis />
                          <Tooltip formatter={(value: any) => [`${Number(value).toFixed(1)}%`, 'Margen']} />
                          <Legend />
                          <Line 
                            type="monotone" 
                            dataKey="profitPct" 
                            stroke="#ffc107" 
                            strokeWidth={3}
                            name="Margen %" 
                            dot={{ fill: '#ffc107', strokeWidth: 2, r: 6 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Distribución por Ejecutivo */}
            {selectedExecutive === "all" && topPerformers.length > 1 && (
              <div className="row g-4 mb-4">
                <div className="col-lg-6">
                  <div className="card shadow-sm h-100">
                    <div className="card-body">
                      <h5 className="card-title mb-3">Profit por Ejecutivo</h5>
                      <div style={{ height: 350 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={topPerformers.slice(0, 5)}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis 
                              dataKey="executive" 
                              angle={-45}
                              textAnchor="end"
                              height={80}
                              tickFormatter={(value) => truncateText(value, 15)}
                            />
                            <YAxis />
                            <Tooltip 
                              formatter={(value: any) => [formatMoney(value), 'Profit']}
                              labelFormatter={(label) => `Ejecutivo: ${truncateText(label, 30)}`}
                            />
                            <Bar dataKey="profit" fill="#198754" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-lg-6">
                  <div className="card shadow-sm h-100">
                    <div className="card-body">
                      <h5 className="card-title mb-3">Operaciones por Ejecutivo</h5>
                      <div style={{ height: 350 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={topPerformers.slice(0, 5)}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis 
                              dataKey="executive" 
                              angle={-45}
                              textAnchor="end"
                              height={80}
                              tickFormatter={(value) => truncateText(value, 15)}
                            />
                            <YAxis />
                            <Tooltip 
                              labelFormatter={(label) => `Ejecutivo: ${truncateText(label, 30)}`}
                            />
                            <Bar dataKey="ops" fill="#6f42c1" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Análisis de Tendencias por Ejecutivo - Solo sin filtro de mes */}
            {availableMonths.length > 1 && selectedMonth === "all" && Object.keys(executiveTrends).length > 0 && (
              <div className="card shadow-sm mb-4">
                <div className="card-header bg-light">
                  <h5 className="card-title mb-0">Análisis de Tendencias Mensuales</h5>
                  <small className="text-muted">Comparación del último mes vs mes anterior</small>
                </div>
                <div className="card-body">
                  <div className="row g-3">
                    {Object.entries(executiveTrends).map(([exec, trend]) => (
                      <div key={exec} className="col-lg-4 col-md-6">
                        <div className="card h-100 border-0 bg-light">
                          <div className="card-body p-3">
                            <div className="d-flex justify-content-between align-items-start mb-2">
                              <h6 className="card-title mb-0" title={exec}>
                                {truncateText(exec, 20)}
                              </h6>
                              <TrendIndicator trend={trend.trend} profitPctChange={trend.profitPctChange} />
                            </div>
                            
                            <div className="row g-2 small">
                              <div className="col-6">
                                <div className="text-muted">Mes Actual:</div>
                                <div className="fw-bold">{trend.currentMonth?.month}</div>
                                <div className="text-success">{formatMoney(trend.currentMonth?.profit || 0)}</div>
                              </div>
                              <div className="col-6">
                                <div className="text-muted">Mes Anterior:</div>
                                <div className="fw-bold">{trend.previousMonth?.month || 'N/A'}</div>
                                <div className="text-muted">{formatMoney(trend.previousMonth?.profit || 0)}</div>
                              </div>
                              
                              {trend.profitChange !== null && (
                                <div className="col-12 mt-2">
                                  <div className="text-muted">Cambio en Profit:</div>
                                  <div className={`fw-bold ${trend.profitChange >= 0 ? 'text-success' : 'text-danger'}`}>
                                    {trend.profitChange >= 0 ? '+' : ''}{formatMoney(trend.profitChange)}
                                  </div>
                                </div>
                              )}
                              
                              {trend.opsChange !== null && (
                                <div className="col-12">
                                  <div className="text-muted">Cambio en Operaciones:</div>
                                  <div className={`fw-bold ${trend.opsChange >= 0 ? 'text-success' : 'text-danger'}`}>
                                    {trend.opsChange >= 0 ? '+' : ''}{trend.opsChange}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* RESUMEN POR EJECUTIVO - CORREGIDO */}
            <div className="card shadow-sm mb-4">
              <div className="card-header bg-light">
                <div className="d-flex justify-content-between align-items-center">
                  <h5 className="card-title mb-0">
                    Resumen por Ejecutivo
                    {selectedMonth !== "all" && <span className="text-muted"> - {selectedMonth}</span>}
                  </h5>
                  <small className="text-muted">💡 Haz clic en un ejecutivo para ver sus operaciones</small>
                </div>
              </div>
              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table table-hover mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Ejecutivo</th>
                        <th>Operaciones</th>
                        <th>Facturación</th>
                        <th>Profit</th>
                        <th>Margen %</th>
                        <th>Clientes</th>
                        <th>Ticket Promedio</th>
                        {availableMonths.length > 1 && selectedMonth === "all" && <th>Tendencia</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(summaryData || {}).map(([exec, data]) => {
                        const profitMargin = data.income > 0 ? (data.profit / data.income) * 100 : 0;
                        const avgTicket = data.ops > 0 ? data.income / data.ops : 0;
                        const trend = executiveTrends[exec];
                        
                        return (
                          <tr 
                            key={exec} 
                            style={{ cursor: 'pointer' }} 
                            onClick={() => {
                              setModalExecutive(exec);
                              setShowModal(true);
                            }}
                          >
                            <td>
                              <div className="fw-semibold text-primary" title={exec} style={{ textDecoration: 'underline' }}>
                                {truncateText(exec, 25)}
                              </div>
                            </td>
                            <td>{data.ops.toLocaleString()}</td>
                            <td>{formatMoney(data.income)}</td>
                            <td>
                              <span className={`fw-bold ${data.profit >= 0 ? 'text-success' : 'text-danger'}`}>
                                {formatMoney(data.profit)}
                              </span>
                            </td>
                            <td>
                              <span className={`badge ${
                                profitMargin >= 20 ? 'bg-success' :
                                profitMargin >= 10 ? 'bg-warning' :
                                'bg-danger'
                              }`}>
                                {formatPct(profitMargin)}
                              </span>
                            </td>
                            <td>{data.clients.size}</td>
                            <td>{formatMoney(avgTicket)}</td>
                            {availableMonths.length > 1 && selectedMonth === "all" && (
                              <td>
                                {trend && <TrendIndicator trend={trend.trend} profitPctChange={trend.profitPctChange} />}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal para Operaciones del Ejecutivo */}
            {showModal && modalExecutive && (
              <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                <div className="modal-dialog modal-xl">
                  <div className="modal-content">
                    <div className="modal-header">
                      <h5 className="modal-title">
                        Operaciones de {truncateText(modalExecutive, 40)}
                        {selectedMonth !== "all" && <span className="text-muted"> - {selectedMonth}</span>}
                      </h5>
                      <button 
                        type="button" 
                        className="btn-close" 
                        onClick={() => setShowModal(false)}
                      ></button>
                    </div>
                    <div className="modal-body">
                      <div className="d-flex justify-content-between align-items-center mb-3">
                        <span className="text-muted">
                          {modalOperations.length} operaciones encontradas
                        </span>
                        <span className="badge bg-primary">
                          Total Profit: {formatMoney(modalOperations.reduce((sum, op) => sum + (op.profit || 0), 0))}
                        </span>
                      </div>
                      
                      <div className="table-responsive" style={{ maxHeight: '500px', overflowY: 'auto' }}>
                        <table className="table table-hover table-sm">
                          <thead className="table-light sticky-top">
                            <tr>
                              <th>Fecha</th>
                              <th>Referencia</th>
                              <th>Cliente</th>
                              <th>Facturación</th>
                              <th>Gasto</th>
                              <th>Profit</th>
                              <th>Margen</th>
                            </tr>
                          </thead>
                          <tbody>
                            {modalOperations.map((op, idx) => {
                              const margin = op.income && op.profit ? (op.profit / op.income) * 100 : null;
                              return (
                                <tr key={idx}>
                                  <td>{op.date ? op.date.toLocaleDateString('es-CL') : "—"}</td>
                                  <td><small className="text-muted">{op.invoiceRef}</small></td>
                                  <td>{truncateText(op.client, 20)}</td>
                                  <td>{formatMoney(op.income)}</td>
                                  <td>{formatMoney(op.expense)}</td>
                                  <td>
                                    <span className={`fw-bold ${(op.profit || 0) >= 0 ? 'text-success' : 'text-danger'}`}>
                                      {formatMoney(op.profit)}
                                    </span>
                                  </td>
                                  <td>
                                    {margin !== null ? (
                                      <span className={`badge ${
                                        margin >= 20 ? 'bg-success' :
                                        margin >= 10 ? 'bg-warning' :
                                        'bg-danger'
                                      }`}>
                                        {formatPct(margin)}
                                      </span>
                                    ) : "—"}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <div className="modal-footer">
                      <button 
                        type="button" 
                        className="btn btn-secondary" 
                        onClick={() => setShowModal(false)}
                      >
                        Cerrar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Análisis Detallado por Mes - Solo para ejecutivo específico */}
            {selectedExecutive !== "all" && (
              <div className="card shadow-sm mb-4">
                <div className="card-header bg-light">
                  <h5 className="card-title mb-0">Análisis Mensual - {truncateText(selectedExecutive, 30)}</h5>
                </div>
                <div className="card-body">
                  <div className="row g-4">
                    <div className="col-lg-6">
                      <h6 className="text-muted mb-3">Operaciones por Mes</h6>
                      <div style={{ height: 250 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="month" />
                            <YAxis />
                            <Tooltip />
                            <Area 
                              type="monotone" 
                              dataKey="ops" 
                              stroke="#0d6efd" 
                              fill="#0d6efd" 
                              fillOpacity={0.6}
                              name="Operaciones"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="col-lg-6">
                      <h6 className="text-muted mb-3">KPIs del Período</h6>
                      <div className="row g-2">
                        {chartData.slice(-3).map((monthData) => (
                          <div key={monthData.month} className="col-12">
                            <div className="p-3 bg-light rounded">
                              <div className="d-flex justify-content-between align-items-center mb-2">
                                <h6 className="fw-bold mb-0">{monthData.month}</h6>
                                <span className="badge bg-primary">{monthData.ops} ops</span>
                              </div>
                              <div className="row g-2 small">
                                <div className="col-6">
                                  <div className="text-muted">Facturación:</div>
                                  <div className="fw-semibold">{formatMoney(monthData.income)}</div>
                                </div>
                                <div className="col-6">
                                  <div className="text-muted">Profit:</div>
                                  <div className="fw-semibold">{formatMoney(monthData.profit)}</div>
                                </div>
                                <div className="col-6">
                                  <div className="text-muted">Margen:</div>
                                  <div className="fw-semibold">{formatPct(monthData.profitPct)}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Métricas Adicionales */}
            <div className="row g-4 mb-4">
              <div className="col-lg-4">
                <div className="card shadow-sm h-100">
                  <div className="card-body">
                    <h5 className="card-title mb-3">
                      <Target size={20} className="me-2 text-primary" />
                      Productividad
                    </h5>
                    <div className="space-y-3">
                      {Object.entries(summaryData || {}).slice(0, 3).map(([exec, data]) => {
                        const opsPerMonth = selectedMonth !== "all" ? data.ops : (data.ops / (monthly.filter(m => m.executive === exec).length || 1));
                        const profitPerOp = data.ops > 0 ? data.profit / data.ops : 0;
                        
                        return (
                          <div key={exec} className="border-bottom pb-3 mb-3">
                            <div className="fw-semibold text-truncate mb-2" title={exec}>
                              {getFirstWord(exec)}
                            </div>
                            <div className="row g-1 small text-muted">
                              <div className="col-6">
                                <div>{selectedMonth !== "all" ? "Operaciones:" : "Ops/mes:"}</div>
                                <div className="fw-bold text-dark">{selectedMonth !== "all" ? data.ops : opsPerMonth.toFixed(1)}</div>
                              </div>
                              <div className="col-6">
                                <div>Profit/op:</div>
                                <div className="fw-bold text-dark">{formatMoney(profitPerOp)}</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-lg-4">
                <div className="card shadow-sm h-100">
                  <div className="card-body">
                    <h5 className="card-title mb-3">
                      <Users size={20} className="me-2 text-success" />
                      Análisis de Clientes
                    </h5>
                    <div className="space-y-3">
                      {Object.entries(summaryData || {}).slice(0, 3).map(([exec, data]) => {
                        const revenuePerClient = data.clients.size > 0 ? data.income / data.clients.size : 0;
                        const opsPerClient = data.clients.size > 0 ? data.ops / data.clients.size : 0;
                        
                        return (
                          <div key={exec} className="border-bottom pb-3 mb-3">
                            <div className="fw-semibold text-truncate mb-2" title={exec}>
                              {getFirstWord(exec)}
                            </div>
                            <div className="row g-1 small text-muted">
                              <div className="col-6">
                                <div>Revenue/cliente:</div>
                                <div className="fw-bold text-dark">{formatMoney(revenuePerClient)}</div>
                              </div>
                              <div className="col-6">
                                <div>Ops/cliente:</div>
                                <div className="fw-bold text-dark">{opsPerClient.toFixed(1)}</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-lg-4">
                <div className="card shadow-sm h-100">
                  <div className="card-body">
                    <h5 className="card-title mb-3">
                      <Award size={20} className="me-2 text-warning" />
                      Rendimiento
                    </h5>
                    <div className="space-y-3">
                      <div className="p-3 bg-primary bg-opacity-10 rounded">
                        <div className="small text-primary fw-semibold">Mejor Margen</div>
                        <div className="h5 fw-bold text-primary mb-0">
                          {topPerformers.length > 0 ? formatPct(Math.max(...topPerformers.map(p => p.profitMargin))) : "—"}
                        </div>
                      </div>
                      <div className="p-3 bg-success bg-opacity-10 rounded">
                        <div className="small text-success fw-semibold">Top Facturación</div>
                        <div className="h5 fw-bold text-success mb-0">
                          {topPerformers.length > 0 ? formatMoney(Math.max(...topPerformers.map(p => p.income))) : "—"}
                        </div>
                      </div>
                      <div className="p-3 bg-info bg-opacity-10 rounded">
                        <div className="small text-info fw-semibold">Más Operaciones</div>
                        <div className="h5 fw-bold text-info mb-0">
                          {topPerformers.length > 0 ? Math.max(...topPerformers.map(p => p.ops)).toLocaleString() : "—"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Footer */}
        <div className="card shadow-sm">
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-center text-muted small">
              <div className="d-flex align-items-center">
                <span className="me-3">📊 Dashboard desarrollado para análisis comercial</span>
                <span className="me-1">•</span>
                <span className="ms-3">Datos procesados: {ops ? ops.length : 0} operaciones</span>
              </div>
              <div className="d-flex align-items-center">
                <span className="me-2">Última actualización:</span>
                <span className="fw-semibold">{new Date().toLocaleString('es-CL')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}