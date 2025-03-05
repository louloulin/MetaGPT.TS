/**
 * Tree of Thought Example
 * 
 * This example demonstrates how to use the Tree of Thought system to solve
 * complex reasoning problems.
 */

import { VercelLLMProvider } from '../src/provider/vercel-llm';
import { createTreeOfThought } from '../src/strategy/tot';
import { Strategy } from '../src/strategy/base';
import { logger, LogLevel } from '../src/utils/logger';

// Set logging level
logger.setLevel(LogLevel.INFO);

/**
 * Main function to demonstrate Tree of Thought
 */
async function main() {
  // Check for API key
  const apiKey = process.env.DASHSCOPE_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    logger.error("Please set DASHSCOPE_API_KEY or OPENAI_API_KEY environment variable");
    return;
  }

  // Initialize LLM provider
  const llmProvider = new VercelLLMProvider({
    providerType: process.env.OPENAI_API_KEY ? 'openai' : 'qwen',
    apiKey: apiKey,
    model: process.env.OPENAI_API_KEY ? 'gpt-3.5-turbo' : 'qwen-plus',
  });

  // Create Tree of Thought instance with BFS strategy
  const tot = createTreeOfThought({
    llm: llmProvider,
    strategy: Strategy.BFS,
    verbose: true,
    config: {
      maxSteps: 3,
      nGenerateSample: 3,
      nSelectSample: 2,
    },
  });

  // Define a complex reasoning problem
  const problem = `
  Solve the following logical puzzle:
  
  Four friends (Alex, Blake, Casey, and Dana) each have a different favorite color (red, blue, green, and yellow) and a different favorite sport (basketball, soccer, tennis, and volleyball).
  
  Given the following clues:
  1. The person who likes blue does not like tennis.
  2. Alex likes volleyball.
  3. The person who likes yellow likes soccer.
  4. Casey does not like blue or red.
  5. Blake likes green.
  6. Dana does not like basketball.
  
  Determine each person's favorite color and sport.
  `;

  logger.info("Solving problem with Tree of Thought...");
  console.time("ToT Solving Time");
  
  // Solve the problem
  const solution = await tot.solve(problem);
  
  console.timeEnd("ToT Solving Time");
  logger.info("Solution found:");
  console.log("\n" + solution);
  
  // Visualize the thought tree
  logger.info("Thought Tree:");
  tot.visualize();
}

// Run the example
if (require.main === module) {
  main().catch(error => {
    logger.error("Error in ToT example:", error);
    process.exit(1);
  });
} 