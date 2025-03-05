import { AgentActivity, MonitoringMetrics, SystemError } from './types';

/**
 * 生成模拟的监控指标数据
 */
export const generateMockMetrics = (): MonitoringMetrics => {
  const now = new Date();
  const timeValue = now.getSeconds() + now.getMilliseconds() / 1000;
  
  // 生成带有周期性波动的模拟数据
  const cpuUsage = 30 + 20 * Math.sin(timeValue * 0.5) + Math.random() * 10;
  const memoryUsage = 45 + 15 * Math.sin(timeValue * 0.2) + Math.random() * 5;
  const networkLatency = 80 + 50 * Math.sin(timeValue * 0.3) + Math.random() * 30;
  
  // 偶尔生成峰值
  const cpuSpike = Math.random() < 0.05 ? 20 : 0;
  const memSpike = Math.random() < 0.03 ? 15 : 0;
  const networkSpike = Math.random() < 0.07 ? 100 : 0;
  
  return {
    cpuUsage: Math.min(100, Math.max(0, cpuUsage + cpuSpike)),
    memoryUsage: Math.min(100, Math.max(0, memoryUsage + memSpike)),
    networkLatency: Math.max(0, networkLatency + networkSpike),
    timestamp: now,
  };
};

/**
 * 生成模拟的代理活动数据
 */
const agentNames = ['ProductManager', 'Architect', 'Engineer', 'DevOps', 'QAEngineer'];
const actionTypes = ['THINK', 'DECIDE', 'ACT', 'RESULT'];
const taskTypes = ['RequirementsAnalysis', 'Design', 'Implementation', 'Testing', 'Deployment'];

export const generateMockAgentActivity = (): AgentActivity => {
  const agentId = agentNames[Math.floor(Math.random() * agentNames.length)];
  const actionType = actionTypes[Math.floor(Math.random() * actionTypes.length)];
  const taskId = taskTypes[Math.floor(Math.random() * taskTypes.length)];
  
  let action = '';
  let details: Record<string, any> = { taskId };
  
  switch (actionType) {
    case 'THINK':
      action = `THINK: Analyzing ${getRandomThoughtContent(taskId)}`;
      details.confidence = Math.random() * 100;
      details.sources = getRandomSources();
      break;
    case 'DECIDE':
      action = `DECIDE: Determined ${getRandomDecisionContent(taskId)}`;
      details.alternatives = getRandomAlternatives();
      details.reasoning = `Based on ${getRandomReasoning()}`;
      break;
    case 'ACT':
      action = `ACT: Executing ${getRandomActionContent(taskId)}`;
      details.expectedOutcome = getRandomExpectedOutcome();
      details.dependencies = getRandomDependencies();
      break;
    case 'RESULT':
      action = `RESULT: Completed ${getRandomResultContent(taskId)}`;
      details.success = Math.random() > 0.2;
      details.metrics = {
        duration: Math.random() * 1000,
        resourceUsage: Math.random() * 50,
      };
      break;
  }
  
  return {
    agentId,
    action,
    timestamp: new Date(),
    details,
  };
};

/**
 * 生成模拟的系统错误
 */
const errorTypes = [
  'resource_limit_exceeded',
  'dependency_failure',
  'invalid_input',
  'task_timeout',
  'communication_error',
];

export const generateMockSystemError = (): SystemError => {
  const errorType = errorTypes[Math.floor(Math.random() * errorTypes.length)];
  const agentId = Math.random() > 0.3 ? 
    agentNames[Math.floor(Math.random() * agentNames.length)] : 
    undefined;
  
  let message = '';
  
  switch (errorType) {
    case 'resource_limit_exceeded':
      message = `Memory usage exceeded limit for task execution`;
      break;
    case 'dependency_failure':
      message = `Failed to connect to external service: ${getRandomDependencyName()}`;
      break;
    case 'invalid_input':
      message = `Received malformed data for processing: ${getRandomInvalidInput()}`;
      break;
    case 'task_timeout':
      message = `Task execution exceeded maximum allowed time of ${Math.floor(Math.random() * 30) + 10}s`;
      break;
    case 'communication_error':
      message = `Communication failed between agents: ${getRandomCommunicationError()}`;
      break;
  }
  
  return {
    type: errorType,
    message,
    timestamp: new Date(),
    agentId,
    taskId: agentId ? taskTypes[Math.floor(Math.random() * taskTypes.length)] : undefined,
    details: {
      severity: Math.random() > 0.7 ? 'critical' : Math.random() > 0.5 ? 'warning' : 'info',
      recoverable: Math.random() > 0.4,
      context: getRandomErrorContext(),
    },
  };
};

// 辅助函数生成随机内容
function getRandomThoughtContent(taskId: string): string {
  const thoughts = [
    `options for optimizing performance in ${taskId}`,
    `potential architecture solutions for ${taskId}`,
    `user requirements and generating acceptance criteria`,
    `code structure and identifying refactoring opportunities`,
    `test scenarios and edge cases for ${taskId}`,
  ];
  return thoughts[Math.floor(Math.random() * thoughts.length)];
}

