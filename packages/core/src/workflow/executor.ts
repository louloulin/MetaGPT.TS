import { EventEmitter } from 'events';
import type { 
  WorkflowExecutor, 
  WorkflowConfig, 
  WorkflowState,
  WorkflowNode,
  NodeExecutor,
  WorkflowEvent
} from '../types/workflow';
import { 
  WorkflowStateSchema, 
  WorkflowNodeSchema,
  WorkflowEventSchema 
} from '../types/workflow';
import { generateId } from '../utils/common';

/**
 * 基础工作流执行器实现
 */
export class BaseWorkflowExecutor extends EventEmitter implements WorkflowExecutor {
  private config!: WorkflowConfig;
  private state!: WorkflowState;
  private nodeExecutors: Map<string, NodeExecutor>;
  private isPaused: boolean = false;
  private isStopped: boolean = false;

  constructor() {
    super();
    this.nodeExecutors = new Map();
  }

  /**
   * 注册节点执行器
   * @param type 节点类型
   * @param executor 执行器实例
   */
  public registerNodeExecutor(type: string, executor: NodeExecutor): void {
    this.nodeExecutors.set(type, executor);
  }

  /**
   * 执行工作流
   * @param config 工作流配置
   */
  public async execute(config: WorkflowConfig): Promise<void> {
    this.config = config;
    this.state = WorkflowStateSchema.parse({
      id: config.id,
      status: 'running',
    });

    this.emit('workflow:start', this.createEvent('workflow:start'));

    try {
      await this.executeNode(this.findStartNode());
      
      if (!this.isStopped) {
        this.state.status = 'completed';
        this.emit('workflow:complete', this.createEvent('workflow:complete'));
      }
    } catch (error) {
      this.state.status = 'failed';
      this.emit('workflow:fail', this.createEvent('workflow:fail', { error }));
      throw error;
    }
  }

  /**
   * 暂停工作流
   */
  public async pause(): Promise<void> {
    this.isPaused = true;
  }

  /**
   * 恢复工作流
   */
  public async resume(): Promise<void> {
    this.isPaused = false;
    if (this.state.currentNodeId) {
      await this.executeNode(this.findNodeById(this.state.currentNodeId));
    }
  }

  /**
   * 停止工作流
   */
  public async stop(): Promise<void> {
    this.isStopped = true;
  }

  /**
   * 获取工作流状态
   */
  public getState(): WorkflowState {
    return this.state;
  }

  /**
   * 执行节点
   * @param node 工作流节点
   */
  private async executeNode(node: WorkflowNode): Promise<void> {
    if (this.isStopped) return;

    while (this.isPaused) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.state.currentNodeId = node.id;
    this.emit('node:start', this.createEvent('node:start', { nodeId: node.id }));

    try {
      const executor = this.nodeExecutors.get(node.type);
      if (!executor) {
        throw new Error(`No executor found for node type: ${node.type}`);
      }

      if (!executor.validate(node)) {
        throw new Error(`Invalid node configuration: ${node.id}`);
      }

      const result = await executor.execute(node, {
        workflow: this.config,
        state: this.state,
      });

      node.status = 'completed';
      node.result = result;
      this.state.completedNodeIds.push(node.id);
      
      this.emit('node:complete', this.createEvent('node:complete', {
        nodeId: node.id,
        data: result,
      }));

      // 执行子节点
      for (const childId of node.childIds) {
        await this.executeNode(this.findNodeById(childId));
      }
    } catch (error) {
      node.status = 'failed';
      this.state.failedNodeIds.push(node.id);
      
      this.emit('node:fail', this.createEvent('node:fail', {
        nodeId: node.id,
        error,
      }));
      
      throw error;
    }
  }

  /**
   * 查找起始节点
   */
  private findStartNode(): WorkflowNode {
    const startNode = this.config.nodes.find(node => !node.parentId);
    if (!startNode) {
      throw new Error('No start node found in workflow');
    }
    return startNode;
  }

  /**
   * 根据ID查找节点
   * @param id 节点ID
   */
  private findNodeById(id: string): WorkflowNode {
    const node = this.config.nodes.find(node => node.id === id);
    if (!node) {
      throw new Error(`Node not found: ${id}`);
    }
    return node;
  }

  /**
   * 创建工作流事件
   * @param type 事件类型
   * @param data 事件数据
   */
  private createEvent(
    type: WorkflowEvent['type'],
    data: Partial<WorkflowEvent> = {}
  ): WorkflowEvent {
    return WorkflowEventSchema.parse({
      type,
      timestamp: Date.now(),
      workflowId: this.config.id,
      ...data,
    });
  }
} 