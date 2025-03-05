import React, { useEffect, useRef, useState } from 'react';
import { useMonitoring } from './MonitoringProvider';

interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  history: Array<{ timestamp: Date; value: number }>;
  threshold?: {
    warning: number;
    critical: number;
  };
}

interface PerformanceMonitorProps {
  width?: number;
  height?: number;
  metrics?: PerformanceMetric[];
  historyLength?: number;
  refreshInterval?: number;
}

const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  width = 800,
  height = 400,
  metrics: externalMetrics,
  historyLength = 60,
  refreshInterval = 1000,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width, height });
  const { state } = useMonitoring();

  const defaultMetrics: PerformanceMetric[] = [
    {
      name: 'CPU Usage',
      value: state.metrics.cpuUsage,
      unit: '%',
      history: [],
      threshold: {
        warning: 70,
        critical: 90,
      },
    },
    {
      name: 'Memory Usage',
      value: state.metrics.memoryUsage,
      unit: '%',
      history: [],
      threshold: {
        warning: 80,
        critical: 95,
      },
    },
    {
      name: 'Network Latency',
      value: state.metrics.networkLatency,
      unit: 'ms',
      history: [],
      threshold: {
        warning: 200,
        critical: 500,
      },
    },
  ];

  const metrics = externalMetrics || defaultMetrics.map(metric => ({
    ...metric,
    value: metric.name === 'CPU Usage' ? state.metrics.cpuUsage :
           metric.name === 'Memory Usage' ? state.metrics.memoryUsage :
           metric.name === 'Network Latency' ? state.metrics.networkLatency : 0
  }));

  // 处理响应式布局
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const { width: containerWidth } = containerRef.current.getBoundingClientRect();
        setContainerSize({
          width: containerWidth,
          height: containerWidth * (height / width)
        });
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [width, height]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const drawChart = () => {
      const { width, height } = containerSize;
      ctx.clearRect(0, 0, width, height);

      const padding = 50;
      const chartWidth = width - padding * 2;
      const chartHeight = height - padding * 2;

      // 绘制背景和边框
      ctx.fillStyle = '#f8f9fa';
      ctx.fillRect(padding, padding, chartWidth, chartHeight);
      ctx.strokeStyle = '#dee2e6';
      ctx.lineWidth = 1;
      ctx.strokeRect(padding, padding, chartWidth, chartHeight);

      // 绘制网格
      ctx.strokeStyle = '#e9ecef';
      ctx.lineWidth = 1;

      // 横向网格线
      for (let i = 0; i <= 10; i++) {
        const y = padding + (chartHeight * i) / 10;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
        ctx.stroke();

        // 绘制刻度
        ctx.fillStyle = '#6c757d';
        ctx.font = '12px Arial';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${100 - i * 10}%`, padding - 10, y);
      }

      // 纵向网格线
      const timeStep = chartWidth / (historyLength - 1);
      for (let i = 0; i < historyLength; i++) {
        const x = padding + i * timeStep;
        ctx.beginPath();
        ctx.moveTo(x, padding);
        ctx.lineTo(x, height - padding);
        ctx.stroke();

        // 每5个点绘制一个时间刻度
        if (i % 5 === 0) {
          const time = new Date(Date.now() - (historyLength - 1 - i) * refreshInterval);
          ctx.fillStyle = '#6c757d';
          ctx.font = '12px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillText(
            time.toLocaleTimeString().split(':').slice(1).join(':'),
            x,
            height - padding + 5
          );
        }
      }

      // 绘制标题和时间轴标签
      ctx.fillStyle = '#343a40';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('System Performance Metrics', width / 2, 15);

      ctx.font = '12px Arial';
      ctx.fillText('Time', width / 2, height - 15);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.save();
      ctx.translate(15, height / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText('Value', 0, 0);
      ctx.restore();

      // 绘制数据线
      metrics.forEach((metric, index) => {
        const colorPalette = [
          { line: '#4361ee', fill: 'rgba(67, 97, 238, 0.1)' },
          { line: '#3a0ca3', fill: 'rgba(58, 12, 163, 0.1)' },
          { line: '#7209b7', fill: 'rgba(114, 9, 183, 0.1)' },
        ];
        const color = colorPalette[index % colorPalette.length];

        ctx.strokeStyle = color.line;
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';

        // 绘制填充区域
        ctx.beginPath();
        metric.history.forEach((point, i) => {
          const x = padding + i * timeStep;
          const normalizedValue = Math.min(100, point.value); // 确保值不超过100
          const y = padding + chartHeight * (1 - normalizedValue / 100);
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        });

        // 如果有历史数据，完成填充区域
        if (metric.history.length > 0) {
          const lastX = padding + (metric.history.length - 1) * timeStep;
          ctx.lineTo(lastX, padding + chartHeight);
          ctx.lineTo(padding, padding + chartHeight);
          ctx.fillStyle = color.fill;
          ctx.fill();
        }

        // 重新绘制线条，确保线条在填充之上
        ctx.beginPath();
        metric.history.forEach((point, i) => {
          const x = padding + i * timeStep;
          const normalizedValue = Math.min(100, point.value);
          const y = padding + chartHeight * (1 - normalizedValue / 100);
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        });
        ctx.stroke();

        // 绘制当前值点
        if (metric.history.length > 0) {
          const lastPoint = metric.history[metric.history.length - 1];
          const x = padding + (metric.history.length - 1) * timeStep;
          const normalizedValue = Math.min(100, lastPoint.value);
          const y = padding + chartHeight * (1 - normalizedValue / 100);
          
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, 2 * Math.PI);
          ctx.fillStyle = color.line;
          ctx.fill();
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        // 绘制图例
        const legendX = padding + 10;
        const legendY = padding + 25 + index * 25;
        ctx.fillStyle = color.line;
        ctx.fillRect(legendX, legendY - 8, 20, 3);
        
        // 根据阈值设置文本颜色
        let textColor = '#212529';
        if (metric.threshold) {
          if (metric.value >= metric.threshold.critical) {
            textColor = '#dc3545';
          } else if (metric.value >= metric.threshold.warning) {
            textColor = '#fd7e14';
          }
        }
        
        ctx.fillStyle = textColor;
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(
          `${metric.name}: ${metric.value.toFixed(2)}${metric.unit}`,
          legendX + 30,
          legendY - 6
        );
      });
    };

    // 更新数据历史
    const updateHistory = () => {
      // 更新指标值
      metrics.forEach(metric => {
        if (metric.name === 'CPU Usage') {
          metric.value = state.metrics.cpuUsage;
        } else if (metric.name === 'Memory Usage') {
          metric.value = state.metrics.memoryUsage;
        } else if (metric.name === 'Network Latency') {
          metric.value = state.metrics.networkLatency;
        }

        metric.history.push({
          timestamp: new Date(),
          value: metric.value,
        });
        if (metric.history.length > historyLength) {
          metric.history.shift();
        }
      });
      drawChart();
    };

    const intervalId = setInterval(updateHistory, refreshInterval);
    updateHistory(); // 立即执行一次

    return () => clearInterval(intervalId);
  }, [metrics, containerSize, historyLength, refreshInterval, state.metrics]);

  return (
    <div 
      ref={containerRef} 
      className="performance-monitor w-full"
      style={{ maxWidth: width }}
    >
      <canvas
        ref={canvasRef}
        width={containerSize.width}
        height={containerSize.height}
        style={{ 
          width: '100%', 
          height: 'auto',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          borderRadius: '8px'
        }}
      />
    </div>
  );
};

export default PerformanceMonitor; 