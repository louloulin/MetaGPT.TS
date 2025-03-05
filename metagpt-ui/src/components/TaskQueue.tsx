import React from 'react';
import type { Task } from '../types/task';

interface TaskQueueProps {
  tasks: Task[];
  onTaskClick?: (task: Task) => void;
}

const TaskQueue: React.FC<TaskQueueProps> = ({ tasks, onTaskClick }) => {
  const getStatusColor = (status: Task['status']) => {
    switch (status) {
      case 'completed':
        return '#4CAF50';
      case 'failed':
        return '#F44336';
      case 'in_progress':
        return '#2196F3';
      default:
        return '#9E9E9E';
    }
  };

  const getPriorityColor = (priority: Task['priority']) => {
    switch (priority) {
      case 'high':
        return '#F44336';
      case 'medium':
        return '#FFC107';
      case 'low':
        return '#4CAF50';
    }
  };

  const handleTaskClick = (task: Task) => {
    if (onTaskClick) {
      onTaskClick(task);
    }
  };

  return (
    <div className="task-queue" style={{ padding: '1rem' }}>
      {tasks.map(task => (
        <div
          key={task.id}
          onClick={() => handleTaskClick(task)}
          style={{
            padding: '1rem',
            marginBottom: '0.5rem',
            borderRadius: '8px',
            backgroundColor: 'white',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            cursor: onTaskClick ? 'pointer' : 'default',
            borderLeft: `4px solid ${getPriorityColor(task.priority)}`,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 'bold' }}>{task.type}</div>
              <div style={{ fontSize: '0.875rem', color: '#666' }}>
                ID: {task.id}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div
                style={{
                  padding: '0.25rem 0.5rem',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                  backgroundColor: `${getStatusColor(task.status)}20`,
                  color: getStatusColor(task.status),
                }}
              >
                {task.status}
              </div>
              <div style={{ width: '40px', textAlign: 'right' }}>
                {task.progress}%
              </div>
            </div>
          </div>

          {task.assignedTo && (
            <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#666' }}>
              Assigned to: {task.assignedTo}
            </div>
          )}

          {task.error && (
            <div style={{ 
              marginTop: '0.5rem',
              padding: '0.5rem',
              backgroundColor: '#FFEBEE',
              color: '#D32F2F',
              borderRadius: '4px',
              fontSize: '0.875rem'
            }}>
              Error: {task.error}
            </div>
          )}

          <div style={{ 
            marginTop: '0.5rem',
            height: '4px',
            backgroundColor: '#E0E0E0',
            borderRadius: '2px'
          }}>
            <div
              style={{
                width: `${task.progress}%`,
                height: '100%',
                backgroundColor: getStatusColor(task.status),
                borderRadius: '2px',
                transition: 'width 0.3s ease'
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export default TaskQueue; 