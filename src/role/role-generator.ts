/**
 * Role Generator Module
 * 
 * This module provides functionality for dynamically generating custom roles
 * based on templates, with support for capability definition and behavior validation.
 */

import { z } from 'zod';
import { logger } from '../utils/logger';
import { Actor } from './actor';
import { ActorMessage } from './actor-message';

// Schema definitions for role capabilities and behaviors
export const RoleCapabilitySchema = z.object({
  name: z.string(),
  description: z.string(),
  requiredSkills: z.array(z.string()),
  inputSchema: z.record(z.any()).optional(),
  outputSchema: z.record(z.any()).optional(),
  constraints: z.array(z.string()).optional(),
});

export const RoleBehaviorSchema = z.object({
  name: z.string(),
  trigger: z.string(),
  preconditions: z.array(z.string()).optional(),
  postconditions: z.array(z.string()).optional(),
  implementation: z.string(),
});

export const RoleTemplateSchema = z.object({
  name: z.string(),
  description: z.string(),
  capabilities: z.array(RoleCapabilitySchema),
  behaviors: z.array(RoleBehaviorSchema),
  baseClass: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export type RoleCapability = z.infer<typeof RoleCapabilitySchema>;
export type RoleBehavior = z.infer<typeof RoleBehaviorSchema>;
export type RoleTemplate = z.infer<typeof RoleTemplateSchema>;

export class RoleGenerator {
  private templates: Map<string, RoleTemplate>;
  private validators: Map<string, (role: any) => boolean>;

  constructor() {
    this.templates = new Map();
    this.validators = new Map();
  }

  /**
   * Register a new role template
   */
  public registerTemplate(template: RoleTemplate): void {
    try {
      const validated = RoleTemplateSchema.parse(template);
      this.templates.set(validated.name, validated);
      logger.info(`Registered role template: ${validated.name}`);
    } catch (error) {
      logger.error(`Failed to register template: ${error}`);
      throw error;
    }
  }

  /**
   * Register a custom validator for role behavior
   */
  public registerValidator(name: string, validator: (role: any) => boolean): void {
    this.validators.set(name, validator);
  }

  /**
   * Generate a new role class based on a template
   */
  public generateRole(templateName: string, customizations: Partial<RoleTemplate> = {}): typeof Actor {
    const template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`Template not found: ${templateName}`);
    }

    // Merge template with customizations
    const finalTemplate = {
      ...template,
      ...customizations,
      capabilities: [...template.capabilities, ...(customizations.capabilities || [])],
      behaviors: [...template.behaviors, ...(customizations.behaviors || [])],
    };

    // Generate the role class
    const RoleClass = class extends Actor {
      private capabilities: Map<string, RoleCapability>;
      private behaviors: Map<string, RoleBehavior>;

      constructor(id: string) {
        super(id);
        this.capabilities = new Map();
        this.behaviors = new Map();
        this.initializeCapabilities(finalTemplate.capabilities);
        this.initializeBehaviors(finalTemplate.behaviors);
      }

      private initializeCapabilities(capabilities: RoleCapability[]): void {
        for (const capability of capabilities) {
          this.capabilities.set(capability.name, capability);
          this.validateCapability(capability);
        }
      }

      private initializeBehaviors(behaviors: RoleBehavior[]): void {
        for (const behavior of behaviors) {
          this.behaviors.set(behavior.name, behavior);
          this.registerMessageHandler(behavior.trigger, this.createBehaviorHandler(behavior));
        }
      }

      private validateCapability(capability: RoleCapability): void {
        // Validate required skills
        for (const skill of capability.requiredSkills) {
          if (!this.hasSkill(skill)) {
            logger.warn(`Missing required skill: ${skill} for capability ${capability.name}`);
          }
        }

        // Validate schemas if provided
        if (capability.inputSchema) {
          try {
            z.record(z.any()).parse(capability.inputSchema);
          } catch (error) {
            logger.error(`Invalid input schema for capability ${capability.name}`);
            throw error;
          }
        }
      }

      private hasSkill(skill: string): boolean {
        // Implement skill checking logic
        return true; // Placeholder
      }

      private createBehaviorHandler(behavior: RoleBehavior): (message: ActorMessage) => Promise<void> {
        return async (message: ActorMessage) => {
          try {
            // Check preconditions
            if (behavior.preconditions) {
              for (const condition of behavior.preconditions) {
                if (!await this.checkCondition(condition, message)) {
                  throw new Error(`Precondition failed: ${condition}`);
                }
              }
            }

            // Execute behavior implementation
            await this.executeBehavior(behavior, message);

            // Check postconditions
            if (behavior.postconditions) {
              for (const condition of behavior.postconditions) {
                if (!await this.checkCondition(condition, message)) {
                  throw new Error(`Postcondition failed: ${condition}`);
                }
              }
            }
          } catch (error) {
            logger.error(`Behavior execution failed: ${error}`);
            throw error;
          }
        };
      }

      private async checkCondition(condition: string, message: ActorMessage): Promise<boolean> {
        const validator = this.validators.get(condition);
        if (validator) {
          return validator(this);
        }
        return true; // Default to true if no validator is found
      }

      private async executeBehavior(behavior: RoleBehavior, message: ActorMessage): Promise<void> {
        // Implement behavior execution logic
        logger.info(`Executing behavior: ${behavior.name}`);
        // Placeholder for actual implementation
      }

      // Public methods for capability and behavior introspection
      public hasCapability(name: string): boolean {
        return this.capabilities.has(name);
      }

      public getCapabilities(): RoleCapability[] {
        return Array.from(this.capabilities.values());
      }

      public getBehaviors(): RoleBehavior[] {
        return Array.from(this.behaviors.values());
      }
    };

    // Add metadata
    Object.defineProperty(RoleClass, 'name', { value: finalTemplate.name });
    Object.defineProperty(RoleClass, 'description', { value: finalTemplate.description });
    Object.defineProperty(RoleClass, 'metadata', { value: finalTemplate.metadata || {} });

    return RoleClass;
  }

  /**
   * Validate a generated role against its template
   */
  public validateRole(role: Actor, templateName: string): boolean {
    const template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`Template not found: ${templateName}`);
    }

    try {
      // Validate capabilities
      for (const capability of template.capabilities) {
        if (!role.hasCapability(capability.name)) {
          throw new Error(`Missing capability: ${capability.name}`);
        }
      }

      // Validate behaviors
      const behaviors = (role as any).getBehaviors();
      for (const behavior of template.behaviors) {
        if (!behaviors.find((b: RoleBehavior) => b.name === behavior.name)) {
          throw new Error(`Missing behavior: ${behavior.name}`);
        }
      }

      // Run custom validators
      for (const validator of this.validators.values()) {
        if (!validator(role)) {
          throw new Error('Custom validation failed');
        }
      }

      return true;
    } catch (error) {
      logger.error(`Role validation failed: ${error}`);
      return false;
    }
  }
} 