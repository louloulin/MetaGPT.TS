import React from 'react';
import { Link } from 'react-router-dom';
import MonitoringPanel from '../components/MonitoringPanel';
import '../styles/home.css';

const HomePage: React.FC = () => {
  return (
    <div className="home-page">
      <div className="welcome-section">
        <h1 className="welcome-title">Welcome to MetaGPT UI</h1>
        <p className="welcome-description">
          A powerful interface for monitoring and managing your MetaGPT agents and tasks.
        </p>
      </div>

      <div className="quick-links">
        <div className="link-section">
          <h2 className="link-title link-title-blue">Monitoring</h2>
          <ul className="link-list">
            <li>
              <Link to="/monitoring/performance" className="link-blue">
                Performance Metrics
              </Link>
            </li>
            <li>
              <Link to="/monitoring/thoughts" className="link-blue">
                Thought Visualization
              </Link>
            </li>
            <li>
              <Link to="/monitoring/debug" className="link-blue">
                Debug Tools
              </Link>
            </li>
          </ul>
        </div>

        <div className="link-section">
          <h2 className="link-title link-title-green">Agents</h2>
          <ul className="link-list">
            <li>
              <Link to="/agents/list" className="link-green">
                Agent List
              </Link>
            </li>
            <li>
              <Link to="/agents/network" className="link-green">
                Agent Network
              </Link>
            </li>
          </ul>
        </div>

        <div className="link-section">
          <h2 className="link-title link-title-purple">Tasks</h2>
          <ul className="link-list">
            <li>
              <Link to="/tasks/queue" className="link-purple">
                Task Queue
              </Link>
            </li>
            <li>
              <Link to="/tasks/history" className="link-purple">
                Task History
              </Link>
            </li>
          </ul>
        </div>
      </div>
      
      {/* 添加监控面板 */}
      <div className="home-monitoring-section">
        <h2 className="section-title">实时监控状态</h2>
        <p className="section-description">
          下面的面板显示系统的实时监控数据，包括性能指标、错误日志和代理活动。
        </p>
        <MonitoringPanel 
          isCollapsed={false} 
          initialTab="performance" 
          pollInterval={5000}
          errorGenerationInterval={20000}
        />
      </div>
    </div>
  );
};

export default HomePage; 