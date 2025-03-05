import { BaseAction } from './base-action';
import type { ActionOutput, ActionConfig } from '../types/action';
import { logger } from '../utils/logger';

/**
 * Difficulty levels for concept explanation
 */
export enum ExplanationLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  EXPERT = 'expert'
}

/**
 * Learning style preferences
 */
export enum LearningStyle {
  VISUAL = 'visual',
  AUDITORY = 'auditory',
  READING = 'reading',
  KINESTHETIC = 'kinesthetic'
}

/**
 * Example type for concept explanation
 */
export interface ConceptExample {
  context: string;
  code?: string;
  explanation: string;
  keyPoints: string[];
}

/**
 * Visual aid type for concept explanation
 */
export interface VisualAid {
  type: 'diagram' | 'flowchart' | 'mindmap' | 'comparison';
  description: string;
  elements: {
    id: string;
    label: string;
    details?: string;
    connections?: string[];
  }[];
}

/**
 * Practice exercise type
 */
export interface PracticeExercise {
  id: string;
  type: 'multiple_choice' | 'coding' | 'open_ended';
  question: string;
  difficulty: ExplanationLevel;
  hints?: string[];
  solution?: string;
  explanation?: string;
}

/**
 * Related concept type
 */
export interface RelatedConcept {
  name: string;
  relationship: 'prerequisite' | 'similar' | 'advanced' | 'alternative';
  description: string;
  importance: 'essential' | 'helpful' | 'optional';
}

/**
 * Concept explanation result
 */
export interface ConceptExplanation {
  overview: {
    concept: string;
    shortDefinition: string;
    level: ExplanationLevel;
    targetAudience: string[];
    prerequisites: string[];
  };
  coreConcepts: {
    definition: string;
    keyPoints: string[];
    commonMisconceptions: string[];
  };
  explanation: {
    mainContent: string;
    sections: {
      title: string;
      content: string;
      importance: 'high' | 'medium' | 'low';
    }[];
    visualAids: VisualAid[];
  };
  examples: ConceptExample[];
  practice: {
    exercises: PracticeExercise[];
    projects: {
      title: string;
      description: string;
      steps: string[];
      learningOutcomes: string[];
    }[];
  };
  connections: {
    relatedConcepts: RelatedConcept[];
    realWorldApplications: string[];
    industryUsage: string[];
  };
  resources: {
    documentation: string[];
    tutorials: string[];
    books: string[];
    communities: string[];
  };
}

/**
 * Action for explaining concepts clearly and thoroughly
 */
export class ExplainConcept extends BaseAction {
  constructor(config: ActionConfig) {
    super({
      ...config,
      name: config.name || 'ExplainConcept',
      description: config.description || 'Explain concepts clearly and thoroughly'
    });
  }

