import React, { useState } from 'react';
import { TrendIndicator } from './TrendIndicator';
import { formatMoney, truncateText } from '../utils/formatters';
import type { ExecutiveTrend, ExecutiveWeeklyTrend } from '../utils/types';

interface WeeklyTrendSectionProps {
  executiveTrends: Record<string, ExecutiveTrend>;
  executiveWeeklyTrends: Record<string, ExecutiveWeeklyTrend>;
  selectedPeriod: string; // "monthly" | "weekly"
  onExecutiveClick: (executiveName: string) => void; // Función para abrir modal
}

export const WeeklyTrendSection: React.FC<WeeklyTrendSectionProps> = ({
  executiveTrends,
  executiveWeeklyTrends,
  selectedPeriod,
  onExecutiveClick
}) => {
  const [viewMode, setViewMode] = useState<'monthly' | 'weekly'>('monthly');
  
  // Determinar si mostrar datos mensuales o semanales
  const trendsToShow = viewMode === 'weekly' ? executiveWeeklyTrends : executiveTrends;
  const hasData = Object.keys(trendsToShow).length > 0;

  if (!hasData && viewMode === 'weekly') {
    return (
      <div className="card shadow-sm mb-4">
        <div className="card-header bg-light p-3">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h6 className="card-title mb-0">Análisis de Tendencias</h6>
              <small className="text-muted">
                {viewMode === 'weekly' ? 'Comparación semanal (semana actual vs anterior)' : 'Comparación del último mes vs mes anterior'}
              </small>
            </div>
            <div className="btn-group" role="group">
              <input
                type="radio"
                className="btn-check"
                name="trendView"
                id="monthly"
                checked={viewMode === 'monthly'}
                onChange={() => setViewMode('monthly')}
              />
              <label className="btn btn-outline-primary btn-sm" htmlFor="monthly">
                Mensual
              </label>
              
              <input
                type="radio"
                className="btn-check"
                name="trendView"
                id="weekly"
                checked={viewMode === 'weekly'}
                onChange={() => setViewMode('weekly')}
              />
              <label className="btn btn-outline-primary btn-sm" htmlFor="weekly">
                Semanal
              </label>
            </div>
          </div>
        </div>
        <div className="card-body p-3">
          <div className="text-center text-muted py-4">
            <p className="mb-0">No hay suficientes datos semanales para mostrar tendencias</p>
            <small>Se necesitan al menos 2 semanas de datos por ejecutivo</small>
          </div>
        </div>
      </div>
    );
  }

  if (!hasData) return null;

  return (
    <div className="card shadow-sm mb-4">
      <div className="card-header bg-light p-3">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <h6 className="card-title mb-0">Análisis de Tendencias</h6>
            <small className="text-muted">
              {viewMode === 'weekly' ? 'Comparación semanal (semana actual vs anterior)' : 'Comparación del último mes vs mes anterior'}
            </small>
          </div>
          <div className="btn-group" role="group">
            <input
              type="radio"
              className="btn-check"
              name="trendView"
              id="monthly"
              checked={viewMode === 'monthly'}
              onChange={() => setViewMode('monthly')}
            />
            <label className="btn btn-outline-primary btn-sm" htmlFor="monthly">
              Mensual
            </label>
            
            <input
              type="radio"
              className="btn-check"
              name="trendView"
              id="weekly"
              checked={viewMode === 'weekly'}
              onChange={() => setViewMode('weekly')}
            />
            <label className="btn btn-outline-primary btn-sm" htmlFor="weekly">
              Semanal
            </label>
          </div>
        </div>
      </div>
      <div className="card-body p-3">
        {/* Nota para el usuario sobre funcionalidad clickeable */}
        <div className="d-flex justify-content-between align-items-center mb-3">
          <span className="text-muted small">
            {viewMode === 'weekly' ? 'Comparación semanal por ejecutivo' : 'Comparación mensual por ejecutivo'}
          </span>
          <small className="text-muted">Haz clic en un ejecutivo para ver sus operaciones</small>
        </div>

        {/* Vista de Cards (6 ejecutivos máximo) */}
        <div className="row g-2 mb-3">
          {Object.entries(trendsToShow).slice(0, 6).map(([exec, trend]) => {
            const currentPeriod = viewMode === 'weekly' ? 
              (trend as ExecutiveWeeklyTrend).currentWeek : 
              (trend as ExecutiveTrend).currentMonth;
            const previousPeriod = viewMode === 'weekly' ? 
              (trend as ExecutiveWeeklyTrend).previousWeek : 
              (trend as ExecutiveTrend).previousMonth;

            return (
              <div key={exec} className="col-lg-2 col-md-4">
                <div 
                  className="card border-0 bg-light h-100" 
                  style={{ cursor: 'pointer' }}
                  onClick={() => onExecutiveClick(exec)}
                >
                  <div className="card-body p-2">
                    <div className="d-flex justify-content-between align-items-start mb-1">
                      <h6 className="card-title mb-0 small text-primary" title={exec} style={{ textDecoration: 'underline' }}>
                        {truncateText(exec, 15)}
                      </h6>
                      <TrendIndicator trend={trend.trend} profitPctChange={trend.profitPctChange} />
                    </div>
                    
                    <div className="small">
                      <div className="d-flex justify-content-between">
                        <span className="text-muted">Actual:</span>
                        <span className="fw-bold">{formatMoney(currentPeriod?.profit || 0)}</span>
                      </div>
                      <div className="d-flex justify-content-between">
                        <span className="text-muted">Anterior:</span>
                        <span>{formatMoney(previousPeriod?.profit || 0)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Tabla completa si hay más de 6 ejecutivos */}
      </div>
    </div>
  );
};