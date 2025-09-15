import React from 'react';
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from 'recharts';

interface ChartDataPoint {
  month: string;
  income: number;
  profit: number;
  ops: number;
  profitPct: number;
}

interface MarginChartProps {
  data: ChartDataPoint[];
}

export const MarginChart: React.FC<MarginChartProps> = ({ data }) => {
  return (
    <div className="card shadow-sm h-100">
      <div className="card-body">
        <h5 className="card-title mb-3">Margen de Profit</h5>
        <div style={{ height: 350 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
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
  );
};