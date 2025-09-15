import React from 'react';
import { TrendingUp, TrendingDown } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  trend?: { value: number; isPositive: boolean };
  bgColor?: string;
}

export const KPICard: React.FC<KPICardProps> = ({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend, 
  bgColor = "primary" 
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