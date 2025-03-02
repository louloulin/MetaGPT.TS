# Data Interpreter Examples

本目录包含使用 Data Interpreter 进行数据分析和可视化的示例。

## 示例

1. **基础数据可视化 (`data_visualization.ts`)**
   
   该示例演示如何使用 `DataInterpreter` 类分析和可视化 sklearn 的 Iris 数据集。
   
   运行示例:
   ```bash
   # 使用默认要求
   npx ts-node examples/di/data_visualization.ts
   
   # 或指定自定义要求
   npx ts-node examples/di/data_visualization.ts "分析iris数据集并为各个特征生成直方图"
   ```

2. **增强数据分析 (`enhanced_data_analysis.ts`)**
   
   该示例使用 `DataInterpreter` 的包装器，提供更简单的接口和错误处理。
   
   运行示例:
   ```bash
   npx ts-node examples/di/enhanced_data_analysis.ts
   ```

3. **虚拟环境支持示例 (`virtual_env_example.ts`)**
   
   该示例演示如何使用虚拟环境支持功能进行数据分析，为每个项目创建独立的Python环境。
   
   特点:
   - 自动创建和使用Python虚拟环境
   - 在隔离环境中安装依赖
   - 适用于需要不同Python包版本的项目
   
   运行示例:
   ```bash
   npx ts-node examples/di/virtual_env_example.ts
   ```

## 示例演示的功能

- 数据分析和可视化
- Python代码生成和执行
- 依赖管理和自动安装
- 错误处理
- 虚拟环境支持

## 需求

- Node.js 16+
- TypeScript
- Python 3.7+
- 数据科学库: `numpy`, `pandas`, `matplotlib`, `seaborn`, `scikit-learn`

## 配置

`DataInterpreter` 和 `EnhancedDataInterpreter` 类支持以下配置选项：

- **runMode**: 运行模式，可选 `'sequential'` 或 `'parallel'`
- **codeExecution**: 代码执行配置
  - **projectPrefix**: 项目名称前缀，默认为 `'数据分析'`
  - **preserveFiles**: 是否保留生成的文件，默认为 `true`
  - **baseDir**: 工作目录基础路径，默认为 `'workspace'`
  - **setupPipLink**: 是否设置pip3到pip的软连接，默认为 `true`
  - **checkDependencies**: 是否检查依赖，默认为 `true`
  - **autoInstallDependencies**: 是否自动安装依赖，默认为 `false`
  - **skipDependenciesErrors**: 是否跳过依赖错误继续执行，默认为 `false`
  - **useVirtualEnv**: 是否使用Python虚拟环境，默认为 `false`
  - **preInstallCommonDeps**: 是否在虚拟环境创建后预安装公共数据科学依赖，默认为 `false`

### 虚拟环境支持

通过设置 `useVirtualEnv: true`，系统将为每个数据分析项目自动创建和使用独立的Python虚拟环境。这提供了以下优势：

1. **依赖隔离**：每个项目的依赖安装在独立环境中，不会影响系统Python
2. **版本一致性**：确保所有依赖版本兼容且一致
3. **安全性提升**：避免权限问题，不需要管理员权限安装全局包
4. **清晰的依赖管理**：每个项目的依赖明确隔离并记录

设置 `preInstallCommonDeps: true` 可以在创建虚拟环境后自动安装基本的数据科学包（numpy, pandas, matplotlib, seaborn, scikit-learn），这样可以大幅减少后续执行代码时的依赖问题。

虚拟环境位于项目工作目录下的 `.venv` 文件夹中，使用 `virtualenv` 创建。如果系统中没有安装 `virtualenv`，系统会尝试自动安装它。

示例配置：
```typescript
const config = {
  codeExecution: {
    useVirtualEnv: true,
    autoInstallDependencies: true,
    preInstallCommonDeps: true
  }
};
```

## 输出

运行示例后，将在 `workspace` 目录下生成带时间戳的项目文件夹，包含：

- `main.py` - 生成的Python代码
- `output.txt` - 执行结果
- `requirements.txt` - 依赖列表
- 各种生成的图表和数据文件
- `.venv` - 虚拟环境目录（如果启用虚拟环境） 