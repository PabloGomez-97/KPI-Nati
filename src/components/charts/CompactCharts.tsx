import React from 'react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  AreaChart,
  Area,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip 
} from 'recharts';
import { formatMoney, formatPct } from '../../utils/formatters';

interface ChartDataPoint {
  month: string;
  income: number;
  profit: number;
  ops: number;
  profitPct: number;
}

interface CompactChartProps {
  data: ChartDataPoint[];
  selectedKPI: string;
}

const chartTheme = {
  grid: '#f8f9fa',
  primary: '#495057',
  success: '#28a745',
  info: '#17a2b8',
  warning: '#ffc107',
  secondary: '#6c757d'
};

export const CompactRevenueTrendChart: React.FC<{ data: ChartDataPoint[] }> = ({ data }) => (
  <div className="card border-0 shadow-sm" style={{ height: '220px' }}>
    <div className="card-body p-3">
      <h6 className="card-title text-muted mb-2 small">Tendencia de Facturación</h6>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="2 2" stroke={chartTheme.grid} />
          <XAxis 
            dataKey="month" 
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: chartTheme.secondary }}
          />
          <YAxis hide />
          <Tooltip 
            formatter={(value: any) => [formatMoney(value), 'Facturación']}
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              fontSize: '12px'
            }}
          />
          <Area 
            type="monotone" 
            dataKey="income" 
            stroke={chartTheme.primary}
            fill={chartTheme.primary}
            fillOpacity={0.1}
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  </div>
);

export const CompactProfitTrendChart: React.FC<{ data: ChartDataPoint[] }> = ({ data }) => (
  <div className="card border-0 shadow-sm" style={{ height: '220px' }}>
    <div className="card-body p-3">
      <h6 className="card-title text-muted mb-2 small">Evolución del Profit</h6>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="2 2" stroke={chartTheme.grid} />
          <XAxis 
            dataKey="month" 
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: chartTheme.secondary }}
          />
          <YAxis hide />
          <Tooltip 
            formatter={(value: any) => [formatMoney(value), 'Profit']}
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              fontSize: '12px'
            }}
          />
          <Line 
            type="monotone" 
            dataKey="profit" 
            stroke={chartTheme.success}
            strokeWidth={3}
            dot={{ fill: chartTheme.success, strokeWidth: 0, r: 3 }}
            activeDot={{ r: 5, stroke: chartTheme.success, strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  </div>
);

export const CompactOperationsChart: React.FC<{ data: ChartDataPoint[] }> = ({ data }) => (
  <div className="card border-0 shadow-sm" style={{ height: '220px' }}>
    <div className="card-body p-3">
      <h6 className="card-title text-muted mb-2 small">Volumen de Operaciones</h6>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="2 2" stroke={chartTheme.grid} />
          <XAxis 
            dataKey="month" 
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: chartTheme.secondary }}
          />
          <YAxis hide />
          <Tooltip 
            formatter={(value: any) => [value, 'Operaciones']}
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              fontSize: '12px'
            }}
          />
          <Bar 
            dataKey="ops" 
            fill={chartTheme.info}
            radius={[2, 2, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  </div>
);

export const CompactMarginChart: React.FC<{ data: ChartDataPoint[] }> = ({ data }) => (
  <div className="card border-0 shadow-sm" style={{ height: '220px' }}>
    <div className="card-body p-3">
      <h6 className="card-title text-muted mb-2 small">Margen de Profit</h6>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="2 2" stroke={chartTheme.grid} />
          <XAxis 
            dataKey="month" 
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: chartTheme.secondary }}
          />
          <YAxis hide />
          <Tooltip 
            formatter={(value: any) => [`${Number(value).toFixed(1)}%`, 'Margen']}
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              fontSize: '12px'
            }}
          />
          <Line 
            type="monotone" 
            dataKey="profitPct" 
            stroke={chartTheme.warning}
            strokeWidth={3}
            dot={{ fill: chartTheme.warning, strokeWidth: 0, r: 3 }}
            activeDot={{ r: 5, stroke: chartTheme.warning, strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  </div>
);

export const CompactChartsGrid: React.FC<CompactChartProps> = ({ data, selectedKPI }) => {
  const getChartsForKPI = () => {
    switch (selectedKPI) {
      case 'revenue':
        return (
          <div className="row g-3">
            <div className="col-lg-6">
              <CompactRevenueTrendChart data={data} />
            </div>
            <div className="col-lg-6">
              <CompactOperationsChart data={data} />
            </div>
          </div>
        );
      case 'profit':
        return (
          <div className="row g-3">
            <div className="col-lg-6">
              <CompactProfitTrendChart data={data} />
            </div>
            <div className="col-lg-6">
              <CompactMarginChart data={data} />
            </div>
          </div>
        );
      case 'clients':
        return (
          <div className="row g-3">
            <div className="col-lg-6">
              <CompactRevenueTrendChart data={data} />
            </div>
            <div className="col-lg-6">
              <CompactOperationsChart data={data} />
            </div>
          </div>
        );
      case 'ticket':
        return (
          <div className="row g-3">
            <div className="col-lg-6">
              <div className="card border-0 shadow-sm" style={{ height: '220px' }}>
                <div className="card-body p-3">
                  <h6 className="card-title text-muted mb-2 small">Ticket Promedio por Mes</h6>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.map(d => ({ ...d, avgTicket: d.ops > 0 ? d.income / d.ops : 0 }))}>
                      <CartesianGrid strokeDasharray="2 2" stroke={chartTheme.grid} />
                      <XAxis 
                        dataKey="month" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: chartTheme.secondary }}
                      />
                      <YAxis hide />
                      <Tooltip 
                        formatter={(value: any) => [formatMoney(value), 'Ticket Promedio']}
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '1px solid #dee2e6',
                          borderRadius: '4px',
                          fontSize: '12px'
                        }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="avgTicket" 
                        stroke={chartTheme.warning}
                        fill={chartTheme.warning}
                        fillOpacity={0.1}
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
            <div className="col-lg-6">
              <CompactOperationsChart data={data} />
            </div>
          </div>
        );
      default:
        return (
          <div className="row g-3">
            <div className="col-lg-3">
              <CompactRevenueTrendChart data={data} />
            </div>
            <div className="col-lg-3">
              <CompactProfitTrendChart data={data} />
            </div>
            <div className="col-lg-3">
              <CompactOperationsChart data={data} />
            </div>
            <div className="col-lg-3">
              <CompactMarginChart data={data} />
            </div>
          </div>
        );
    }
  };

  return (
    <div className="mb-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h6 className="text-muted mb-0">
          {selectedKPI === 'none' ? 'Vista General' : `Análisis Detallado - ${
            selectedKPI === 'revenue' ? 'Facturación' :
            selectedKPI === 'profit' ? 'Profit' :
            selectedKPI === 'clients' ? 'Clientes' :
            selectedKPI === 'ticket' ? 'Ticket Promedio' : 'General'
          }`}
        </h6>
        {selectedKPI !== 'none' && (
          <span className="badge bg-light text-dark small">
            Haz clic en otro KPI para cambiar vista
          </span>
        )}
      </div>
      {}
    </div>
  );
};