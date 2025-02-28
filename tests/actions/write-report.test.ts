import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WriteReport } from '../../src/actions/write-report';
import { createTestLLMProvider } from '../utils/test-llm-provider';
import type { LLMProvider } from '../../src/types/llm';
import { UserMessage, AIMessage } from '../../src/types/message';

describe('WriteReport', () => {
  let llmProvider: LLMProvider;
  
  beforeEach(() => {
    llmProvider = createTestLLMProvider();
  });

  it('should handle empty message list', async () => {
    const writeReport = new WriteReport({
      name: 'WriteReport',
      description: 'Generate a report',
      llm: llmProvider
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

    const writeReport = new WriteReport({
      name: 'WriteReport',
      description: 'Generate a report',
      llm: llmProvider,
      messages
    });

    const result = await writeReport.run();
    expect(result.status).toBe('completed');
    expect(result.content).toBeDefined();
    expect(result.content).toContain('Project Status Report');
  });

  it('should include specified sections', async () => {
    const messages = [
      new UserMessage('Project milestone: Database migration complete'),
      new AIMessage('Performance metrics show 30% improvement'),
    ];

    const writeReport = new WriteReport({
      name: 'WriteReport',
      description: 'Generate a report',
      llm: llmProvider,
      messages,
      sections: ['Executive Summary', 'Technical Details', 'Next Steps']
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

    const writeReport = new WriteReport({
      name: 'WriteReport',
      description: 'Generate a report',
      llm: llmProvider,
      messages,
      reportType: 'SECURITY_AUDIT'
    });

    const result = await writeReport.run();
    expect(result.status).toBe('completed');
    expect(result.content).toBeDefined();
    expect(result.content).toContain('Security');
    expect(result.content).toContain('Vulnerabilities');
  });
});