  protected async prompt(): Promise<string> {
    // Get and validate required arguments
    const concept = this.getArg<string>('concept');
    if (!concept) {
      throw new Error('Concept is required for explanation');
    }

    // Get optional arguments with defaults
    const level = this.getArg<ExplanationLevel>('level') || ExplanationLevel.INTERMEDIATE;
    const style = this.getArg<LearningStyle>('style') || LearningStyle.READING;
    const context = this.getArg<string>('context') || '';
    const focus = this.getArg<string[]>('focus') || [];
    const includeExercises = this.getArg<boolean>('includeExercises') || true;

    // Log explanation start
    logger.info(`[${this.name}] Starting concept explanation`);
    logger.debug(`[${this.name}] Configuration:`, {
      level,
      style,
      hasContext: !!context,
      focusAreas: focus,
      includeExercises
    });

    return `As an educational expert, please explain the following concept comprehensively:

Concept: ${concept}

${context ? `Context:
${context}

` : ''}${focus.length ? `Focus Areas:
${focus.join('\n')}

` : ''}Configuration:
- Difficulty Level: ${level}
- Learning Style: ${style}
- Include Exercises: ${includeExercises}

Please provide the explanation in the following JSON format:

{
  "overview": {
    "concept": "Concept name",
    "shortDefinition": "One-sentence definition",
    "level": "${Object.values(ExplanationLevel).join('" | "')}",
    "targetAudience": ["Intended audience"],
    "prerequisites": ["Required knowledge"]
  },
  "coreConcepts": {
    "definition": "Detailed definition",
    "keyPoints": ["Key points to understand"],
    "commonMisconceptions": ["Common misconceptions"]
  },
  "explanation": {
    "mainContent": "Main explanation text",
    "sections": [
      {
        "title": "Section title",
        "content": "Section content",
        "importance": "high | medium | low"
      }
    ],
    "visualAids": [
      {
        "type": "diagram | flowchart | mindmap | comparison",
        "description": "Visual aid description",
        "elements": [
          {
            "id": "Element ID",
            "label": "Element label",
            "details": "Element details",
            "connections": ["Connected element IDs"]
          }
        ]
      }
    ]
  },
  "examples": [
    {
      "context": "Example context",
      "code": "Example code if applicable",
      "explanation": "Example explanation",
      "keyPoints": ["Key points from example"]
    }
  ],
  "practice": {
    "exercises": [
      {
        "id": "Exercise ID",
        "type": "multiple_choice | coding | open_ended",
        "question": "Exercise question",
        "difficulty": "${Object.values(ExplanationLevel).join('" | "')}",
        "hints": ["Exercise hints"],
        "solution": "Exercise solution",
        "explanation": "Solution explanation"
      }
    ],
    "projects": [
      {
        "title": "Project title",
        "description": "Project description",
        "steps": ["Project steps"],
        "learningOutcomes": ["Expected outcomes"]
      }
    ]
  },
  "connections": {
    "relatedConcepts": [
      {
        "name": "Related concept name",
        "relationship": "prerequisite | similar | advanced | alternative",
        "description": "Relationship description",
        "importance": "essential | helpful | optional"
      }
    ],
    "realWorldApplications": ["Real-world applications"],
    "industryUsage": ["Industry usage examples"]
  },
  "resources": {
    "documentation": ["Documentation links"],
    "tutorials": ["Tutorial links"],
    "books": ["Book recommendations"],
    "communities": ["Community resources"]
  }
}

Please ensure:
1. The explanation matches the specified difficulty level
2. Examples are practical and relevant
3. Visual aids are clear and helpful
4. Exercises reinforce key concepts
5. Resources are current and valuable`;
  }

  /**
   * Parse and validate the concept explanation
   * @param response The LLM response
   * @returns Parsed concept explanation
   */
  private parseConceptExplanation(response: string): ConceptExplanation {
    try {
      const result = JSON.parse(response);
      
      // Validate required sections
      if (!result.overview || !result.coreConcepts || !result.explanation || 
          !result.examples || !result.practice || !result.connections || 
          !result.resources) {
        throw new Error('Missing required sections in concept explanation');
      }

      // Validate overview
      if (!result.overview.concept || !result.overview.shortDefinition || 
          !result.overview.level || !result.overview.targetAudience || 
          !result.overview.prerequisites) {
        throw new Error('Missing required fields in overview');
      }

      return result;
    } catch (error) {
      logger.error(`[${this.name}] Failed to parse concept explanation:`, error);
      throw new Error(`Failed to parse concept explanation: ${error}`);
    }
  }

