/**
 * MetaGPT.TS 状态管理系统
 * 
 * 充分利用TypeScript特性的状态管理解决方案：
 * - 类型安全的状态机实现
 * - 角色专用状态管理
 * - 状态持久化和可视化
 * - 高性能事件驱动架构
 */

// 核心类型定义
export * from './types';

// 状态机核心实现
export { StateMachine } from './state-machine';

// 角色状态机
export { 
  RoleStateMachine, 
  RoleStateMachineFactory,
  type RoleStateMachineOptions 
} from './role-state-machine';

// 状态持久化
export {
  StatePersistenceManager,
  FileSystemStorageAdapter,
  MemoryStorageAdapter,
  JsonStateSerializer,
  CompressedJsonStateSerializer,
  defaultPersistenceManager,
  Persistent,
  type StorageAdapter,
  type StateSerializer,
} from './persistence';

// 状态可视化
export {
  StateVisualizationManager,
  MermaidVisualizationFormat,
  DotVisualizationFormat,
  JsonVisualizationFormat,
  defaultVisualizationManager,
  Visualizable,
  type VisualizationFormat,
} from './visualization';

// 工具函数
export {
  createStateId,
  createEventType,
  isRoleEvent,
  isRoleEventOfType,
} from './types';

/**
 * 创建增强的角色状态机
 * 集成持久化和可视化功能
 */
export async function createEnhancedRoleStateMachine(
  roleId: string,
  context: import('./types').RoleContext,
  options: {
    type?: 'standard' | 'learning' | 'collaborative';
    persistence?: import('./types').StatePersistenceConfig;
    visualization?: import('./types').StateVisualizationConfig;
    stateMachine?: import('./role-state-machine').RoleStateMachineOptions;
  } = {}
): Promise<RoleStateMachine> {
  const {
    type = 'standard',
    persistence,
    visualization,
    stateMachine: stateMachineOptions,
  } = options;

  // 导入所需的类
  const { RoleStateMachineFactory } = await import('./role-state-machine');
  const { StatePersistenceManager } = await import('./persistence');
  const { StateVisualizationManager } = await import('./visualization');

  // 创建状态机
  let stateMachine: RoleStateMachine;

  switch (type) {
    case 'learning':
      stateMachine = RoleStateMachineFactory.createLearning(roleId, context, stateMachineOptions);
      break;
    case 'collaborative':
      stateMachine = RoleStateMachineFactory.createCollaborative(roleId, context, stateMachineOptions);
      break;
    default:
      stateMachine = RoleStateMachineFactory.createStandard(roleId, context, stateMachineOptions);
  }

  // 添加持久化功能
  if (persistence?.enabled) {
    const persistenceManager = new StatePersistenceManager(persistence);
    persistenceManager.enableAutoSave(stateMachine);
  }

  // 添加可视化功能
  if (visualization?.enabled) {
    const visualizationManager = new StateVisualizationManager(visualization);
    visualizationManager.enableRealTimeVisualization(stateMachine);
  }

  return stateMachine;
}

/**
 * 状态管理工具类
 */
export class StateManagementUtils {
  /**
   * 创建默认角色上下文
   */
  static createDefaultRoleContext(name: string): import('./types').RoleContext {
    return {
      name,
      messageQueue: [],
      retryCount: 0,
      maxRetries: 3,
      stats: {
        observeCount: 0,
        thinkCount: 0,
        actCount: 0,
        reactCount: 0,
        errorCount: 0,
      },
      data: {},
    };
  }

