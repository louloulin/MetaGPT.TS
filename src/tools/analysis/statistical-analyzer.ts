/**
 * @module StatisticalAnalyzer
 * @category Tools
 * 
 * Advanced statistical analysis tool for data analysis and interpretation
 */

import { BaseTool } from '../base-tool';
import type { ToolConfig, ToolResult } from '../../types/tool';
import { logger } from '../../utils/logger';

// Supported statistical analysis types
export type StatisticalAnalysisType =
  | 'descriptive'      // Basic statistics (mean, median, mode, etc.)
  | 'correlation'      // Correlation analysis
  | 'regression'       // Regression analysis
  | 'hypothesis'       // Hypothesis testing
  | 'distribution'     // Distribution analysis
  | 'timeseries'       // Time series analysis
  | 'clustering'       // Clustering analysis
  | 'anomaly'         // Anomaly detection
  | 'factor';         // Factor analysis

// Statistical analysis configuration
export interface StatisticalConfig {
  type: StatisticalAnalysisType;
  data: any[];
  options?: {
    significance?: number;      // Significance level for hypothesis testing
    method?: string;           // Specific method for the analysis type
    features?: string[];       // Features to analyze
    target?: string;          // Target variable for regression/classification
    timeColumn?: string;      // Column name for time series data
    clusters?: number;        // Number of clusters for clustering analysis
    threshold?: number;       // Threshold for anomaly detection
  };
}

/**
 * Statistical Analyzer Tool
 * Provides advanced statistical analysis capabilities
 */
export class StatisticalAnalyzerTool extends BaseTool {
  constructor(config?: Partial<ToolConfig>) {
    super({
      name: 'statistical_analyzer',
      description: 'Perform advanced statistical analysis on data',
      version: '1.0.0',
      category: 'data_analysis',
      ...config,
    });
  }

  /**
   * Execute statistical analysis
   * @param args Execution parameters
   * @returns Analysis results
   */
  async execute(args?: Record<string, any>): Promise<ToolResult> {
    try {
      // Validate input parameters
      if (!args?.data || !Array.isArray(args.data)) {
        return this.createResult(false, 'Data array is required');
      }

      if (!args?.type) {
        return this.createResult(false, 'Analysis type is required');
      }

      const config: StatisticalConfig = {
        type: args.type,
        data: args.data,
        options: args.options || {}
      };

      // Perform the analysis
      const result = await this.performAnalysis(config);
      
      return this.createResult(
        true,
        'Statistical analysis completed successfully',
        result
      );
    } catch (error) {
      logger.error(`[StatisticalAnalyzer] Error: ${(error as Error).message}`);
      return this.createResult(
        false,
        `Analysis failed: ${(error as Error).message}`,
        undefined,
        error
      );
    }
  }

  /**
   * Perform statistical analysis based on configuration
   */
  private async performAnalysis(config: StatisticalConfig): Promise<any> {
    switch (config.type) {
      case 'descriptive':
        return this.descriptiveAnalysis(config.data, config.options);
      case 'correlation':
        return this.correlationAnalysis(config.data, config.options);
      case 'regression':
        return this.regressionAnalysis(config.data, config.options);
      case 'hypothesis':
        return this.hypothesisTest(config.data, config.options);
      case 'distribution':
        return this.distributionAnalysis(config.data, config.options);
      case 'timeseries':
        return this.timeseriesAnalysis(config.data, config.options);
      case 'clustering':
        return this.clusteringAnalysis(config.data, config.options);
      case 'anomaly':
        return this.anomalyDetection(config.data, config.options);
      case 'factor':
        return this.factorAnalysis(config.data, config.options);
      default:
        throw new Error(`Unsupported analysis type: ${config.type}`);
    }
  }

