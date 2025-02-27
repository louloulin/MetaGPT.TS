import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WriteTutorial, TutorialLevel, TutorialFormat } from '../../src/actions/write-tutorial';
import { UserMessage } from '../../src/types/message';

describe('WriteTutorial', () => {
  let mockLLM: any;
  let writeTutorial: WriteTutorial;

  beforeEach(() => {
    // Create mock LLM
    mockLLM = {
      chat: vi.fn(),
      getName: () => 'MockLLM',
      getModel: () => 'test-model',
      generate: vi.fn(),
    };

    // Create WriteTutorial instance
    writeTutorial = new WriteTutorial({
      name: 'WriteTutorial',
      llm: mockLLM,
      args: {
        level: TutorialLevel.BEGINNER,
        format: TutorialFormat.STEP_BY_STEP,
        include_exercises: true
      }
    });
  });

  it('should create a WriteTutorial instance', () => {
    expect(writeTutorial).toBeInstanceOf(WriteTutorial);
    expect(writeTutorial.name).toBe('WriteTutorial');
  });

  it('should handle empty message list', async () => {
    const result = await writeTutorial.run();
    expect(result.status).toBe('failed');
    expect(result.content).toContain('No messages available');
  });

  it('should generate tutorial successfully', async () => {
    // Mock successful LLM response
    const mockTutorial = {
      title: 'Getting Started with TypeScript',
      description: 'A beginner-friendly introduction to TypeScript',
      prerequisites: ['Basic JavaScript knowledge'],
      learning_objectives: ['Understand TypeScript basics'],
      difficulty_level: TutorialLevel.BEGINNER,
      format: TutorialFormat.STEP_BY_STEP,
      estimated_time: '1 hour',
      sections: [
        {
          title: 'Introduction',
          content: 'TypeScript is a typed superset of JavaScript',
          code_examples: ['const message: string = "Hello TypeScript";'],
          key_points: ['TypeScript adds type safety'],
          exercises: [
            {
              description: 'Create a simple typed variable',
              solution: 'const age: number = 25;'
            }
          ]
        }
      ],
      summary: 'You learned TypeScript basics',
      further_reading: ['TypeScript Handbook'],
      keywords: ['typescript', 'javascript', 'programming']
    };

    mockLLM.chat.mockResolvedValue(JSON.stringify(mockTutorial));

    // Add a message to process
    writeTutorial.context.memory.add(new UserMessage('Create a TypeScript tutorial for beginners'));

    // Run tutorial generation
    const result = await writeTutorial.run();

    // Verify result
    expect(result.status).toBe('completed');
    expect(result.content).toContain('# Getting Started with TypeScript');
    expect(result.content).toContain('## Prerequisites');
    expect(result.content).toContain('## Learning Objectives');
    expect(result.content).toContain('## Introduction');
    expect(result.content).toContain('```typescript\nconst message: string = "Hello TypeScript";\n```');
    expect(result.content).toContain('### Exercise');
  });

  it('should handle LLM response parsing error', async () => {
    // Mock LLM response with invalid JSON
    mockLLM.chat.mockResolvedValue('Invalid JSON response');

    // Add a message to process
    writeTutorial.context.memory.add(new UserMessage('Create a TypeScript tutorial'));

    // Run tutorial generation
    const result = await writeTutorial.run();

    // Verify fallback behavior
    expect(result.status).toBe('completed');
    expect(result.content).toContain('Basic Tutorial');
    expect(result.content).toContain('Introduction');
    expect(result.content).toContain('No prerequisites specified');
  });

  it('should handle missing fields in LLM response', async () => {
    // Mock LLM response with missing fields
    const partialTutorial = {
      title: 'Partial Tutorial',
      description: 'Test tutorial'
      // Other fields missing
    };

    mockLLM.chat.mockResolvedValue(JSON.stringify(partialTutorial));

    // Add a message to process
    writeTutorial.context.memory.add(new UserMessage('Create a tutorial'));

    // Run tutorial generation
    const result = await writeTutorial.run();

    // Verify default values are used
    expect(result.status).toBe('completed');
    expect(result.content).toContain('# Partial Tutorial');
    expect(result.content).toContain('No prerequisites specified');
    expect(result.content).toContain('Basic concepts');
  });

  it('should respect configuration options', async () => {
    // Create instance with specific configuration
    const customTutorial = new WriteTutorial({
      name: 'WriteTutorial',
      llm: mockLLM,
      args: {
        level: TutorialLevel.ADVANCED,
        format: TutorialFormat.PROJECT_BASED,
        include_exercises: true,
        target_audience: 'Experienced developers',
        max_length: 5000,
        focus_areas: ['Advanced TypeScript features']
      }
    });

    // Mock successful LLM response
    const mockTutorial = {
      title: 'Advanced TypeScript Patterns',
      difficulty_level: TutorialLevel.ADVANCED,
      format: TutorialFormat.PROJECT_BASED,
      sections: [
        {
          title: 'Advanced Types',
          content: 'Understanding advanced TypeScript types',
          exercises: [{ description: 'Complex type challenge' }]
        }
      ]
    };

    mockLLM.chat.mockResolvedValue(JSON.stringify(mockTutorial));

    // Add a message to process
    customTutorial.context.memory.add(new UserMessage('Create an advanced TypeScript tutorial'));

    // Run tutorial generation
    const result = await customTutorial.run();

    // Verify configuration was respected
    expect(result.content).toContain('Advanced TypeScript Patterns');
    expect(result.content).toContain('Difficulty: ADVANCED');
    expect(result.content).toContain('Format: PROJECT_BASED');
  });
}); 