import React from 'react';
import { ResponsiveContainer, ComposedChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { formatMoney } from '../../utils/formatters';

interface ChartDataPoint {
  month: string;
  income: number;
  profit: number;
  ops: number;
  profitPct: number;
}

interface RevenueProfitChartProps {
  data: ChartDataPoint[];
}

export const RevenueProfitChart: React.FC<RevenueProfitChartProps> = ({ data }) => {
  return (
    <div className="card shadow-sm h-100">
      <div className="card-body">
        <h5 className="card-title mb-3">Facturación vs Profit</h5>
        <div style={{ height: 350 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data}>
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
  );
};