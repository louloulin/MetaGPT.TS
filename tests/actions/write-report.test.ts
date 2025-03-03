import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WriteReport } from '../../src/actions/write-report';
import { UserMessage, AIMessage } from '../../src/types/message';
import { ArrayMemory } from '../../src/types/memory';

describe('WriteReport', () => {
  // Create a simple mock LLM provider that returns a string
  const llmProvider = {
    chat: vi.fn().mockResolvedValue(`{
      "title": "Project Status Report",
      "type": "PROJECT_STATUS",
      "format": "DETAILED",
      "executive_summary": "This is a summary of the project status",
      "date": "2023-05-15",
      "author": "AI Assistant",
      "sections": [
        {
          "title": "Progress Overview",
          "content": "Feature A is complete, Feature B has some bugs"
        },
        {
          "title": "Technical Details",
          "content": "Testing coverage is at 95%"
        },
        {
          "title": "Next Steps",
          "content": "Fix bugs in Feature B"
        }
      ],
      "conclusions": ["Project is on track"],
      "recommendations": ["Allocate more resources to bug fixing"],
      "metrics": []
    }`)
  };

  it('should handle empty message list', async () => {
    const memory = new ArrayMemory();
    const writeReport = new WriteReport({
      name: 'WriteReport',
      description: 'Generate a report',
      llm: llmProvider,
      context: { memory }
    });

    const result = await writeReport.run();
    expect(result.status).toBe('failed');
    expect(result.content).toContain('No messages available');
  });

  it('should generate report successfully', async () => {
    const messages = [
      new UserMessage('Project update: Completed feature A'),
      new AIMessage('Testing of feature A shows 95% coverage'),
      new UserMessage('Found some bugs in feature B'),
    ];
    
    const memory = new ArrayMemory();
    for (const message of messages) {
      await memory.add(message);
    }

    console.log('LLM chat mock:', llmProvider.chat);
    
    const writeReport = new WriteReport({
      name: 'WriteReport',
      description: 'Generate a report',
      llm: llmProvider,
      context: { memory }
    });

    const result = await writeReport.run();
    console.log('Generate report result:', result);
    expect(result.status).toBe('completed');
    expect(result.content).toBeDefined();
    expect(result.content).toContain('Project Status Report');
  });

  it('should include specified sections', async () => {
    const messages = [
      new UserMessage('Project milestone: Database migration complete'),
      new AIMessage('Performance metrics show 30% improvement'),
    ];
    
    const memory = new ArrayMemory();
    for (const message of messages) {
      await memory.add(message);
    }

    const writeReport = new WriteReport({
      name: 'WriteReport',
      description: 'Generate a report',
      llm: llmProvider,
      context: { memory },
      args: {
        sections: ['Executive Summary', 'Technical Details', 'Next Steps']
      }
    });

    const result = await writeReport.run();
    expect(result.status).toBe('completed');
    expect(result.content).toBeDefined();
    expect(result.content).toContain('Executive Summary');
    expect(result.content).toContain('Technical Details');
    expect(result.content).toContain('Next Steps');
  });

  it('should handle report type configuration', async () => {
    const messages = [
      new UserMessage('Security audit findings'),
      new AIMessage('Identified 3 critical vulnerabilities'),
    ];
    
    const memory = new ArrayMemory();
    for (const message of messages) {
      await memory.add(message);
    }

    const writeReport = new WriteReport({
      name: 'WriteReport',
      description: 'Generate a report',
      llm: llmProvider,
      context: { memory },
      args: {
        report_type: 'SECURITY_AUDIT'
      }
    });

    const result = await writeReport.run();
    expect(result.status).toBe('completed');
    expect(result.content).toBeDefined();
    expect(result.content).toContain('Security');
    expect(result.content).toContain('Vulnerabilities');
  });
});