  /**
   * 验证状态机配置
   */
  static validateStateMachineConfig(
    config: import('./types').StateMachineConfig
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 检查初始状态
    if (!config.states[config.initial]) {
      errors.push(`Initial state '${config.initial}' not found in states`);
    }

    // 检查状态转换
    for (const [stateId, stateConfig] of Object.entries(config.states)) {
      for (const [eventType, transition] of Object.entries(stateConfig.transitions)) {
        if (!config.states[transition.target]) {
          errors.push(`Target state '${transition.target}' not found for transition ${stateId} -> ${eventType}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 分析状态机性能
   */
  static analyzeStateMachinePerformance(
    snapshot: import('./types').StateSnapshot
  ): {
    totalTransitions: number;
    averageTransitionTime: number;
    stateDistribution: Record<string, number>;
    eventDistribution: Record<string, number>;
    slowestTransitions: Array<{
      from: string;
      to: string;
      event: string;
      duration: number;
    }>;
  } {
    const { history } = snapshot;
    
    const totalTransitions = history.length;
    const totalTime = history.reduce((sum, entry) => sum + (entry.duration || 0), 0);
    const averageTransitionTime = totalTransitions > 0 ? totalTime / totalTransitions : 0;

    // 状态分布
    const stateDistribution: Record<string, number> = {};
    for (const entry of history) {
      stateDistribution[entry.from] = (stateDistribution[entry.from] || 0) + 1;
      stateDistribution[entry.to] = (stateDistribution[entry.to] || 0) + 1;
    }

    // 事件分布
    const eventDistribution: Record<string, number> = {};
    for (const entry of history) {
      eventDistribution[entry.event] = (eventDistribution[entry.event] || 0) + 1;
    }

    // 最慢的转换
    const slowestTransitions = history
      .filter(entry => entry.duration !== undefined)
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .slice(0, 10)
      .map(entry => ({
        from: entry.from,
        to: entry.to,
        event: entry.event,
        duration: entry.duration || 0,
      }));

    return {
      totalTransitions,
      averageTransitionTime,
      stateDistribution,
      eventDistribution,
      slowestTransitions,
    };
  }

  /**
   * 生成状态机报告
   */
  static generateStateMachineReport(
    stateMachine: StateMachine,
    includeVisualization: boolean = true
  ): {
    id: string;
    currentState: string;
    isRunning: boolean;
    snapshot: import('./types').StateSnapshot;
    performance: ReturnType<typeof StateManagementUtils.analyzeStateMachinePerformance>;
    visualization?: string;
  } {
    const snapshot = stateMachine.getSnapshot();
    const performance = this.analyzeStateMachinePerformance(snapshot);

    const report = {
      id: stateMachine.getId(),
      currentState: stateMachine.getCurrentState(),
      isRunning: true, // 需要从状态机获取实际状态
      snapshot,
      performance,
    };

    if (includeVisualization) {
      const visualizationManager = new StateVisualizationManager();
      const visualization = visualizationManager.generateVisualization(stateMachine);
      return { ...report, visualization };
    }

    return report;
  }
}

/**
 * 状态管理配置
 */
export interface StateManagementConfig {
  /** 默认持久化配置 */
  defaultPersistence?: import('./types').StatePersistenceConfig;
  /** 默认可视化配置 */
  defaultVisualization?: import('./types').StateVisualizationConfig;
  /** 默认状态机选项 */
  defaultStateMachineOptions?: import('./types').StateMachineOptions;
  /** 调试模式 */
  debug?: boolean;
}

/**
 * 全局状态管理配置
 */
let globalConfig: StateManagementConfig = {
  defaultPersistence: {
    enabled: false,
    keyPrefix: 'metagpt-state',
  },
  defaultVisualization: {
    enabled: false,
    format: 'mermaid',
  },
  defaultStateMachineOptions: {
    debug: false,
    maxHistorySize: 1000,
  },
  debug: false,
};

/**
 * 设置全局状态管理配置
 */
export function setGlobalStateManagementConfig(config: Partial<StateManagementConfig>): void {
  globalConfig = { ...globalConfig, ...config };
}

/**
 * 获取全局状态管理配置
 */
export function getGlobalStateManagementConfig(): StateManagementConfig {
  return { ...globalConfig };
}

/**
 * 状态管理系统版本信息
 */
export const STATE_MANAGEMENT_VERSION = '1.0.0';

/**
 * 状态管理系统信息
 */
export const STATE_MANAGEMENT_INFO = {
  version: STATE_MANAGEMENT_VERSION,
  features: [
    'TypeScript原生状态机',
    '类型安全的状态和事件定义',
    '异步状态转换支持',
    '状态历史追踪',
    '状态持久化',
    '状态可视化',
    '角色专用状态管理',
    '性能监控和分析',
    '错误处理和恢复',
    '装饰器支持',
  ],
  compatibility: {
    typescript: '>=4.9.0',
    node: '>=16.0.0',
  },
} as const;
