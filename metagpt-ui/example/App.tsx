import React from 'react';
import { AgentCard, TaskQueue, useAgentStatus, useTaskQueue } from '../src';

export function App() {
  const { status: agent1Status } = useAgentStatus('agent-1');
  const { tasks, addTask, updateTask, removeTask } = useTaskQueue();

  const handleAgentAction = (action: 'start' | 'stop' | 'restart') => {
    console.log('Agent action:', action);
  };

  const handleTaskAction = (taskId: string, action: 'cancel' | 'retry' | 'prioritize') => {
    switch (action) {
      case 'cancel':
        removeTask(taskId);
        break;
      case 'retry':
        updateTask(taskId, { status: 'pending', progress: 0 });
        break;
      case 'prioritize':
        updateTask(taskId, { priority: 'high' });
        break;
    }
  };

  const handleAddTask = () => {
    addTask({
      type: 'code-review',
      priority: 'medium',
      status: 'pending',
      assignedTo: 'agent-1'
    });
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-8">MetaGPT Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h2 className="text-xl font-semibold mb-4">Agents</h2>
          {agent1Status && (
            <AgentCard
              agent={agent1Status}
              onAction={handleAgentAction}
            />
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Tasks</h2>
            <button
              onClick={handleAddTask}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Add Task
            </button>
          </div>
          <TaskQueue
            tasks={tasks}
            onTaskAction={handleTaskAction}
          />
        </div>
      </div>
    </div>
  );
} 