import React, { useState, useMemo } from 'react';
import type { Operation } from '../utils/types';
import { formatMoney, formatPct, truncateText } from '../utils/formatters';
import { filterOperationsByMonth } from '../utils/dataProcessing';

interface ExecutiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  executiveName: string;
  operations: Operation[];
  selectedMonth: string;
  // NUEVAS PROPS para el análisis de tendencias
  comparisonPeriod?: string; // El período de comparación del análisis de tendencias
  currentPeriod?: string;    // El período actual del análisis de tendencias
  showPeriodSelector?: boolean; // Si mostrar el selector de períodos
}

export const ExecutiveModal: React.FC<ExecutiveModalProps> = ({
  isOpen,
  onClose,
  executiveName,
  operations,
  selectedMonth,
  comparisonPeriod,
  currentPeriod,
  showPeriodSelector = false
}) => {
  // Estado para controlar qué período mostrar cuando viene del análisis de tendencias
  const [selectedPeriodView, setSelectedPeriodView] = useState<'current' | 'comparison'>('current');

  // Filtrar operaciones según el período seleccionado
  const filteredOperations = useMemo(() => {
    if (!showPeriodSelector) {
      // Comportamiento normal - usar selectedMonth
      return operations;
    }

    // Comportamiento del análisis de tendencias
    const periodToShow = selectedPeriodView === 'current' ? currentPeriod : comparisonPeriod;
    if (!periodToShow || periodToShow === 'all') {
      return operations.filter(op => op.executive === executiveName);
    }

    const executiveOps = operations.filter(op => op.executive === executiveName);
    return filterOperationsByMonth(executiveOps, periodToShow);
  }, [operations, executiveName, showPeriodSelector, selectedPeriodView, currentPeriod, comparisonPeriod]);

  const totalProfit = filteredOperations.reduce((sum, op) => sum + (op.profit || 0), 0);
  const totalIncome = filteredOperations.reduce((sum, op) => sum + (op.income || 0), 0);
  const averageMargin = totalIncome > 0 ? (totalProfit / totalIncome) * 100 : 0;

  if (!isOpen) return null;

  const modalTitle = showPeriodSelector 
    ? `${truncateText(executiveName, 30)} - Análisis Comparativo`
    : `Operaciones de ${truncateText(executiveName, 30)}`;

  const periodLabel = showPeriodSelector 
    ? (selectedPeriodView === 'current' ? currentPeriod : comparisonPeriod)
    : selectedMonth !== "all" ? selectedMonth : "Todos los períodos";

  return (
    <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-xl">
        <div className="modal-content">
          <div className="modal-header">
            <div>
              <h5 className="modal-title mb-1">{modalTitle}</h5>
              <small className="text-muted">Período: {periodLabel}</small>
            </div>
            <button 
              type="button" 
              className="btn-close" 
              onClick={onClose}
            ></button>
          </div>

          <div className="modal-body">
            {/* Selector de Período para Análisis de Tendencias */}
            {showPeriodSelector && currentPeriod && comparisonPeriod && (
              <div className="row mb-4">
                <div className="col-md-6">
                  <div className="card bg-light border-0">
                    <div className="card-body p-3">
                      <h6 className="fw-bold mb-3">Seleccionar Período a Analizar</h6>
                      <div className="btn-group w-100" role="group">
                        <input
                          type="radio"
                          className="btn-check"
                          name="periodView"
                          id="currentPeriod"
                          checked={selectedPeriodView === 'current'}
                          onChange={() => setSelectedPeriodView('current')}
                        />
                        <label className="btn btn-outline-primary" htmlFor="currentPeriod">
                          Período Actual ({currentPeriod})
                        </label>
                        
                        <input
                          type="radio"
                          className="btn-check"
                          name="periodView"
                          id="comparisonPeriod"
                          checked={selectedPeriodView === 'comparison'}
                          onChange={() => setSelectedPeriodView('comparison')}
                        />
                        <label className="btn btn-outline-secondary" htmlFor="comparisonPeriod">
                          Comparación ({comparisonPeriod})
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="card border-0 bg-primary bg-opacity-10">
                    <div className="card-body p-3">
                      <div className="row text-center">
                        <div className="col-4">
                          <div className="fw-bold text-primary">{filteredOperations.length}</div>
                          <small className="text-muted">Operaciones</small>
                        </div>
                        <div className="col-4">
                          <div className="fw-bold text-success">{formatMoney(totalProfit)}</div>
                          <small className="text-muted">Profit Total</small>
                        </div>
                        <div className="col-4">
                          <div className="fw-bold text-info">{formatPct(averageMargin)}</div>
                          <small className="text-muted">Margen Promedio</small>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Resumen Simple para Modal Normal */}
            {!showPeriodSelector && (
              <div className="d-flex justify-content-between align-items-center mb-3">
                <span className="text-muted">
                  {filteredOperations.length} operaciones encontradas
                </span>
                <div className="d-flex gap-3">
                  <span className="badge bg-primary fs-6">
                    Profit Total: {formatMoney(totalProfit)}
                  </span>
                  <span className="badge bg-info fs-6">
                    Margen: {formatPct(averageMargin)}
                  </span>
                </div>
              </div>
            )}
            
            {/* Tabla de Operaciones */}
            {filteredOperations.length > 0 ? (
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
                    {filteredOperations.map((op, idx) => {
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
            ) : (
              <div className="text-center py-5 text-muted">
                <p className="mb-0">No hay operaciones para el período seleccionado</p>
                {showPeriodSelector && (
                  <small>Intenta cambiar al otro período usando el selector arriba</small>
                )}
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={onClose}
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};