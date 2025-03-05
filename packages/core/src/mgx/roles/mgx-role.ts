import { BaseRole } from '../../roles/base-role';
import { Message } from '../../types/message';
import { Action } from '../../types/action';
import { z } from 'zod';

/**
 * MGX role capabilities schema
 */
export const MGXCapabilitiesSchema = z.object({
  /** Role's primary skills */
  skills: z.array(z.string()),
  /** Role's experience level */
  experienceLevel: z.enum(['junior', 'mid', 'senior', 'lead']),
  /** Role's specializations */
  specializations: z.array(z.string()),
  /** Role's preferred tools */
  preferredTools: z.array(z.string()),
});

export type MGXCapabilities = z.infer<typeof MGXCapabilitiesSchema>;

/**
 * Base class for MGX team roles with enhanced capabilities
 */
export abstract class MGXRole extends BaseRole {
  protected capabilities: MGXCapabilities;

  constructor(
    name: string,
    profile: string,
    goal: string,
    constraints: string,
    capabilities: MGXCapabilities,
    actions: Action[] = []
  ) {
    super(name, profile, goal, constraints, actions);
    this.capabilities = MGXCapabilitiesSchema.parse(capabilities);
  }

  /**
   * Get role capabilities
   */
  public getCapabilities(): MGXCapabilities {
    return this.capabilities;
  }

  /**
   * Update role capabilities
   */
  public updateCapabilities(capabilities: Partial<MGXCapabilities>): void {
    this.capabilities = MGXCapabilitiesSchema.parse({
      ...this.capabilities,
      ...capabilities,
    });
  }

  /**
   * Check if role has specific skill
   */
  public hasSkill(skill: string): boolean {
    return this.capabilities.skills.includes(skill);
  }

  /**
   * Check if role has specific specialization
   */
  public hasSpecialization(specialization: string): boolean {
    return this.capabilities.specializations.includes(specialization);
  }

  /**
   * Get role's experience level
   */
  public getExperienceLevel(): string {
    return this.capabilities.experienceLevel;
  }

  /**
   * Check if role can use specific tool
   */
  public canUseTool(tool: string): boolean {
    return this.capabilities.preferredTools.includes(tool);
  }
} 