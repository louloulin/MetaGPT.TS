import React from 'react';
import { useMetaGPT } from './MetaGPTProvider';

interface Metric {
  name: string;
  value: number;
  unit: string;
  trend?: 'up' | 'down' | 'stable';
  threshold?: {
    warning: number;
    critical: number;
  };
}

interface MetricsDisplayProps {
  metrics: Metric[];
  layout?: 'grid' | 'list';
  showTrends?: boolean;
  onThresholdExceeded?: (metric: Metric) => void;
}

const MetricsDisplay: React.FC<MetricsDisplayProps> = ({
  metrics,
  layout = 'grid',
  showTrends = true,
  onThresholdExceeded,
}) => {
  const { config } = useMetaGPT();

  const getStatusColor = (metric: Metric) => {
    if (!metric.threshold) return '#2196F3';
    
    if (metric.value >= metric.threshold.critical) {
      return '#F44336';
    }
    if (metric.value >= metric.threshold.warning) {
      return '#FFC107';
    }
    return '#4CAF50';
  };

  const getTrendIcon = (trend?: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return '↑';
      case 'down':
        return '↓';
      case 'stable':
        return '→';
      default:
        return '';
    }
  };

  const renderMetric = (metric: Metric) => {
    const color = getStatusColor(metric);
    const trendIcon = showTrends ? getTrendIcon(metric.trend) : '';

    return (
      <div
        key={metric.name}
        className="metric-card"
        style={{
          padding: '1rem',
          margin: '0.5rem',
          borderRadius: '8px',
          backgroundColor: 'white',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          border: `1px solid ${color}`,
        }}
      >
        <div style={{ color: '#666', fontSize: '0.875rem' }}>
          {metric.name}
        </div>
        <div style={{ 
          fontSize: '1.5rem', 
          fontWeight: 'bold',
          color,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          {metric.value}
          <span style={{ fontSize: '1rem', color: '#666' }}>
            {metric.unit}
          </span>
          {trendIcon && (
            <span style={{ 
              fontSize: '1rem',
              color: metric.trend === 'up' ? '#F44336' : 
                     metric.trend === 'down' ? '#4CAF50' : '#666'
            }}>
              {trendIcon}
            </span>
          )}
        </div>
      </div>
    );
  };

  React.useEffect(() => {
    metrics.forEach(metric => {
      if (metric.threshold && 
          metric.value >= metric.threshold.warning && 
          onThresholdExceeded) {
        onThresholdExceeded(metric);
      }
    });
  }, [metrics, onThresholdExceeded]);

  return (
    <div
      style={{
        display: layout === 'grid' ? 'grid' : 'flex',
        gridTemplateColumns: layout === 'grid' ? 'repeat(auto-fill, minmax(200px, 1fr))' : undefined,
        flexDirection: layout === 'list' ? 'column' : undefined,
        gap: '1rem',
        padding: '1rem',
      }}
    >
      {metrics.map(renderMetric)}
    </div>
  );
};

export default MetricsDisplay; 