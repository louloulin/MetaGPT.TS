import React, { useState } from 'react';
import { MonitoringProvider } from '../monitoring/MonitoringProvider';
import MonitoringDashboard from '../monitoring/MonitoringDashboard';
import '../styles/monitoring.css';

interface MonitoringPanelProps {
  isCollapsed?: boolean;
  initialTab?: 'performance' | 'errors' | 'thoughts' | 'debug';
  pollInterval?: number;
  errorGenerationInterval?: number;
}

/**
 * 监控面板组件，作为监控系统的主入口
 * 可以集成到应用的任何部分，提供折叠/展开功能
 */
const MonitoringPanel: React.FC<MonitoringPanelProps> = ({ 
  isCollapsed: initialCollapsed = false,
  initialTab = 'performance',
  pollInterval = 5000,
  errorGenerationInterval = 15000,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);

  return (
    <div className={`monitoring-panel ${isCollapsed ? 'collapsed' : 'expanded'}`}>
      <div className="panel-header">
        <h3>MetaGPT 监控中心</h3>
        <button 
          className="toggle-button"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? '展开' : '折叠'}
        </button>
      </div>
      
      {!isCollapsed && (
        <div className="panel-content">
          <MonitoringProvider 
            pollInterval={pollInterval}
            errorGenerationInterval={errorGenerationInterval}
            initialErrors={3}
          >
            <MonitoringDashboard initialTab={initialTab} />
          </MonitoringProvider>
        </div>
      )}
      
      {isCollapsed && (
        <div className="panel-collapsed-info">
          <p>监控系统已折叠，点击"展开"按钮查看详情</p>
        </div>
      )}
    </div>
  );
};

export default MonitoringPanel; 