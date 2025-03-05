import React, { useState } from 'react';
import { useMonitoring } from './MonitoringProvider';
import ErrorLogViewer from './ErrorLogViewer';
import PerformanceMonitor from './PerformanceMonitor';
import ThoughtVisualizer from './ThoughtVisualizer';
import DebugTools from './DebugTools';
import '../styles/monitoring.css';

interface MonitoringDashboardProps {
  initialTab?: 'performance' | 'errors' | 'thoughts' | 'debug';
}

const MonitoringDashboard: React.FC<MonitoringDashboardProps> = ({
  initialTab = 'performance',
}) => {
  const [activeTab, setActiveTab] = useState(initialTab);
  const { state } = useMonitoring();
  
  // 计算错误提示标记
  const errorCount = state.errors.length;
  const hasErrors = errorCount > 0;

  // 计算性能提醒标记
  const highCpuUsage = state.metrics.cpuUsage > 80;
  const highMemoryUsage = state.metrics.memoryUsage > 80;
  const highNetworkLatency = state.metrics.networkLatency > 150;
  const hasPerformanceIssues = highCpuUsage || highMemoryUsage || highNetworkLatency;
  
  return (
    <div className="monitoring-dashboard">
      <div className="monitoring-header">
        <h2>系统监控与可视化</h2>
        <div className="system-status">
          <span className={`status-indicator ${hasPerformanceIssues ? 'status-warning' : 'status-normal'}`}>
            系统状态: {hasPerformanceIssues ? '需要注意' : '正常'}
          </span>
          <span className="metrics-summary">
            CPU: {state.metrics.cpuUsage.toFixed(1)}% | 
            内存: {state.metrics.memoryUsage.toFixed(1)}% | 
            延迟: {state.metrics.networkLatency.toFixed(0)}ms
          </span>
        </div>
      </div>
      
      <div className="tabs-nav">
        <button 
          className={`tab-item ${activeTab === 'performance' ? 'tab-active' : 'tab-inactive'} ${hasPerformanceIssues ? 'status-warning' : ''}`}
          onClick={() => setActiveTab('performance')}
        >
          性能监控
          {hasPerformanceIssues && <span className="status-badge">!</span>}
        </button>
        <button 
          className={`tab-item ${activeTab === 'errors' ? 'tab-active' : 'tab-inactive'} ${hasErrors ? 'status-critical' : ''}`}
          onClick={() => setActiveTab('errors')}
        >
          错误日志
          {hasErrors && <span className="status-badge">{errorCount}</span>}
        </button>
        <button 
          className={`tab-item ${activeTab === 'thoughts' ? 'tab-active' : 'tab-inactive'}`}
          onClick={() => setActiveTab('thoughts')}
        >
          思维可视化
        </button>
        <button 
          className={`tab-item ${activeTab === 'debug' ? 'tab-active' : 'tab-inactive'}`}
          onClick={() => setActiveTab('debug')}
        >
          调试工具
        </button>
      </div>
      
      <div className="tab-content">
        {activeTab === 'performance' && (
          <PerformanceMonitor />
        )}
        {activeTab === 'errors' && (
          <ErrorLogViewer 
            maxErrors={100}
            title="系统错误日志"
            height={500}
          />
        )}
        {activeTab === 'thoughts' && (
          <ThoughtVisualizer />
        )}
        {activeTab === 'debug' && (
          <DebugTools />
        )}
      </div>
      
      <div className="monitoring-footer">
        <div className="agent-summary">
          活跃代理: {state.metrics.activeAgents} | 
          任务进度: {state.metrics.completedTasks}/{state.metrics.totalTasks} |
          错误率: {state.metrics.errorRate.toFixed(2)}%
        </div>
        <div className="refresh-controls">
          <button className="refresh-button" onClick={() => window.location.reload()}>
            刷新面板
          </button>
        </div>
      </div>
    </div>
  );
};

export default MonitoringDashboard; 