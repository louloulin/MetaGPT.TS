import React from 'react';
import { Link } from 'react-router-dom';
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
    </div>
  );
};

export default HomePage; 