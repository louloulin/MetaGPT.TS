import { StatisticalAnalyzerTool } from '../statistical-analyzer';

describe('StatisticalAnalyzerTool', () => {
  let analyzer: StatisticalAnalyzerTool;

  beforeEach(() => {
    analyzer = new StatisticalAnalyzerTool();
  });

  describe('descriptive analysis', () => {
    it('should calculate basic statistics correctly', async () => {
      const data = [
        { x: 1, y: 2 },
        { x: 2, y: 4 },
        { x: 3, y: 6 },
        { x: 4, y: 8 },
        { x: 5, y: 10 }
      ];

      const result = await analyzer.execute({
        type: 'descriptive',
        data
      });

      expect(result.success).toBe(true);
      expect(result.data.type).toBe('descriptive');
      
      const xStats = result.data.results.x;
      expect(xStats.mean).toBe(3);
      expect(xStats.median).toBe(3);
      expect(xStats.min).toBe(1);
      expect(xStats.max).toBe(5);
      
      const yStats = result.data.results.y;
      expect(yStats.mean).toBe(6);
      expect(yStats.median).toBe(6);
      expect(yStats.min).toBe(2);
      expect(yStats.max).toBe(10);
    });
  });

  describe('correlation analysis', () => {
    it('should calculate correlations correctly', async () => {
      const data = [
        { x: 1, y: 2 },
        { x: 2, y: 4 },
        { x: 3, y: 6 },
        { x: 4, y: 8 },
        { x: 5, y: 10 }
      ];

      const result = await analyzer.execute({
        type: 'correlation',
        data
      });

      expect(result.success).toBe(true);
      expect(result.data.type).toBe('correlation');
      expect(result.data.matrix.x.y).toBeCloseTo(1, 5); // Perfect correlation
    });
  });

  describe('regression analysis', () => {
    it('should perform linear regression correctly', async () => {
      const data = [
        { x: 1, y: 2 },
        { x: 2, y: 4 },
        { x: 3, y: 6 },
        { x: 4, y: 8 },
        { x: 5, y: 10 }
      ];

      const result = await analyzer.execute({
        type: 'regression',
        data,
        options: {
          features: ['x'],
          target: 'y'
        }
      });

      expect(result.success).toBe(true);
      expect(result.data.type).toBe('regression');
      expect(result.data.method).toBe('linear');
      expect(result.data.coefficients[0]).toBeCloseTo(2, 5); // y = 2x
      expect(result.data.r2).toBeCloseTo(1, 5); // Perfect fit
    });
  });

  describe('anomaly detection', () => {
    it('should detect anomalies correctly', async () => {
      const data = [
        { x: 1 },
        { x: 2 },
        { x: 3 },
        { x: 20 }, // Anomaly
        { x: 2 }
      ];

      const result = await analyzer.execute({
        type: 'anomaly',
        data,
        options: {
          threshold: 2 // 2 standard deviations
        }
      });

      expect(result.success).toBe(true);
      expect(result.data.type).toBe('anomaly');
      expect(result.data.results.x.anomalies).toContain(3); // Index of anomaly
    });
  });

  describe('error handling', () => {
    it('should handle missing data gracefully', async () => {
      const result = await analyzer.execute({
        type: 'descriptive'
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Data array is required');
    });

    it('should handle missing analysis type gracefully', async () => {
      const result = await analyzer.execute({
        data: [{ x: 1 }]
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Analysis type is required');
    });

    it('should handle invalid analysis type gracefully', async () => {
      const result = await analyzer.execute({
        type: 'invalid',
        data: [{ x: 1 }]
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Unsupported analysis type');
    });
  });
}); 