function getRandomDecisionContent(taskId: string): string {
  const decisions = [
    `to use microservice architecture for ${taskId}`,
    `that React is the best frontend framework for this project`,
    `to implement a caching layer to improve performance`,
    `to refactor the authentication system for better security`,
    `that we need more comprehensive testing for ${taskId}`,
  ];
  return decisions[Math.floor(Math.random() * decisions.length)];
}

function getRandomActionContent(taskId: string): string {
  const actions = [
    `code implementation for ${taskId}`,
    `architecture diagram creation for ${taskId}`,
    `database schema design for the new feature`,
    `CI/CD pipeline configuration for faster deployment`,
    `integration test suite for ${taskId}`,
  ];
  return actions[Math.floor(Math.random() * actions.length)];
}

function getRandomResultContent(taskId: string): string {
  const results = [
    `implementation of ${taskId} with all requirements met`,
    `design phase for ${taskId} with approved documentation`,
    `performance optimization with 30% improvement in response time`,
    `integration of new security features with zero vulnerabilities`,
    `deployment of ${taskId} to production environment`,
  ];
  return results[Math.floor(Math.random() * results.length)];
}

function getRandomSources(): string[] {
  const sources = [
    'requirements_doc.md',
    'system_architecture.pdf',
    'user_feedback.json',
    'performance_metrics.csv',
    'api_documentation.yaml',
  ];
  
  const count = Math.floor(Math.random() * 3) + 1;
  const selectedSources = [];
  
  for (let i = 0; i < count; i++) {
    const source = sources[Math.floor(Math.random() * sources.length)];
    if (!selectedSources.includes(source)) {
      selectedSources.push(source);
    }
  }
  
  return selectedSources;
}

function getRandomAlternatives(): string[] {
  const alternatives = [
    'Using Docker containers',
    'Implementing serverless architecture',
    'Developing a monolithic application',
    'Using GraphQL instead of REST',
    'Utilizing a NoSQL database',
    'Implementing a microservices pattern',
  ];
  
  const count = Math.floor(Math.random() * 3) + 1;
  const selectedAlternatives = [];
  
  for (let i = 0; i < count; i++) {
    const alternative = alternatives[Math.floor(Math.random() * alternatives.length)];
    if (!selectedAlternatives.includes(alternative)) {
      selectedAlternatives.push(alternative);
    }
  }
  
  return selectedAlternatives;
}

function getRandomReasoning(): string {
  const reasoning = [
    'performance requirements and scalability needs',
    'security considerations and compliance requirements',
    'maintainability and long-term support considerations',
    'user experience and accessibility requirements',
    'budget constraints and available resources',
  ];
  return reasoning[Math.floor(Math.random() * reasoning.length)];
}

function getRandomExpectedOutcome(): string {
  const outcomes = [
    'Improved application performance by reducing response time',
    'Enhanced security through proper authentication and authorization',
    'Better user experience with more intuitive interface',
    'Increased scalability to handle peak loads',
    'Reduced maintenance costs through automated processes',
  ];
  return outcomes[Math.floor(Math.random() * outcomes.length)];
}

function getRandomDependencies(): string[] {
  const dependencies = [
    'Authentication Service',
    'Data Storage Layer',
    'Notification System',
    'Payment Gateway',
    'User Profile Service',
    'Recommendation Engine',
    'Analytics Platform',
  ];
  
  const count = Math.floor(Math.random() * 3) + 1;
  const selectedDependencies = [];
  
  for (let i = 0; i < count; i++) {
    const dependency = dependencies[Math.floor(Math.random() * dependencies.length)];
    if (!selectedDependencies.includes(dependency)) {
      selectedDependencies.push(dependency);
    }
  }
  
  return selectedDependencies;
}

function getRandomDependencyName(): string {
  const dependencies = [
    'Redis Cache',
    'PostgreSQL Database',
    'Elasticsearch',
    'Kafka Message Queue',
    'MongoDB',
    'S3 Storage',
    'Auth0 Service',
  ];
  return dependencies[Math.floor(Math.random() * dependencies.length)];
}

function getRandomInvalidInput(): string {
  const inputs = [
    'Missing required field "userId"',
    'Invalid date format in request payload',
    'Array expected but received string',
    'Parameter "limit" exceeds maximum value',
    'Malformed JSON in request body',
  ];
  return inputs[Math.floor(Math.random() * inputs.length)];
}

function getRandomCommunicationError(): string {
  const errors = [
    'Timeout waiting for response from ProductManager',
    'Message format mismatch between Engineer and Architect',
    'Invalid operation requested by QAEngineer',
    'Data transformation failed between DevOps and Engineer',
    'Response too large from Architect to ProductManager',
  ];
  return errors[Math.floor(Math.random() * errors.length)];
}

function getRandomErrorContext(): Record<string, any> {
  return {
    location: `${['api', 'service', 'controller', 'model'][Math.floor(Math.random() * 4)]}.${['user', 'product', 'order', 'payment'][Math.floor(Math.random() * 4)]}`,
    stackTrace: `Error at line ${Math.floor(Math.random() * 500) + 1}...`,
    attemptCount: Math.floor(Math.random() * 5) + 1,
  };
} 