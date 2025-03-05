import { BaseAction } from './base-action';
import type { ActionOutput, ActionConfig } from '../types/action';
import { logger } from '../utils/logger';

/**
 * Teaching style preferences
 */
export enum TeachingStyle {
  LECTURE = 'lecture',
  INTERACTIVE = 'interactive',
  PROJECT_BASED = 'project_based',
  PROBLEM_BASED = 'problem_based',
  FLIPPED = 'flipped',
  BLENDED = 'blended',
  ADAPTIVE = 'adaptive'
}

/**
 * Learning objective type
 */
export interface LearningObjective {
  id: string;
  description: string;
  category: 'knowledge' | 'comprehension' | 'application' | 'analysis' | 'synthesis' | 'evaluation';
  assessmentCriteria: string[];
}

/**
 * Course material type
 */
export interface CourseMaterial {
  type: 'reading' | 'video' | 'audio' | 'interactive' | 'worksheet';
  title: string;
  description: string;
  url?: string;
  duration?: number;
  requiredResources?: string[];
}

/**
 * Teaching activity type
 */
export interface TeachingActivity {
  id: string;
  title: string;
  description: string;
  duration: number;
  type: 'introduction' | 'presentation' | 'discussion' | 'exercise' | 'group_work' | 'assessment';
  objectives: string[];
  materials: CourseMaterial[];
  instructions: {
    teacher: string[];
    student: string[];
  };
  adaptations?: {
    advanced: string;
    struggling: string;
  };
}

/**
 * Assessment method type
 */
export interface AssessmentMethod {
  id: string;
  type: 'quiz' | 'project' | 'presentation' | 'essay' | 'practical';
  title: string;
  description: string;
  objectives: string[];
  criteria: {
    category: string;
    description: string;
    weight: number;
  }[];
  rubric?: {
    excellent: string;
    good: string;
    satisfactory: string;
    needsImprovement: string;
  };
}

/**
 * Lesson plan type
 */
export interface LessonPlan {
  overview: {
    topic: string;
    style: TeachingStyle;
    duration: number;
    targetAudience: string[];
    prerequisites: string[];
  };
  objectives: LearningObjective[];
  outline: {
    title: string;
    description: string;
    activities: string[];
    duration: number;
  }[];
  activities: TeachingActivity[];
  materials: CourseMaterial[];
  assessment: {
    methods: AssessmentMethod[];
    feedback: {
      type: string;
      timing: string;
      method: string;
    }[];
  };
  differentiation: {
    advanced: string[];
    struggling: string[];
    accessibility: string[];
  };
  reflection: {
    teacherPrompts: string[];
    studentPrompts: string[];
    successIndicators: string[];
  };
}

/**
 * Action for creating detailed lesson plans
 */
export class CreateLesson extends BaseAction {
  constructor(config: ActionConfig) {
    super({
      ...config,
      name: config.name || 'CreateLesson',
      description: config.description || 'Create a detailed lesson plan'
    });
  }

