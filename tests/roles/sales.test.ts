/**
 * Unit tests for Sales role
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Sales } from '../../src/roles/sales';
import { createTestLLMProvider } from '../utils/test-llm-provider';
import type { LLMProvider } from '../../src/types/llm';

describe('Sales', () => {
  let llmProvider: LLMProvider;
  
  beforeEach(() => {
    llmProvider = createTestLLMProvider();
  });

  it('should initialize correctly', () => {
    const sales = new Sales('test_sales', llmProvider);
    
    expect(sales.name).toBe('test_sales');
    expect(sales.llm).toBe(llmProvider);
  });

  it('should analyze customer needs', async () => {
    const sales = new Sales('test_sales', llmProvider);
    const customerInfo = 'Looking for a CRM solution for small business';

    const result = await sales.analyzeCustomerNeeds(customerInfo);
    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(result.status).toBe('completed');
  });

  it('should handle empty customer info', async () => {
    const sales = new Sales('test_sales', llmProvider);
    
    const result = await sales.analyzeCustomerNeeds('');
    expect(result.status).toBe('failed');
    expect(result.content).toContain('Empty customer info');
  });

  it('should create sales pitch', async () => {
    const sales = new Sales('test_sales', llmProvider);
    const productInfo = {
      name: 'Enterprise CRM',
      features: ['Customer management', 'Sales tracking', 'Analytics'],
      price: '$99/month'
    };

    const result = await sales.createSalesPitch(productInfo);
    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(result.status).toBe('completed');
  });

  it('should handle objections', async () => {
    const sales = new Sales('test_sales', llmProvider);
    const objection = 'The price is too high';

    const result = await sales.handleObjection(objection);
    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(result.status).toBe('completed');
  });
}); 