import React, { useState } from 'react';
import { useMonitoring } from './MonitoringProvider';
import { MonitoringError } from './types';
import '../styles/monitoring.css';

export interface ErrorLogViewerProps {
  maxErrors?: number;
  title?: string;
  onErrorClick?: (error: MonitoringError) => void;
  height?: number;
  filterByAgent?: string;
  filterByTask?: string;
}

/**
 * 错误日志查看器组件 - 展示系统中的错误日志
 */
const ErrorLogViewer: React.FC<ErrorLogViewerProps> = ({
  maxErrors = 100,
  title = '错误日志',
  onErrorClick,
  height = 400,
  filterByAgent,
  filterByTask,
}) => {
  const { state, clearErrors } = useMonitoring();
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedError, setSelectedError] = useState<MonitoringError | null>(null);

  // 过滤并排序错误
  const filteredErrors = state.errors
    .filter((error) => {
      // 根据搜索词过滤
      if (
        searchTerm &&
        !error.message.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !error.type.toLowerCase().includes(searchTerm.toLowerCase())
      ) {
        return false;
      }

      // 根据选定的类型过滤
      if (selectedType && error.type !== selectedType) {
        return false;
      }

      // 根据代理过滤
      if (filterByAgent && error.agentId !== filterByAgent) {
        return false;
      }

      // 根据任务过滤
      if (filterByTask && error.taskId !== filterByTask) {
        return false;
      }

      return true;
    })
    // 按时间排序
    .sort((a, b) => {
      if (sortOrder === 'newest') {
        return b.timestamp.getTime() - a.timestamp.getTime();
      } else {
        return a.timestamp.getTime() - b.timestamp.getTime();
      }
    })
    // 限制数量
    .slice(0, maxErrors);

  // 提取所有错误类型以供过滤
  const errorTypes = Array.from(new Set(state.errors.map((e) => e.type)));

  // 处理错误点击
  const handleErrorClick = (error: MonitoringError) => {
    setSelectedError(error);
    if (onErrorClick) {
      onErrorClick(error);
    }
  };

  // 格式化时间戳
  const formatTimestamp = (date: Date): string => {
    return new Intl.DateTimeFormat('default', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(date);
  };

  // 获取错误类型对应的样式类名
  const getErrorTypeClass = (type: string): string => {
    switch (type.toLowerCase()) {
      case 'critical':
        return 'error-type-critical';
      case 'warning':
        return 'error-type-warning';
      case 'system':
        return 'error-type-system';
      case 'agent':
        return 'error-type-agent';
      case 'task':
        return 'error-type-task';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="error-log-viewer">
      <div className="flex justify-between items-center p-4 border-b">
        <h2 className="section-title mb-0">{title}</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">
            {filteredErrors.length} / {state.errors.length} 错误
          </span>
          <button
            onClick={() => clearErrors()}
            className="text-xs px-2 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100"
            disabled={state.errors.length === 0}
          >
            清除全部
          </button>
        </div>
      </div>

      <div className="p-4 border-b">
        <div className="flex flex-col sm:flex-row gap-3 items-center">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜索错误..."
              className="w-full p-2 pr-8 text-sm border border-gray-300 rounded"
            />
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 absolute right-2 top-3 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>

          <select
            value={selectedType || ''}
            onChange={(e) => setSelectedType(e.target.value || null)}
            className="p-2 text-sm border border-gray-300 rounded"
          >
            <option value="">所有错误类型</option>
            {errorTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>

          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest')}
            className="p-2 text-sm border border-gray-300 rounded"
          >
            <option value="newest">最新优先</option>
            <option value="oldest">最早优先</option>
          </select>
        </div>
      </div>

      <div
        className="error-logs-container"
        style={{ height: `${height}px` }}
      >
        {filteredErrors.length > 0 ? (
          <div className="divide-y">
            {filteredErrors.map((error, index) => (
              <div
                key={index}
                onClick={() => handleErrorClick(error)}
                className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                  selectedError === error ? 'bg-blue-50' : ''
                }`}
              >
                <div className="flex justify-between mb-2">
                  <span className={`text-xs px-2 py-1 rounded ${getErrorTypeClass(error.type)}`}>
                    {error.type}
                  </span>
                  <span className="text-xs text-gray-500">{formatTimestamp(error.timestamp)}</span>
                </div>
                <p className="text-sm mb-2">{error.message}</p>
                <div className="flex gap-2 text-xs text-gray-500">
                  {error.agentId && (
                    <span className="bg-gray-100 px-2 py-1 rounded">
                      Agent: {error.agentId}
                    </span>
                  )}
                  {error.taskId && (
                    <span className="bg-gray-100 px-2 py-1 rounded">
                      Task: {error.taskId}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-12 w-12 mb-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p>没有错误日志</p>
            <p className="text-xs mt-1">系统运行正常</p>
          </div>
        )}
      </div>

      {selectedError && (
        <div className="p-4 border-t bg-gray-50">
          <h3 className="text-sm font-medium mb-2">错误详情</h3>
          <div className="bg-white p-3 rounded border text-xs font-mono whitespace-pre-wrap">
            {JSON.stringify(selectedError, null, 2)}
          </div>
        </div>
      )}
    </div>
  );
};

export default ErrorLogViewer; 