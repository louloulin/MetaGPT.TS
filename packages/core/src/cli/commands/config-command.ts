/**
 * @module ConfigCommand
 * @category CLI Commands
 * @description Command to manage MetaGPT configuration
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { Command } from '../command';
import type { CommandArguments, CommandOptions, CommandContext, CommandMeta } from '../command';
import { CLIManager } from '../cli-manager';
import { logger } from '../../utils/logger';

/**
 * Command to manage MetaGPT configuration
 */
export class ConfigCommand extends Command {
  /** CLI Manager instance */
  private manager: CLIManager;
  
  /**
   * Create a new config command
   * @param manager CLI Manager instance
   */
  constructor(manager: CLIManager) {
    const meta: CommandMeta = {
      name: 'config',
      description: 'Manage MetaGPT configuration',
      aliases: ['cfg', 'conf'],
      examples: [
        'metagpt config list',
        'metagpt config get api.key',
        'metagpt config set api.key YOUR_API_KEY',
        'metagpt config delete api.key',
      ],
      category: 'Configuration',
    };
    
    super(meta);
    this.manager = manager;
  }
  
  /**
   * Execute the command
   * @param args Command arguments
   * @param options Command options
   * @param context Command context
   * @returns Promise that resolves when the command completes
   */
  public async execute(
    args: CommandArguments,
    options: CommandOptions,
    context: CommandContext
  ): Promise<void> {
    const action = (args['0'] as string || '').toLowerCase();
    
    switch (action) {
      case 'list':
      case 'ls':
        await this.listConfig(context);
        break;
        
      case 'get':
        await this.getConfig(args['1'] as string, context);
        break;
        
      case 'set':
        await this.setConfig(args['1'] as string, args['2'] as string, context);
        break;
        
      case 'delete':
      case 'remove':
      case 'rm':
        await this.deleteConfig(args['1'] as string, context);
        break;
        
      case 'reset':
        await this.resetConfig(context);
        break;
        
      default:
        context.output('Invalid action. Available actions: list, get, set, delete, reset', 'error');
        context.output(this.getHelp(), 'info');
        break;
    }
  }
  
