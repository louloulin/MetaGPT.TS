// Import and re-export browser-compatible SPO optimizer
import BrowserSPOOptimizer, {
  Solution,
  ParameterBounds,
  SPOOptimizerOptions,
  OptimizationProgressEvent,
  OptimizationResult,
  ObjectiveFunction,
  ConstraintFunction,
  ProgressCallback
} from './browser-spo-optimizer';

export {
  BrowserSPOOptimizer,
  Solution,
  ParameterBounds,
  SPOOptimizerOptions,
  OptimizationProgressEvent,
  OptimizationResult,
  ObjectiveFunction,
  ConstraintFunction,
  ProgressCallback
};

export default BrowserSPOOptimizer; 