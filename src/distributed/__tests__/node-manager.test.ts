import { NodeManager, NodeStatus, type NodeInfo } from '../node-manager';
import { MessageBroker, MessageType } from '../message-broker';

jest.useFakeTimers();

describe('NodeManager', () => {
  let messageBroker: MessageBroker;
  let nodeManager: NodeManager;
  const nodeInfo: Partial<NodeInfo> = {
    host: 'test-host',
    port: 8080,
    capabilities: {
      maxConcurrentTasks: 5,
      supportedTaskTypes: ['test'],
      resources: {
        cpu: 4,
        memory: 8192,
        gpu: 1
      }
    }
  };

  beforeEach(() => {
    messageBroker = new MessageBroker();
    nodeManager = new NodeManager(messageBroker, nodeInfo, {
      heartbeatInterval: 1000,
      heartbeatTimeout: 3000,
      cleanupInterval: 5000,
      discoveryBroadcastInterval: 2000
    });
  });

  afterEach(() => {
    nodeManager.cleanup();
    messageBroker.clear();
    jest.clearAllTimers();
  });

  describe('initialization', () => {
    it('should initialize with correct node info', () => {
      const node = nodeManager.getNode(nodeManager['nodeId']);
      expect(node).toBeDefined();
      expect(node?.host).toBe('test-host');
      expect(node?.port).toBe(8080);
      expect(node?.status).toBe(NodeStatus.STARTING);
      expect(node?.capabilities).toEqual(nodeInfo.capabilities);
    });

    it('should start with default values when no options provided', () => {
      const defaultManager = new NodeManager(messageBroker, {});
      const node = defaultManager.getNode(defaultManager['nodeId']);
      expect(node).toBeDefined();
      expect(node?.host).toBe('localhost');
      expect(node?.port).toBe(0);
      expect(node?.capabilities.maxConcurrentTasks).toBe(10);
      defaultManager.cleanup();
    });
  });

  describe('node discovery', () => {
    it('should discover and add new nodes', async () => {
      const newNodeInfo: NodeInfo = {
        id: 'test-node',
        host: 'other-host',
        port: 9090,
        status: NodeStatus.ACTIVE,
        capabilities: {
          maxConcurrentTasks: 3,
          supportedTaskTypes: ['test'],
          resources: {
            cpu: 2,
            memory: 4096
          }
        },
        currentLoad: {
          tasks: 0,
          cpu: 0,
          memory: 0
        },
        lastHeartbeat: Date.now()
      };

      const addedPromise = new Promise<NodeInfo>(resolve => {
        nodeManager.once('nodeAdded', resolve);
      });

      await messageBroker.publish({
        type: MessageType.NODE_DISCOVERY,
        sender: 'test-node',
        payload: newNodeInfo
      });

      const addedNode = await addedPromise;
      expect(addedNode.id).toBe('test-node');
      expect(addedNode.host).toBe('other-host');
    });

    it('should update existing nodes', async () => {
      const nodeId = 'test-node';
      const initialNodeInfo: NodeInfo = {
        id: nodeId,
        host: 'test-host',
        port: 8080,
        status: NodeStatus.ACTIVE,
        capabilities: {
          maxConcurrentTasks: 3,
          supportedTaskTypes: ['test'],
          resources: {
            cpu: 2,
            memory: 4096
          }
        },
        currentLoad: {
          tasks: 0,
          cpu: 0,
          memory: 0
        },
        lastHeartbeat: Date.now()
      };

      // Add initial node
      await messageBroker.publish({
        type: MessageType.NODE_DISCOVERY,
        sender: nodeId,
        payload: initialNodeInfo
      });

      // Update node
      const updatedNodeInfo = {
        ...initialNodeInfo,
        status: NodeStatus.BUSY,
        currentLoad: {
          tasks: 2,
          cpu: 1,
          memory: 2048
        }
      };

      const updatePromise = new Promise<NodeInfo>(resolve => {
        nodeManager.once('nodeUpdated', resolve);
      });

      await messageBroker.publish({
        type: MessageType.NODE_DISCOVERY,
        sender: nodeId,
        payload: updatedNodeInfo
      });

      const updatedNode = await updatePromise;
      expect(updatedNode.status).toBe(NodeStatus.BUSY);
      expect(updatedNode.currentLoad.tasks).toBe(2);
    });
  });

  describe('heartbeat mechanism', () => {
    it('should send heartbeats periodically', () => {
      const publishSpy = jest.spyOn(messageBroker, 'publish');
      
      jest.advanceTimersByTime(1000);
      expect(publishSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.HEARTBEAT,
          sender: nodeManager['nodeId']
        })
      );

      jest.advanceTimersByTime(1000);
      expect(publishSpy).toHaveBeenCalledTimes(2);
    });

    it('should update node status on heartbeat', async () => {
      const nodeId = 'test-node';
      const initialNodeInfo: NodeInfo = {
        id: nodeId,
        host: 'test-host',
        port: 8080,
        status: NodeStatus.ACTIVE,
        capabilities: {
          maxConcurrentTasks: 3,
          supportedTaskTypes: ['test'],
          resources: {
            cpu: 2,
            memory: 4096
          }
        },
        currentLoad: {
          tasks: 0,
          cpu: 0,
          memory: 0
        },
        lastHeartbeat: Date.now()
      };

      // Add node
      await messageBroker.publish({
        type: MessageType.NODE_DISCOVERY,
        sender: nodeId,
        payload: initialNodeInfo
      });

      // Send heartbeat
      const updatePromise = new Promise<NodeInfo>(resolve => {
        nodeManager.once('nodeUpdated', resolve);
      });

      await messageBroker.publish({
        type: MessageType.HEARTBEAT,
        sender: nodeId,
        payload: {
          nodeId,
          status: NodeStatus.BUSY,
          currentLoad: {
            tasks: 1,
            cpu: 0.5,
            memory: 1024
          }
        }
      });

      const updatedNode = await updatePromise;
      expect(updatedNode.status).toBe(NodeStatus.BUSY);
      expect(updatedNode.currentLoad.tasks).toBe(1);
    });

    it('should cleanup inactive nodes', () => {
      const nodeId = 'test-node';
      const node: NodeInfo = {
        id: nodeId,
        host: 'test-host',
        port: 8080,
        status: NodeStatus.ACTIVE,
        capabilities: {
          maxConcurrentTasks: 3,
          supportedTaskTypes: ['test'],
          resources: {
            cpu: 2,
            memory: 4096
          }
        },
        currentLoad: {
          tasks: 0,
          cpu: 0,
          memory: 0
        },
        lastHeartbeat: Date.now() - 4000 // Older than heartbeat timeout
      };

      // Add node manually
      nodeManager['nodes'].set(nodeId, node);

      const removePromise = new Promise<NodeInfo>(resolve => {
        nodeManager.once('nodeRemoved', resolve);
      });

      // Trigger cleanup
      jest.advanceTimersByTime(5000);

      return expect(removePromise).resolves.toEqual(node);
    });
  });

  describe('node capabilities', () => {
    it('should find nodes by capabilities', async () => {
      const node1: NodeInfo = {
        id: 'node1',
        host: 'host1',
        port: 8080,
        status: NodeStatus.ACTIVE,
        capabilities: {
          maxConcurrentTasks: 5,
          supportedTaskTypes: ['type1', 'type2'],
          resources: {
            cpu: 4,
            memory: 8192,
            gpu: 1
          }
        },
        currentLoad: {
          tasks: 2,
          cpu: 2,
          memory: 4096,
          gpu: 0
        },
        lastHeartbeat: Date.now()
      };

      const node2: NodeInfo = {
        id: 'node2',
        host: 'host2',
        port: 8080,
        status: NodeStatus.ACTIVE,
        capabilities: {
          maxConcurrentTasks: 3,
          supportedTaskTypes: ['type1'],
          resources: {
            cpu: 2,
            memory: 4096
          }
        },
        currentLoad: {
          tasks: 1,
          cpu: 1,
          memory: 2048
        },
        lastHeartbeat: Date.now()
      };

      nodeManager['nodes'].set(node1.id, node1);
      nodeManager['nodes'].set(node2.id, node2);

      // Find nodes that can handle type2 tasks
      const type2Nodes = nodeManager.findNodesByCapabilities({
        supportedTaskTypes: ['type2']
      });
      expect(type2Nodes).toHaveLength(1);
      expect(type2Nodes[0].id).toBe('node1');

      // Find nodes with available GPU
      const gpuNodes = nodeManager.findNodesByCapabilities({
        resources: {
          cpu: 0,
          memory: 0,
          gpu: 1
        }
      });
      expect(gpuNodes).toHaveLength(1);
      expect(gpuNodes[0].id).toBe('node1');

      // Find nodes with available CPU
      const cpuNodes = nodeManager.findNodesByCapabilities({
        resources: {
          cpu: 1,
          memory: 0
        }
      });
      expect(cpuNodes).toHaveLength(2);
    });
  });

  describe('node status management', () => {
    it('should update node status', async () => {
      const updatePromise = new Promise<NodeInfo>(resolve => {
        nodeManager.once('nodeUpdated', resolve);
      });

      await nodeManager.updateStatus(NodeStatus.BUSY);

      const updatedNode = await updatePromise;
      expect(updatedNode.status).toBe(NodeStatus.BUSY);
    });

    it('should update node load', async () => {
      const updatePromise = new Promise<NodeInfo>(resolve => {
        nodeManager.once('nodeUpdated', resolve);
      });

      await nodeManager.updateLoad({
        tasks: 2,
        cpu: 0.5,
        memory: 1024
      });

      const updatedNode = await updatePromise;
      expect(updatedNode.currentLoad.tasks).toBe(2);
      expect(updatedNode.currentLoad.cpu).toBe(0.5);
      expect(updatedNode.currentLoad.memory).toBe(1024);
    });
  });
}); 