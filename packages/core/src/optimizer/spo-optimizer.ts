/**
 * SPO (Subject-Predicate-Object) Optimizer
 * 
 * This module implements an optimizer for role communication and task processing,
 * using SPO triples to analyze and optimize message patterns and task execution.
 */

import { z } from 'zod';
import { logger } from '../utils/logger';

// Schema definitions for SPO analysis
export const SPOTripleSchema = z.object({
  subject: z.string(),
  predicate: z.string(),
  object: z.string(),
  confidence: z.number().min(0).max(1),
  timestamp: z.number(),
});

export type SPOTriple = z.infer<typeof SPOTripleSchema>;

export interface TaskPattern {
  pattern: SPOTriple[];
  frequency: number;
  averageLatency: number;
  successRate: number;
}

export class SPOOptimizer {
  private patterns: Map<string, TaskPattern>;
  private triples: SPOTriple[];
  private readonly maxHistorySize: number;
  private readonly minConfidence: number;

  constructor(maxHistorySize = 1000, minConfidence = 0.7) {
    this.patterns = new Map();
    this.triples = [];
    this.maxHistorySize = maxHistorySize;
    this.minConfidence = minConfidence;
  }

  /**
   * Add a new SPO triple to the history
   */
  public addTriple(triple: Omit<SPOTriple, 'timestamp'>): void {
    const fullTriple: SPOTriple = {
      ...triple,
      timestamp: Date.now(),
    };

    this.triples.push(fullTriple);
    if (this.triples.length > this.maxHistorySize) {
      this.triples.shift();
    }

    this.updatePatterns();
  }

  /**
   * Get task execution suggestions based on historical patterns
   */
  public getSuggestions(subject: string, predicate?: string): TaskPattern[] {
    const relevantPatterns = Array.from(this.patterns.values())
      .filter(pattern => {
        const firstTriple = pattern.pattern[0];
        return firstTriple.subject === subject && 
               (!predicate || firstTriple.predicate === predicate);
      })
      .sort((a, b) => {
        // Sort by success rate and frequency
        const scoreA = a.successRate * 0.7 + (a.frequency / this.maxHistorySize) * 0.3;
        const scoreB = b.successRate * 0.7 + (b.frequency / this.maxHistorySize) * 0.3;
        return scoreB - scoreA;
      });

    return relevantPatterns;
  }

  /**
   * Get communication optimization suggestions for roles
   */
  public getCommunicationSuggestions(roleA: string, roleB: string): {
    directPatterns: TaskPattern[];
    indirectPatterns: TaskPattern[];
  } {
    const directPatterns = Array.from(this.patterns.values())
      .filter(pattern => {
        const involves = (triple: SPOTriple) => 
          triple.subject === roleA && triple.object === roleB ||
          triple.subject === roleB && triple.object === roleA;
        return pattern.pattern.some(involves);
      });

    const indirectPatterns = Array.from(this.patterns.values())
      .filter(pattern => {
        const path = this.findPath(pattern.pattern, roleA, roleB);
        return path.length > 0 && !directPatterns.includes(pattern);
      });

    return {
      directPatterns: this.sortPatternsByEfficiency(directPatterns),
      indirectPatterns: this.sortPatternsByEfficiency(indirectPatterns),
    };
  }

  /**
   * Get task scheduling suggestions
   */
  public getSchedulingSuggestions(tasks: SPOTriple[]): {
    parallelGroups: SPOTriple[][];
    dependencies: [string, string][];
    estimatedLatency: number;
  } {
    const groups: SPOTriple[][] = [];
    const dependencies: [string, string][] = [];
    let currentGroup: SPOTriple[] = [];
    let estimatedLatency = 0;

    for (const task of tasks) {
      const conflicts = this.findConflictingTasks(task, currentGroup);
      if (conflicts.length > 0) {
        groups.push([...currentGroup]);
        currentGroup = [task];
        for (const conflict of conflicts) {
          dependencies.push([conflict.subject, task.subject]);
        }
      } else {
        currentGroup.push(task);
      }

      const pattern = this.findMatchingPattern(task);
      if (pattern) {
        estimatedLatency += pattern.averageLatency;
      }
    }

    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }

