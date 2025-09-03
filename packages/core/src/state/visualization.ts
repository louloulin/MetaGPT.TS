/**
 * 状态机可视化工具
 * 
 * 提供状态机的可视化功能：
 * - Mermaid图表生成
 * - DOT图表生成
 * - 状态历史可视化
 * - 实时状态监控
 */

import { writeFile, mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { logger } from '../utils/logger';
import type { 
  StateMachine,
  StateSnapshot,
  StateHistoryEntry,
  StateVisualizationConfig,
  StateId,
  EventType,
} from './types';

/**
 * 可视化格式接口
 */
export interface VisualizationFormat {
  generate(stateMachine: StateMachine, snapshot: StateSnapshot): string;
  getFileExtension(): string;
}

/**
 * Mermaid格式生成器
 */
export class MermaidVisualizationFormat implements VisualizationFormat {
  generate(stateMachine: StateMachine, snapshot: StateSnapshot): string {
    const lines: string[] = [];
    
    lines.push('stateDiagram-v2');
    lines.push('');
    
    // 添加状态定义
    const states = this.getStatesFromSnapshot(snapshot);
    for (const state of states) {
      if (state === snapshot.value) {
        lines.push(`    ${state} : ${state} (Current)`);
      } else {
        lines.push(`    ${state} : ${state}`);
      }
    }
    
    lines.push('');
    
    // 添加转换
    const transitions = this.getTransitionsFromHistory(snapshot.history);
    for (const transition of transitions) {
      lines.push(`    ${transition.from} --> ${transition.to} : ${transition.event}`);
    }
    
    // 添加初始状态标记
    if (snapshot.history.length > 0) {
      const firstState = snapshot.history[0].to;
      lines.push(`    [*] --> ${firstState}`);
    }
    
    // 添加当前状态标记
    if (snapshot.done) {
      lines.push(`    ${snapshot.value} --> [*]`);
    }
    
    return lines.join('\n');
  }

  getFileExtension(): string {
    return 'mmd';
  }

  private getStatesFromSnapshot(snapshot: StateSnapshot): Set<string> {
    const states = new Set<string>();
    states.add(snapshot.value);
    
    for (const entry of snapshot.history) {
      states.add(entry.from);
      states.add(entry.to);
    }
    
    return states;
  }

  private getTransitionsFromHistory(history: StateHistoryEntry[]): Array<{
    from: string;
    to: string;
    event: string;
  }> {
    const transitions = new Map<string, { from: string; to: string; event: string }>();
    
    for (const entry of history) {
      const key = `${entry.from}-${entry.to}-${entry.event}`;
      if (!transitions.has(key)) {
        transitions.set(key, {
          from: entry.from,
          to: entry.to,
          event: entry.event,
        });
      }
    }
    
    return Array.from(transitions.values());
  }
}

/**
 * DOT格式生成器
 */
export class DotVisualizationFormat implements VisualizationFormat {
  generate(stateMachine: StateMachine, snapshot: StateSnapshot): string {
    const lines: string[] = [];
    
    lines.push('digraph StateMachine {');
    lines.push('  rankdir=LR;');
    lines.push('  node [shape=circle];');
    lines.push('');
    
    // 添加状态节点
    const states = this.getStatesFromSnapshot(snapshot);
    for (const state of states) {
      if (state === snapshot.value) {
        lines.push(`  "${state}" [style=filled, fillcolor=lightblue];`);
      } else {
        lines.push(`  "${state}";`);
      }
    }
    
    lines.push('');
    
    // 添加转换边
    const transitions = this.getTransitionsFromHistory(snapshot.history);
    for (const transition of transitions) {
      lines.push(`  "${transition.from}" -> "${transition.to}" [label="${transition.event}"];`);
    }
    
    // 添加初始状态
    if (snapshot.history.length > 0) {
      const firstState = snapshot.history[0].to;
      lines.push(`  start [shape=point];`);
      lines.push(`  start -> "${firstState}";`);
    }
    
    // 添加最终状态
    if (snapshot.done) {
      lines.push(`  end [shape=doublecircle];`);
      lines.push(`  "${snapshot.value}" -> end;`);
    }
    
    lines.push('}');
    
    return lines.join('\n');
  }

  getFileExtension(): string {
    return 'dot';
  }

  private getStatesFromSnapshot(snapshot: StateSnapshot): Set<string> {
    const states = new Set<string>();
    states.add(snapshot.value);
    
    for (const entry of snapshot.history) {
      states.add(entry.from);
      states.add(entry.to);
    }
    
    return states;
  }

  private getTransitionsFromHistory(history: StateHistoryEntry[]): Array<{
    from: string;
    to: string;
    event: string;
  }> {
    const transitions = new Map<string, { from: string; to: string; event: string }>();
    
    for (const entry of history) {
      const key = `${entry.from}-${entry.to}-${entry.event}`;
      if (!transitions.has(key)) {
        transitions.set(key, {
          from: entry.from,
          to: entry.to,
          event: entry.event,
        });
      }
    }
    
    return Array.from(transitions.values());
  }
}

/**
 * JSON格式生成器
 */
export class JsonVisualizationFormat implements VisualizationFormat {
  generate(stateMachine: StateMachine, snapshot: StateSnapshot): string {
    const visualization = {
      stateMachineId: stateMachine.getId(),
      currentState: snapshot.value,
      timestamp: snapshot.timestamp,
      done: snapshot.done,
      context: snapshot.context,
      states: this.getStatesFromSnapshot(snapshot),
      transitions: this.getTransitionsFromHistory(snapshot.history),
      history: snapshot.history,
      meta: snapshot.meta,
    };
    
    return JSON.stringify(visualization, null, 2);
  }

  getFileExtension(): string {
    return 'json';
  }

  private getStatesFromSnapshot(snapshot: StateSnapshot): string[] {
    const states = new Set<string>();
    states.add(snapshot.value);
    
    for (const entry of snapshot.history) {
      states.add(entry.from);
      states.add(entry.to);
    }
    
    return Array.from(states);
  }

  private getTransitionsFromHistory(history: StateHistoryEntry[]): Array<{
    from: string;
    to: string;
    event: string;
    count: number;
  }> {
    const transitionCounts = new Map<string, number>();
    const transitions = new Map<string, { from: string; to: string; event: string }>();
    
    for (const entry of history) {
      const key = `${entry.from}-${entry.to}-${entry.event}`;
      transitionCounts.set(key, (transitionCounts.get(key) || 0) + 1);
      
      if (!transitions.has(key)) {
        transitions.set(key, {
          from: entry.from,
          to: entry.to,
          event: entry.event,
        });
      }
    }
    
    return Array.from(transitions.values()).map(transition => ({
      ...transition,
      count: transitionCounts.get(`${transition.from}-${transition.to}-${transition.event}`) || 0,
    }));
  }
}

/**
 * 状态可视化管理器
 */
export class StateVisualizationManager {
  private formats: Map<string, VisualizationFormat> = new Map();
  private config: Required<StateVisualizationConfig>;

  constructor(config: StateVisualizationConfig = {}) {
    this.config = {
      enabled: true,
      format: 'mermaid',
      outputPath: './state-visualizations',
      includeHistory: true,
      ...config,
    };

    // 注册默认格式
    this.registerFormat('mermaid', new MermaidVisualizationFormat());
    this.registerFormat('dot', new DotVisualizationFormat());
    this.registerFormat('json', new JsonVisualizationFormat());
  }

  /**
   * 注册可视化格式
   */
  registerFormat(name: string, format: VisualizationFormat): void {
    this.formats.set(name, format);
  }

  /**
   * 生成可视化
   */
  async generateVisualization(
    stateMachine: StateMachine,
    format?: string,
    outputPath?: string
  ): Promise<string | null> {
    if (!this.config.enabled) {
      return null;
    }

    const formatName = format || this.config.format;
    const formatGenerator = this.formats.get(formatName);
    
    if (!formatGenerator) {
      throw new Error(`Unsupported visualization format: ${formatName}`);
    }

    try {
      const snapshot = stateMachine.getSnapshot();
      const content = formatGenerator.generate(stateMachine, snapshot);
      
      if (outputPath || this.config.outputPath) {
        const filePath = await this.saveVisualization(
          stateMachine.getId(),
          content,
          formatGenerator.getFileExtension(),
          outputPath
        );
        return filePath;
      }
      
      return content;
    } catch (error) {
      logger.error(`Failed to generate visualization for ${stateMachine.getId()}:`, error);
      throw error;
    }
  }

  /**
   * 生成历史可视化
   */
  async generateHistoryVisualization(
    stateMachine: StateMachine,
    timeRange?: { start: number; end: number }
  ): Promise<string | null> {
    if (!this.config.enabled || !this.config.includeHistory) {
      return null;
    }

    try {
      const snapshot = stateMachine.getSnapshot();
      let history = snapshot.history;
      
      // 过滤时间范围
      if (timeRange) {
        history = history.filter(entry => 
          entry.timestamp >= timeRange.start && entry.timestamp <= timeRange.end
        );
      }

      const historyVisualization = {
        stateMachineId: stateMachine.getId(),
        timeRange,
        totalTransitions: history.length,
        timeline: history.map(entry => ({
          timestamp: entry.timestamp,
          from: entry.from,
          to: entry.to,
          event: entry.event,
          duration: entry.duration,
        })),
        stateFrequency: this.calculateStateFrequency(history),
        eventFrequency: this.calculateEventFrequency(history),
      };

      const content = JSON.stringify(historyVisualization, null, 2);
      
      if (this.config.outputPath) {
        const filePath = await this.saveVisualization(
          `${stateMachine.getId()}-history`,
          content,
          'json'
        );
        return filePath;
      }
      
      return content;
    } catch (error) {
      logger.error(`Failed to generate history visualization for ${stateMachine.getId()}:`, error);
      throw error;
    }
  }

  /**
   * 实时监控状态机
   */
  enableRealTimeVisualization(
    stateMachine: StateMachine,
    updateInterval: number = 1000
  ): () => void {
    if (!this.config.enabled) {
      return () => {};
    }

    const updateVisualization = async () => {
      try {
        await this.generateVisualization(stateMachine);
      } catch (error) {
        logger.error(`Real-time visualization update failed for ${stateMachine.getId()}:`, error);
      }
    };

    // 监听状态变化
    stateMachine.on('state:changed', updateVisualization);

    // 定期更新
    const intervalId = setInterval(updateVisualization, updateInterval);

    // 返回清理函数
    return () => {
      stateMachine.off('state:changed', updateVisualization);
      clearInterval(intervalId);
    };
  }

  /**
   * 保存可视化文件
   */
  private async saveVisualization(
    name: string,
    content: string,
    extension: string,
    customPath?: string
  ): Promise<string> {
    const basePath = customPath || this.config.outputPath!;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${name}-${timestamp}.${extension}`;
    const filePath = join(basePath, fileName);
    
    // 确保目录存在
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
    
    await writeFile(filePath, content, 'utf8');
    
    logger.debug(`Visualization saved to ${filePath}`);
    return filePath;
  }

  /**
   * 计算状态频率
   */
  private calculateStateFrequency(history: StateHistoryEntry[]): Record<string, number> {
    const frequency: Record<string, number> = {};
    
    for (const entry of history) {
      frequency[entry.from] = (frequency[entry.from] || 0) + 1;
      frequency[entry.to] = (frequency[entry.to] || 0) + 1;
    }
    
    return frequency;
  }

  /**
   * 计算事件频率
   */
  private calculateEventFrequency(history: StateHistoryEntry[]): Record<string, number> {
    const frequency: Record<string, number> = {};
    
    for (const entry of history) {
      frequency[entry.event] = (frequency[entry.event] || 0) + 1;
    }
    
    return frequency;
  }

  /**
   * 获取配置
   */
  getConfig(): StateVisualizationConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<StateVisualizationConfig>): void {
    Object.assign(this.config, config);
  }
}

/**
 * 默认可视化管理器实例
 */
export const defaultVisualizationManager = new StateVisualizationManager({
  enabled: true,
  format: 'mermaid',
  outputPath: './state-visualizations',
  includeHistory: true,
});

/**
 * 可视化装饰器
 * 自动为状态机添加可视化功能
 */
export function Visualizable(
  config: StateVisualizationConfig = {},
  realTimeInterval: number = 5000
) {
  return function <T extends { new (...args: any[]): StateMachine<any> }>(constructor: T) {
    return class extends constructor {
      private visualizationManager: StateVisualizationManager;
      private visualizationCleanup?: () => void;

      constructor(...args: any[]) {
        super(...args);
        
        this.visualizationManager = new StateVisualizationManager({
          enabled: true,
          format: 'mermaid',
          outputPath: './visualizations',
          includeHistory: true,
          ...config,
        });

        // 启用实时可视化
        if (realTimeInterval > 0) {
          this.visualizationCleanup = this.visualizationManager.enableRealTimeVisualization(
            this,
            realTimeInterval
          );
        }
      }

      async dispose(): Promise<void> {
        // 清理实时可视化
        if (this.visualizationCleanup) {
          this.visualizationCleanup();
        }

        // 调用父类的dispose方法（如果存在）
        if (super.dispose) {
          await super.dispose();
        }
      }

      getVisualizationManager(): StateVisualizationManager {
        return this.visualizationManager;
      }

      async generateVisualization(format?: string): Promise<string | null> {
        return this.visualizationManager.generateVisualization(this, format);
      }
    };
  };
}
