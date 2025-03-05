import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QAEngineer } from '../../src/roles/qa-engineer';
import { createTestLLMProvider } from '../utils/test-llm-provider';
import type { LLMProvider } from '../../src/types/llm';

describe('QA Engineer', () => {
  let llmProvider: LLMProvider;
  
  beforeEach(() => {
    llmProvider = createTestLLMProvider();
  });

  it('should initialize correctly', () => {
    const qaEngineer = new QAEngineer('test_qa', llmProvider);
    
    expect(qaEngineer.name).toBe('test_qa');
    expect(qaEngineer.llm).toBe(llmProvider);
  });

  it('should analyze code and generate test cases', async () => {
    const qaEngineer = new QAEngineer('test_qa', llmProvider);
    const code = `
      function add(a: number, b: number): number {
        return a + b;
      }
    `;

    const result = await qaEngineer.analyzeCode(code);
    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(result.content).toContain('test');
  });

  it('should handle empty code input', async () => {
    const qaEngineer = new QAEngineer('test_qa', llmProvider);
    
    const result = await qaEngineer.analyzeCode('');
    expect(result.status).toBe('failed');
    expect(result.content).toContain('No code provided');
  });

  it('should generate test plan', async () => {
    const qaEngineer = new QAEngineer('test_qa', llmProvider);
    const requirements = 'Create a calculator app with basic arithmetic operations';

    const result = await qaEngineer.createTestPlan(requirements);
    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(result.content).toContain('test');
  });

  it('should execute test cases', async () => {
    const qaEngineer = new QAEngineer('test_qa', llmProvider);
    const testCases = `
      describe('Calculator', () => {
        it('should add numbers correctly', () => {
          expect(add(2, 3)).toBe(5);
        });
      });
    `;

    const result = await qaEngineer.executeTests(testCases);
    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
  });
}); 