    return {
      parallelGroups: groups,
      dependencies,
      estimatedLatency,
    };
  }

  /**
   * Update performance metrics for a completed task
   */
  public updateMetrics(pattern: SPOTriple[], latency: number, success: boolean): void {
    const key = this.getPatternKey(pattern);
    const existing = this.patterns.get(key);

    if (existing) {
      const newFreq = existing.frequency + 1;
      const newLatency = (existing.averageLatency * existing.frequency + latency) / newFreq;
      const newSuccessRate = (existing.successRate * existing.frequency + (success ? 1 : 0)) / newFreq;

      this.patterns.set(key, {
        ...existing,
        frequency: newFreq,
        averageLatency: newLatency,
        successRate: newSuccessRate,
      });
    } else {
      this.patterns.set(key, {
        pattern,
        frequency: 1,
        averageLatency: latency,
        successRate: success ? 1 : 0,
      });
    }
  }

  private updatePatterns(): void {
    // Find new patterns in recent history
    const windowSize = 5;
    for (let i = 0; i < this.triples.length - windowSize + 1; i++) {
      const window = this.triples.slice(i, i + windowSize);
      if (this.isValidPattern(window)) {
        const key = this.getPatternKey(window);
        const existing = this.patterns.get(key);
        if (existing) {
          existing.frequency++;
        } else {
          this.patterns.set(key, {
            pattern: window,
            frequency: 1,
            averageLatency: 0,
            successRate: 0,
          });
        }
      }
    }
  }

  private isValidPattern(triples: SPOTriple[]): boolean {
    if (triples.length < 2) return false;

    // Check temporal consistency
    for (let i = 1; i < triples.length; i++) {
      if (triples[i].timestamp < triples[i - 1].timestamp) return false;
    }

    // Check confidence
    const avgConfidence = triples.reduce((sum, t) => sum + t.confidence, 0) / triples.length;
    if (avgConfidence < this.minConfidence) return false;

    // Check semantic connectivity
    for (let i = 1; i < triples.length; i++) {
      const prev = triples[i - 1];
      const curr = triples[i];
      if (!this.areConnected(prev, curr)) return false;
    }

    return true;
  }

  private areConnected(a: SPOTriple, b: SPOTriple): boolean {
    return a.object === b.subject || 
           a.subject === b.subject ||
           a.object === b.object;
  }

  private findPath(pattern: SPOTriple[], start: string, end: string): SPOTriple[] {
    const visited = new Set<string>();
    const path: SPOTriple[] = [];

    const dfs = (current: string): boolean => {
      if (current === end) return true;
      if (visited.has(current)) return false;

      visited.add(current);
      for (const triple of pattern) {
        if (triple.subject === current && !visited.has(triple.object)) {
          path.push(triple);
          if (dfs(triple.object)) return true;
          path.pop();
        }
      }
      return false;
    };

    dfs(start);
    return path;
  }

  private findConflictingTasks(task: SPOTriple, group: SPOTriple[]): SPOTriple[] {
    return group.filter(t => 
      t.subject === task.subject ||
      t.object === task.object ||
      t.subject === task.object ||
      t.object === task.subject
    );
  }

  private findMatchingPattern(task: SPOTriple): TaskPattern | undefined {
    return Array.from(this.patterns.values())
      .find(p => p.pattern.some(t => 
        t.subject === task.subject &&
        t.predicate === task.predicate &&
        t.object === task.object
      ));
  }

  private sortPatternsByEfficiency(patterns: TaskPattern[]): TaskPattern[] {
    return patterns.sort((a, b) => {
      const efficiencyA = a.successRate / a.averageLatency;
      const efficiencyB = b.successRate / b.averageLatency;
      return efficiencyB - efficiencyA;
    });
  }

  private getPatternKey(pattern: SPOTriple[]): string {
    return pattern
      .map(t => `${t.subject}-${t.predicate}-${t.object}`)
      .join('|');
  }
} 