/**
 * Distributed Actors Example
 * 
 * This example demonstrates how to create a distributed actor system
 * that can communicate across multiple nodes using a P2P network.
 */

import { randomUUID } from 'crypto';
import { Actor, ActorMessage, ActorSystem } from '../src/actor/actor';
import { P2PNetwork } from '../src/actor/p2p-network';
import { HttpTransport } from '../src/actor/http-transport';
import { StaticDiscoveryService } from '../src/actor/discovery-service';
import { logger } from '../src/utils/logger';

// Define actor types
enum ActorTypes {
  CALCULATOR = 'calculator',
  AGGREGATOR = 'aggregator',
  LOGGER = 'logger',
}

// Define message types
enum MessageTypes {
  CALCULATE = 'calculate',
  CALCULATION_RESULT = 'calculation_result',
  LOG = 'log',
}

// Calculator actor that performs math operations
class CalculatorActor extends Actor {
  constructor() {
    super(ActorTypes.CALCULATOR);
    
    // Handle calculation requests
    this.registerHandler(MessageTypes.CALCULATE, async (message) => {
      const { operation, operands } = message.payload;
      let result = null;
      let error = null;
      
      try {
        // Perform the calculation
        switch (operation) {
          case 'add':
            result = operands.reduce((sum: number, value: number) => sum + value, 0);
            break;
          case 'subtract':
            result = operands.reduce((diff: number, value: number, index: number) => 
              index === 0 ? value : diff - value, 0);
            break;
          case 'multiply':
            result = operands.reduce((product: number, value: number) => product * value, 1);
            break;
          case 'divide':
            result = operands.reduce((quotient: number, value: number, index: number) => 
              index === 0 ? value : quotient / value, 0);
            break;
          default:
            throw new Error(`Unknown operation: ${operation}`);
        }
      } catch (e) {
        error = (e as Error).message;
      }
      
      // Send the result back to the requester
      const response: ActorMessage<any> = {
        id: randomUUID(),
        from: this.id,
        to: message.from,
        type: MessageTypes.CALCULATION_RESULT,
        payload: {
          operation,
          operands,
          result,
          error,
          requestId: message.id,
        },
        timestamp: Date.now(),
        correlationId: message.correlationId || message.id,
      };
      
      await this.send(response);
      logger.info(`Calculator processed operation: ${operation}`, { result });
    });
  }
}

// Aggregator actor that collects and processes results
class AggregatorActor extends Actor {
  private results: Record<string, any> = {};
  
  constructor() {
    super(ActorTypes.AGGREGATOR);
    
    // Handle calculation results
    this.registerHandler(MessageTypes.CALCULATION_RESULT, async (message) => {
      const { operation, result, requestId } = message.payload;
      
      // Store the result
      this.results[requestId] = { operation, result, timestamp: Date.now() };
      
      // Log the result
      const logMessage: ActorMessage<any> = {
        id: randomUUID(),
        from: this.id,
        to: ActorTypes.LOGGER,
        type: MessageTypes.LOG,
        payload: {
          level: 'info',
          message: `Result received for ${operation}: ${result}`,
          data: message.payload,
        },
        timestamp: Date.now(),
      };
      
      await this.send(logMessage);
    });
  }
  
  // Get all stored results
  public getResults(): Record<string, any> {
    return { ...this.results };
  }
}

// Logger actor that handles logging across the network
class LoggerActor extends Actor {
  constructor() {
    super(ActorTypes.LOGGER);
    
    // Handle log messages
    this.registerHandler(MessageTypes.LOG, async (message) => {
      const { level, message: logMessage, data } = message.payload;
      
      switch (level) {
        case 'info':
          logger.info(`[${message.from}] ${logMessage}`, data);
          break;
        case 'warn':
          logger.warn(`[${message.from}] ${logMessage}`, data);
          break;
        case 'error':
          logger.error(`[${message.from}] ${logMessage}`, data);
          break;
        default:
          logger.debug(`[${message.from}] ${logMessage}`, data);
      }
    });
  }
}

