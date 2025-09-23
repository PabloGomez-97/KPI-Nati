import React, { useMemo, useState } from "react";
import Papa from "papaparse";
import "bootstrap/dist/css/bootstrap.min.css";
import { Users, DollarSign, Target, Award, Calendar, BarChart3, Upload } from "lucide-react";

// Imports de componentes y utilidades
import { TrendIndicator } from './components/TrendIndicator';
import { ExecutiveModal } from './components/ExecutiveModal';
import { EnhancedKPISection } from './components/EnhancedKPISection';
import { extractOperations, aggregateMonthly, aggregateWeekly, filterOperationsByMonth } from './utils/dataProcessing';
import { calculateEnhancedGlobalKPIs, calculateAdvancedKPIs } from './utils/advancedKPIs';
import { formatMoney, formatPct, truncateText, getFirstWord } from './utils/formatters';
import { WeeklyTrendSection } from './components/WeeklyTrendSection';
import type { WeeklyAgg, ExecutiveWeeklyTrend } from './utils/types';
import type {
  Operation,
  MonthlyAgg,
  ExecutiveTrend,
  ExecutiveSummary,
  TopPerformer,
  GlobalKPIs,
  AdvancedKPIs
} from './utils/types';

export default function App() {
  const [ops, setOps] = useState<Operation[] | null>(null);
  const [selectedExecutive, setSelectedExecutive] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedKPI, setSelectedKPI] = useState<string>("none");
  const [modalExecutive, setModalExecutive] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  
  // PASO 1: Datos base sin filtros
  const monthly = useMemo(() => (ops ? aggregateMonthly(ops) : []), [ops]);

  const weekly = useMemo(() => (ops ? aggregateWeekly(ops) : []), [ops]);
  
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

  // PASO 5: KPIs globales mejorados
  const globalKPIs = useMemo((): GlobalKPIs | null => {
    if (!summaryData || !ops || !monthly) return null;
    return calculateEnhancedGlobalKPIs(ops, monthly, summaryData);
  }, [summaryData, ops, monthly]);

  // PASO 6: KPIs avanzados
  const advancedKPIs = useMemo((): AdvancedKPIs | null => {
    if (!summaryData || !ops || !monthly) return null;
    return calculateAdvancedKPIs(ops, monthly, summaryData);
  }, [summaryData, ops, monthly]);

  // PASO 7: Top performers
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

  // PASO 8: Análisis de tendencias
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

  const executiveWeeklyTrends = useMemo((): Record<string, ExecutiveWeeklyTrend> => {
    if (!weekly || weekly.length < 2 || selectedMonth !== "all") return {};
    
    const trends: Record<string, ExecutiveWeeklyTrend> = {};
    const executives = Array.from(new Set(weekly.map(w => w.executive)));
    
    executives.forEach(exec => {
      const execWeekly = weekly.filter(w => w.executive === exec).sort((a, b) => a.week.localeCompare(b.week));
      
      if (execWeekly.length >= 2) {
        const current = execWeekly[execWeekly.length - 1];
        const previous = execWeekly[execWeekly.length - 2];
        
        const profitChange = current.profit - previous.profit;
        const profitPctChange = previous.profit !== 0 ? ((current.profit - previous.profit) / Math.abs(previous.profit)) * 100 : null;
        const opsChange = current.ops - previous.ops;
        
        let trend: 'up' | 'down' | 'stable' | 'new';
        if (profitPctChange === null) trend = 'new';
        else if (Math.abs(profitPctChange) < 5) trend = 'stable';
        else if (profitPctChange > 0) trend = 'up';
        else trend = 'down';
        
        trends[exec] = {
          currentWeek: current,
          previousWeek: previous,
          profitChange,
          profitPctChange,
          opsChange,
          trend
        };
      } else if (execWeekly.length === 1) {
        trends[exec] = {
          currentWeek: execWeekly[0],
          previousWeek: null,
          profitChange: null,
          profitPctChange: null,
          opsChange: null,
          trend: 'new'
        };
      }
    });
    
    return trends;
  }, [weekly, selectedMonth]);

  // PASO 9: Modal operations
  const modalOperations = useMemo(() => {
    if (!ops || !modalExecutive) return [];
    
    let filtered = ops.filter(op => op.executive === modalExecutive);
    
    // Usar la nueva función de filtrado
    filtered = filterOperationsByMonth(filtered, selectedMonth);
    
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

  function handleExecutiveClickFromTrends(executiveName: string) {
    setModalExecutive(executiveName);
    setShowModal(true);
  }

  return (
    <div style={{ backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
      {/* Header Mejorado */}
      <nav className="navbar navbar-expand-lg bg-white shadow-sm mb-4">
        <div className="container-fluid">
          <div className="d-flex align-items-center">
            <BarChart3 size={28} className="text-primary me-3" />
            <div>
              <h1 className="navbar-brand fw-bold mb-0 fs-4">Dashboard Comercial</h1>
              <small className="text-muted">Análisis Avanzado de KPIs y Comisiones</small>
            </div>
          </div>
          <div className="d-flex align-items-center text-muted">
            <Calendar size={18} className="me-2" />
            <span className="small">{new Date().toLocaleDateString('es-CL')}</span>
          </div>
        </div>
      </nav>

      <div className="container-fluid px-4">
        {/* Upload Section Compacto */}
        <div className="card shadow-sm mb-4">
          <div className="card-body p-3">
            <div className="row align-items-center">
              <div className="col-md-8">
                <div className="d-flex align-items-center">
                  <Upload size={20} className="text-primary me-2" />
                  <div>
                    <h6 className="mb-1">Cargar Datos</h6>
                    <small className="text-muted">Sube tu archivo CSV para analizar los KPIs</small>
                  </div>
                </div>
              </div>
              <div className="col-md-4">
                <input 
                  type="file" 
                  className="form-control form-control-sm" 
                  accept=".csv" 
                  onChange={(e) => { 
                    const f = e.target.files?.[0]; 
                    if (f) handleFile(f); 
                  }} 
                />
              </div>
            </div>
          </div>
        </div>

        {!ops && (
          <div className="alert alert-info d-flex align-items-center" role="alert">
            <Target size={18} className="me-2" />
            Sube un archivo CSV para ver el análisis de KPIs
          </div>
        )}

        {ops && globalKPIs && advancedKPIs && (
          <>
            {/* Sección de KPIs Mejorada */}
            <EnhancedKPISection
              globalKPIs={globalKPIs}
              advancedKPIs={advancedKPIs}
              selectedKPI={selectedKPI}
              onKPISelect={setSelectedKPI}
            />

            {/* Controles y Top Performers Compactos */}
            <div className="row g-3 mb-4">
              {/* Filtros Compactos */}
              <div className="col-lg-4">
                <div className="card shadow-sm">
                  <div className="card-body p-3">
                    <h6 className="card-title mb-3">Filtros</h6>
                    <div className="row g-2">
                      <div className="col-12">
                        <label className="form-label small fw-semibold">Ejecutivo</label>
                        <select
                          value={selectedExecutive}
                          onChange={(e) => setSelectedExecutive(e.target.value)}
                          className="form-select form-select-sm"
                        >
                          <option value="all">Todos los ejecutivos</option>
                          {executiveOptions.map(exec => (
                            <option key={exec} value={exec}>{truncateText(exec, 30)}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-12">
                        <label className="form-label small fw-semibold">Período</label>
                        <select
                          value={selectedMonth}
                          onChange={(e) => setSelectedMonth(e.target.value)}
                          className="form-select form-select-sm"
                        >
                          <option value="all">Todos los meses</option>
                          {availableMonths.map(month => (
                            <option key={month} value={month}>{month}</option>
                          ))}
                        </select>
                      </div>
                      {(selectedExecutive !== "all" || selectedMonth !== "all") && (
                        <div className="col-12">
                          <button 
                            className="btn btn-outline-secondary btn-sm w-100"
                            onClick={() => {
                              setSelectedExecutive("all");
                              setSelectedMonth("all");
                            }}
                          >
                            Limpiar filtros
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Top Performers Compacto */}
              <div className="col-lg-8">
                <div className="card shadow-sm">
                  <div className="card-body p-3">
                    <h6 className="card-title mb-3">Top Performers</h6>
                    {topPerformers.length > 0 ? (
                      <div className="row g-2">
                        {topPerformers.slice(0, 3).map((performer, index) => (
                          <div key={performer.executive + index} className="col-lg-4">
                            <div className="d-flex align-items-center p-2 bg-light rounded">
                              <div 
                                className={`rounded-circle d-flex align-items-center justify-content-center text-white fw-bold me-2`}
                                style={{ 
                                  width: '30px', 
                                  height: '30px',
                                  backgroundColor: index === 0 ? '#ffc107' : index === 1 ? '#6c757d' : '#fd7e14',
                                  fontSize: '12px'
                                }}
                              >
                                {index + 1}
                              </div>
                              <div className="flex-grow-1">
                                <div className="fw-semibold small" title={performer.executive}>
                                  {truncateText(performer.executive, 20)}
                                </div>
                                <div className="d-flex justify-content-between">
                                  <small className="text-muted">{performer.ops} ops</small>
                                  <small className="fw-bold">{formatMoney(performer.profit)}</small>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center text-muted py-3">
                        <p className="mb-0 small">No hay datos suficientes para mostrar el ranking</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Análisis de Tendencias con Toggle Mensual/Semanal */}
            {availableMonths.length > 1 && selectedMonth === "all" && (
              <WeeklyTrendSection
              executiveTrends={executiveTrends}
              executiveWeeklyTrends={executiveWeeklyTrends}
              selectedPeriod={selectedMonth}
              onExecutiveClick={handleExecutiveClickFromTrends}
            />
            )}

            {/* RESUMEN POR EJECUTIVO Compacto */}
            <div className="card shadow-sm mb-4">
              <div className="card-header bg-light p-3">
                <div className="d-flex justify-content-between align-items-center">
                  <h6 className="card-title mb-0">
                    Resumen por Ejecutivo
                    {selectedMonth !== "all" && <span className="text-muted"> - {selectedMonth}</span>}
                  </h6>
                  <small className="text-muted">Haz clic en un ejecutivo para ver sus operaciones</small>
                </div>
              </div>
              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table table-hover mb-0 table-sm">
                    <thead className="table-light">
                      <tr>
                        <th className="small">Ejecutivo</th>
                        <th className="small">Operaciones</th>
                        <th className="small">Facturación</th>
                        <th className="small">Profit</th>
                        <th className="small">Margen %</th>
                        <th className="small">Clientes</th>
                        <th className="small">Ticket Promedio</th>
                        {availableMonths.length > 1 && selectedMonth === "all" && <th className="small">Tendencia</th>}
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
                            className="align-middle"
                          >
                            <td>
                              <div className="fw-semibold text-primary small" title={exec} style={{ textDecoration: 'underline' }}>
                                {truncateText(exec, 25)}
                              </div>
                            </td>
                            <td className="small">{data.ops.toLocaleString()}</td>
                            <td className="small">{formatMoney(data.income)}</td>
                            <td>
                              <span className={`fw-bold small ${data.profit >= 0 ? 'text-success' : 'text-danger'}`}>
                                {formatMoney(data.profit)}
                              </span>
                            </td>
                            <td>
                              <span className={`badge badge-sm ${
                                profitMargin >= 20 ? 'bg-success' :
                                profitMargin >= 10 ? 'bg-warning' :
                                'bg-danger'
                              }`}>
                                {formatPct(profitMargin)}
                              </span>
                            </td>
                            <td className="small">{data.clients.size}</td>
                            <td className="small">{formatMoney(avgTicket)}</td>
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

            {/* Métricas de Productividad Compactas */}
            <div className="row g-3 mb-4">
              <div className="col-lg-4">
                <div className="card shadow-sm">
                  <div className="card-body p-3">
                    <h6 className="card-title mb-2">
                      <Target size={16} className="me-2 text-primary" />
                      Productividad
                    </h6>
                    <div className="space-y-2">
                      {Object.entries(summaryData || {}).slice(0, 3).map(([exec, data]) => {
                        const opsPerMonth = selectedMonth !== "all" ? data.ops : (data.ops / (monthly.filter(m => m.executive === exec).length || 1));
                        const profitPerOp = data.ops > 0 ? data.profit / data.ops : 0;
                        
                        return (
                          <div key={exec} className="border-bottom pb-2 mb-2">
                            <div className="fw-semibold small text-truncate mb-1" title={exec}>
                              {getFirstWord(exec)}
                            </div>
                            <div className="row g-1">
                              <div className="col-6">
                                <div className="text-muted" style={{ fontSize: '11px' }}>{selectedMonth !== "all" ? "Operaciones:" : "Ops/mes:"}</div>
                                <div className="fw-bold small text-dark">{selectedMonth !== "all" ? data.ops : opsPerMonth.toFixed(1)}</div>
                              </div>
                              <div className="col-6">
                                <div className="text-muted" style={{ fontSize: '11px' }}>Profit/op:</div>
                                <div className="fw-bold small text-dark">{formatMoney(profitPerOp)}</div>
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
                <div className="card shadow-sm">
                  <div className="card-body p-3">
                    <h6 className="card-title mb-2">
                      <Users size={16} className="me-2 text-success" />
                      Análisis de Clientes
                    </h6>
                    <div className="space-y-2">
                      {Object.entries(summaryData || {}).slice(0, 3).map(([exec, data]) => {
                        const revenuePerClient = data.clients.size > 0 ? data.income / data.clients.size : 0;
                        const opsPerClient = data.clients.size > 0 ? data.ops / data.clients.size : 0;
                        
                        return (
                          <div key={exec} className="border-bottom pb-2 mb-2">
                            <div className="fw-semibold small text-truncate mb-1" title={exec}>
                              {getFirstWord(exec)}
                            </div>
                            <div className="row g-1">
                              <div className="col-6">
                                <div className="text-muted" style={{ fontSize: '11px' }}>Revenue/cliente:</div>
                                <div className="fw-bold small text-dark">{formatMoney(revenuePerClient)}</div>
                              </div>
                              <div className="col-6">
                                <div className="text-muted" style={{ fontSize: '11px' }}>Ops/cliente:</div>
                                <div className="fw-bold small text-dark">{opsPerClient.toFixed(1)}</div>
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
                <div className="card shadow-sm">
                  <div className="card-body p-3">
                    <h6 className="card-title mb-2">
                      <Award size={16} className="me-2 text-warning" />
                      Rendimiento
                    </h6>
                    <div className="space-y-2">
                      <div className="p-2 bg-primary bg-opacity-10 rounded mb-2">
                        <div className="text-primary fw-semibold" style={{ fontSize: '11px' }}>Mejor Margen</div>
                        <div className="h6 fw-bold text-primary mb-0">
                          {topPerformers.length > 0 ? formatPct(Math.max(...topPerformers.map(p => p.profitMargin))) : "—"}
                        </div>
                      </div>
                      <div className="p-2 bg-success bg-opacity-10 rounded mb-2">
                        <div className="text-success fw-semibold" style={{ fontSize: '11px' }}>Top Facturación</div>
                        <div className="h6 fw-bold text-success mb-0">
                          {topPerformers.length > 0 ? formatMoney(Math.max(...topPerformers.map(p => p.income))) : "—"}
                        </div>
                      </div>
                      <div className="p-2 bg-info bg-opacity-10 rounded">
                        <div className="text-info fw-semibold" style={{ fontSize: '11px' }}>Más Operaciones</div>
                        <div className="h6 fw-bold text-info mb-0">
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

        {/* Footer Compacto */}
        <div className="card shadow-sm">
          <div className="card-body p-3">
            <div className="d-flex justify-content-between align-items-center text-muted small">
              <div className="d-flex align-items-center">
                <span className="me-3">Dashboard Comercial Avanzado</span>
                <span className="me-1">•</span>
                <span className="ms-3">Datos procesados: {ops ? ops.length : 0} operaciones</span>
              </div>
              <div className="d-flex align-items-center">
                <span className="me-2">Última actualización:</span>
                <span className="fw-semibold">{new Date().toLocaleString('es-CL', { 
                  day: '2-digit', 
                  month: '2-digit', 
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}