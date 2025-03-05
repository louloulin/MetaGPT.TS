import React from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { useMonitoring } from '../monitoring/MonitoringProvider';
import PerformanceMonitor from '../monitoring/PerformanceMonitor';
import ThoughtVisualizer from '../monitoring/ThoughtVisualizer';
import DebugTools, { DebugAction } from '../monitoring/DebugTools';
import ErrorLogViewer from '../monitoring/ErrorLogViewer';
import '../styles/monitoring.css';

const MonitoringDashboard: React.FC = () => {
  const location = useLocation();
  const { state } = useMonitoring();

  // 检查当前路径以高亮显示当前活动项
  const isActive = (path: string) => {
    return location.pathname.endsWith(path) ? 'tab-active' : 'tab-inactive';
  };

  // 选项卡导航
  const TabNavigation = () => (
    <div className="tabs-container">
      <nav className="tabs-nav">
        <Link 
          to="/monitoring/performance" 
          className={`tab-item ${isActive('performance')} 
            ${location.pathname === '/monitoring' ? 'tab-active' : ''}`}
        >
          <span className="tab-content">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            </svg>
            系统性能
          </span>
        </Link>
        <Link 
          to="/monitoring/thoughts" 
          className={`tab-item ${isActive('thoughts')}`}
        >
          <span className="tab-content">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
            </svg>
            思考可视化
          </span>
        </Link>
        <Link 
          to="/monitoring/debug" 
          className={`tab-item ${isActive('debug')}`}
        >
          <span className="tab-content">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m18 8 4 4-4 4"/>
              <path d="m6 8-4 4 4 4"/>
              <path d="m14.5 4-5 16"/>
            </svg>
            调试工具
          </span>
        </Link>
        <Link 
          to="/monitoring/logs" 
          className={`tab-item ${isActive('logs')}`}
        >
          <span className="tab-content">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 3v4a1 1 0 0 0 1 1h4" />
              <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" />
              <line x1="9" y1="9" x2="10" y2="9" />
              <line x1="9" y1="13" x2="15" y2="13" />
              <line x1="9" y1="17" x2="15" y2="17" />
            </svg>
            错误日志
          </span>
        </Link>
      </nav>
    </div>
  );

  // 状态摘要卡片 - 使用新的样式类
  const StatusCard = ({ title, value, status }: { title: string; value: string; status: 'normal' | 'warning' | 'critical' }) => {
    let cardClass = "metric-card";
    
    if (status === 'critical') {
      cardClass += " critical";
    } else if (status === 'warning') {
      cardClass += " warning";
    }

    return (
      <div className={cardClass}>
        <h3 className="metric-card-title">{title}</h3>
        <div className="metric-card-content">
          <p className="metric-value">{value}</p>
          <span className={`status-badge ${status === 'normal' ? 'status-normal' : status === 'warning' ? 'status-warning' : 'status-critical'}`}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
        </div>
      </div>
    );
  };

  // 获取各指标状态
  const getCpuStatus = () => {
    const cpu = state.metrics.cpuUsage;
    if (cpu >= 90) return 'critical';
    if (cpu >= 70) return 'warning';
    return 'normal';
  };

  const getMemoryStatus = () => {
    const memory = state.metrics.memoryUsage;
    if (memory >= 95) return 'critical';
    if (memory >= 80) return 'warning';
    return 'normal';
  };

  const getNetworkStatus = () => {
    const network = state.metrics.networkLatency;
    if (network >= 500) return 'critical';
    if (network >= 200) return 'warning';
    return 'normal';
  };

  return (
    <div className="monitoring-dashboard">
      <div className="dashboard-header">
        <h1>监控仪表板</h1>
        <p className="dashboard-description">
          监控系统性能，可视化智能体思考，以及调试MetaGPT应用程序。
        </p>
      </div>

      <div className="dashboard-content">
        <TabNavigation />

        {/* 状态摘要 - 使用metric-summary类 */}
        <div className="metric-summary">
          <StatusCard 
            title="CPU 使用率" 
            value={`${state.metrics.cpuUsage.toFixed(1)}%`} 
            status={getCpuStatus()} 
          />
          <StatusCard 
            title="内存使用率" 
            value={`${state.metrics.memoryUsage.toFixed(1)}%`} 
            status={getMemoryStatus()} 
          />
          <StatusCard 
            title="网络延迟" 
            value={`${state.metrics.networkLatency.toFixed(0)}ms`} 
            status={getNetworkStatus()} 
          />
        </div>

        {/* 主要内容区域 */}
        <div className="monitoring-section">
          <Routes>
            <Route index element={
              <div className="visualization-container">
                <h2 className="section-title">系统性能概览</h2>
                <div className="chart-container chart-container-mb">
                  <PerformanceMonitor width={800} height={300} />
                </div>
                <div className="dashboard-overview">
                  <div className="overview-section">
                    <h3>活动智能体</h3>
                    <p className="overview-description">
                      当前活跃的智能体数量: <strong>{state.metrics.activeAgents}</strong>
                    </p>
                    <ul className="overview-list">
                      {state.agentActivities.slice(0, 3).map((activity, index) => (
                        <li key={index}>{activity.agentId || `Agent ${index + 1}`}</li>
                      ))}
                      {state.agentActivities.length > 3 && (
                        <li>+{state.agentActivities.length - 3} 更多...</li>
                      )}
                    </ul>
                  </div>
                  <div className="overview-section">
                    <h3>任务状态</h3>
                    <p className="overview-description">
                      当前队列中的任务: <strong>{state.metrics.totalTasks - state.metrics.completedTasks}</strong>
                    </p>
                    <ul className="overview-list">
                      {Object.entries(state.taskProgress).slice(0, 3).map(([taskId, task], index) => (
                        <li key={taskId}>Task {index + 1}: {Math.round((task.completed / task.total) * 100)}% 完成</li>
                      ))}
                      {Object.keys(state.taskProgress).length > 3 && (
                        <li>+{Object.keys(state.taskProgress).length - 3} 更多...</li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            } />
            <Route path="performance" element={
              <div className="visualization-container">
                <h2 className="section-title">系统性能指标</h2>
                <p className="section-description">
                  实时监控系统资源使用情况和性能指标趋势。
                </p>
                <div className="chart-container">
                  <PerformanceMonitor width={800} height={400} />
                </div>
              </div>
            } />
            <Route path="thoughts" element={
              <div className="visualization-container">
                <h2 className="section-title">智能体思考可视化</h2>
                <p className="section-description">
                  探索智能体的思考过程和决策链。
                </p>
                <ThoughtVisualizer />
              </div>
            } />
            <Route path="debug" element={
              <div className="debug-view">
                <h2 className="section-title">调试工具</h2>
                <p className="section-description">
                  使用这些工具进行故障排除、性能测试和智能体行为分析。
                </p>
                <DebugTools 
                  availableActions={['pause', 'resume', 'step', 'inspect', 'reset']}
                  onAction={(action: DebugAction) => {
                    console.log(`执行操作: ${action.type}`, { agentId: action.agentId, taskId: action.taskId });
                    return Promise.resolve();
                  }}
                />
              </div>
            } />
            <Route path="logs" element={
              <div className="debug-view">
                <h2 className="section-title">错误日志查看器</h2>
                <p className="section-description">
                  查看和分析系统中的错误和警告信息，帮助识别和解决问题。
                </p>
                <ErrorLogViewer 
                  title="系统错误日志"
                  height={500}
                  onErrorClick={(error) => {
                    console.log('查看错误详情:', error);
                  }}
                />
              </div>
            } />
          </Routes>
        </div>
      </div>
    </div>
  );
};

export default MonitoringDashboard; 