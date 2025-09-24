import React, { useMemo, useState } from "react";
import Papa from "papaparse";
import "bootstrap/dist/css/bootstrap.min.css";
import { Users, DollarSign, Target, Award, Calendar, BarChart3, Upload, Filter, TrendingUp } from "lucide-react";

// Imports de componentes y utilidades
import { TrendIndicator } from './components/TrendIndicator';
import { ExecutiveModal } from './components/ExecutiveModal';
import { EnhancedKPISection } from './components/EnhancedKPISection';
import { AdvancedTrendSection } from './components/AdvancedTrendSection';
import { extractOperations, aggregateMonthly, aggregateWeekly, filterOperationsByMonth } from './utils/dataProcessing';
import { calculateEnhancedGlobalKPIs, calculateAdvancedKPIs } from './utils/advancedKPIs';
import { formatMoney, formatPct, truncateText, getFirstWord } from './utils/formatters';
import type {
  Operation,
  MonthlyAgg,
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
  const [modalPeriodFilter, setModalPeriodFilter] = useState<string>("all");
  
  // Estados para el análisis de tendencias
  const [trendCurrentPeriod, setTrendCurrentPeriod] = useState<string | null>(null);
  const [trendComparisonPeriod, setTrendComparisonPeriod] = useState<string | null>(null);
  const [isFromTrendAnalysis, setIsFromTrendAnalysis] = useState<boolean>(false);
  
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

  // PASO 9: Modal operations
  const modalOperations = useMemo(() => {
    if (!ops || !modalExecutive) return [];
    
    let filtered = ops.filter(op => op.executive === modalExecutive);
    filtered = filterOperationsByMonth(filtered, modalPeriodFilter);
    
    return filtered.sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
  }, [ops, modalExecutive, modalPeriodFilter]);

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

  // FUNCIÓN MEJORADA - Para clicks desde análisis de tendencias
  function handleExecutiveClickFromTrends(executiveName: string, currentPeriod?: string, comparisonPeriod?: string) {
    setModalExecutive(executiveName);
    setIsFromTrendAnalysis(true);
    
    // Guardar ambos períodos
    setTrendCurrentPeriod(currentPeriod || null);
    setTrendComparisonPeriod(comparisonPeriod || null);
    
    // Usar el período actual por defecto para el filtro inicial
    if (currentPeriod && currentPeriod !== 'all') {
      if (currentPeriod.includes('W')) {
        const year = currentPeriod.split('-')[0];
        const weekNum = parseInt(currentPeriod.split('W')[1]);
        const approximateMonth = Math.ceil(weekNum / 4.33);
        const monthKey = `${year}-${approximateMonth}`;
        setModalPeriodFilter(monthKey);
      } else {
        setModalPeriodFilter(currentPeriod);
      }
    } else {
      setModalPeriodFilter(selectedMonth);
    }
    
    setShowModal(true);
  }

  function handleExecutiveClickFromSummary(executiveName: string) {
    setModalExecutive(executiveName);
    setModalPeriodFilter(selectedMonth);
    setIsFromTrendAnalysis(false);
    setShowModal(true);
  }

  // FUNCIÓN MEJORADA - Para cerrar modal
  function handleCloseModal() {
    setShowModal(false);
    setModalPeriodFilter("all");
    setIsFromTrendAnalysis(false);
    setTrendCurrentPeriod(null);
    setTrendComparisonPeriod(null);
  }

  const hasActiveFilters = selectedExecutive !== "all" || selectedMonth !== "all";

  return (
    <div style={{ backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
      {/* Header Modernizado */}
      <nav className="navbar navbar-expand-lg bg-white shadow-sm border-bottom mb-0">
        <div className="container-fluid py-3">
          <div className="d-flex align-items-center">
            <div className="bg-primary bg-opacity-10 rounded-3 p-2 me-3">
              <BarChart3 size={32} className="text-primary" />
            </div>
            <div>
              <h1 className="navbar-brand fw-bold mb-0 fs-3 text-dark">Dashboard Comercial</h1>
              <p className="text-muted mb-0 small">Panel de análisis avanzado y métricas de rendimiento</p>
            </div>
          </div>
          <div className="d-flex align-items-center gap-4">
            <div className="d-flex align-items-center text-muted">
              <Calendar size={18} className="me-2" />
              <span className="small fw-medium">{new Date().toLocaleDateString('es-CL')}</span>
            </div>
          </div>
        </div>
      </nav>

      <div className="container-fluid px-4 py-4">
        {/* Upload Section - Solo visible cuando no hay datos */}
        {!ops && (
          <div className="row justify-content-center mb-5">
            <div className="col-md-8 col-lg-6">
              <div className="card border-0 shadow-sm">
                <div className="card-body text-center py-5">
                  <div className="bg-primary bg-opacity-10 rounded-circle d-inline-flex align-items-center justify-content-center mb-4" style={{ width: '80px', height: '80px' }}>
                    <Upload size={32} className="text-primary" />
                  </div>
                  <h4 className="fw-bold text-dark mb-3">Comienza tu análisis</h4>
                  <p className="text-muted mb-4">Sube tu archivo CSV para generar insights poderosos sobre el rendimiento comercial</p>
                  <input 
                    type="file" 
                    className="form-control form-control-lg" 
                    accept=".csv" 
                    onChange={(e) => { 
                      const f = e.target.files?.[0]; 
                      if (f) handleFile(f); 
                    }} 
                  />
                  <small className="text-muted mt-2 d-block">Formatos soportados: CSV</small>
                </div>
              </div>
            </div>
          </div>
        )}

        {ops && globalKPIs && advancedKPIs && (
          <>
            {/* Barra de Filtros Flotante */}
            <div className="position-sticky top-0 mb-4 z-3">
              <div className="card border-0 shadow-sm bg-white">
                <div className="card-body p-3">
                  <div className="row align-items-center">
                    <div className="col-md-8">
                      <div className="d-flex align-items-center gap-3 flex-wrap">
                        <div className="d-flex align-items-center">
                          <Filter size={18} className="text-primary me-2" />
                          <span className="fw-semibold text-dark me-3">Filtros:</span>
                        </div>
                        
                        <div style={{ minWidth: '200px' }}>
                          <select
                            value={selectedExecutive}
                            onChange={(e) => setSelectedExecutive(e.target.value)}
                            className="form-select form-select-sm"
                          >
                            <option value="all">Todos los ejecutivos</option>
                            {executiveOptions.map(exec => (
                              <option key={exec} value={exec}>{truncateText(exec, 25)}</option>
                            ))}
                          </select>
                        </div>
                        
                        <div style={{ minWidth: '150px' }}>
                          <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="form-select form-select-sm"
                          >
                            <option value="all">Todos los períodos</option>
                            {availableMonths.map(month => (
                              <option key={month} value={month}>{month}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                    
                    <div className="col-md-4 text-end">
                      {hasActiveFilters && (
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
                      <span className="text-muted small ms-3">
                        {ops.length.toLocaleString()} operaciones
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Sección Principal de KPIs */}
            <div className="mb-5">
              <div className="d-flex align-items-center mb-4">
                <div className="bg-primary bg-opacity-10 rounded-2 p-2 me-3">
                  <DollarSign size={24} className="text-primary" />
                </div>
                <div>
                  <h3 className="fw-bold text-dark mb-0">Métricas Principales</h3>
                  <p className="text-muted mb-0 small">Indicadores clave de rendimiento</p>
                </div>
              </div>
              
              <EnhancedKPISection
                globalKPIs={globalKPIs}
                advancedKPIs={advancedKPIs}
                selectedKPI={selectedKPI}
                onKPISelect={setSelectedKPI}
              />
            </div>

            {/* Top Performers - Destacado */}
            <div className="mb-5">
              <div className="d-flex align-items-center justify-content-between mb-4">
                <div className="d-flex align-items-center">
                  <div className="bg-warning bg-opacity-10 rounded-2 p-2 me-3">
                    <Award size={24} className="text-warning" />
                  </div>
                  <div>
                    <h3 className="fw-bold text-dark mb-0">Mejores Performers</h3>
                    <p className="text-muted mb-0 small">Ranking de ejecutivos por profit generado</p>
                  </div>
                </div>
              </div>
              
              <div className="card border-0 shadow-sm">
                <div className="card-body p-4">
                  {topPerformers.length > 0 ? (
                    <div className="row g-4">
                      {topPerformers.slice(0, 3).map((performer, index) => (
                        <div key={performer.executive + index} className="col-lg-4">
                          <div className="card border-0 bg-light h-100">
                            <div className="card-body p-4 text-center">
                              <div 
                                className={`rounded-circle d-inline-flex align-items-center justify-content-center text-white fw-bold mb-3`}
                                style={{ 
                                  width: '60px', 
                                  height: '60px',
                                  backgroundColor: index === 0 ? '#ffc107' : index === 1 ? '#6c757d' : '#fd7e14',
                                  fontSize: '24px'
                                }}
                              >
                                {index + 1}
                              </div>
                              <h5 className="fw-bold text-dark mb-1" title={performer.executive}>
                                {truncateText(performer.executive, 20)}
                              </h5>
                              <div className="text-muted mb-3">{performer.ops} operaciones</div>
                              <div className="display-6 fw-bold text-success">{formatMoney(performer.profit)}</div>
                              <div className="small text-muted">Margen: {formatPct(performer.profitMargin)}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-5">
                      <div className="text-muted mb-3">
                        <Award size={48} className="opacity-50" />
                      </div>
                      <h5 className="text-muted">No hay datos suficientes para mostrar el ranking</h5>
                      <p className="text-muted small mb-0">Ajusta los filtros o sube más datos</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Análisis de Tendencias */}
            {availableMonths.length > 1 && selectedMonth === "all" && (
              <div className="mb-5">
                <div className="d-flex align-items-center mb-4">
                  <div className="bg-info bg-opacity-10 rounded-2 p-2 me-3">
                    <TrendingUp size={24} className="text-info" />
                  </div>
                  <div>
                    <h3 className="fw-bold text-dark mb-0">Análisis de Tendencias</h3>
                    <p className="text-muted mb-0 small">Comparaciones personalizadas de rendimiento</p>
                  </div>
                </div>
                
                <AdvancedTrendSection
                  monthlyData={monthly}
                  weeklyData={weekly}
                  operations={ops}
                  onExecutiveClick={handleExecutiveClickFromTrends}
                />
              </div>
            )}

            {/* Tabla Detallada de Ejecutivos - REDISEÑADA */}
            <div className="mb-5">
              <div className="d-flex align-items-center mb-4">
                <div className="bg-success bg-opacity-10 rounded-2 p-2 me-3">
                  <Users size={24} className="text-success" />
                </div>
                <div>
                  <h3 className="fw-bold text-dark mb-0">Detalle por Ejecutivo</h3>
                  <p className="text-muted mb-0 small">
                    Análisis completo del rendimiento individual
                    {selectedMonth !== "all" && <span className="fw-medium"> - {selectedMonth}</span>}
                  </p>
                </div>
              </div>
              
              <div className="card border-0 shadow-sm">
                <div className="card-body p-4">
                  {Object.entries(summaryData || {}).length > 0 ? (
                    <>
                      {/* Nota informativa */}
                      <div className="d-flex justify-content-between align-items-center mb-4">
                        <span className="text-muted small">
                          <strong>{Object.keys(summaryData || {}).length}</strong> ejecutivos con rendimiento registrado
                        </span>
                        <small className="text-muted">Haz clic en un ejecutivo para ver operaciones detalladas</small>
                      </div>

                      {/* Vista de Cards para pocos ejecutivos */}
                      {Object.entries(summaryData || {}).length <= 6 ? (
                        <div className="row g-3">
                          {Object.entries(summaryData || {}).map(([exec, data]) => {
                            const profitMargin = data.income > 0 ? (data.profit / data.income) * 100 : 0;
                            const avgTicket = data.ops > 0 ? data.income / data.ops : 0;
                            
                            return (
                              <div key={exec} className="col-lg-4 col-md-6">
                                <div 
                                  className="card border-0 bg-light h-100 shadow-sm" 
                                  style={{ cursor: 'pointer', transition: 'transform 0.2s ease' }}
                                  onClick={() => handleExecutiveClickFromSummary(exec)}
                                  onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                                  onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                                >
                                  <div className="card-body p-3">
                                    {/* Header con Avatar */}
                                    <div className="d-flex align-items-center mb-3">
                                      <div className="bg-primary bg-opacity-15 rounded-circle d-flex align-items-center justify-content-center me-3" style={{ width: '45px', height: '45px' }}>
                                        <span className="fw-bold text-primary">{exec.charAt(0).toUpperCase()}</span>
                                      </div>
                                      <div className="flex-grow-1">
                                        <h6 className="fw-bold text-primary mb-0" title={exec} style={{ textDecoration: 'underline' }}>
                                          {truncateText(exec, 18)}
                                        </h6>
                                        <small className="text-muted">{data.ops} operaciones</small>
                                      </div>
                                    </div>
                                    
                                    {/* Métricas principales */}
                                    <div className="row g-2 mb-3">
                                      <div className="col-6">
                                        <div className="text-center p-2 bg-success bg-opacity-10 rounded">
                                          <div className="fw-bold text-success small">{formatMoney(data.profit)}</div>
                                          <div className="text-muted" style={{ fontSize: '10px' }}>Profit</div>
                                        </div>
                                      </div>
                                      <div className="col-6">
                                        <div className="text-center p-2 bg-info bg-opacity-10 rounded">
                                          <div className="fw-bold text-info small">{formatMoney(data.income)}</div>
                                          <div className="text-muted" style={{ fontSize: '10px' }}>Revenue</div>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Métricas adicionales */}
                                    <div className="small">
                                      <div className="d-flex justify-content-between align-items-center mb-1">
                                        <span className="text-muted">Margen:</span>
                                        <span className={`badge ${
                                          profitMargin >= 20 ? 'bg-success' :
                                          profitMargin >= 10 ? 'bg-warning' :
                                          'bg-danger'
                                        }`} style={{ fontSize: '10px' }}>
                                          {formatPct(profitMargin)}
                                        </span>
                                      </div>
                                      <div className="d-flex justify-content-between align-items-center mb-1">
                                        <span className="text-muted">Clientes:</span>
                                        <span className="badge bg-secondary" style={{ fontSize: '10px' }}>{data.clients.size}</span>
                                      </div>
                                      <div className="d-flex justify-content-between align-items-center">
                                        <span className="text-muted">Ticket Prom:</span>
                                        <span className="fw-bold text-dark" style={{ fontSize: '11px' }}>{formatMoney(avgTicket)}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        /* Vista de Tabla compacta para muchos ejecutivos */
                        <div className="table-responsive">
                          <table className="table table-hover table-sm mb-0">
                            <thead className="table-light">
                              <tr>
                                <th className="small fw-semibold border-0 py-2">Ejecutivo</th>
                                <th className="small fw-semibold border-0 py-2">Ops</th>
                                <th className="small fw-semibold border-0 py-2">Revenue</th>
                                <th className="small fw-semibold border-0 py-2">Profit</th>
                                <th className="small fw-semibold border-0 py-2">Margen</th>
                                <th className="small fw-semibold border-0 py-2">Clientes</th>
                                <th className="small fw-semibold border-0 py-2">Ticket Prom.</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(summaryData || {}).map(([exec, data]) => {
                                const profitMargin = data.income > 0 ? (data.profit / data.income) * 100 : 0;
                                const avgTicket = data.ops > 0 ? data.income / data.ops : 0;
                                
                                return (
                                  <tr 
                                    key={exec} 
                                    style={{ cursor: 'pointer' }} 
                                    onClick={() => handleExecutiveClickFromSummary(exec)}
                                    className="align-middle"
                                  >
                                    <td className="py-2">
                                      <div className="d-flex align-items-center">
                                        <div className="bg-primary bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center me-2" style={{ width: '30px', height: '30px' }}>
                                          <span className="fw-bold text-primary small">{exec.charAt(0).toUpperCase()}</span>
                                        </div>
                                        <div>
                                          <div className="fw-semibold text-primary small" title={exec} style={{ textDecoration: 'underline' }}>
                                            {truncateText(exec, 20)}
                                          </div>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="py-2">
                                      <span className="badge bg-secondary small">{data.ops}</span>
                                    </td>
                                    <td className="py-2 small fw-semibold">{formatMoney(data.income)}</td>
                                    <td className="py-2">
                                      <span className={`fw-bold small ${data.profit >= 0 ? 'text-success' : 'text-danger'}`}>
                                        {formatMoney(data.profit)}
                                      </span>
                                    </td>
                                    <td className="py-2">
                                      <span className={`badge small ${
                                        profitMargin >= 20 ? 'bg-success' :
                                        profitMargin >= 10 ? 'bg-warning' :
                                        'bg-danger'
                                      }`}>
                                        {formatPct(profitMargin)}
                                      </span>
                                    </td>
                                    <td className="py-2">
                                      <span className="badge bg-info small">{data.clients.size}</span>
                                    </td>
                                    <td className="py-2 small fw-semibold">{formatMoney(avgTicket)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-5">
                      <div className="text-muted mb-3">
                        <Users size={48} className="opacity-50" />
                      </div>
                      <h5 className="text-muted">No hay datos de ejecutivos para mostrar</h5>
                      <p className="text-muted small mb-0">Ajusta los filtros o verifica los datos cargados</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Métricas Adicionales en Sidebar */}
            <div className="row g-4 mb-5">
              <div className="col-lg-4">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-header border-0 bg-transparent pt-4 pb-0">
                    <h5 className="fw-bold text-dark d-flex align-items-center">
                      <Target size={20} className="me-2 text-primary" />
                      Productividad
                    </h5>
                  </div>
                  <div className="card-body">
                    {Object.entries(summaryData || {}).slice(0, 3).map(([exec, data]) => {
                      const opsPerMonth = selectedMonth !== "all" ? data.ops : (data.ops / (monthly.filter(m => m.executive === exec).length || 1));
                      const profitPerOp = data.ops > 0 ? data.profit / data.ops : 0;
                      
                      return (
                        <div key={exec} className="d-flex justify-content-between align-items-center py-3 border-bottom">
                          <div>
                            <div className="fw-semibold text-dark" title={exec}>
                              {getFirstWord(exec)}
                            </div>
                            <small className="text-muted">
                              {selectedMonth !== "all" ? `${data.ops} ops` : `${opsPerMonth.toFixed(1)} ops/mes`}
                            </small>
                          </div>
                          <div className="text-end">
                            <div className="fw-bold text-primary">{formatMoney(profitPerOp)}</div>
                            <small className="text-muted">por operación</small>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="col-lg-4">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-header border-0 bg-transparent pt-4 pb-0">
                    <h5 className="fw-bold text-dark d-flex align-items-center">
                      <Users size={20} className="me-2 text-success" />
                      Análisis de Clientes
                    </h5>
                  </div>
                  <div className="card-body">
                    {Object.entries(summaryData || {}).slice(0, 3).map(([exec, data]) => {
                      const revenuePerClient = data.clients.size > 0 ? data.income / data.clients.size : 0;
                      const opsPerClient = data.clients.size > 0 ? data.ops / data.clients.size : 0;
                      
                      return (
                        <div key={exec} className="d-flex justify-content-between align-items-center py-3 border-bottom">
                          <div>
                            <div className="fw-semibold text-dark" title={exec}>
                              {getFirstWord(exec)}
                            </div>
                            <small className="text-muted">
                              {data.clients.size} clientes
                            </small>
                          </div>
                          <div className="text-end">
                            <div className="fw-bold text-success">{formatMoney(revenuePerClient)}</div>
                            <small className="text-muted">{opsPerClient.toFixed(1)} ops/cliente</small>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="col-lg-4">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-header border-0 bg-transparent pt-4 pb-0">
                    <h5 className="fw-bold text-dark d-flex align-items-center">
                      <Award size={20} className="me-2 text-warning" />
                      Métricas Destacadas
                    </h5>
                  </div>
                  <div className="card-body">
                    <div className="row g-3">
                      <div className="col-12">
                        <div className="bg-primary bg-opacity-10 rounded-3 p-3 text-center">
                          <div className="text-primary fw-semibold small">Mejor Margen</div>
                          <div className="h4 fw-bold text-primary mb-0">
                            {topPerformers.length > 0 ? formatPct(Math.max(...topPerformers.map(p => p.profitMargin))) : "—"}
                          </div>
                        </div>
                      </div>
                      <div className="col-6">
                        <div className="bg-success bg-opacity-10 rounded-3 p-3 text-center">
                          <div className="text-success fw-semibold small">Top Revenue</div>
                          <div className="fw-bold text-success small">
                            {topPerformers.length > 0 ? formatMoney(Math.max(...topPerformers.map(p => p.income))).replace(' CLP', '').substring(0, 8) + '...' : "—"}
                          </div>
                        </div>
                      </div>
                      <div className="col-6">
                        <div className="bg-info bg-opacity-10 rounded-3 p-3 text-center">
                          <div className="text-info fw-semibold small">Max Ops</div>
                          <div className="fw-bold text-info small">
                            {topPerformers.length > 0 ? Math.max(...topPerformers.map(p => p.ops)).toLocaleString() : "—"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Modal para Operaciones del Ejecutivo - MEJORADO */}
        <ExecutiveModal
          isOpen={showModal}
          onClose={handleCloseModal}
          executiveName={modalExecutive || ''}
          operations={ops || []}
          selectedMonth={modalPeriodFilter}
          currentPeriod={trendCurrentPeriod}
          comparisonPeriod={trendComparisonPeriod}
          showPeriodSelector={isFromTrendAnalysis}
        />
      </div>
    </div>
  );
}