  /**
   * Format the concept explanation as markdown
   * @param explanation The concept explanation
   * @returns Formatted markdown string
   */
  private formatConceptExplanation(explanation: ConceptExplanation): string {
    return `# ${explanation.overview.concept}

## Overview
${explanation.overview.shortDefinition}

**Level:** ${explanation.overview.level}  
**Target Audience:** ${explanation.overview.targetAudience.join(', ')}

### Prerequisites
${explanation.overview.prerequisites.map(prereq => `- ${prereq}`).join('\n')}

## Core Concepts
${explanation.coreConcepts.definition}

### Key Points
${explanation.coreConcepts.keyPoints.map(point => `- ${point}`).join('\n')}

### Common Misconceptions
${explanation.coreConcepts.commonMisconceptions.map(misconception => `- ${misconception}`).join('\n')}

## Detailed Explanation
${explanation.explanation.mainContent}

${explanation.explanation.sections.map(section => `
### ${section.title}
> Importance: ${section.importance}

${section.content}`).join('\n')}

## Visual Aids
${explanation.explanation.visualAids.map(aid => `
### ${aid.type.charAt(0).toUpperCase() + aid.type.slice(1)}
${aid.description}

Elements:
${aid.elements.map(element => `- **${element.label}**: ${element.details || ''}${element.connections?.length ? `\n  Connected to: ${element.connections.join(', ')}` : ''}`).join('\n')}`).join('\n')}

## Examples
${explanation.examples.map(example => `
### Example: ${example.context}
${example.code ? `
\`\`\`
${example.code}
\`\`\`
` : ''}
${example.explanation}

**Key Points:**
${example.keyPoints.map(point => `- ${point}`).join('\n')}`).join('\n')}

## Practice

### Exercises
${explanation.practice.exercises.map(exercise => `
#### ${exercise.id}: ${exercise.type.toUpperCase()}
${exercise.question}

**Difficulty:** ${exercise.difficulty}

${exercise.hints?.length ? `**Hints:**
${exercise.hints.map(hint => `- ${hint}`).join('\n')}` : ''}

${exercise.solution ? `<details>
<summary>Solution</summary>

${exercise.solution}

${exercise.explanation ? `**Explanation:**
${exercise.explanation}` : ''}
</details>` : ''}`).join('\n')}

### Projects
${explanation.practice.projects.map(project => `
#### ${project.title}
${project.description}

**Steps:**
${project.steps.map((step, index) => `${index + 1}. ${step}`).join('\n')}

**Learning Outcomes:**
${project.learningOutcomes.map(outcome => `- ${outcome}`).join('\n')}`).join('\n')}

## Connections

### Related Concepts
${explanation.connections.relatedConcepts.map(concept => `
#### ${concept.name} (${concept.importance})
- **Relationship:** ${concept.relationship}
- **Description:** ${concept.description}`).join('\n')}

### Real-world Applications
${explanation.connections.realWorldApplications.map(app => `- ${app}`).join('\n')}

### Industry Usage
${explanation.connections.industryUsage.map(usage => `- ${usage}`).join('\n')}

## Additional Resources

### Documentation
${explanation.resources.documentation.map(doc => `- ${doc}`).join('\n')}

### Tutorials
${explanation.resources.tutorials.map(tutorial => `- ${tutorial}`).join('\n')}

### Books
${explanation.resources.books.map(book => `- ${book}`).join('\n')}

### Communities
${explanation.resources.communities.map(community => `- ${community}`).join('\n')}

## Learning Progress Checklist
- [ ] Understand core concepts
- [ ] Review examples
- [ ] Complete exercises
- [ ] Explore real-world applications
- [ ] Connect with related concepts
- [ ] Access additional resources`;
  }

  /**
   * Execute the concept explanation action
   * @returns Explanation with detailed breakdown
   */
  public async run(): Promise<ActionOutput> {
    try {
      // Get prompt
      const prompt = await this.prompt();
      
      // Generate explanation using LLM
      const response = await this.ask(prompt);
      
      // Parse and validate explanation
      const result = this.parseConceptExplanation(response);
      
      // Format as markdown
      const formattedResult = this.formatConceptExplanation(result);
      
      return this.createOutput(
        formattedResult,
        'completed',
        result
      );
    } catch (error) {
      logger.error(`[${this.name}] Error in concept explanation:`, error);
      return this.createOutput(
        `Failed to explain concept: ${error}`,
        'failed'
      );
    }
  }
} 