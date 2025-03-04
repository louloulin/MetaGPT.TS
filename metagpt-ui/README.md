# MetaGPT UI

React components and hooks for building MetaGPT user interfaces.

## Installation

```bash
npm install @metagpt/ui
# or
yarn add @metagpt/ui
# or
pnpm add @metagpt/ui
```

## Components

### AgentCard

A card component for displaying agent information and controls.

```tsx
import { AgentCard } from '@metagpt/ui';

function MyComponent() {
  const agent = {
    name: 'Agent 1',
    status: 'active',
    capabilities: ['text', 'code', 'math'],
    metrics: {
      tasksCompleted: 42,
      successRate: 95,
      avgResponseTime: 1200
    }
  };

  return (
    <AgentCard 
      agent={agent}
      onAction={(action) => console.log(action)}
    />
  );
}
```

### TaskQueue

A component for displaying and managing task queues.

```tsx
import { TaskQueue } from '@metagpt/ui';

function MyComponent() {
  const tasks = [
    {
      id: '1',
      type: 'code-review',
      priority: 'high',
      status: 'pending',
      progress: 0,
      createdAt: new Date(),
      assignedTo: 'Agent 1'
    }
  ];

  return (
    <TaskQueue 
      tasks={tasks}
      onTaskAction={(taskId, action) => console.log(taskId, action)}
    />
  );
}
```

## Hooks

### useAgentStatus

A hook for managing agent status.

```tsx
import { useAgentStatus } from '@metagpt/ui';

function MyComponent() {
  const { status, loading, error, updateStatus } = useAgentStatus('agent-1');

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!status) return null;

  return (
    <div>
      <h1>{status.name}</h1>
      <p>Status: {status.status}</p>
      <button onClick={() => updateStatus({ status: 'active' })}>
        Activate
      </button>
    </div>
  );
}
```

### useTaskQueue

A hook for managing task queues.

```tsx
import { useTaskQueue } from '@metagpt/ui';

function MyComponent() {
  const { tasks, loading, error, addTask, updateTask, removeTask } = useTaskQueue();

  const handleAddTask = () => {
    addTask({
      type: 'code-review',
      priority: 'high',
      status: 'pending',
      assignedTo: 'Agent 1'
    });
  };

  return (
    <div>
      <button onClick={handleAddTask}>Add Task</button>
      {tasks.map(task => (
        <div key={task.id}>
          <h2>{task.type}</h2>
          <p>Status: {task.status}</p>
          <button onClick={() => updateTask(task.id, { status: 'running' })}>
            Start
          </button>
          <button onClick={() => removeTask(task.id)}>
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}
```

## Development

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm run dev
```

3. Build for production:
```bash
npm run build
```

## License

MIT 