// Function to initialize a node in the P2P network
async function initializeNode(nodeId: string, port: number, seedNodes: string[] = []): Promise<P2PNetwork> {
  // Create the HTTP transport
  const transport = new HttpTransport(nodeId, {
    port,
    host: 'localhost',
  });
  
  // Create the discovery service
  const discovery = new StaticDiscoveryService({
    seedNodes,
    discoveryInterval: 30000, // 30 seconds
  });
  
  // Create the P2P network
  const network = P2PNetwork.getInstance(nodeId, {
    transport,
    discovery,
  });
  
  // Initialize and start the network
  await network.initialize();
  await network.start();
  
  return network;
}

// Function to set up an actor system with the specified actors
async function setupActorSystem(actors: Actor[]): Promise<ActorSystem> {
  const actorSystem = ActorSystem.getInstance();
  
  // Register all actors
  for (const actor of actors) {
    await actorSystem.registerActor(actor);
  }
  
  return actorSystem;
}

// Function to run a calculator node
async function runCalculatorNode(nodeId: string, port: number, seedNodes: string[]): Promise<void> {
  logger.info(`Starting calculator node ${nodeId} on port ${port}`);
  
  // Initialize the P2P network
  await initializeNode(nodeId, port, seedNodes);
  
  // Set up actors
  const calculator = new CalculatorActor();
  const logger = new LoggerActor();
  await setupActorSystem([calculator, logger]);
  
  logger.info(`Calculator node ${nodeId} is running`);
}

// Function to run an aggregator node
async function runAggregatorNode(nodeId: string, port: number, seedNodes: string[]): Promise<AggregatorActor> {
  logger.info(`Starting aggregator node ${nodeId} on port ${port}`);
  
  // Initialize the P2P network
  await initializeNode(nodeId, port, seedNodes);
  
  // Set up actors
  const aggregator = new AggregatorActor();
  const logger = new LoggerActor();
  await setupActorSystem([aggregator, logger]);
  
  logger.info(`Aggregator node ${nodeId} is running`);
  
  return aggregator;
}

// Main function to run the example
async function main(): Promise<void> {
  // Define node configuration
  const calculatorNode1 = { id: 'calculator-1', port: 3001 };
  const calculatorNode2 = { id: 'calculator-2', port: 3002 };
  const aggregatorNode = { id: 'aggregator-1', port: 3000 };
  
  // Start nodes
  await runCalculatorNode(
    calculatorNode1.id, 
    calculatorNode1.port, 
    [`http://localhost:${aggregatorNode.port}/p2p`]
  );
  
  await runCalculatorNode(
    calculatorNode2.id, 
    calculatorNode2.port, 
    [`http://localhost:${aggregatorNode.port}/p2p`]
  );
  
  const aggregator = await runAggregatorNode(
    aggregatorNode.id, 
    aggregatorNode.port, 
    []
  );
  
  // Wait for nodes to discover each other
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Get the actor system
  const actorSystem = ActorSystem.getInstance();
  
  // Send calculation requests to both calculator nodes
  const operations = [
    { operation: 'add', operands: [10, 20, 30, 40] },
    { operation: 'subtract', operands: [100, 20, 5] },
    { operation: 'multiply', operands: [2, 3, 4] },
    { operation: 'divide', operands: [100, 4, 5] },
  ];
  
  for (const [index, calcData] of operations.entries()) {
    // Alternate between calculators
    const targetNode = index % 2 === 0 ? calculatorNode1.id : calculatorNode2.id;
    
    const message: ActorMessage<any> = {
      id: randomUUID(),
      from: aggregatorNode.id,
      to: targetNode,
      type: MessageTypes.CALCULATE,
      payload: calcData,
      timestamp: Date.now(),
    };
    
    await actorSystem.sendMessage(message);
    logger.info(`Sent ${calcData.operation} request to ${targetNode}`);
  }
  
  // Wait for results to be processed
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Display aggregated results
  const results = aggregator.getResults();
  logger.info('Aggregated results:', results);
  
  // Keep the process running a bit longer so messages can be delivered
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Done
  logger.info('Example completed successfully');
  process.exit(0);
}

// Run the example
main().catch(error => {
  logger.error('Example failed:', error);
  process.exit(1);
}); 