  protected async prompt(): Promise<string> {
    // Get and validate required arguments
    const topic = this.getArg<string>('topic');
    if (!topic) {
      throw new Error('Topic is required for lesson creation');
    }

    // Get optional arguments with defaults
    const style = this.getArg<TeachingStyle>('style') || TeachingStyle.ADAPTIVE;
    const duration = this.getArg<number>('duration') || 60;
    const audience = this.getArg<string[]>('audience') || [];
    const prerequisites = this.getArg<string[]>('prerequisites') || [];

    // Log lesson creation start
    logger.info(`[${this.name}] Starting lesson plan creation`);
    logger.debug(`[${this.name}] Configuration:`, {
      style,
      duration,
      hasAudience: audience.length > 0,
      hasPrerequisites: prerequisites.length > 0
    });

    return `As an educational expert, please create a comprehensive lesson plan for the following topic:

Topic: ${topic}

Configuration:
- Teaching Style: ${style}
- Duration: ${duration} minutes
${audience.length ? `- Target Audience: ${audience.join(', ')}` : ''}
${prerequisites.length ? `- Prerequisites: ${prerequisites.join(', ')}` : ''}

Please provide the lesson plan in the following JSON format:

{
  "overview": {
    "topic": "Lesson topic",
    "style": "${Object.values(TeachingStyle).join('" | "')}",
    "duration": 0,
    "targetAudience": ["Intended audience"],
    "prerequisites": ["Required knowledge"]
  },
  "objectives": [
    {
      "id": "Objective ID",
      "description": "Learning objective",
      "category": "knowledge | comprehension | application | analysis | synthesis | evaluation",
      "assessmentCriteria": ["Assessment criteria"]
    }
  ],
  "outline": [
    {
      "title": "Section title",
      "description": "Section description",
      "activities": ["Activity IDs"],
      "duration": 0
    }
  ],
  "activities": [
    {
      "id": "Activity ID",
      "title": "Activity title",
      "description": "Activity description",
      "duration": 0,
      "type": "introduction | presentation | discussion | exercise | group_work | assessment",
      "objectives": ["Objective IDs"],
      "materials": [
        {
          "type": "reading | video | audio | interactive | worksheet",
          "title": "Material title",
          "description": "Material description",
          "url": "Optional URL",
          "duration": 0,
          "requiredResources": ["Required resources"]
        }
      ],
      "instructions": {
        "teacher": ["Teacher instructions"],
        "student": ["Student instructions"]
      },
      "adaptations": {
        "advanced": "Adaptation for advanced learners",
        "struggling": "Adaptation for struggling learners"
      }
    }
  ],
  "materials": [
    {
      "type": "reading | video | audio | interactive | worksheet",
      "title": "Material title",
      "description": "Material description",
      "url": "Optional URL",
      "duration": 0,
      "requiredResources": ["Required resources"]
    }
  ],
  "assessment": {
    "methods": [
      {
        "id": "Assessment ID",
        "type": "quiz | project | presentation | essay | practical",
        "title": "Assessment title",
        "description": "Assessment description",
        "objectives": ["Objective IDs"],
        "criteria": [
          {
            "category": "Criteria category",
            "description": "Criteria description",
            "weight": 0
          }
        ],
        "rubric": {
          "excellent": "Excellent criteria",
          "good": "Good criteria",
          "satisfactory": "Satisfactory criteria",
          "needsImprovement": "Needs improvement criteria"
        }
      }
    ],
    "feedback": [
      {
        "type": "Feedback type",
        "timing": "Feedback timing",
        "method": "Feedback method"
      }
    ]
  },
  "differentiation": {
    "advanced": ["Advanced strategies"],
    "struggling": ["Support strategies"],
    "accessibility": ["Accessibility considerations"]
  },
  "reflection": {
    "teacherPrompts": ["Reflection prompts for teachers"],
    "studentPrompts": ["Reflection prompts for students"],
    "successIndicators": ["Success indicators"]
  }
}

Please ensure:
1. Learning objectives are specific and measurable
2. Activities align with the teaching style
3. Materials are appropriate and accessible
4. Assessment methods match objectives
5. Differentiation strategies are practical
6. Time allocations are realistic
7. Instructions are clear for both teachers and students`;
  }

  /**
   * Parse and validate the lesson plan
   * @param response The LLM response
   * @returns Parsed lesson plan
   */
  private parseLessonPlan(response: string): LessonPlan {
    try {
      const result = JSON.parse(response);
      
      // Validate required sections
      if (!result.overview || !result.objectives || !result.outline || 
          !result.activities || !result.materials || !result.assessment || 
          !result.differentiation || !result.reflection) {
        throw new Error('Missing required sections in lesson plan');
      }

      // Validate overview
      if (!result.overview.topic || !result.overview.style || 
          !result.overview.duration || !result.overview.targetAudience || 
          !result.overview.prerequisites) {
        throw new Error('Missing required fields in overview');
      }

      // Validate time allocation
      const totalActivityTime = result.activities.reduce((sum, activity) => sum + activity.duration, 0);
      if (totalActivityTime > result.overview.duration) {
        throw new Error('Total activity time exceeds lesson duration');
      }

      return result;
    } catch (error) {
      logger.error(`[${this.name}] Failed to parse lesson plan:`, error);
      throw new Error(`Failed to parse lesson plan: ${error}`);
    }
  }

