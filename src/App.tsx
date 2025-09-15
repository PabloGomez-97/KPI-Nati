import React, { useMemo, useState } from "react";
import Papa from "papaparse";
import "bootstrap/dist/css/bootstrap.min.css";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { TrendingUp, TrendingDown, Users, DollarSign, Target, Award, Calendar, BarChart3, Upload } from "lucide-react";

// Imports de componentes y utilidades
import { KPICard } from './components/KPICard';
import { TrendIndicator } from './components/TrendIndicator';
import { ExecutiveModal } from './components/ExecutiveModal';
import { RevenueProfitChart } from './components/charts/RevenueProfitChart';
import { MarginChart } from './components/charts/MarginChart';
import { extractOperations, aggregateMonthly } from './utils/dataProcessing';
import { formatMoney, formatPct, truncateText, getFirstWord } from './utils/formatters';
import type {
  RawRow,
  Operation,
  MonthlyAgg,
  ExecutiveTrend,
  ExecutiveSummary,
  TopPerformer,
  GlobalKPIs
} from './utils/types';

export default function App() {
  const [ops, setOps] = useState<Operation[] | null>(null);
  const [selectedExecutive, setSelectedExecutive] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [modalExecutive, setModalExecutive] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  
  // PASO 1: Datos base sin filtros
  const monthly = useMemo(() => (ops ? aggregateMonthly(ops) : []), [ops]);
  
  // PASO 2: Opciones para dropdowns
  const availableMonths = useMemo(() => {
    if (!monthly) return [];
    return Array.from(new Set(monthly.map(m => m.month))).sort();
  }, [monthly]);

  const executiveOptions = useMemo(() => {
    if (!ops) return [];
    return Array.from(new Set(ops.map(op => op.executive).filter(exec => exec && exec.trim())));
  }, [ops]);

  // PASO 3: LÓGICA DE FILTRADO
  const summaryData = useMemo(() => {
    if (!monthly) return null;

    let filteredMonthlyData = monthly;

    if (selectedMonth !== "all") {
      filteredMonthlyData = filteredMonthlyData.filter(m => m.month === selectedMonth);
    }

    if (selectedExecutive !== "all") {
      filteredMonthlyData = filteredMonthlyData.filter(m => m.executive === selectedExecutive);
    }

    const byExec: Record<string, ExecutiveSummary> = {};
    
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

  // PASO 5: KPIs globales
  const globalKPIs = useMemo((): GlobalKPIs | null => {
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
  const topPerformers = useMemo((): TopPerformer[] => {
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

  // PASO 7: Análisis de tendencias
  const executiveTrends = useMemo((): Record<string, ExecutiveTrend> => {
    if (!monthly || availableMonths.length < 2 || selectedMonth !== "all") return {};
    
    const trends: Record<string, ExecutiveTrend> = {};
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

  // PASO 8: Modal operations
  const modalOperations = useMemo(() => {
    if (!ops || !modalExecutive) return [];
    
    let filtered = ops.filter(op => op.executive === modalExecutive);
    
    if (selectedMonth !== "all") {
      filtered = filtered.filter(op => {
        if (!op.date) return false;
        const opMonth = `${op.date.getUTCFullYear()}-${op.date.getUTCMonth() + 1}`;
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
                <RevenueProfitChart data={chartData} />
              </div>
              <div className="col-lg-6">
                <MarginChart data={chartData} />
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

            {/* Análisis de Tendencias por Ejecutivo */}
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

            {/* RESUMEN POR EJECUTIVO */}
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
            <ExecutiveModal
              isOpen={showModal}
              onClose={() => setShowModal(false)}
              executiveName={modalExecutive || ''}
              operations={modalOperations}
              selectedMonth={selectedMonth}
            />

            {/* Análisis Detallado por Mes */}
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