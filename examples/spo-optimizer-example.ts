/**
 * Example demonstrating the usage of the SPO optimizer
 */

import { SPOOptimizer } from '../src/optimizer/spo-optimizer';
import type { SPOTriple } from '../src/optimizer/spo-optimizer';

async function main() {
  // Create an SPO optimizer instance
  const optimizer = new SPOOptimizer();

  // Simulate some task execution patterns
  const taskPatterns: SPOTriple[] = [
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
      confidence: 0.8,
      timestamp: Date.now() + 1000,
    },
    {
      subject: 'Reviewer',
      predicate: 'REVIEWS',
      object: 'Code',
      confidence: 0.85,
      timestamp: Date.now() + 2000,
    },
    {
      subject: 'Engineer',
      predicate: 'FIXES',
      object: 'Issues',
      confidence: 0.75,
      timestamp: Date.now() + 3000,
    },
  ];

  // Add task patterns to the optimizer
  for (const task of taskPatterns) {
    optimizer.addTriple(task);
  }

  // Update metrics for completed tasks
  optimizer.updateMetrics(taskPatterns.slice(0, 2), 5000, true); // First pattern completed successfully
  optimizer.updateMetrics(taskPatterns.slice(2), 3000, true); // Second pattern completed successfully

  // Get task execution suggestions
  console.log('\nTask suggestions for Engineer:');
  const suggestions = optimizer.getSuggestions('Engineer');
  console.log(suggestions);

  // Get communication optimization suggestions
  console.log('\nCommunication suggestions between Engineer and Reviewer:');
  const commSuggestions = optimizer.getCommunicationSuggestions('Engineer', 'Reviewer');
  console.log(commSuggestions);

  // Simulate parallel task scheduling
  const newTasks: SPOTriple[] = [
    {
      subject: 'Engineer1',
      predicate: 'IMPLEMENTS',
      object: 'Feature1',
      confidence: 0.9,
      timestamp: Date.now(),
    },
    {
      subject: 'Engineer2',
      predicate: 'IMPLEMENTS',
      object: 'Feature2',
      confidence: 0.85,
      timestamp: Date.now(),
    },
    {
      subject: 'Engineer1',
      predicate: 'REVIEWS',
      object: 'Feature2',
      confidence: 0.8,
      timestamp: Date.now(),
    },
    {
      subject: 'Engineer2',
      predicate: 'REVIEWS',
      object: 'Feature1',
      confidence: 0.8,
      timestamp: Date.now(),
    },
  ];

  console.log('\nTask scheduling suggestions:');
  const scheduling = optimizer.getSchedulingSuggestions(newTasks);
  console.log('Parallel groups:', scheduling.parallelGroups);
  console.log('Dependencies:', scheduling.dependencies);
  console.log('Estimated latency:', scheduling.estimatedLatency);
}

main().catch(console.error); 