import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import MonitoringDashboard from './pages/MonitoringDashboard';

const AppRoutes: React.FC = () => {
  return (
    <Router>
      <div>
        <nav className="main-nav">
          <ul>
            <li>
              <Link to="/">Home</Link>
            </li>
            <li>
              <Link to="/monitoring">Monitoring</Link>
            </li>
          </ul>
        </nav>

        <Routes>
          <Route path="/" element={<div>Home Page</div>} />
          <Route path="/monitoring" element={<MonitoringDashboard />} />
        </Routes>

        <style>
          {`
            .main-nav {
              background-color: #1976D2;
              padding: 1rem;
            }

            .main-nav ul {
              list-style: none;
              margin: 0;
              padding: 0;
              display: flex;
              gap: 2rem;
            }

            .main-nav a {
              color: white;
              text-decoration: none;
              font-weight: 500;
              padding: 0.5rem 1rem;
              border-radius: 4px;
              transition: background-color 0.3s ease;
            }

            .main-nav a:hover {
              background-color: rgba(255, 255, 255, 0.1);
            }
          `}
        </style>
      </div>
    </Router>
  );
};

export default AppRoutes; 