import React from 'react';
import type { AgentInfo } from '../types/agent';

interface AgentCardProps {
  agent: AgentInfo;
  onClick?: (agent: AgentInfo) => void;
}

const AgentCard: React.FC<AgentCardProps> = ({ agent, onClick }) => {
  const handleClick = () => {
    if (onClick) {
      onClick(agent);
    }
  };

  return (
    <div
      className="agent-card"
      onClick={handleClick}
      style={{
        padding: '1rem',
        margin: '0.5rem',
        borderRadius: '8px',
        backgroundColor: 'white',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>{agent.name}</h3>
        <span
          style={{
            padding: '0.25rem 0.5rem',
            borderRadius: '4px',
            fontSize: '0.875rem',
            backgroundColor: agent.status === 'working' ? '#E3F2FD' :
                           agent.status === 'error' ? '#FFEBEE' : '#F5F5F5',
            color: agent.status === 'working' ? '#1976D2' :
                   agent.status === 'error' ? '#D32F2F' : '#757575',
          }}
        >
          {agent.status}
        </span>
      </div>

      <div style={{ marginTop: '1rem' }}>
        <div style={{ fontSize: '0.875rem', color: '#666' }}>
          Capabilities:
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
          {agent.capabilities.map((capability, index) => (
            <span
              key={index}
              style={{
                padding: '0.25rem 0.5rem',
                backgroundColor: '#F5F5F5',
                borderRadius: '4px',
                fontSize: '0.75rem',
              }}
            >
              {capability}
            </span>
          ))}
        </div>
      </div>

      <div style={{ marginTop: '1rem' }}>
        <div style={{ fontSize: '0.875rem', color: '#666' }}>
          Metrics:
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.5rem' }}>
          <div>Tasks: {agent.metrics.tasksCompleted}</div>
          <div>Success: {(agent.metrics.successRate * 100).toFixed(1)}%</div>
          <div>Avg Time: {agent.metrics.averageResponseTime}ms</div>
          <div>Memory: {agent.metrics.memoryUsage}MB</div>
        </div>
      </div>
    </div>
  );
};

export default AgentCard; 