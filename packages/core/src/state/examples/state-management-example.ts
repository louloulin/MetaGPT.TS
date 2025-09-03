/**
 * 状态管理系统使用示例
 * 
 * 展示TypeScript原生状态管理系统的强大功能：
 * - 类型安全的状态机定义
 * - 角色状态管理
 * - 状态持久化
 * - 状态可视化
 * - 错误处理和恢复
 */

import {
  createEnhancedRoleStateMachine,
  StateManagementUtils,
  RoleStates,
  RoleEvents,
  defaultPersistenceManager,
  defaultVisualizationManager,
  type RoleContext,
} from '../index';

/**
 * 创建示例角色上下文
 */
function createExampleRoleContext(name: string): RoleContext {
  return StateManagementUtils.createDefaultRoleContext(name);
}

/**
 * 状态管理系统示例
 */
export async function stateManagementExample() {
  console.log('🚀 MetaGPT.TS 状态管理系统示例');
  
  // 1. 创建增强的角色状态机
  console.log('\n📝 创建增强角色状态机:');
  
  const productManagerContext = createExampleRoleContext('ProductManager');
  const architectContext = createExampleRoleContext('Architect');
  
  const productManager = await createEnhancedRoleStateMachine('pm-001', productManagerContext, {
    type: 'standard',
    persistence: {
      enabled: true,
      keyPrefix: 'pm-state',
    },
    visualization: {
      enabled: true,
      format: 'mermaid',
      outputPath: './state-visualizations',
    },
    stateMachine: {
      debug: true,
      maxRetries: 3,
      autoRecover: true,
    },
  });

  const architect = await createEnhancedRoleStateMachine('arch-001', architectContext, {
    type: 'learning',
    persistence: {
      enabled: true,
      keyPrefix: 'arch-state',
    },
    visualization: {
      enabled: true,
      format: 'json',
    },
  });

  console.log(`✅ 产品经理状态机: ${productManager.getId()}`);
  console.log(`✅ 架构师状态机: ${architect.getId()}`);

  // 2. 启动状态机
  console.log('\n🔄 启动状态机:');
  
  await productManager.start();
  await architect.start();
  
  console.log(`产品经理当前状态: ${productManager.getCurrentState()}`);
  console.log(`架构师当前状态: ${architect.getCurrentState()}`);

  // 3. 状态转换演示
  console.log('\n🎯 状态转换演示:');
  
  // 产品经理开始观察
  await productManager.sendRoleEvent({ type: RoleEvents.OBSERVE });
  console.log(`产品经理状态: ${productManager.getCurrentState()}`);
  
  // 添加消息到队列
  productManager.addMessage({
    id: 'msg-001',
    content: '需要设计一个用户管理系统',
    role: 'user',
    timestamp: new Date(),
  } as any);
  
  // 开始思考
  await productManager.sendRoleEvent({ type: RoleEvents.THINK });
  console.log(`产品经理状态: ${productManager.getCurrentState()}`);
  
  // 设置动作并执行
  productManager.setCurrentAction({
    id: 'write-prd',
    name: 'WritePRD',
    description: '编写产品需求文档',
  } as any);
  
  await productManager.sendRoleEvent({ type: RoleEvents.ACT });
  console.log(`产品经理状态: ${productManager.getCurrentState()}`);

  // 4. 并行状态管理
  console.log('\n⚡ 并行状态管理:');
  
  // 架构师同时开始工作
  await architect.sendRoleEvent({ type: RoleEvents.OBSERVE });
  
  architect.addMessage({
    id: 'msg-002',
    content: '基于PRD设计系统架构',
    role: 'system',
    timestamp: new Date(),
  } as any);
  
  await architect.sendRoleEvent({ type: RoleEvents.THINK });
  
  console.log(`产品经理状态: ${productManager.getCurrentState()}`);
  console.log(`架构师状态: ${architect.getCurrentState()}`);

  // 5. 错误处理演示
  console.log('\n❌ 错误处理演示:');
  
  const testError = new Error('模拟的系统错误');
  await architect.sendRoleEvent({ 
    type: RoleEvents.ERROR, 
    error: testError 
  });
  
  console.log(`架构师状态: ${architect.getCurrentState()}`);
  console.log(`错误信息: ${architect.getContext().error?.message}`);
  
  // 自动恢复（如果启用）
  setTimeout(async () => {
    console.log('🔄 尝试自动恢复...');
    const context = architect.getContext();
    if (context.retryCount < context.maxRetries) {
      await architect.sendRoleEvent({ type: RoleEvents.RESUME });
      console.log(`架构师恢复后状态: ${architect.getCurrentState()}`);
    }
  }, 1000);

  // 6. 统计信息展示
  console.log('\n📊 统计信息:');
  
  const pmStats = productManager.getStats();
  const archStats = architect.getStats();
  
  console.log('产品经理统计:', {
    当前状态: pmStats.currentState,
    观察次数: pmStats.observeCount,
    思考次数: pmStats.thinkCount,
    行动次数: pmStats.actCount,
    消息队列大小: pmStats.messageQueueSize,
  });
  
  console.log('架构师统计:', {
    当前状态: archStats.currentState,
    观察次数: archStats.observeCount,
    思考次数: archStats.thinkCount,
    错误次数: archStats.errorCount,
    重试次数: archStats.retryCount,
    有错误: archStats.hasError,
  });

  // 7. 状态快照和历史
  console.log('\n📸 状态快照和历史:');
  
  const pmSnapshot = productManager.getSnapshot();
  console.log('产品经理状态快照:', {
    当前状态: pmSnapshot.value,
    历史记录数: pmSnapshot.history.length,
    是否完成: pmSnapshot.done,
    时间戳: new Date(pmSnapshot.timestamp).toLocaleString(),
  });
  
  if (pmSnapshot.history.length > 0) {
    console.log('最近的状态转换:');
    pmSnapshot.history.slice(-3).forEach((entry, index) => {
      console.log(`  ${index + 1}. ${entry.from} -> ${entry.to} (${entry.event}) [${entry.duration}ms]`);
    });
  }

  // 8. 性能分析
  console.log('\n⚡ 性能分析:');
  
  const pmPerformance = StateManagementUtils.analyzeStateMachinePerformance(pmSnapshot);
  console.log('产品经理性能分析:', {
    总转换次数: pmPerformance.totalTransitions,
    平均转换时间: `${pmPerformance.averageTransitionTime.toFixed(2)}ms`,
    状态分布: pmPerformance.stateDistribution,
    事件分布: pmPerformance.eventDistribution,
  });

  // 9. 状态持久化演示
  console.log('\n💾 状态持久化演示:');
  
  try {
    // 保存状态快照
    await defaultPersistenceManager.saveSnapshot(productManager.getId(), pmSnapshot);
    console.log(`✅ 产品经理状态已保存`);
    
    // 列出所有快照
    const snapshots = await defaultPersistenceManager.listSnapshots();
    console.log(`📋 已保存的快照: ${snapshots.join(', ')}`);
    
    // 加载状态快照
    const loadedSnapshot = await defaultPersistenceManager.loadSnapshot(productManager.getId());
    if (loadedSnapshot) {
      console.log(`✅ 状态快照加载成功: ${loadedSnapshot.value}`);
    }
  } catch (error) {
    console.error('❌ 持久化操作失败:', error);
  }

  // 10. 状态可视化演示
  console.log('\n🎨 状态可视化演示:');
  
  try {
    // 生成Mermaid图表
    const mermaidPath = await defaultVisualizationManager.generateVisualization(
      productManager,
      'mermaid'
    );
    if (mermaidPath) {
      console.log(`✅ Mermaid图表已生成: ${mermaidPath}`);
    }
    
    // 生成JSON可视化
    const jsonVisualization = await defaultVisualizationManager.generateVisualization(
      architect,
      'json'
    );
    if (jsonVisualization) {
      console.log(`✅ JSON可视化已生成`);
    }
    
    // 生成历史可视化
    const historyVisualization = await defaultVisualizationManager.generateHistoryVisualization(
      productManager
    );
    if (historyVisualization) {
      console.log(`✅ 历史可视化已生成`);
    }
  } catch (error) {
    console.error('❌ 可视化生成失败:', error);
  }

  // 11. 状态机报告
  console.log('\n📋 状态机报告:');
  
  const pmReport = StateManagementUtils.generateStateMachineReport(productManager, false);
  console.log('产品经理状态机报告:', {
    ID: pmReport.id,
    当前状态: pmReport.currentState,
    运行状态: pmReport.isRunning,
    性能指标: {
      总转换: pmReport.performance.totalTransitions,
      平均时间: `${pmReport.performance.averageTransitionTime.toFixed(2)}ms`,
    },
  });

  // 12. 清理资源
  console.log('\n🧹 清理资源:');
  
  setTimeout(async () => {
    await productManager.dispose();
    await architect.dispose();
    console.log('✅ 状态机资源已清理');
  }, 2000);

  console.log('\n✅ 状态管理系统示例完成!');
  console.log('\n💡 主要特性展示:');
  console.log('  - ✅ 类型安全的状态机定义');
  console.log('  - ✅ 角色专用状态管理');
  console.log('  - ✅ 状态转换守卫和副作用');
  console.log('  - ✅ 错误处理和自动恢复');
  console.log('  - ✅ 状态历史追踪');
  console.log('  - ✅ 性能监控和分析');
  console.log('  - ✅ 状态持久化');
  console.log('  - ✅ 状态可视化');
  console.log('  - ✅ 并行状态管理');
  console.log('  - ✅ 统计信息收集');
}

// 如果直接运行此文件
if (import.meta.main) {
  stateManagementExample().catch(console.error);
}