  /**
   * Format the lesson plan as markdown
   * @param plan The lesson plan
   * @returns Formatted markdown string
   */
  private formatLessonPlan(plan: LessonPlan): string {
    return `# Lesson Plan: ${plan.overview.topic}

## Overview
- **Teaching Style:** ${plan.overview.style}
- **Duration:** ${plan.overview.duration} minutes
- **Target Audience:** ${plan.overview.targetAudience.join(', ')}
- **Prerequisites:** ${plan.overview.prerequisites.join(', ')}

## Learning Objectives
${plan.objectives.map(obj => `
### ${obj.id}
- **Description:** ${obj.description}
- **Category:** ${obj.category}
- **Assessment Criteria:**
${obj.assessmentCriteria.map(criteria => `  - ${criteria}`).join('\n')}`).join('\n')}

## Lesson Outline
${plan.outline.map(section => `
### ${section.title} (${section.duration} min)
${section.description}

**Activities:** ${section.activities.join(', ')}`).join('\n')}

## Teaching Activities
${plan.activities.map(activity => `
### ${activity.id}: ${activity.title}
${activity.description}

- **Type:** ${activity.type}
- **Duration:** ${activity.duration} minutes
- **Objectives:** ${activity.objectives.join(', ')}

**Materials Required:**
${activity.materials.map(material => `- ${material.title} (${material.type})${material.duration ? ` - ${material.duration} min` : ''}`).join('\n')}

**Teacher Instructions:**
${activity.instructions.teacher.map(instruction => `1. ${instruction}`).join('\n')}

**Student Instructions:**
${activity.instructions.student.map(instruction => `1. ${instruction}`).join('\n')}

${activity.adaptations ? `**Adaptations:**
- Advanced Learners: ${activity.adaptations.advanced}
- Struggling Learners: ${activity.adaptations.struggling}` : ''}`).join('\n')}

## Course Materials
${plan.materials.map(material => `
### ${material.title}
- **Type:** ${material.type}
- **Description:** ${material.description}
${material.url ? `- **URL:** ${material.url}` : ''}
${material.duration ? `- **Duration:** ${material.duration} minutes` : ''}
${material.requiredResources?.length ? `- **Required Resources:**\n${material.requiredResources.map(resource => `  - ${resource}`).join('\n')}` : ''}`).join('\n')}

## Assessment Plan

### Assessment Methods
${plan.assessment.methods.map(method => `
#### ${method.title} (${method.type})
${method.description}

**Objectives:** ${method.objectives.join(', ')}

**Evaluation Criteria:**
${method.criteria.map(criterion => `- ${criterion.category} (${criterion.weight}%): ${criterion.description}`).join('\n')}

${method.rubric ? `**Rubric:**
- Excellent: ${method.rubric.excellent}
- Good: ${method.rubric.good}
- Satisfactory: ${method.rubric.satisfactory}
- Needs Improvement: ${method.rubric.needsImprovement}` : ''}`).join('\n')}

### Feedback Strategies
${plan.assessment.feedback.map(feedback => `- **${feedback.type}:** ${feedback.method} (${feedback.timing})`).join('\n')}

## Differentiation Strategies

### Advanced Learners
${plan.differentiation.advanced.map(strategy => `- ${strategy}`).join('\n')}

### Struggling Learners
${plan.differentiation.struggling.map(strategy => `- ${strategy}`).join('\n')}

### Accessibility Considerations
${plan.differentiation.accessibility.map(consideration => `- ${consideration}`).join('\n')}

## Reflection and Evaluation

### Teacher Reflection Prompts
${plan.reflection.teacherPrompts.map(prompt => `- ${prompt}`).join('\n')}

### Student Reflection Prompts
${plan.reflection.studentPrompts.map(prompt => `- ${prompt}`).join('\n')}

### Success Indicators
${plan.reflection.successIndicators.map(indicator => `- ${indicator}`).join('\n')}

## Quality Checklist
- [ ] Learning objectives are clear and measurable
- [ ] Activities align with teaching style
- [ ] Materials are prepared and accessible
- [ ] Assessment methods match objectives
- [ ] Differentiation strategies are included
- [ ] Time allocations are realistic
- [ ] Instructions are clear and detailed
- [ ] Reflection prompts are meaningful`;
  }

  /**
   * Execute the lesson creation action
   * @returns Lesson plan with detailed breakdown
   */
  public async run(): Promise<ActionOutput> {
    try {
      // Get prompt
      const prompt = await this.prompt();
      
      // Generate lesson plan using LLM
      const response = await this.ask(prompt);
      
      // Parse and validate lesson plan
      const result = this.parseLessonPlan(response);
      
      // Format as markdown
      const formattedResult = this.formatLessonPlan(result);
      
      return this.createOutput(
        formattedResult,
        'completed',
        result
      );
    } catch (error) {
      logger.error(`[${this.name}] Error in lesson creation:`, error);
      return this.createOutput(
        `Failed to create lesson plan: ${error}`,
        'failed'
      );
    }
  }
} 