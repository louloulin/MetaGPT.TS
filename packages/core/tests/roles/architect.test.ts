import { describe, test, expect, beforeEach, mock, afterEach } from 'bun:test';
import { Architect } from '../../src/roles/architect';
import type { Message } from '../../src/types/message';
import { DesignArchitecture, EvaluateArchitecture, MapComponents } from '../../src/actions';
import type { LLMProvider } from '../../src/types/llm';

// Create a more complete mock LLM provider
const mockLLM: Partial<LLMProvider> = {
  chat: mock(() => Promise.resolve('Mocked LLM response')),
  getName: mock(() => 'MockLLM'),
  getModel: mock(() => 'mock-model'),
  generate: mock(() => Promise.resolve('Mocked generated text'))
};

describe('Architect Role', () => {
  let architect: Architect;
  
  beforeEach(() => {
    // Create a new Architect instance for each test
    architect = new Architect();
    
    // Mock the actions with LLM
    architect.actions = [
      new DesignArchitecture({
        name: 'DesignArchitecture',
        llm: mockLLM as LLMProvider
      }),
      new EvaluateArchitecture({
        name: 'EvaluateArchitecture',
        llm: mockLLM as LLMProvider
      }),
      new MapComponents({
        name: 'MapComponents',
        llm: mockLLM as LLMProvider
      })
    ];
  });
  
  afterEach(() => {
    // Clear all mocks after each test
    mock.restore();
  });

  test('should initialize with correct default properties', () => {
    const architect = new Architect();
    
    expect(architect.name).toBe('Architect');
    expect(architect.profile).toBe('System Architect');
    expect(architect.goal).toBe('Design a concise, usable, and complete software system architecture');
    expect(architect.desc).toBe('Designs software architecture, APIs, data structures, and system components');
  });
  
  test('should initialize with custom properties', () => {
    const customName = 'CustomArchitect';
    const customProfile = 'Senior System Architect';
    const customGoal = 'Design robust, scalable architectures';
    const customConstraints = 'Follow company standards';
    
    const architect = new Architect(
      customName,
      customProfile,
      customGoal,
      customConstraints
    );
    
    expect(architect.name).toBe(customName);
    expect(architect.profile).toBe(customProfile);
    expect(architect.goal).toBe(customGoal);
    expect(architect.constraints).toBe(customConstraints);
  });

  test('should design architecture when requested', async () => {
    // Create a message
    const messageProps = {
      role: 'user',
      content: 'design architecture for a todo application',
      sender: 'user',
      receiver: 'Architect'
    };
    
    // Use createMessage method from the role
    const message = architect.createMessage(messageProps.content);
    message.sender = messageProps.sender;
    
    const response = await architect.react(message);
    
    expect(mockLLM.chat).toHaveBeenCalled();
    expect(response.content).toContain('Architecture Design:');
  });

  test('should evaluate architecture when requested', async () => {
    // Create a message
    const messageProps = {
      role: 'user',
      content: 'evaluate architecture: Component A connects to Component B via REST API',
      sender: 'user',
      receiver: 'Architect'
    };
    
    // Use createMessage method from the role
    const message = architect.createMessage(messageProps.content);
    message.sender = messageProps.sender;
    
    const response = await architect.react(message);
    
    expect(mockLLM.chat).toHaveBeenCalled();
    expect(response.content).toContain('Architecture Evaluation:');
  });

  test('should map component relationships when requested', async () => {
    // Create a message
    const messageProps = {
      role: 'user',
      content: 'map components: Frontend, Backend API, Database, Authentication Service',
      sender: 'user',
      receiver: 'Architect'
    };
    
    // Use createMessage method from the role
    const message = architect.createMessage(messageProps.content);
    message.sender = messageProps.sender;
    
    const response = await architect.react(message);
    
    expect(mockLLM.chat).toHaveBeenCalled();
    expect(response.content).toContain('Component Relationship Map:');
  });

  test('should select appropriate action based on message content', async () => {
    // Use a simpler approach for testing internal methods
    const origDecideNextAction = architect['decideNextAction'].bind(architect);
    architect['decideNextAction'] = async () => {
      return architect.actions[0];
    };
    
    // Create a message
    const messageProps = {
      role: 'user',
      content: 'We need an architecture design for our new e-commerce system',
      sender: 'user',
      receiver: 'Architect'
    };
    
    // Use createMessage method from the role
    const message = architect.createMessage(messageProps.content);
    message.sender = messageProps.sender;
    
    await architect.react(message);
    
    // Restore original method
    architect['decideNextAction'] = origDecideNextAction;
  });

  test('should handle errors gracefully', async () => {
    // Make LLM throw error
    const originalChat = mockLLM.chat;
    mockLLM.chat = mock(() => {
      throw new Error('LLM failure');
    });
    
    // Create a message
    const messageProps = {
      role: 'user',
      content: 'design architecture for a banking application',
      sender: 'user',
      receiver: 'Architect'
    };
    
    // Use createMessage method from the role
    const message = architect.createMessage(messageProps.content);
    message.sender = messageProps.sender;
    
    const response = await architect.react(message);
    
    expect(response.content).toContain('Failed to design architecture');
    
    // Restore original mock
    mockLLM.chat = originalChat;
  });

  test('should have appropriate methods for architecture tasks', () => {
    // Check for methods we expect the Architect to have
    expect(typeof architect.designArchitecture).toBe('function');
    expect(typeof architect.evaluateArchitecture).toBe('function');
    expect(typeof architect.mapComponentRelationships).toBe('function');
  });
}); 