  /**
   * Perform descriptive statistical analysis
   */
  private descriptiveAnalysis(data: any[], options?: any) {
    const numericColumns = this.getNumericColumns(data);
    const results: Record<string, any> = {};

    for (const column of numericColumns) {
      const values = data.map(row => row[column]).filter(val => val != null);
      
      if (values.length === 0) continue;

      results[column] = {
        count: values.length,
        mean: this.mean(values),
        median: this.median(values),
        mode: this.mode(values),
        std: this.standardDeviation(values),
        variance: this.variance(values),
        min: Math.min(...values),
        max: Math.max(...values),
        quartiles: this.quartiles(values),
        skewness: this.skewness(values),
        kurtosis: this.kurtosis(values)
      };
    }

    return {
      type: 'descriptive',
      results
    };
  }

  /**
   * Perform correlation analysis
   */
  private correlationAnalysis(data: any[], options?: any) {
    const numericColumns = this.getNumericColumns(data);
    const correlationMatrix: Record<string, Record<string, number>> = {};

    for (const col1 of numericColumns) {
      correlationMatrix[col1] = {};
      for (const col2 of numericColumns) {
        const values1 = data.map(row => row[col1]).filter(val => val != null);
        const values2 = data.map(row => row[col2]).filter(val => val != null);
        correlationMatrix[col1][col2] = this.pearsonCorrelation(values1, values2);
      }
    }

    return {
      type: 'correlation',
      matrix: correlationMatrix
    };
  }

  /**
   * Perform regression analysis
   */
  private regressionAnalysis(data: any[], options?: any) {
    if (!options?.target || !options?.features) {
      throw new Error('Target and features must be specified for regression analysis');
    }

    const X = data.map(row => options.features.map(f => row[f]));
    const y = data.map(row => row[options.target]);

    // Simple linear regression for now
    const result = this.linearRegression(X, y);

    return {
      type: 'regression',
      method: 'linear',
      coefficients: result.coefficients,
      intercept: result.intercept,
      r2: result.r2,
      mse: result.mse
    };
  }

  /**
   * Perform hypothesis testing
   */
  private hypothesisTest(data: any[], options?: any) {
    if (!options?.method) {
      throw new Error('Method must be specified for hypothesis testing');
    }

    const significance = options.significance || 0.05;
    let result;

    switch (options.method) {
      case 'ttest':
        result = this.tTest(data, options);
        break;
      case 'chisquare':
        result = this.chiSquareTest(data, options);
        break;
      default:
        throw new Error(`Unsupported hypothesis test method: ${options.method}`);
    }

    return {
      type: 'hypothesis',
      method: options.method,
      significance,
      ...result
    };
  }

  /**
   * Perform distribution analysis
   */
  private distributionAnalysis(data: any[], options?: any) {
    const numericColumns = options?.features || this.getNumericColumns(data);
    const results: Record<string, any> = {};

    for (const column of numericColumns) {
      const values = data.map(row => row[column]).filter(val => val != null);
      
      if (values.length === 0) continue;

      results[column] = {
        normality: this.normalityTest(values),
        histogram: this.histogram(values),
        density: this.kernelDensityEstimation(values)
      };
    }

    return {
      type: 'distribution',
      results
    };
  }

  /**
   * Perform time series analysis
   */
  private timeseriesAnalysis(data: any[], options?: any) {
    if (!options?.timeColumn) {
      throw new Error('Time column must be specified for time series analysis');
    }

    const timeValues = data.map(row => new Date(row[options.timeColumn]));
    const features = options?.features || this.getNumericColumns(data);
    const results: Record<string, any> = {};

    for (const feature of features) {
      if (feature === options.timeColumn) continue;

      const values = data.map(row => row[feature]);
      results[feature] = {
        trend: this.trendAnalysis(values),
        seasonality: this.seasonalityAnalysis(timeValues, values),
        stationarity: this.stationarityTest(values),
        forecast: this.timeseriesForecast(values)
      };
    }

    return {
      type: 'timeseries',
      results
    };
  }

