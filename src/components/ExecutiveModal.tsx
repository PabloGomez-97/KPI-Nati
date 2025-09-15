import React from 'react';
import type { Operation } from '../utils/types';
import { formatMoney, formatPct, truncateText } from '../utils/formatters';

interface ExecutiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  executiveName: string;
  operations: Operation[];
  selectedMonth: string;
}

export const ExecutiveModal: React.FC<ExecutiveModalProps> = ({
  isOpen,
  onClose,
  executiveName,
  operations,
  selectedMonth
}) => {
  if (!isOpen) return null;

  const totalProfit = operations.reduce((sum, op) => sum + (op.profit || 0), 0);

  return (
    <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-xl">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              Operaciones de {truncateText(executiveName, 40)}
              {selectedMonth !== "all" && <span className="text-muted"> - {selectedMonth}</span>}
            </h5>
            <button 
              type="button" 
              className="btn-close" 
              onClick={onClose}
            ></button>
          </div>
          <div className="modal-body">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <span className="text-muted">
                {operations.length} operaciones encontradas
              </span>
              <span className="badge bg-primary">
                Total Profit: {formatMoney(totalProfit)}
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
                  {operations.map((op, idx) => {
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