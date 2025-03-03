/**
 * Tests for SPO (Subject-Predicate-Object) Optimizer
 */

import { describe, expect, test, beforeEach } from '@jest/globals';
import { SPOOptimizer, type SPOTriple } from '../../src/optimizer/spo-optimizer';

describe('SPOOptimizer', () => {
  let optimizer: SPOOptimizer;

  beforeEach(() => {
    optimizer = new SPOOptimizer();
  });

  describe('Triple Management', () => {
    test('should add triples to history', () => {
      const triple: Omit<SPOTriple, 'timestamp'> = {
        subject: 'Engineer',
        predicate: 'WRITES',
        object: 'Code',
        confidence: 0.9,
      };

      optimizer.addTriple(triple);
      
      // Since triples are private, we'll test indirectly through other methods
      const suggestions = optimizer.getSuggestions('Engineer');
      expect(suggestions.length).toBe(0); // No patterns yet with just one triple
    });

    test('should recognize patterns from multiple related triples', () => {
      // Add a sequence of related triples
      const triples: Omit<SPOTriple, 'timestamp'>[] = [
        {
          subject: 'Engineer',
          predicate: 'WRITES',
          object: 'Code',
          confidence: 0.9,
        },
        {
          subject: 'Code',
          predicate: 'REQUIRES',
          object: 'Review',
          confidence: 0.85,
        },
        {
          subject: 'Reviewer',
          predicate: 'PERFORMS',
          object: 'Review',
          confidence: 0.8,
        },
        {
          subject: 'Review',
          predicate: 'GENERATES',
          object: 'Feedback',
          confidence: 0.9,
        },
        {
          subject: 'Engineer',
          predicate: 'ADDRESSES',
          object: 'Feedback',
          confidence: 0.85,
        },
      ];

      // Add triples with small time differences to simulate a sequence
      let timestamp = Date.now();
      for (const triple of triples) {
        optimizer.addTriple({
          ...triple,
        });
        timestamp += 1000; // 1 second between triples
      }

      // Update metrics to make the pattern more significant
      optimizer.updateMetrics(
        triples.map((t, i) => ({ ...t, timestamp: Date.now() + i * 1000 })),
        5000,
        true
      );

      // Now we should have a pattern
      const suggestions = optimizer.getSuggestions('Engineer');
      expect(suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('Task Suggestions', () => {
    test('should provide task execution suggestions', () => {
      // Create a pattern of tasks
      const taskPattern: SPOTriple[] = [
        {
          subject: 'Developer',
          predicate: 'IMPLEMENTS',
          object: 'Feature',
          confidence: 0.9,
          timestamp: Date.now(),
        },
        {
          subject: 'Feature',
          predicate: 'REQUIRES',
          object: 'Testing',
          confidence: 0.85,
          timestamp: Date.now() + 1000,
        },
        {
          subject: 'Tester',
          predicate: 'PERFORMS',
          object: 'Testing',
          confidence: 0.8,
          timestamp: Date.now() + 2000,
        },
      ];

      // Add the pattern and update metrics
      for (const task of taskPattern) {
        optimizer.addTriple(task);
      }
      optimizer.updateMetrics(taskPattern, 3000, true);

      // Get suggestions for Developer
      const suggestions = optimizer.getSuggestions('Developer');
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].pattern[0].subject).toBe('Developer');
      expect(suggestions[0].successRate).toBeGreaterThan(0);
    });

    test('should filter suggestions by predicate when provided', () => {
      // Add two different patterns with the same subject
      const pattern1: SPOTriple[] = [
        {
          subject: 'Engineer',
          predicate: 'WRITES',
          object: 'Code',
          confidence: 0.9,
          timestamp: Date.now(),
        },
        {
          subject: 'Code',
          predicate: 'REQUIRES',
          object: 'Review',
          confidence: 0.85,
          timestamp: Date.now() + 1000,
        },
      ];

      const pattern2: SPOTriple[] = [
        {
          subject: 'Engineer',
          predicate: 'REVIEWS',
          object: 'Documentation',
          confidence: 0.8,
          timestamp: Date.now() + 2000,
        },
        {
          subject: 'Documentation',
          predicate: 'NEEDS',
          object: 'Approval',
          confidence: 0.75,
          timestamp: Date.now() + 3000,
        },
      ];

      // Add both patterns
      for (const task of [...pattern1, ...pattern2]) {
        optimizer.addTriple(task);
      }

      // Update metrics for both patterns
      optimizer.updateMetrics(pattern1, 2000, true);
      optimizer.updateMetrics(pattern2, 1500, true);

      // Get suggestions filtered by predicate
      const writeSuggestions = optimizer.getSuggestions('Engineer', 'WRITES');
      expect(writeSuggestions.length).toBeGreaterThan(0);
      expect(writeSuggestions[0].pattern[0].predicate).toBe('WRITES');

      const reviewSuggestions = optimizer.getSuggestions('Engineer', 'REVIEWS');
      expect(reviewSuggestions.length).toBeGreaterThan(0);
      expect(reviewSuggestions[0].pattern[0].predicate).toBe('REVIEWS');
    });
  });

  describe('Communication Optimization', () => {
    test('should provide direct communication suggestions', () => {
      // Create a pattern with direct communication
      const directPattern: SPOTriple[] = [
        {
          subject: 'Manager',
          predicate: 'ASSIGNS',
          object: 'Task',
          confidence: 0.9,
          timestamp: Date.now(),
        },
        {
          subject: 'Task',
          predicate: 'ASSIGNED_TO',
          object: 'Developer',
          confidence: 0.85,
          timestamp: Date.now() + 1000,
        },
        {
          subject: 'Developer',
          predicate: 'REPORTS',
          object: 'Manager',
          confidence: 0.8,
          timestamp: Date.now() + 2000,
        },
      ];

      // Add the pattern
      for (const triple of directPattern) {
        optimizer.addTriple(triple);
      }
      optimizer.updateMetrics(directPattern, 3000, true);

      // Get communication suggestions
      const suggestions = optimizer.getCommunicationSuggestions('Manager', 'Developer');
      expect(suggestions.directPatterns.length).toBeGreaterThan(0);
      
      // Verify the pattern involves both roles
      const pattern = suggestions.directPatterns[0].pattern;
      const hasManagerDeveloper = pattern.some(
        t => (t.subject === 'Manager' && t.object === 'Developer') || 
             (t.subject === 'Developer' && t.object === 'Manager')
      );
      expect(hasManagerDeveloper).toBeTruthy();
    });

    test('should provide indirect communication suggestions', () => {
      // Create a pattern with indirect communication through intermediaries
      const indirectPattern: SPOTriple[] = [
        {
          subject: 'ProductOwner',
          predicate: 'DEFINES',
          object: 'Requirement',
          confidence: 0.9,
          timestamp: Date.now(),
        },
        {
          subject: 'Requirement',
          predicate: 'ASSIGNED_TO',
          object: 'TeamLead',
          confidence: 0.85,
          timestamp: Date.now() + 1000,
        },
        {
          subject: 'TeamLead',
          predicate: 'DELEGATES',
          object: 'Task',
          confidence: 0.8,
          timestamp: Date.now() + 2000,
        },
        {
          subject: 'Task',
          predicate: 'ASSIGNED_TO',
          object: 'Developer',
          confidence: 0.75,
          timestamp: Date.now() + 3000,
        },
      ];

      // Add the pattern
      for (const triple of indirectPattern) {
        optimizer.addTriple(triple);
      }
      optimizer.updateMetrics(indirectPattern, 5000, true);

      // Get communication suggestions
      const suggestions = optimizer.getCommunicationSuggestions('ProductOwner', 'Developer');
      
      // There should be indirect patterns
      expect(suggestions.indirectPatterns.length).toBeGreaterThan(0);
    });
  });

  describe('Task Scheduling', () => {
    test('should identify parallel task groups', () => {
      // Create tasks that can be executed in parallel
      const tasks: SPOTriple[] = [
        {
          subject: 'Developer1',
          predicate: 'IMPLEMENTS',
          object: 'Feature1',
          confidence: 0.9,
          timestamp: Date.now(),
        },
        {
          subject: 'Developer2',
          predicate: 'IMPLEMENTS',
          object: 'Feature2',
          confidence: 0.85,
          timestamp: Date.now(),
        },
        {
          subject: 'Tester1',
          predicate: 'TESTS',
          object: 'Feature3',
          confidence: 0.8,
          timestamp: Date.now(),
        },
      ];

      // Get scheduling suggestions
      const scheduling = optimizer.getSchedulingSuggestions(tasks);
      
      // All tasks should be in one parallel group since they don't conflict
      expect(scheduling.parallelGroups.length).toBe(1);
      expect(scheduling.parallelGroups[0].length).toBe(3);
      expect(scheduling.dependencies.length).toBe(0);
    });

    test('should identify task dependencies', () => {
      // Create tasks with dependencies
      const tasks: SPOTriple[] = [
        {
          subject: 'Developer',
          predicate: 'IMPLEMENTS',
          object: 'Feature',
          confidence: 0.9,
          timestamp: Date.now(),
        },
        {
          subject: 'Developer',
          predicate: 'TESTS',
          object: 'Feature',
          confidence: 0.85,
          timestamp: Date.now() + 1000,
        },
        {
          subject: 'Reviewer',
          predicate: 'REVIEWS',
          object: 'Feature',
          confidence: 0.8,
          timestamp: Date.now() + 2000,
        },
      ];

      // Get scheduling suggestions
      const scheduling = optimizer.getSchedulingSuggestions(tasks);
      
      // Should identify dependencies due to same subject or object
      expect(scheduling.parallelGroups.length).toBeGreaterThan(1);
      expect(scheduling.dependencies.length).toBeGreaterThan(0);
    });

    test('should estimate task latency based on patterns', () => {
      // Create a pattern and update metrics with known latency
      const pattern: SPOTriple[] = [
        {
          subject: 'Developer',
          predicate: 'IMPLEMENTS',
          object: 'Feature',
          confidence: 0.9,
          timestamp: Date.now(),
        },
        {
          subject: 'Developer',
          predicate: 'TESTS',
          object: 'Feature',
          confidence: 0.85,
          timestamp: Date.now() + 1000,
        },
      ];

      // Add pattern and update metrics with 3000ms latency
      for (const triple of pattern) {
        optimizer.addTriple(triple);
      }
      optimizer.updateMetrics(pattern, 3000, true);

      // Create a new task matching the pattern
      const newTask: SPOTriple = {
        subject: 'Developer',
        predicate: 'IMPLEMENTS',
        object: 'Feature',
        confidence: 0.9,
        timestamp: Date.now(),
      };

      // Get scheduling suggestions
      const scheduling = optimizer.getSchedulingSuggestions([newTask]);
      
      // Should estimate latency based on the pattern
      expect(scheduling.estimatedLatency).toBeGreaterThan(0);
    });
  });

  describe('Metrics Management', () => {
    test('should update metrics for task patterns', () => {
      // Create a pattern
      const pattern: SPOTriple[] = [
        {
          subject: 'Developer',
          predicate: 'CODES',
          object: 'Feature',
          confidence: 0.9,
          timestamp: Date.now(),
        },
        {
          subject: 'Feature',
          predicate: 'REQUIRES',
          object: 'Testing',
          confidence: 0.85,
          timestamp: Date.now() + 1000,
        },
      ];

      // Update metrics multiple times with different values
      optimizer.updateMetrics(pattern, 2000, true);  // Success
      optimizer.updateMetrics(pattern, 3000, false); // Failure
      optimizer.updateMetrics(pattern, 1500, true);  // Success

      // Get suggestions to check the updated metrics
      const suggestions = optimizer.getSuggestions('Developer', 'CODES');
      expect(suggestions.length).toBeGreaterThan(0);
      
      const metrics = suggestions[0];
      expect(metrics.frequency).toBe(3);
      expect(metrics.successRate).toBeCloseTo(2/3, 2); // 2 successes out of 3
      
      // Average latency should be (2000 + 3000 + 1500) / 3 = 2166.67
      expect(metrics.averageLatency).toBeGreaterThan(2000);
      expect(metrics.averageLatency).toBeLessThan(2200);
    });

    test('should prioritize patterns by success rate and frequency', () => {
      // Create two patterns with different metrics
      const pattern1: SPOTriple[] = [
        {
          subject: 'Developer',
          predicate: 'USES',
          object: 'Framework1',
          confidence: 0.9,
          timestamp: Date.now(),
        },
        {
          subject: 'Framework1',
          predicate: 'ENABLES',
          object: 'Feature',
          confidence: 0.85,
          timestamp: Date.now() + 1000,
        },
      ];

      const pattern2: SPOTriple[] = [
        {
          subject: 'Developer',
          predicate: 'USES',
          object: 'Framework2',
          confidence: 0.8,
          timestamp: Date.now() + 2000,
        },
        {
          subject: 'Framework2',
          predicate: 'ENABLES',
          object: 'Feature',
          confidence: 0.75,
          timestamp: Date.now() + 3000,
        },
      ];

      // Add both patterns
      for (const triple of [...pattern1, ...pattern2]) {
        optimizer.addTriple(triple);
      }

      // Update metrics with different success rates
      optimizer.updateMetrics(pattern1, 2000, true);  // 100% success, 1 occurrence
      optimizer.updateMetrics(pattern2, 1500, true);  // 100% success, 1 occurrence
      optimizer.updateMetrics(pattern2, 1600, true);  // Still 100% success, but 2 occurrences

      // Get suggestions
      const suggestions = optimizer.getSuggestions('Developer', 'USES');
      expect(suggestions.length).toBe(2);
      
      // Pattern2 should be first due to higher frequency
      expect(suggestions[0].pattern[0].object).toBe('Framework2');
      expect(suggestions[0].frequency).toBe(2);
      
      // Pattern1 should be second
      expect(suggestions[1].pattern[0].object).toBe('Framework1');
      expect(suggestions[1].frequency).toBe(1);
    });
  });
}); 