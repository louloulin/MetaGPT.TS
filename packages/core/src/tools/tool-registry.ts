/**
 * @module ToolRegistry
 * @category Tools
 * 
 * Tool Registry for managing and accessing tools
 */

import { z } from 'zod';
import { logger } from '../utils/logger';
import type { Tool } from '../types/tool';

/**
 * Tool Registry class
 * Provides a central registry for tools with management capabilities
 */
export class ToolRegistry {
  private static instance: ToolRegistry;
  private tools: Map<string, Tool> = new Map();
  private categories: Map<string, Set<string>> = new Map();

  /**
   * Get the singleton instance
   */
  public static getInstance(): ToolRegistry {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry();
    }
    return ToolRegistry.instance;
  }

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Register a tool
   * @param tool Tool instance
   * @throws Error if a tool with the same name is already registered
   */
  public register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool with name '${tool.name}' is already registered`);
    }

    this.tools.set(tool.name, tool);
    
    // Add to category index
    if (!this.categories.has(tool.category)) {
      this.categories.set(tool.category, new Set());
    }
    this.categories.get(tool.category)?.add(tool.name);
    
    logger.debug(`Registered tool: ${tool.name} (category: ${tool.category})`);
  }

  /**
   * Register multiple tools
   * @param tools Array of tool instances
   */
  public registerMany(tools: Tool[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  /**
   * Unregister a tool
   * @param name Tool name
   * @throws Error if the tool is not registered
   */
  public unregister(name: string): void {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool with name '${name}' is not registered`);
    }

    // Remove from category index
    this.categories.get(tool.category)?.delete(name);
    if (this.categories.get(tool.category)?.size === 0) {
      this.categories.delete(tool.category);
    }

    this.tools.delete(name);
    logger.debug(`Unregistered tool: ${name}`);
  }

  /**
   * Get a tool by name
   * @param name Tool name
   * @returns Tool instance or undefined if not found
   */
  public getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all registered tools
   * @returns Array of all registered tools
   */
  public getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tools by category
   * @param category Category name
   * @returns Array of tools in the specified category
   */
  public getToolsByCategory(category: string): Tool[] {
    const toolNames = this.categories.get(category);
    if (!toolNames) {
      return [];
    }

    return Array.from(toolNames).map(name => this.tools.get(name)!);
  }

  /**
   * Get all tool categories
   * @returns Array of all category names
   */
  public getCategories(): string[] {
    return Array.from(this.categories.keys());
  }

  /**
   * Execute a tool
   * @param name Tool name
   * @param args Tool arguments
   * @returns Tool execution result
   * @throws Error if the tool is not registered
   */
  public async executeTool(name: string, args?: Record<string, any>): Promise<any> {
    const tool = this.getTool(name);
    if (!tool) {
      throw new Error(`Tool with name '${name}' is not registered`);
    }

    try {
      return await tool.execute(args);
    } catch (error) {
      await tool.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Check if a tool is registered
   * @param name Tool name
   * @returns True if the tool is registered
   */
  public hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Reset the registry (remove all tools)
   * Primarily used for testing
   */
  public reset(): void {
    this.tools.clear();
    this.categories.clear();
    logger.debug('Tool registry reset');
  }
} 