# MetaGPT Actor System

This module provides a robust actor-based concurrency model for building distributed systems in MetaGPT. It enables asynchronous, message-passing communication between independent actors, with support for peer-to-peer networking across multiple nodes.

## Key Components

### Actor System

The core of the actor model implementation consists of:

- **Actor**: Base class for creating actors that can process messages asynchronously
- **ActorMessage**: Interface for strongly-typed messages exchanged between actors
- **ActorSystem**: Central registry that manages actor lifecycle and message routing

### P2P Networking

The distributed capabilities are provided by:

- **P2PNetwork**: Manages peer-to-peer communication between nodes
- **NetworkTransport**: Abstraction for network communication protocols
- **DiscoveryService**: Mechanism for nodes to find each other in the network

## Features

- **Type-safe message passing**: Using TypeScript for compile-time checking of message formats
- **Asynchronous processing**: Non-blocking message handling with async/await support
- **State management**: Each actor maintains its own state, preventing shared state issues
- **Message routing**: Automatic delivery of messages to the appropriate actor
- **Distributed communication**: Seamless communication between actors across different nodes
- **Peer discovery**: Automatic discovery of peers in the network
- **Transport abstraction**: Pluggable transports (HTTP, WebSockets, etc.)

## Usage Example

### Define an Actor

```typescript
import { Actor } from '../src/actor/actor';

enum MessageTypes {
  GREET = 'greet',
  RESPONSE = 'response',
}

class GreeterActor extends Actor {
  constructor() {
    super('greeter');
    
    // Register message handlers
    this.handleMessage(MessageTypes.GREET, async (message) => {
      const { name } = message.payload;
      console.log(`Received greeting for ${name}`);
      
      // Send a response
      await this.send({
        id: crypto.randomUUID(),
        from: this.id,
        to: message.from,
        type: MessageTypes.RESPONSE,
        payload: { greeting: `Hello, ${name}!` },
        timestamp: Date.now(),
      });
    });
  }
}
```

### Setup Local Actor System

```typescript
import { ActorSystem } from '../src/actor/actor';

async function setupLocalSystem() {
  // Get the actor system instance
  const actorSystem = ActorSystem.getInstance();
  
  // Create and register actors
  const greeter = new GreeterActor();
  await actorSystem.registerActor(greeter);
  
  // Send a message
  await actorSystem.sendMessage({
    id: crypto.randomUUID(),
    from: 'client',
    to: 'greeter',
    type: 'greet',
    payload: { name: 'World' },
    timestamp: Date.now(),
  });
}
```

### Setup Distributed Actor System

```typescript
import { P2PNetwork } from '../src/actor/p2p-network';
import { HttpTransport } from '../src/actor/http-transport';
import { StaticDiscoveryService } from '../src/actor/discovery-service';

async function setupDistributedSystem(nodeId: string, port: number, seedNodes: string[] = []) {
  // Create the transport and discovery components
  const transport = new HttpTransport(nodeId, { port });
  const discovery = new StaticDiscoveryService({ seedNodes });
  
  // Set up the P2P network
  const network = P2PNetwork.getInstance(nodeId, { transport, discovery });
  await network.initialize();
  await network.start();
  
  // Set up the actor system
  const actorSystem = ActorSystem.getInstance();
  const greeter = new GreeterActor();
  await actorSystem.registerActor(greeter);
  
  return { network, actorSystem };
}
```

## Implementing Custom Actors

To create your own actor:

1. Extend the `Actor` base class
2. Define message types and handlers in the constructor
3. Use `this.send()` to reply or send messages to other actors
4. Manage actor-specific state as instance properties

## Distributed System Architecture

The distributed actor system is designed around these principles:

- **Location transparency**: Actors communicate the same way whether local or remote
- **Message serialization**: Messages are automatically serialized for network transport
- **Peer discovery**: Nodes can find each other through various discovery mechanisms
- **Fault tolerance**: The system handles network disconnections and node failures
- **Scalability**: New nodes can join the network dynamically

## Future Enhancements

- WebSocket transport implementation
- Pub/Sub messaging patterns
- Actor supervision hierarchies
- Persistence and recovery strategies
- Enhanced security and authentication 