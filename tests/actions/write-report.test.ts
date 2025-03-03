import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WriteReport, ReportType, ReportFormat } from '../../src/actions/write-report';
import { createTestLLMProvider } from '../utils/test-llm-provider';
import type { LLMProvider } from '../../src/types/llm';
import { UserMessage, AIMessage } from '../../src/types/message';
import { ArrayMemory } from '../../src/types/memory';

describe('WriteReport', () => {
  let llmProvider: LLMProvider;
  
  beforeEach(() => {
    // Create test LLM provider
    llmProvider = createTestLLMProvider();
    
    // Mock the chat method to return a valid JSON string
    vi.spyOn(llmProvider, 'chat').mockImplementation(async () => {
      return JSON.stringify({
        title: 'Project Status Report',
        type: ReportType.PROJECT_STATUS,
        format: ReportFormat.DETAILED,
        executive_summary: 'This is an executive summary of the project status.',
        date: new Date().toISOString(),
        author: 'Test Author',
        sections: [
          {
            title: 'Project Overview',
            content: 'This is an overview of the project status.',
            key_points: ['Key point 1', 'Key point 2']
          },
          {
            title: 'Technical Details',
            content: 'These are the technical details.',
            key_points: ['Technical point 1', 'Technical point 2']
          },
          {
            title: 'Next Steps',
            content: 'These are the next steps.',
            key_points: ['Next step 1', 'Next step 2']
          }
        ],
        conclusions: ['Conclusion 1', 'Conclusion 2'],
        recommendations: ['Recommendation 1', 'Recommendation 2'],
        metrics: [
          {
            name: 'Performance',
            value: '95%',
            target: '90%',
            status: 'ON_TRACK'
          }
        ]
      });
    });
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

    // Create memory and add messages
    const memory = new ArrayMemory();
    for (const message of messages) {
      await memory.add(message);
    }

    const writeReport = new WriteReport({
      name: 'WriteReport',
      description: 'Generate a report',
      llm: llmProvider,
      memory: memory
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

    // Create memory and add messages
    const memory = new ArrayMemory();
    for (const message of messages) {
      await memory.add(message);
    }

    const writeReport = new WriteReport({
      name: 'WriteReport',
      description: 'Generate a report',
      llm: llmProvider,
      memory: memory,
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

    // For security audit, override the mock to return security-specific content
    vi.spyOn(llmProvider, 'chat').mockImplementation(async () => {
      return JSON.stringify({
        title: 'Security Audit Report',
        type: ReportType.COMPLIANCE,
        format: ReportFormat.DETAILED,
        executive_summary: 'Security audit identified several vulnerabilities.',
        date: new Date().toISOString(),
        author: 'Security Team',
        sections: [
          {
            title: 'Security Overview',
            content: 'Overview of security findings.',
            key_points: ['3 critical vulnerabilities identified']
          },
          {
            title: 'Vulnerabilities',
            content: 'Details of identified vulnerabilities.',
            key_points: ['SQL Injection risk', 'Authentication bypass']
          }
        ],
        conclusions: ['Security needs immediate attention'],
        recommendations: ['Fix critical vulnerabilities within 24 hours'],
        metrics: []
      });
    });

    // Create memory and add messages
    const memory = new ArrayMemory();
    for (const message of messages) {
      await memory.add(message);
    }

    const writeReport = new WriteReport({
      name: 'WriteReport',
      description: 'Generate a report',
      llm: llmProvider,
      memory: memory,
      args: {
        report_type: ReportType.COMPLIANCE
      }
    });

    const result = await writeReport.run();
    expect(result.status).toBe('completed');
    expect(result.content).toBeDefined();
    expect(result.content).toContain('Security');
    expect(result.content).toContain('Vulnerabilities');
  });
});