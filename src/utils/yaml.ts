import * as yaml from 'js-yaml';
import * as fs from 'fs/promises';
import { stringify } from 'yaml';

/**
 * YAML model utility class for handling YAML configuration files
 */
export class YamlModel {
  /**
   * Parse YAML string to object
   * @param data - YAML string to parse
   * @returns Parsed object
   */
  public static parse(data: string): any {
    try {
      return yaml.load(data);
    } catch (error: unknown) {
      throw new Error(`Failed to parse YAML string: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Convert object to YAML string
   * @param obj - Object to convert
   * @returns YAML string
   */
  public static stringify(obj: any): string {
    try {
      // Test for circular references
      JSON.stringify(obj);
      return yaml.dump(obj);
    } catch (error: unknown) {
      if (error instanceof TypeError && error.message.includes('circular')) {
        throw new Error('Cannot stringify object with circular references');
      }
      throw error;
    }
  }

  /**
   * Load and parse YAML file
   * @param path - Path to YAML file
   * @returns Parsed object
   */
  public static async fromFile(path: string): Promise<any> {
    try {
      const data = await fs.readFile(path, 'utf-8');
      return YamlModel.parse(data);
    } catch (error: unknown) {
      throw new Error(`Failed to load YAML file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Save object as YAML file
   * @param obj - Object to save
   * @param path - Path to save to
   */
  public static async toFile(obj: any, path: string): Promise<void> {
    try {
      const yaml = YamlModel.stringify(obj);
      await fs.writeFile(path, yaml);
    } catch (error: unknown) {
      throw new Error(`Failed to save YAML file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
} 