  /**
   * List all configuration values
   * @param context Command context
   */
  private async listConfig(context: CommandContext): Promise<void> {
    const config = this.manager.getAllConfig();
    
    if (Object.keys(config).length === 0) {
      context.output('No configuration values set', 'info');
      return;
    }
    
    context.output('Configuration:', 'info');
    
    // Format config for display
    const formatConfig = (obj: Record<string, any>, prefix = ''): void => {
      for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          formatConfig(value, fullKey);
        } else {
          // Handle sensitive data (any key containing "key", "token", "secret", "password")
          const isSensitive = /key|token|secret|password/i.test(fullKey);
          const displayValue = isSensitive
            ? `${value.toString().substring(0, 3)}${'*'.repeat(6)}`
            : value;
          
          context.output(`  ${fullKey}: ${displayValue}`, 'info');
        }
      }
    };
    
    formatConfig(config);
  }
  
  /**
   * Get a configuration value
   * @param key Configuration key
   * @param context Command context
   */
  private async getConfig(key: string, context: CommandContext): Promise<void> {
    if (!key) {
      context.output('Key is required', 'error');
      return;
    }
    
    const value = this.getNestedValue(this.manager.getAllConfig(), key);
    
    if (value === undefined) {
      context.output(`Configuration key "${key}" not found`, 'error');
      return;
    }
    
    // Handle sensitive data
    const isSensitive = /key|token|secret|password/i.test(key);
    const displayValue = isSensitive && typeof value === 'string'
      ? `${value.substring(0, 3)}${'*'.repeat(6)}`
      : value;
    
    context.output(`${key}: ${displayValue}`, 'info');
  }
  
  /**
   * Set a configuration value
   * @param key Configuration key
   * @param value Configuration value
   * @param context Command context
   */
  private async setConfig(key: string, value: string, context: CommandContext): Promise<void> {
    if (!key) {
      context.output('Key is required', 'error');
      return;
    }
    
    if (value === undefined) {
      context.output('Value is required', 'error');
      return;
    }
    
    // Parse value if possible
    const parsedValue = this.parseValue(value);
    
    // Get current config
    const config = this.manager.getAllConfig();
    
    // Set nested value
    this.setNestedValue(config, key, parsedValue);
    
    // Update all config
    Object.entries(config).forEach(([k, v]) => {
      this.manager.setConfig(k, v);
    });
    
    // Save config
    await this.manager.saveConfig();
    
    // Handle sensitive data
    const isSensitive = /key|token|secret|password/i.test(key);
    const displayValue = isSensitive && typeof parsedValue === 'string'
      ? `${parsedValue.substring(0, 3)}${'*'.repeat(6)}`
      : parsedValue;
    
    context.output(`Set ${key} = ${displayValue}`, 'success');
  }
  
  /**
   * Delete a configuration value
   * @param key Configuration key
   * @param context Command context
   */
  private async deleteConfig(key: string, context: CommandContext): Promise<void> {
    if (!key) {
      context.output('Key is required', 'error');
      return;
    }
    
    // Get current config
    const config = this.manager.getAllConfig();
    
    // Check if key exists
    if (this.getNestedValue(config, key) === undefined) {
      context.output(`Configuration key "${key}" not found`, 'error');
      return;
    }
    
    // Delete nested value
    this.deleteNestedValue(config, key);
    
    // Update all config
    // This is a simplistic approach - a more robust solution would recreate
    // the entire config object from the modified nested structure
    Object.entries(config).forEach(([k, v]) => {
      if (v !== undefined) {
        this.manager.setConfig(k, v);
      }
    });
    
    // Save config
    await this.manager.saveConfig();
    
    context.output(`Deleted configuration key "${key}"`, 'success');
  }
  
  /**
   * Reset all configuration
   * @param context Command context
   */
  private async resetConfig(context: CommandContext): Promise<void> {
    // Confirm reset
    const confirm = await context.input('Are you sure you want to reset all configuration? (y/N): ');
    
    if (confirm.toLowerCase() !== 'y') {
      context.output('Reset cancelled', 'info');
      return;
    }
    
    // Get all keys
    const config = this.manager.getAllConfig();
    const keys = Object.keys(config);
    
    // Delete all keys
    for (const key of keys) {
      this.manager.setConfig(key, undefined);
    }
    
    // Save config
    await this.manager.saveConfig();
    
    context.output('Configuration reset', 'success');
  }
  
  /**
   * Parse a value string to an appropriate type
   * @param value Value string
   * @returns Parsed value
   */
  private parseValue(value: string): any {
    // Boolean
    if (value === 'true') return true;
    if (value === 'false') return false;
    
    // Null
    if (value === 'null') return null;
    
    // Number
    if (!isNaN(Number(value)) && value.trim() !== '') {
      return Number(value);
    }
    
    // Array (comma-separated values)
    if (value.includes(',')) {
      return value.split(',').map(v => this.parseValue(v.trim()));
    }
    
    // JSON
    try {
      return JSON.parse(value);
    } catch (e) {
      // Not JSON, treat as string
    }
    
    // String
    return value;
  }
  
  /**
   * Get a nested value from an object
   * @param obj Object to get value from
   * @param path Path to value (e.g., "api.key")
   * @returns Value or undefined if not found
   */
  private getNestedValue(obj: Record<string, any>, path: string): any {
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
      if (current === undefined || current === null || typeof current !== 'object') {
        return undefined;
      }
      
      current = current[key];
    }
    
    return current;
  }
  
  /**
   * Set a nested value in an object
   * @param obj Object to set value in
   * @param path Path to value (e.g., "api.key")
   * @param value Value to set
   */
  private setNestedValue(obj: Record<string, any>, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop();
    
    if (!lastKey) {
      return;
    }
    
    let current = obj;
    
    for (const key of keys) {
      if (current[key] === undefined || current[key] === null || typeof current[key] !== 'object') {
        current[key] = {};
      }
      
      current = current[key];
    }
    
    current[lastKey] = value;
  }
  
  /**
   * Delete a nested value from an object
   * @param obj Object to delete value from
   * @param path Path to value (e.g., "api.key")
   */
  private deleteNestedValue(obj: Record<string, any>, path: string): void {
    const keys = path.split('.');
    const lastKey = keys.pop();
    
    if (!lastKey) {
      return;
    }
    
    let current = obj;
    
    for (const key of keys) {
      if (current[key] === undefined || current[key] === null || typeof current[key] !== 'object') {
        return;
      }
      
      current = current[key];
    }
    
    delete current[lastKey];
  }
} 