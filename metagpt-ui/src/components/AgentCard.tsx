import React from 'react';
import type { AgentInfo } from '../types';

interface AgentCardProps {
  agent: AgentInfo;
  onAction?: (action: 'start' | 'stop' | 'restart') => void;
}

export const AgentCard: React.FC<AgentCardProps> = ({ agent, onAction }) => {
  const statusColors = {
    active: 'bg-green-100 text-green-800',
    inactive: 'bg-gray-100 text-gray-800',
    busy: 'bg-yellow-100 text-yellow-800'
  };

  return (
    <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg">{agent.name}</h3>
        <span className={`px-2 py-1 rounded text-xs ${statusColors[agent.status]}`}>
          {agent.status}
        </span>
      </div>

      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-medium text-gray-500 mb-2">Capabilities</h4>
          <div className="flex flex-wrap gap-2">
            {agent.capabilities.map((capability, index) => (
              <span
                key={index}
                className="bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded"
              >
                {capability}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-500">Tasks Completed</p>
            <p className="font-semibold">{agent.metrics.tasksCompleted}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Success Rate</p>
            <p className="font-semibold">{agent.metrics.successRate}%</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Avg Response</p>
            <p className="font-semibold">{agent.metrics.avgResponseTime}ms</p>
          </div>
        </div>

        {onAction && (
          <div className="flex space-x-2 mt-4">
            {agent.status === 'inactive' && (
              <button
                onClick={() => onAction('start')}
                className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600"
              >
                Start
              </button>
            )}
            {agent.status === 'active' && (
              <button
                onClick={() => onAction('stop')}
                className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
              >
                Stop
              </button>
            )}
            <button
              onClick={() => onAction('restart')}
              className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
            >
              Restart
            </button>
          </div>
        )}
      </div>
    </div>
  );
}; 