import { useState, useEffect } from 'react';
import type { Task } from '../types';

export function useTaskQueue() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;
    const interval = setInterval(async () => {
      try {
        const response = await fetch('/api/tasks');
        const data = await response.json();
        
        if (mounted) {
          setTasks(data);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Failed to fetch tasks'));
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }, 3000); // Poll every 3 seconds

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const addTask = async (task: Omit<Task, 'id' | 'createdAt' | 'progress'>) => {
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(task),
      });
      
      const newTask = await response.json();
      setTasks(current => [...current, newTask]);
      setError(null);
      return newTask;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to add task');
      setError(error);
      throw error;
    }
  };

  const updateTask = async (taskId: string, updates: Partial<Task>) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });
      
      const updatedTask = await response.json();
      setTasks(current =>
        current.map(task =>
          task.id === taskId ? { ...task, ...updatedTask } : task
        )
      );
      setError(null);
      return updatedTask;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to update task');
      setError(error);
      throw error;
    }
  };

  const removeTask = async (taskId: string) => {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
      });
      
      setTasks(current => current.filter(task => task.id !== taskId));
      setError(null);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to remove task');
      setError(error);
      throw error;
    }
  };

  return {
    tasks,
    loading,
    error,
    addTask,
    updateTask,
    removeTask,
  };
} 