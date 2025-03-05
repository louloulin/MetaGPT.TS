import React, { useState } from 'react';
import { useMonitoring } from './MonitoringProvider';

export interface DebugAction {
  type: 'pause' | 'resume' | 'step' | 'inspect' | 'reset' | 'custom';
  payload?: any;
  timestamp: Date;
  agentId?: string;
  taskId?: string;
}

export interface DebugToolsProps {
  onAction?: (action: DebugAction) => Promise<any>;
  availableActions?: ('pause' | 'resume' | 'step' | 'inspect' | 'reset' | 'custom')[];
}

const DebugTools: React.FC<DebugToolsProps> = ({
  onAction,
  availableActions = ['pause', 'resume', 'step', 'inspect', 'reset'],
}) => {
  const { state } = useMonitoring();
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [selectedTask, setSelectedTask] = useState<string>('');
  const [customCommand, setCustomCommand] = useState<string>('');
  const [inspectionData, setInspectionData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [actionHistory, setActionHistory] = useState<DebugAction[]>([]);

  // 提取可用代理和任务
  const agents = Array.from(
    new Set(state.agentActivities.map((activity) => activity.agentId))
  );
  
  const tasks = selectedAgent
    ? Array.from(
        new Set(
          state.agentActivities
            .filter((activity) => activity.agentId === selectedAgent)
            .map((activity) => activity.details?.taskId || 'default')
        )
      )
    : [];

  // 处理调试操作
  const handleAction = async (actionType: DebugAction['type']) => {
    setError(null);
    setIsLoading(true);
    
    try {
      const action: DebugAction = {
        type: actionType,
        timestamp: new Date(),
        agentId: selectedAgent || undefined,
        taskId: selectedTask || undefined,
        payload: actionType === 'custom' ? customCommand : undefined,
      };
      
      // 添加到历史记录
      setActionHistory((prev) => [action, ...prev].slice(0, 10));
      
      if (onAction) {
        const result = await onAction(action);
        if (actionType === 'inspect') {
          setInspectionData(result);
        }
      } else {
        console.log('Debug action executed:', action);
        // 默认行为，只记录到控制台
      }
    } catch (err) {
      setError(`Error executing action: ${err instanceof Error ? err.message : String(err)}`);
      console.error('Debug action error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // 为按钮提供颜色
  const getButtonColorClass = (actionType: DebugAction['type']) => {
    switch (actionType) {
      case 'pause': return 'bg-[#fef3c7] text-[#92400e] hover:bg-[#fde68a]';
      case 'resume': return 'bg-[#dcfce7] text-[#166534] hover:bg-[#bbf7d0]';
      case 'step': return 'bg-[#fef9c3] text-[#854d0e] hover:bg-[#fef08a]';
      case 'inspect': return 'bg-[#dbeafe] text-[#1e40af] hover:bg-[#bfdbfe]';
      case 'reset': return 'bg-[#fee2e2] text-[#b91c1c] hover:bg-[#fecaca]';
      case 'custom': return 'bg-[#f3e8ff] text-[#6b21a8] hover:bg-[#e9d5ff]';
      default: return 'bg-[#f0f1f3] text-[#374151] hover:bg-[#e5e7eb]';
    }
  };

  // 为按钮提供图标
  const renderActionIcon = (actionType: DebugAction['type']) => {
    switch (actionType) {
      case 'pause':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
          </svg>
        );
      case 'resume':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        );
      case 'step':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        );
      case 'inspect':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        );
      case 'reset':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 2v6h6" />
            <path d="M3 13a9 9 0 1 0 3-7.7L3 8" />
          </svg>
        );
      case 'custom':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m18 16 4-4-4-4" />
            <path d="m6 8-4 4 4 4" />
            <path d="m14.5 4-5 16" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className="debug-tools w-full">
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-4">Debug Controls</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* 代理选择 */}
          <div className="bg-[#ffffff] p-4 rounded-lg shadow-sm">
            <h3 className="text-md font-medium mb-2">Target Selection</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Agent</label>
                <select
                  value={selectedAgent}
                  onChange={(e) => setSelectedAgent(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="">All Agents</option>
                  {agents.map((agent) => (
                    <option key={agent} value={agent}>
                      {agent}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Task</label>
                <select
                  value={selectedTask}
                  onChange={(e) => setSelectedTask(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md text-sm"
                  disabled={!selectedAgent}
                >
                  <option value="">All Tasks</option>
                  {tasks.map((task, index) => (
                    <option key={`task-${index}`} value={task}>
                      {task}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          
          {/* 系统状态 */}
          <div className="bg-[#ffffff] p-4 rounded-lg shadow-sm">
            <h3 className="text-md font-medium mb-2">System Status</h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="text-sm">
                <span className="font-medium text-gray-500">Execution:</span>
                <span className="ml-2">
                  <span className="text-green-600 font-medium">Running</span>
                </span>
              </div>
              <div className="text-sm">
                <span className="font-medium text-gray-500">Active Agents:</span>
                <span className="ml-2 font-medium">{agents.length}</span>
              </div>
              <div className="text-sm">
                <span className="font-medium text-gray-500">Activities:</span>
                <span className="ml-2 font-medium">{state.agentActivities.length}</span>
              </div>
              <div className="text-sm">
                <span className="font-medium text-gray-500">Memory Usage:</span>
                <span className="ml-2 font-medium">{state.metrics.memoryUsage.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* 操作按钮 */}
        <div className="bg-[#ffffff] p-4 rounded-lg shadow-sm mb-6">
          <h3 className="text-md font-medium mb-3">Actions</h3>
          <div className="flex flex-wrap gap-2">
            {availableActions.map((action) => (
              <button
                key={action}
                onClick={() => handleAction(action)}
                disabled={isLoading}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium ${getButtonColorClass(action)}`}
              >
                {renderActionIcon(action)}
                {action.charAt(0).toUpperCase() + action.slice(1)}
              </button>
            ))}
          </div>
          
          {availableActions.includes('custom') && (
            <div className="mt-4">
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={customCommand}
                  onChange={(e) => setCustomCommand(e.target.value)}
                  placeholder="Enter custom debug command"
                  className="flex-1 p-2 border border-gray-300 rounded-md text-sm"
                />
                <button
                  onClick={() => handleAction('custom')}
                  disabled={isLoading || !customCommand.trim()}
                  className={`px-3 py-2 rounded-md text-sm font-medium flex items-center justify-center ${
                    !customCommand.trim() ? 'bg-[#f0f1f3] text-[#9ca3af]' : getButtonColorClass('custom')
                  }`}
                >
                  {renderActionIcon('custom')}
                  <span className="ml-2">Execute</span>
                </button>
              </div>
            </div>
          )}
        </div>
        
        {/* 错误显示 */}
        {error && (
          <div className="bg-[#fee2e2] border border-[#fecaca] text-[#b91c1c] p-4 rounded-lg mb-6">
            <h3 className="text-md font-medium mb-1">Error</h3>
            <p className="text-sm">{error}</p>
          </div>
        )}
        
        {/* 检查结果 */}
        {inspectionData && (
          <div className="bg-[#ffffff] p-4 rounded-lg shadow-sm mb-6">
            <h3 className="text-md font-medium mb-2">Inspection Results</h3>
            <pre className="p-3 bg-[#f9fafb] rounded text-sm overflow-auto max-h-48">
              {typeof inspectionData === 'object'
                ? JSON.stringify(inspectionData, null, 2)
                : String(inspectionData)}
            </pre>
          </div>
        )}
        
        {/* 操作历史记录 */}
        {actionHistory.length > 0 && (
          <div className="bg-[#ffffff] p-4 rounded-lg shadow-sm">
            <h3 className="text-md font-medium mb-2">Action History</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-[#f9fafb]">
                    <th className="px-3 py-2 text-left text-gray-500 font-medium">Time</th>
                    <th className="px-3 py-2 text-left text-gray-500 font-medium">Action</th>
                    <th className="px-3 py-2 text-left text-gray-500 font-medium">Target</th>
                    <th className="px-3 py-2 text-left text-gray-500 font-medium">Payload</th>
                  </tr>
                </thead>
                <tbody>
                  {actionHistory.map((action, index) => (
                    <tr key={index} className={index % 2 === 0 ? 'bg-[#f9fafb]' : 'bg-[#ffffff]'}>
                      <td className="px-3 py-2">{action.timestamp.toLocaleTimeString()}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-1 rounded-full text-xs ${getButtonColorClass(action.type)}`}>
                          {action.type}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {action.agentId ? `${action.agentId}${action.taskId ? `:${action.taskId}` : ''}` : 'All'}
                      </td>
                      <td className="px-3 py-2 font-mono">
                        {action.payload ? 
                          (typeof action.payload === 'object' ? 
                            JSON.stringify(action.payload).substring(0, 30) : 
                            String(action.payload).substring(0, 30)) : 
                          '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DebugTools; 