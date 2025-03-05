import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { MonitoringProvider } from './monitoring/MonitoringProvider';
import Layout from './components/Layout';
import MonitoringDashboard from './pages/MonitoringDashboard';
import HomePage from './pages/HomePage';
import './styles/components.css';

const App: React.FC = () => {
  return (
    <MonitoringProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/monitoring/*" element={<MonitoringDashboard />} />
          <Route path="/agents/list" element={<div className="coming-soon-panel">Agent List (Coming Soon)</div>} />
          <Route path="/agents/network" element={<div className="coming-soon-panel">Agent Network (Coming Soon)</div>} />
          <Route path="/tasks/queue" element={<div className="coming-soon-panel">Task Queue (Coming Soon)</div>} />
          <Route path="/tasks/history" element={<div className="coming-soon-panel">Task History (Coming Soon)</div>} />
        </Routes>
      </Layout>
    </MonitoringProvider>
  );
};

export default App; 