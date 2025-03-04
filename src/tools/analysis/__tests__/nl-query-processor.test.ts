import { NLQueryProcessor } from '../nl-query-processor';
import type { LLMProvider } from '../../../types/llm';

describe('NLQueryProcessor', () => {
  let processor: NLQueryProcessor;
  let mockLLM: jest.Mocked<LLMProvider>;

  beforeEach(() => {
    mockLLM = {
      generate: jest.fn(),
      generateStream: jest.fn(),
      cost: jest.fn(),
      name: 'mock-llm'
    };

    processor = new NLQueryProcessor({
      llm: mockLLM
    });
  });

  describe('query processing', () => {
    it('should process simple filter query', async () => {
      const queryPlan = {
        type: 'filter',
        operations: [
          {
            type: 'filter',
            field: 'region',
            operator: 'equals',
            value: 'North'
          }
        ]
      };

      mockLLM.generate.mockResolvedValue(JSON.stringify(queryPlan));

      const data = [
        { region: 'North', sales: 100 },
        { region: 'South', sales: 200 },
        { region: 'North', sales: 300 }
      ];

      const result = await processor.execute({
        query: 'Show sales from North region',
        data
      });

      expect(result.success).toBe(true);
      expect(result.data.results).toHaveLength(2);
      expect(result.data.results.every((item: any) => item.region === 'North')).toBe(true);
    });

    it('should process aggregation query', async () => {
      const queryPlan = {
        type: 'aggregate',
        operations: [],
        metrics: ['sum:sales'],
        groupBy: ['region']
      };

      mockLLM.generate.mockResolvedValue(JSON.stringify(queryPlan));

      const data = [
        { region: 'North', sales: 100 },
        { region: 'South', sales: 200 },
        { region: 'North', sales: 300 }
      ];

      const result = await processor.execute({
        query: 'Show total sales by region',
        data
      });

      expect(result.success).toBe(true);
      const northTotal = result.data.results.find((r: any) => r.region === 'North')['sum:sales'];
      expect(northTotal).toBe(400);
    });

    it('should process sorting query', async () => {
      const queryPlan = {
        type: 'sort',
        operations: [],
        orderBy: ['-sales']
      };

      mockLLM.generate.mockResolvedValue(JSON.stringify(queryPlan));

      const data = [
        { region: 'North', sales: 100 },
        { region: 'South', sales: 200 },
        { region: 'East', sales: 300 }
      ];

      const result = await processor.execute({
        query: 'Show regions ordered by sales (highest first)',
        data
      });

      expect(result.success).toBe(true);
      expect(result.data.results[0].sales).toBe(300);
      expect(result.data.results[2].sales).toBe(100);
    });

    it('should handle complex queries', async () => {
      const queryPlan = {
        type: 'custom',
        operations: [
          {
            type: 'filter',
            field: 'sales',
            operator: 'greaterThan',
            value: 150
          }
        ],
        metrics: ['avg:sales'],
        groupBy: ['region'],
        orderBy: ['-avg:sales'],
        limit: 2
      };

      mockLLM.generate.mockResolvedValue(JSON.stringify(queryPlan));

      const data = [
        { region: 'North', sales: 100 },
        { region: 'South', sales: 200 },
        { region: 'North', sales: 300 },
        { region: 'East', sales: 400 },
        { region: 'South', sales: 500 }
      ];

      const result = await processor.execute({
        query: 'Show top 2 regions by average sales (only sales above 150)',
        data
      });

      expect(result.success).toBe(true);
      expect(result.data.results).toHaveLength(2);
      expect(result.data.results[0]['avg:sales']).toBeGreaterThan(result.data.results[1]['avg:sales']);
    });
  });

  describe('error handling', () => {
    it('should handle missing query', async () => {
      const result = await processor.execute({
        data: [{ x: 1 }]
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Natural language query is required');
    });

    it('should handle missing data', async () => {
      const result = await processor.execute({
        query: 'Show me everything'
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Data array is required');
    });

    it('should handle LLM errors', async () => {
      mockLLM.generate.mockRejectedValue(new Error('LLM error'));

      const result = await processor.execute({
        query: 'Show me everything',
        data: [{ x: 1 }]
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Query processing failed');
    });

    it('should handle invalid query plan', async () => {
      mockLLM.generate.mockResolvedValue('invalid json');

      const result = await processor.execute({
        query: 'Show me everything',
        data: [{ x: 1 }]
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to parse query');
    });
  });
}); 