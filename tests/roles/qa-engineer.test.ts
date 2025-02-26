import { describe, test, expect, beforeEach, mock, afterEach } from 'bun:test';
import { QAEngineer } from '../../src/roles/qa-engineer';
import { WriteTest } from '../../src/actions/write-test';
import type { Message } from '../../src/types/message';
import type { LLMProvider } from '../../src/types/llm';

// Create a mock LLM provider for testing
const mockLLM: Partial<LLMProvider> = {
  chat: mock(() => Promise.resolve('Mocked LLM response')),
  getName: mock(() => 'MockLLM'),
  getModel: mock(() => 'mock-model'),
  generate: mock(() => Promise.resolve('Mocked generated text'))
};

// Helper to create a message for testing
const createTestMessage = (content: string): Message => {
  return {
    id: 'test-id',
    content,
    role: 'user',
    causedBy: 'test',
    sentFrom: 'user',
    sendTo: new Set(['QAEngineer']),
    timestamp: new Date().toISOString(),
  };
};

describe('QA Engineer Role', () => {
  let qaEngineer: QAEngineer;
  
  beforeEach(() => {
    // Create a new QAEngineer instance for each test
    qaEngineer = new QAEngineer();
    
    // Mock the actions with LLM
    qaEngineer.actions = [
      new WriteTest({
        name: 'WriteTest',
        llm: mockLLM as LLMProvider
      })
    ];
  });
  
  afterEach(() => {
    // Clear all mocks after each test
    mock.restore();
  });

  test('should initialize with correct default properties', () => {
    const qaEngineer = new QAEngineer();
    
    expect(qaEngineer.name).toBe('QAEngineer');
    expect(qaEngineer.profile).toBe('Quality Assurance Engineer');
    expect(qaEngineer.goal).toBe('Ensure high quality code with thorough testing and bug detection');
    expect(qaEngineer.desc).toBe('Creates test plans, writes test cases, identifies bugs, and provides quality feedback');
  });
  
  test('should initialize with custom properties', () => {
    const customName = 'CustomQAEngineer';
    const customProfile = 'Senior QA Engineer';
    const customGoal = 'Find and fix all bugs';
    const customConstraints = 'Focus on critical paths';
    
    const qaEngineer = new QAEngineer(
      customName,
      customProfile,
      customGoal,
      customConstraints
    );
    
    expect(qaEngineer.name).toBe(customName);
    expect(qaEngineer.profile).toBe(customProfile);
    expect(qaEngineer.goal).toBe(customGoal);
    expect(qaEngineer.constraints).toBe(customConstraints);
  });

  test('should create test plan when requested', async () => {
    const message = createTestMessage('create test plan for a login component');
    
    const response = await qaEngineer.react(message);
    
    expect(mockLLM.chat).toHaveBeenCalled();
    expect(response.content).toContain('Test Plan:');
  });

  test('should write test cases when requested', async () => {
    const message = createTestMessage('write test cases for a user authentication function');
    
    const response = await qaEngineer.react(message);
    
    expect(mockLLM.chat).toHaveBeenCalled();
    expect(response.content).toContain('Test Cases:');
  });

  test('should find bugs when requested', async () => {
    const message = createTestMessage('find bugs in this code: function add(a,b) { return a - b; }');
    
    const response = await qaEngineer.react(message);
    
    expect(mockLLM.chat).toHaveBeenCalled();
    expect(response.content).toContain('Bug Report:');
  });

  test('should review test coverage when requested', async () => {
    const message = createTestMessage('review test coverage for our authentication module');
    
    const response = await qaEngineer.react(message);
    
    expect(mockLLM.chat).toHaveBeenCalled();
    expect(response.content).toContain('Test Coverage Report:');
  });

  test('should handle errors gracefully', async () => {
    // Make LLM throw error
    const originalChat = mockLLM.chat;
    mockLLM.chat = mock(() => {
      throw new Error('LLM failure');
    });
    
    const message = createTestMessage('create test plan for our payment system');
    
    const response = await qaEngineer.react(message);
    
    expect(response.content).toContain('Failed to create test plan');
    
    // Restore original mock
    mockLLM.chat = originalChat;
  });

  test('should have appropriate methods for QA tasks', () => {
    // Check for methods we expect the QAEngineer to have
    expect(typeof qaEngineer.createTestPlan).toBe('function');
    expect(typeof qaEngineer.writeTestCases).toBe('function');
    expect(typeof qaEngineer.findBugs).toBe('function');
    expect(typeof qaEngineer.reviewTestCoverage).toBe('function');
  });
}); 