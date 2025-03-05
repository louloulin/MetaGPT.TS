import { SystemMetrics, MonitoringError } from '../monitoring/types';

export const getMockMetrics = async (): Promise<SystemMetrics> => {
  return {
    cpuUsage: Math.random() * 100,
    memoryUsage: Math.random() * 100,
    networkLatency: Math.random() * 200,
    activeAgents: Math.floor(Math.random() * 10),
    totalTasks: 100,
    completedTasks: Math.floor(Math.random() * 100),
    errorRate: Math.random() * 5,
  };
};

const errorTypes = ['critical', 'warning', 'system', 'agent', 'task'];
const errorMessages = [
  '内存分配失败',
  '网络连接超时',
  '权限被拒绝',
  '未找到依赖项',
  '资源已耗尽',
  '无效的请求格式',
  '服务不可用',
  '代理通信失败',
  '任务执行超时',
  '处理结果验证失败',
];

const agentIds = [
  'agent-001',
  'agent-002',
  'agent-003',
  'agent-004',
  'agent-005',
];

const taskIds = [
  'task-001',
  'task-002',
  'task-003',
  'task-004',
  'task-005',
];

/**
 * 生成一个随机的模拟错误
 */
export const generateMockError = (): Omit<MonitoringError, 'timestamp'> => {
  // 随机选择错误类型
  const randomType = errorTypes[Math.floor(Math.random() * errorTypes.length)];
  // 随机选择错误消息
  const randomMessage = errorMessages[Math.floor(Math.random() * errorMessages.length)];
  // 如果是代理错误或任务错误，添加相关ID
  const error: Omit<MonitoringError, 'timestamp'> = {
    type: randomType,
    message: randomMessage,
  };

  // 50%的概率添加代理ID
  if (Math.random() > 0.5) {
    error.agentId = agentIds[Math.floor(Math.random() * agentIds.length)];
  }

  // 30%的概率添加任务ID
  if (Math.random() > 0.7) {
    error.taskId = taskIds[Math.floor(Math.random() * taskIds.length)];
  }

  return error;
}; 