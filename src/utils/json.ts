/**
 * JSON Utility Functions
 */

/**
 * Stringifies a JSON object, handling circular references.
 * 
 * @param obj The object to stringify
 * @param space Number of spaces to use for indentation
 * @returns JSON string representation
 */
export function stringifyWithCircularRefs(obj: any, space: number = 0): string {
  const cache = new Set();
  
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      // Check for circular references
      if (cache.has(value)) {
        return '[Circular Reference]';
      }
      cache.add(value);
    }
    return value;
  }, space);
} 