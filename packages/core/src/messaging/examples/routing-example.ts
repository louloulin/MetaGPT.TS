/**
 * TypeScript原生消息路由系统使用示例
 * 
 * 展示消息路由系统的强大功能：
 * - 复杂的消息路由和过滤
 * - 中间件管道处理
 * - 性能监控和指标收集
 * - 类型安全的消息构建
 */

import {
  createMessageRouter,
  MessageFactory,
  RouteRuleFactory,
  ContentFilters,
  PriorityFilters,
  TimeFilters,
  RoleFilters,
  CompositeFilters,
  MessageTransformers,
  RouterMiddlewares,
  MessagePriority,
  MessageRoutingUtils,
  type RoutableMessage,
  type MessageHandler,
} from '../index';

/**
 * 消息路由系统示例
 */
export async function messageRoutingExample() {
  console.log('🚀 MetaGPT.TS 消息路由系统示例');
  
  // 1. 创建高性能消息路由器
  console.log('\n📝 创建消息路由器:');
  
  const router = createMessageRouter({
    name: 'ExampleRouter',
    debug: true,
    maxConcurrency: 20,
    enableMetrics: true,
  });

  // 启动路由器
  router.start();
  console.log(`✅ 路由器已启动: ${router.getConfig().name}`);

  // 2. 添加中间件
  console.log('\n🔧 添加中间件:');
  
  // 性能监控中间件
  router.use(RouterMiddlewares.performance({
    slowThreshold: 100,
    enableMetrics: true,
  }));
  
  // 日志中间件
  router.use(RouterMiddlewares.logging({
    logLevel: 'info',
    includeContent: false,
  }));
  
  // 限流中间件
  router.use(RouterMiddlewares.rateLimit({
    maxRequests: 10,
    windowMs: 1000,
    keyGenerator: (msg) => msg.role,
  }));
  
  console.log('✅ 中间件已配置');

  // 3. 定义消息处理器
  console.log('\n🎯 定义消息处理器:');
  
  const handlers = {
    // 用户消息处理器
    userHandler: ((message: RoutableMessage) => {
      console.log(`👤 处理用户消息: ${message.content.substring(0, 50)}...`);
    }) as MessageHandler,
    
    // 系统消息处理器
    systemHandler: ((message: RoutableMessage) => {
      console.log(`🖥️  处理系统消息: ${message.content.substring(0, 50)}...`);
    }) as MessageHandler,
    
    // 高优先级消息处理器
    urgentHandler: ((message: RoutableMessage) => {
      console.log(`🚨 处理紧急消息: ${message.content.substring(0, 50)}...`);
    }) as MessageHandler,
    
    // 任务消息处理器
    taskHandler: ((message: RoutableMessage) => {
      console.log(`📋 处理任务消息: ${message.content.substring(0, 50)}...`);
    }) as MessageHandler,
    
    // 通知消息处理器
    notificationHandler: ((message: RoutableMessage) => {
      console.log(`🔔 处理通知消息: ${message.content.substring(0, 50)}...`);
    }) as MessageHandler,
  };

  // 4. 配置路由规则
  console.log('\n📋 配置路由规则:');
  
  // 用户消息路由
  const userRule = RouteRuleFactory.createRoleRule(
    'user',
    handlers.userHandler,
    {
      priority: 100,
      description: '处理用户输入消息',
    }
  );
  router.addRule(userRule);
  
  // 系统消息路由
  const systemRule = RouteRuleFactory.createRoleRule(
    'system',
    handlers.systemHandler,
    {
      priority: 200,
      description: '处理系统通知消息',
    }
  );
  router.addRule(systemRule);
  
  // 高优先级消息路由
  const urgentRule = RouteRuleFactory.createPriorityRule(
    MessagePriority.HIGH,
    handlers.urgentHandler,
    {
      operator: '>=',
      priority: 300,
      description: '处理高优先级消息',
    }
  );
  router.addRule(urgentRule);
  
  // 任务消息路由（带过滤器）
  router.addRule({
    id: 'task-rule',
    pattern: 'topic:task',
    filters: [
      ContentFilters.minLength(10),
      RoleFilters.hasTag('task'),
    ],
    transformers: [
      MessageTransformers.addTag('processed'),
    ],
    handlers: [handlers.taskHandler],
    priority: 250,
    enabled: true,
    description: '处理任务相关消息',
  });
  
  // 通知消息路由（复合过滤器）
  router.addRule({
    id: 'notification-rule',
    pattern: '*',
    filters: [
      CompositeFilters.and(
        RoleFilters.messageType('notification'),
        CompositeFilters.or(
          RoleFilters.hasTag('urgent'),
          PriorityFilters.minPriority(MessagePriority.HIGH)
        )
      ),
    ],
    transformers: [
      MessageTransformers.addTag('notification-processed'),
      MessageTransformers.addMetadata({ processedAt: new Date() }),
    ],
    handlers: [handlers.notificationHandler],
    priority: 400,
    enabled: true,
    description: '处理紧急通知消息',
  });
  
  console.log(`✅ 已配置 ${router.getAllRules().length} 个路由规则`);

  // 5. 创建和路由各种消息
  console.log('\n📨 创建和路由消息:');
  
  const messages = [
    // 用户消息
    MessageFactory.createUserMessage('我需要帮助完成这个项目', {
      priority: MessagePriority.NORMAL,
      tags: ['help', 'project'],
    }),
    
    // 系统消息
    MessageFactory.createSystemMessage('系统维护将在今晚进行', {
      priority: MessagePriority.HIGH,
      tags: ['maintenance', 'system'],
    }),
    
    // 任务消息
    MessageFactory.createTaskMessage(
      '请在明天之前完成代码审查',
      'code-review',
      {
        priority: MessagePriority.HIGH,
        assignee: 'developer-123',
        deadline: new Date(Date.now() + 86400000),
      }
    ),
    
    // 紧急通知
    MessageFactory.createNotificationMessage(
      '服务器CPU使用率超过90%',
      'alert',
      {
        urgent: true,
        recipients: ['admin-1', 'admin-2'],
        metadata: { severity: 'critical', source: 'monitoring' },
      }
    ),
    
    // 低优先级消息（可能被过滤）
    MessageFactory.createUserMessage('Hi', {
      priority: MessagePriority.LOW,
    }),
  ];

  // 路由所有消息
  for (const [index, message] of messages.entries()) {
    console.log(`\n📤 路由消息 ${index + 1}:`);
    console.log(`   类型: ${message.messageType}`);
    console.log(`   角色: ${message.role}`);
    console.log(`   优先级: ${message.priority}`);
    console.log(`   标签: ${Array.from(message.routingTags).join(', ')}`);
    
    try {
      const result = await router.route(message);
      console.log(`   ✅ 路由成功: ${result.handlerCount} 个处理器执行 (${result.duration}ms)`);
      if (result.matchedPattern) {
        console.log(`   🎯 匹配模式: ${result.matchedPattern}`);
      }
    } catch (error) {
      console.log(`   ❌ 路由失败: ${error}`);
    }
  }

  // 6. 性能分析
  console.log('\n📊 性能分析:');
  
  const metrics = router.getMetrics();
  console.log('路由器指标:', {
    总消息数: metrics.totalMessages,
    成功消息数: metrics.successfulMessages,
    失败消息数: metrics.failedMessages,
    过滤消息数: metrics.filteredMessages,
    平均处理时间: `${metrics.averageProcessingTime.toFixed(2)}ms`,
    活跃规则数: metrics.activeRules,
  });
  
  const analysis = MessageRoutingUtils.analyzeRouterPerformance(router);
  if (analysis.recommendations.length > 0) {
    console.log('\n💡 性能建议:');
    analysis.recommendations.forEach((rec, index) => {
      console.log(`   ${index + 1}. ${rec}`);
    });
  }

  // 7. 测试复杂过滤器
  console.log('\n🔍 测试复杂过滤器:');
  
  // 创建时间敏感的消息
  const timeMessage = MessageFactory.createUserMessage('工作时间内的消息', {
    priority: MessagePriority.NORMAL,
    tags: ['work-hours'],
  });
  
  // 添加工作时间过滤规则
  router.addRule({
    id: 'work-hours-rule',
    pattern: 'topic:work-hours',
    filters: [
      TimeFilters.workingHours(9, 17),
      TimeFilters.weekdaysOnly(),
    ],
    transformers: [],
    handlers: [(message) => {
      console.log(`⏰ 工作时间消息处理: ${message.content}`);
    }],
    priority: 150,
    enabled: true,
    description: '仅在工作时间处理的消息',
  });
  
  const timeResult = await router.route(timeMessage);
  console.log(`工作时间消息路由结果: ${timeResult.success ? '成功' : '失败'} (${timeResult.handlerCount} 个处理器)`);

  // 8. 测试自定义匹配器
  console.log('\n🎨 测试自定义匹配器:');
  
  // 添加自定义匹配器到默认匹配器
  const matcher = router['matcher']; // 访问私有属性用于演示
  if (matcher && typeof matcher.addCustomMatcher === 'function') {
    matcher.addCustomMatcher('wordCount', (pattern: string, message: RoutableMessage) => {
      const [operator, value] = pattern.split(':');
      const wordCount = message.content.split(' ').length;
      const targetCount = parseInt(value);
      
      switch (operator) {
        case '>': return wordCount > targetCount;
        case '<': return wordCount < targetCount;
        case '>=': return wordCount >= targetCount;
        case '<=': return wordCount <= targetCount;
        case '=': return wordCount === targetCount;
        default: return false;
      }
    });
    
    // 添加使用自定义匹配器的规则
    router.addRule({
      id: 'word-count-rule',
      pattern: 'custom:wordCount:>:5' as any,
      filters: [],
      transformers: [],
      handlers: [(message) => {
        const wordCount = message.content.split(' ').length;
        console.log(`📝 长文本消息处理 (${wordCount} 词): ${message.content.substring(0, 30)}...`);
      }],
      priority: 120,
      enabled: true,
      description: '处理超过5个词的消息',
    });
    
    const longMessage = MessageFactory.createUserMessage(
      '这是一个包含很多词汇的长消息，用于测试自定义匹配器的功能'
    );
    
    const customResult = await router.route(longMessage);
    console.log(`自定义匹配器测试结果: ${customResult.success ? '成功' : '失败'} (${customResult.handlerCount} 个处理器)`);
  }

  // 9. 死信队列演示
  console.log('\n💀 死信队列演示:');
  
  // 添加会失败的规则
  router.addRule({
    id: 'failing-rule',
    pattern: 'topic:fail-test',
    filters: [],
    transformers: [],
    handlers: [() => {
      throw new Error('故意失败的处理器');
    }],
    priority: 500,
    enabled: true,
    description: '故意失败的规则用于测试死信队列',
  });
  
  const failMessage = MessageFactory.createUserMessage('测试失败处理', {
    tags: ['fail-test'],
  });
  
  try {
    await router.route(failMessage);
  } catch (error) {
    console.log(`❌ 预期的失败: ${error}`);
  }
  
  const deadLetterQueue = router.getDeadLetterQueue();
  console.log(`💀 死信队列大小: ${deadLetterQueue.length}`);

  // 10. 清理和总结
  console.log('\n🧹 清理资源:');
  
  router.stop();
  console.log('✅ 路由器已停止');
  
  const finalMetrics = router.getMetrics();
  console.log('\n📈 最终统计:');
  console.log(`   总处理消息: ${finalMetrics.totalMessages}`);
  console.log(`   成功率: ${((finalMetrics.successfulMessages / finalMetrics.totalMessages) * 100).toFixed(1)}%`);
  console.log(`   平均处理时间: ${finalMetrics.averageProcessingTime.toFixed(2)}ms`);
  console.log(`   配置规则数: ${finalMetrics.activeRules}`);

  console.log('\n✅ 消息路由系统示例完成!');
  console.log('\n💡 主要特性展示:');
  console.log('  - ✅ 高性能消息路由引擎');
  console.log('  - ✅ 灵活的过滤和转换机制');
  console.log('  - ✅ 类型安全的消息构建');
  console.log('  - ✅ 丰富的中间件支持');
  console.log('  - ✅ 性能监控和指标收集');
  console.log('  - ✅ 复杂的路由模式匹配');
  console.log('  - ✅ 自定义匹配器扩展');
  console.log('  - ✅ 死信队列和错误处理');
  console.log('  - ✅ 并发控制和限流');
  console.log('  - ✅ 实时性能分析');
}

// 如果直接运行此文件
if (import.meta.main) {
  messageRoutingExample().catch(console.error);
}
