import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WriteReport, ReportType, ReportFormat } from '../../src/actions/write-report';
import { UserMessage } from '../../src/types/message';

describe('WriteReport', () => {
  let mockLLM: any;
  let writeReport: WriteReport;

  beforeEach(() => {
    // Create mock LLM
    mockLLM = {
      chat: vi.fn(),
      getName: () => 'MockLLM',
      getModel: () => 'test-model',
      generate: vi.fn(),
    };

    // Create WriteReport instance
    writeReport = new WriteReport({
      name: 'WriteReport',
      llm: mockLLM,
      args: {
        report_type: ReportType.PROJECT_STATUS,
        format: ReportFormat.DETAILED,
        include_metrics: true,
        include_recommendations: true
      }
    });
  });

  it('should create a WriteReport instance', () => {
    expect(writeReport).toBeInstanceOf(WriteReport);
    expect(writeReport.name).toBe('WriteReport');
  });

  it('should handle empty message list', async () => {
    const result = await writeReport.run();
    expect(result.status).toBe('failed');
    expect(result.content).toContain('No messages available');
  });

  it('should generate report successfully', async () => {
    // Mock successful LLM response
    const mockReport = {
      title: 'Project Status Report',
      type: ReportType.PROJECT_STATUS,
      format: ReportFormat.DETAILED,
      executive_summary: 'Summary of project progress',
      date: '2024-03-20',
      author: 'Test Author',
      sections: [
        {
          title: 'Progress Overview',
          content: 'Project is on track',
          key_points: ['Milestone 1 completed', 'Milestone 2 in progress'],
          data_points: [
            {
              label: 'Tasks Completed',
              value: 25,
              unit: 'tasks',
              trend: 'UP',
              change_percentage: 10
            }
          ],
          recommendations: ['Increase testing coverage']
        }
      ],
      metrics: [
        {
          name: 'Sprint Velocity',
          value: 45,
          target: 50,
          status: 'AT_RISK'
        }
      ],
      conclusions: ['Project is progressing well'],
      recommendations: ['Add more automated tests'],
      next_steps: ['Complete Milestone 2']
    };

    mockLLM.chat.mockResolvedValue(JSON.stringify(mockReport));

    // Add a message to process
    writeReport.context.memory.add(new UserMessage('Generate project status report'));

    // Run report generation
    const result = await writeReport.run();

    // Verify result
    expect(result.status).toBe('completed');
    expect(result.content).toContain('# Project Status Report');
    expect(result.content).toContain('## Executive Summary');
    expect(result.content).toContain('## Progress Overview');
    expect(result.content).toContain('Tasks Completed: 25 tasks (↑ 10%)');
    expect(result.content).toContain('Sprint Velocity: 45 (Target: 50) - AT RISK');
    expect(result.content).toContain('### Recommendations');
  });

  it('should handle LLM response parsing error', async () => {
    // Mock LLM response with invalid JSON
    mockLLM.chat.mockResolvedValue('Invalid JSON response');

    // Add a message to process
    writeReport.context.memory.add(new UserMessage('Generate report'));

    // Run report generation
    const result = await writeReport.run();

    // Verify fallback behavior
    expect(result.status).toBe('completed');
    expect(result.content).toContain('Basic Report');
    expect(result.content).toContain('Generated based on available information');
  });

  it('should handle missing fields in LLM response', async () => {
    // Mock LLM response with missing fields
    const partialReport = {
      title: 'Partial Report',
      type: ReportType.TECHNICAL
      // Other fields missing
    };

    mockLLM.chat.mockResolvedValue(JSON.stringify(partialReport));

    // Add a message to process
    writeReport.context.memory.add(new UserMessage('Generate report'));

    // Run report generation
    const result = await writeReport.run();

    // Verify default values are used
    expect(result.status).toBe('completed');
    expect(result.content).toContain('# Partial Report');
    expect(result.content).toContain('Type: TECHNICAL');
  });

  it('should format complex sections with all optional fields', async () => {
    // Mock report with complex nested sections
    const mockReport = {
      title: 'Complex Report',
      type: ReportType.ANALYSIS,
      format: ReportFormat.DETAILED,
      executive_summary: 'Complex analysis report',
      date: '2024-03-20',
      author: 'Test Author',
      sections: [
        {
          title: 'Main Section',
          content: 'Main content',
          key_points: ['Key point 1', 'Key point 2'],
          data_points: [
            {
              label: 'Metric 1',
              value: 100,
              unit: 'units',
              trend: 'UP',
              change_percentage: 20
            }
          ],
          subsections: [
            {
              title: 'Subsection 1',
              content: 'Subsection content',
              recommendations: ['Sub recommendation']
            }
          ],
          recommendations: ['Main recommendation'],
          references: ['Reference 1']
        }
      ],
      conclusions: ['Main conclusion'],
      recommendations: ['Overall recommendation']
    };

    mockLLM.chat.mockResolvedValue(JSON.stringify(mockReport));

    // Add a message to process
    writeReport.context.memory.add(new UserMessage('Generate complex report'));

    // Run report generation
    const result = await writeReport.run();

    // Verify complex formatting
    expect(result.status).toBe('completed');
    expect(result.content).toContain('# Complex Report');
    expect(result.content).toContain('## Main Section');
    expect(result.content).toContain('### Key Points');
    expect(result.content).toContain('### Data Points');
    expect(result.content).toContain('### Subsection 1');
    expect(result.content).toContain('### Recommendations');
    expect(result.content).toContain('### References');
  });
});