  /**
   * Perform clustering analysis
   */
  private clusteringAnalysis(data: any[], options?: any) {
    const features = options?.features || this.getNumericColumns(data);
    const k = options?.clusters || 3;

    const X = data.map(row => features.map(f => row[f]));
    const clusters = this.kMeans(X, k);

    return {
      type: 'clustering',
      method: 'kmeans',
      k,
      clusters,
      silhouetteScore: this.silhouetteScore(X, clusters)
    };
  }

  /**
   * Perform anomaly detection
   */
  private anomalyDetection(data: any[], options?: any) {
    const features = options?.features || this.getNumericColumns(data);
    const threshold = options?.threshold || 2; // Default: 2 standard deviations

    const results: Record<string, any> = {};

    for (const feature of features) {
      const values = data.map(row => row[feature]);
      results[feature] = {
        anomalies: this.detectAnomalies(values, threshold),
        statistics: {
          mean: this.mean(values),
          std: this.standardDeviation(values)
        }
      };
    }

    return {
      type: 'anomaly',
      method: 'zscore',
      threshold,
      results
    };
  }

  /**
   * Perform factor analysis
   */
  private factorAnalysis(data: any[], options?: any) {
    const features = options?.features || this.getNumericColumns(data);
    const X = data.map(row => features.map(f => row[f]));

    return {
      type: 'factor',
      correlationMatrix: this.correlationMatrix(X),
      eigenvalues: this.eigenvalues(X),
      loadings: this.factorLoadings(X)
    };
  }

  // Helper methods for statistical calculations

  private mean(values: number[]): number {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  private mode(values: number[]): number[] {
    const counts = new Map<number, number>();
    values.forEach(val => counts.set(val, (counts.get(val) || 0) + 1));
    
    let maxCount = 0;
    let modes: number[] = [];
    
    counts.forEach((count, value) => {
      if (count > maxCount) {
        maxCount = count;
        modes = [value];
      } else if (count === maxCount) {
        modes.push(value);
      }
    });
    
    return modes;
  }

  private variance(values: number[]): number {
    const avg = this.mean(values);
    return this.mean(values.map(x => Math.pow(x - avg, 2)));
  }

  private standardDeviation(values: number[]): number {
    return Math.sqrt(this.variance(values));
  }

  private quartiles(values: number[]): number[] {
    const sorted = [...values].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q2 = this.median(sorted);
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    return [q1, q2, q3];
  }

  private skewness(values: number[]): number {
    const avg = this.mean(values);
    const std = this.standardDeviation(values);
    const n = values.length;
    return (n / ((n - 1) * (n - 2))) * values.reduce((sum, x) => sum + Math.pow((x - avg) / std, 3), 0);
  }

  private kurtosis(values: number[]): number {
    const avg = this.mean(values);
    const std = this.standardDeviation(values);
    const n = values.length;
    return (n * (n + 1) / ((n - 1) * (n - 2) * (n - 3))) * values.reduce((sum, x) => sum + Math.pow((x - avg) / std, 4), 0) - (3 * (n - 1) * (n - 1) / ((n - 2) * (n - 3)));
  }

  private pearsonCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    const xMean = this.mean(x);
    const yMean = this.mean(y);
    
    let numerator = 0;
    let xDenominator = 0;
    let yDenominator = 0;
    
    for (let i = 0; i < n; i++) {
      const xDiff = x[i] - xMean;
      const yDiff = y[i] - yMean;
      numerator += xDiff * yDiff;
      xDenominator += xDiff * xDiff;
      yDenominator += yDiff * yDiff;
    }
    
    return numerator / Math.sqrt(xDenominator * yDenominator);
  }

  private getNumericColumns(data: any[]): string[] {
    if (data.length === 0) return [];
    
    return Object.keys(data[0]).filter(key => {
      const value = data[0][key];
      return typeof value === 'number' || !isNaN(Number(value));
    });
  }

