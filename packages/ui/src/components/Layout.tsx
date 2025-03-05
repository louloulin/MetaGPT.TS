import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { MonitorIcon, NetworkIcon, ListIcon, HistoryIcon, HomeIcon } from 'lucide-react';
import '../styles/layout.css';

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

const NavItem: React.FC<NavItemProps> = ({ to, icon, children }) => {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Button
      variant={isActive ? "secondary" : "ghost"}
      className={cn(
        "nav-button",
        isActive && "nav-button-active"
      )}
      asChild
    >
      <Link to={to}>
        {React.cloneElement(icon as React.ReactElement, {
          className: "nav-icon"
        })}
        {children}
      </Link>
    </Button>
  );
};

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="app-container">
      <div className="layout-container">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-header">
            <h2 className="app-title">MetaGPT UI</h2>
          </div>
          <nav className="sidebar-nav">
            <NavItem to="/" icon={<HomeIcon />}>Home</NavItem>
            <div className="nav-section">
              <h3 className="nav-section-title">Monitoring</h3>
              <div className="nav-items-group">
                <NavItem to="/monitoring/performance" icon={<MonitorIcon />}>Performance</NavItem>
                <NavItem to="/monitoring/thoughts" icon={<NetworkIcon />}>Thoughts</NavItem>
                <NavItem to="/monitoring/debug" icon={<ListIcon />}>Debug</NavItem>
              </div>
            </div>
            <div className="nav-section">
              <h3 className="nav-section-title">Agents</h3>
              <div className="nav-items-group">
                <NavItem to="/agents/list" icon={<ListIcon />}>Agent List</NavItem>
                <NavItem to="/agents/network" icon={<NetworkIcon />}>Agent Network</NavItem>
              </div>
            </div>
            <div className="nav-section">
              <h3 className="nav-section-title">Tasks</h3>
              <div className="nav-items-group">
                <NavItem to="/tasks/queue" icon={<ListIcon />}>Task Queue</NavItem>
                <NavItem to="/tasks/history" icon={<HistoryIcon />}>Task History</NavItem>
              </div>
            </div>
          </nav>
        </aside>

        {/* Main content */}
        <main className="main-content">
          <div className="content-container">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout; 