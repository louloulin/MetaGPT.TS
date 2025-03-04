import { MessageBroker, MessageType, MessagePriority } from '../message-broker';

describe('MessageBroker', () => {
  let broker: MessageBroker;

  beforeEach(() => {
    broker = new MessageBroker({
      maxRetries: 2,
      retryDelay: 100,
      defaultTTL: 1000,
      maxQueueSize: 10
    });
  });

  afterEach(() => {
    broker.clear();
  });

  describe('basic functionality', () => {
    it('should publish and handle messages', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      broker.subscribe(MessageType.TASK_ASSIGNMENT, handler);

      const messageId = await broker.publish({
        type: MessageType.TASK_ASSIGNMENT,
        sender: 'test',
        payload: { data: 'test' }
      });

      // Wait for message processing
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          id: messageId,
          type: MessageType.TASK_ASSIGNMENT,
          sender: 'test',
          payload: { data: 'test' }
        })
      );
    });

    it('should handle message priorities correctly', async () => {
      const receivedMessages: string[] = [];
      const handler = jest.fn(async (message) => {
        receivedMessages.push(message.payload.data);
      });

      broker.subscribe(MessageType.TASK_ASSIGNMENT, handler);

      // Publish low priority message first
      await broker.publish({
        type: MessageType.TASK_ASSIGNMENT,
        sender: 'test',
        priority: MessagePriority.LOW,
        payload: { data: 'low' }
      });

      // Publish high priority message second
      await broker.publish({
        type: MessageType.TASK_ASSIGNMENT,
        sender: 'test',
        priority: MessagePriority.HIGH,
        payload: { data: 'high' }
      });

      // Wait for message processing
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(receivedMessages).toEqual(['high', 'low']);
    });

    it('should respect max queue size', async () => {
      const broker = new MessageBroker({ maxQueueSize: 2 });

      await broker.publish({
        type: MessageType.TASK_ASSIGNMENT,
        sender: 'test',
        payload: { data: '1' }
      });

      await broker.publish({
        type: MessageType.TASK_ASSIGNMENT,
        sender: 'test',
        payload: { data: '2' }
      });

      await expect(broker.publish({
        type: MessageType.TASK_ASSIGNMENT,
        sender: 'test',
        payload: { data: '3' }
      })).rejects.toThrow('Message queue is full');
    });
  });

  describe('error handling', () => {
    it('should retry failed messages', async () => {
      let attempts = 0;
      const handler = jest.fn().mockImplementation(async () => {
        attempts++;
        if (attempts <= 2) {
          throw new Error('Test error');
        }
      });

      broker.subscribe(MessageType.TASK_ASSIGNMENT, handler);

      await broker.publish({
        type: MessageType.TASK_ASSIGNMENT,
        sender: 'test',
        payload: { data: 'test' }
      });

      // Wait for retries
      await new Promise(resolve => setTimeout(resolve, 500));

      expect(handler).toHaveBeenCalledTimes(3);
    });

    it('should publish error message after max retries', async () => {
      const errorHandler = jest.fn().mockResolvedValue(undefined);
      broker.subscribe(MessageType.ERROR, errorHandler);

      const handler = jest.fn().mockRejectedValue(new Error('Test error'));
      broker.subscribe(MessageType.TASK_ASSIGNMENT, handler);

      await broker.publish({
        type: MessageType.TASK_ASSIGNMENT,
        sender: 'test',
        payload: { data: 'test' }
      });

      // Wait for retries and error message
      await new Promise(resolve => setTimeout(resolve, 500));

      expect(handler).toHaveBeenCalledTimes(3); // Initial + 2 retries
      expect(errorHandler).toHaveBeenCalledTimes(1);
      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.ERROR,
          sender: 'message_broker',
          payload: expect.objectContaining({
            error: 'Test error'
          })
        })
      );
    });
  });

  describe('message expiration', () => {
    it('should expire messages after TTL', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      broker.subscribe(MessageType.TASK_ASSIGNMENT, handler);

      await broker.publish({
        type: MessageType.TASK_ASSIGNMENT,
        sender: 'test',
        payload: { data: 'test' },
        ttl: 50 // Very short TTL
      });

      // Wait for message to expire
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('subscription management', () => {
    it('should handle multiple subscribers', async () => {
      const handler1 = jest.fn().mockResolvedValue(undefined);
      const handler2 = jest.fn().mockResolvedValue(undefined);

      broker.subscribe(MessageType.TASK_ASSIGNMENT, handler1);
      broker.subscribe(MessageType.TASK_ASSIGNMENT, handler2);

      await broker.publish({
        type: MessageType.TASK_ASSIGNMENT,
        sender: 'test',
        payload: { data: 'test' }
      });

      // Wait for message processing
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('should handle unsubscribe correctly', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      
      broker.subscribe(MessageType.TASK_ASSIGNMENT, handler);
      broker.unsubscribe(MessageType.TASK_ASSIGNMENT, handler);

      await broker.publish({
        type: MessageType.TASK_ASSIGNMENT,
        sender: 'test',
        payload: { data: 'test' }
      });

      // Wait for message processing
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(handler).not.toHaveBeenCalled();
    });
  });
}); 