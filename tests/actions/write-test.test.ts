import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test';
import { WriteTest } from '../../src/actions/write-test';
import type { LLMProvider } from '../../src/types/llm';
import type { ActionConfig } from '../../src/types/action';

// Create a mock LLM provider for testing
const mockLLM: Partial<LLMProvider> = {
  chat: mock(() => Promise.resolve('Mocked test code:\n```typescript\nconst test = true;\n```')),
  getName: mock(() => 'MockLLM'),
  getModel: mock(() => 'mock-model'),
  generate: mock(() => Promise.resolve('Mocked generated text'))
};

describe('WriteTest Action', () => {
  let writeTest: WriteTest;
  
  beforeEach(() => {
    // Create a new WriteTest instance for each test
    writeTest = new WriteTest({
      name: 'WriteTest',
      llm: mockLLM as LLMProvider
    });
  });
  
  afterEach(() => {
    // Clear all mocks after each test
    mock.restore();
  });

  test('should initialize with correct default properties', () => {
    const action = new WriteTest({
      name: 'WriteTest',
      llm: mockLLM as LLMProvider
    });
    expect(action.name).toBe('WriteTest');
    expect(action.desc).toContain('Write comprehensive test cases');
  });

  test('should use custom name if provided', () => {
    const customName = 'CustomWriteTest';
    const action = new WriteTest({
      name: customName,
      llm: mockLLM as LLMProvider
    });
    expect(action.name).toBe(customName);
  });

  test('should generate tests when given code', async () => {
    // Sample code to test
    const code = `
    function add(a: number, b: number): number {
      return a + b;
    }
    `;
    
    // Set the arguments in the context
    writeTest['context'].args = { code };
    
    // Run the action
    const result = await writeTest.run();
    
    // Verify the result
    expect(result.status).toBe('completed');
    expect(result.content).toContain('Mocked test code');
    expect(mockLLM.chat).toHaveBeenCalled();
    
    // Verify the prompt contained the code and framework
    const prompt = (mockLLM.chat as any).mock.calls[0][0];
    expect(prompt).toContain(code);
    expect(prompt).toContain('Testing Framework: jest');
  });

  test('should allow specifying a testing framework', async () => {
    const code = 'function example() { return true; }';
    const framework = 'mocha';
    
    // Set the arguments in the context
    writeTest['context'].args = { code, framework };
    
    // Run the action
    await writeTest.run();
    
    // Verify the prompt contained the specified framework
    const prompt = (mockLLM.chat as any).mock.calls[0][0];
    expect(prompt).toContain(`Testing Framework: ${framework}`);
  });

  test('should allow specifying a language', async () => {
    const code = 'function example() { return true; }';
    const language = 'javascript';
    
    // Set the arguments in the context
    writeTest['context'].args = { code, language };
    
    // Run the action
    await writeTest.run();
    
    // Verify the prompt contained the specified language
    const prompt = (mockLLM.chat as any).mock.calls[0][0];
    expect(prompt).toContain(`Language: ${language}`);
  });

  test('should fail when no code is provided', async () => {
    // Run without setting code
    writeTest['context'].args = {};
    const result = await writeTest.run();
    
    // Verify failure
    expect(result.status).toBe('failed');
    expect(result.content).toContain('No code provided');
    expect(mockLLM.chat).not.toHaveBeenCalled();
  });

  test('should fail when LLM is not available', async () => {
    // Create action without LLM
    const actionConfig: ActionConfig = {
      name: 'WriteTest',
      llm: null as unknown as LLMProvider
    };
    const actionWithoutLLM = new WriteTest(actionConfig);
    
    // Set code
    actionWithoutLLM['context'].args = { code: 'function test() {}' };
    
    // Run the action
    const result = await actionWithoutLLM.run();
    
    // Verify failure
    expect(result.status).toBe('failed');
    expect(result.content).toContain('LLM provider is required');
  });

  test('should handle LLM errors gracefully', async () => {
    // Make LLM throw error
    const originalChat = mockLLM.chat;
    mockLLM.chat = mock(() => {
      throw new Error('LLM API error');
    });
    
    // Set args and run
    writeTest['context'].args = { code: 'function test() {}' };
    const result = await writeTest.run();
    
    // Verify failure handling
    expect(result.status).toBe('failed');
    expect(result.content).toContain('Failed to write tests');
    
    // Restore mock
    mockLLM.chat = originalChat;
  });
}); 