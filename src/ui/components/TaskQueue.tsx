import React from 'react';

interface Task {
  id: string;
  type: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  createdAt: Date;
  assignedTo?: string;
}

interface TaskQueueProps {
  tasks: Task[];
  onTaskAction?: (taskId: string, action: 'cancel' | 'retry' | 'prioritize') => void;
}

export const TaskQueue: React.FC<TaskQueueProps> = ({ tasks, onTaskAction }) => {
  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800',
    running: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800'
  };

  const priorityColors = {
    high: 'text-red-600',
    medium: 'text-yellow-600',
    low: 'text-green-600'
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-gray-50 px-4 py-2 border-b">
        <h3 className="font-semibold">Task Queue</h3>
      </div>
      
      <div className="divide-y">
        {tasks.map(task => (
          <div key={task.id} className="p-4 hover:bg-gray-50">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <span className={`px-2 py-1 rounded text-xs ${statusColors[task.status]}`}>
                  {task.status}
                </span>
                <span className={`font-medium ${priorityColors[task.priority]}`}>
                  {task.type}
                </span>
              </div>
              <span className="text-sm text-gray-500">
                {task.createdAt.toLocaleTimeString()}
              </span>
            </div>

            {task.status === 'running' && (
              <div className="w-full bg-gray-200 rounded h-2 mb-2">
                <div
                  className="bg-blue-500 h-2 rounded"
                  style={{ width: `${task.progress}%` }}
                />
              </div>
            )}

            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">
                {task.assignedTo ? `Assigned to: ${task.assignedTo}` : 'Unassigned'}
              </span>
              
              {onTaskAction && (
                <div className="flex space-x-2">
                  {task.status === 'pending' && (
                    <button
                      onClick={() => onTaskAction(task.id, 'prioritize')}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      Prioritize
                    </button>
                  )}
                  {['pending', 'running'].includes(task.status) && (
                    <button
                      onClick={() => onTaskAction(task.id, 'cancel')}
                      className="text-red-600 hover:text-red-800"
                    >
                      Cancel
                    </button>
                  )}
                  {task.status === 'failed' && (
                    <button
                      onClick={() => onTaskAction(task.id, 'retry')}
                      className="text-green-600 hover:text-green-800"
                    >
                      Retry
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}; 