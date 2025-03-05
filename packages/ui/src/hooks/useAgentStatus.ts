import { useState, useEffect } from 'react';
import type { AgentInfo } from '../types';

export function useAgentStatus(agentId: string) {
  const [status, setStatus] = useState<AgentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/agents/${agentId}`);
        const data = await response.json();
        
        if (mounted) {
          setStatus(data);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Failed to fetch agent status'));
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }, 5000); // Poll every 5 seconds

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [agentId]);

  const updateStatus = async (updates: Partial<AgentInfo>) => {
    try {
      const response = await fetch(`/api/agents/${agentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });
      
      const updatedStatus = await response.json();
      setStatus(updatedStatus);
      setError(null);
      return updatedStatus;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to update agent status');
      setError(error);
      throw error;
    }
  };

  return {
    status,
    loading,
    error,
    updateStatus,
  };
} 