  private linearRegression(X: number[][], y: number[]): any {
    // Simple implementation of linear regression
    // For production use, consider using a proper machine learning library
    const n = X.length;
    const p = X[0].length;
    
    // Add intercept term
    const Xb = X.map(row => [1, ...row]);
    
    // Calculate coefficients using normal equation
    // β = (X'X)^(-1)X'y
    const Xt = this.transpose(Xb);
    const XtX = this.matrixMultiply(Xt, Xb);
    const XtXInv = this.inverse(XtX);
    const Xty = this.matrixMultiply(Xt, y.map(yi => [yi]));
    const beta = this.matrixMultiply(XtXInv, Xty).map(row => row[0]);
    
    // Calculate predictions
    const yPred = Xb.map(row => 
      row.reduce((sum, xi, i) => sum + xi * beta[i], 0)
    );
    
    // Calculate R-squared
    const yMean = this.mean(y);
    const totalSS = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
    const residualSS = y.reduce((sum, yi, i) => sum + Math.pow(yi - yPred[i], 2), 0);
    const r2 = 1 - (residualSS / totalSS);
    
    // Calculate MSE
    const mse = residualSS / n;
    
    return {
      coefficients: beta.slice(1),
      intercept: beta[0],
      r2,
      mse
    };
  }

  private transpose(matrix: number[][]): number[][] {
    return matrix[0].map((_, i) => matrix.map(row => row[i]));
  }

  private matrixMultiply(a: number[][], b: number[][]): number[][] {
    const result: number[][] = [];
    for (let i = 0; i < a.length; i++) {
      result[i] = [];
      for (let j = 0; j < b[0].length; j++) {
        let sum = 0;
        for (let k = 0; k < a[0].length; k++) {
          sum += a[i][k] * b[k][j];
        }
        result[i][j] = sum;
      }
    }
    return result;
  }

  private inverse(matrix: number[][]): number[][] {
    // Simple implementation for 2x2 matrices
    // For production use, consider using a proper linear algebra library
    if (matrix.length !== 2 || matrix[0].length !== 2) {
      throw new Error('Matrix inverse only implemented for 2x2 matrices');
    }
    
    const det = matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0];
    return [
      [matrix[1][1] / det, -matrix[0][1] / det],
      [-matrix[1][0] / det, matrix[0][0] / det]
    ];
  }

  private detectAnomalies(values: number[], threshold: number): number[] {
    const mean = this.mean(values);
    const std = this.standardDeviation(values);
    return values.map((value, index) => {
      const zscore = Math.abs((value - mean) / std);
      return zscore > threshold ? index : -1;
    }).filter(index => index !== -1);
  }

  /**
   * Get help information
   */
  getHelp(): string {
    return `
Tool: ${this.name} (v${this.version})
Category: ${this.category}
Description: ${this.description}

Supported Analysis Types:
- descriptive: Basic statistical measures (mean, median, mode, etc.)
- correlation: Correlation analysis between variables
- regression: Linear regression analysis
- hypothesis: Statistical hypothesis testing
- distribution: Distribution analysis and normality tests
- timeseries: Time series analysis and forecasting
- clustering: Clustering analysis (K-means)
- anomaly: Anomaly detection using Z-score
- factor: Factor analysis

Arguments:
- type: Analysis type (required)
- data: Array of data objects (required)
- options: Configuration options (optional)
  - significance: Significance level for hypothesis testing
  - method: Specific method for the analysis
  - features: Features to analyze
  - target: Target variable for regression
  - timeColumn: Column name for time series data
  - clusters: Number of clusters
  - threshold: Threshold for anomaly detection

Examples:
1. Descriptive statistics:
   {
     type: 'descriptive',
     data: [{x: 1, y: 2}, {x: 3, y: 4}]
   }

2. Correlation analysis:
   {
     type: 'correlation',
     data: [{x: 1, y: 2}, {x: 3, y: 4}],
     options: {
       features: ['x', 'y']
     }
   }

3. Regression analysis:
   {
     type: 'regression',
     data: [{x: 1, y: 2}, {x: 3, y: 4}],
     options: {
       features: ['x'],
       target: 'y'
     }
   }
    `.trim();
  }
} 