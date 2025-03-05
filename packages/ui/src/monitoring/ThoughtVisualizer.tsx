import React, { useEffect, useRef, useState } from 'react';
import { useMonitoring } from './MonitoringProvider';

export interface ThoughtNode {
  id: string;
  content: string;
  type: 'thought' | 'decision' | 'action' | 'result';
  timestamp: Date;
  children: ThoughtNode[];
  metadata?: Record<string, any>;
}

export interface ThoughtVisualizerProps {
  thoughts?: ThoughtNode[];
  width?: number;
  height?: number;
  onNodeClick?: (node: ThoughtNode) => void;
}

const ThoughtVisualizer: React.FC<ThoughtVisualizerProps> = ({
  thoughts: externalThoughts,
  width = 800,
  height = 600,
  onNodeClick,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width, height });
  const [hoveredNode, setHoveredNode] = useState<ThoughtNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<ThoughtNode | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const { state } = useMonitoring();

  // 将agent活动转换为思考节点
  const convertActivitiesToThoughts = (): ThoughtNode[] => {
    if (!state.agentActivities || state.agentActivities.length === 0) {
      // 创建一些模拟数据，以便在没有实际数据时展示UI
      return [
        {
          id: 'root-1',
          content: 'Main Task: Analyze Customer Data',
          type: 'thought',
          timestamp: new Date(),
          children: [
            {
              id: 'decision-1',
              content: 'DECIDE: Use clustering algorithm for segmentation',
              type: 'decision',
              timestamp: new Date(Date.now() + 1000),
              children: [
                {
                  id: 'action-1',
                  content: 'ACT: Implement K-means clustering',
                  type: 'action',
                  timestamp: new Date(Date.now() + 2000),
                  children: [
                    {
                      id: 'result-1',
                      content: 'RESULT: Identified 5 customer segments',
                      type: 'result',
                      timestamp: new Date(Date.now() + 3000),
                      children: []
                    }
                  ]
                }
              ]
            },
            {
              id: 'decision-2',
              content: 'DECIDE: Generate insights from segments',
              type: 'decision',
              timestamp: new Date(Date.now() + 4000),
              children: [
                {
                  id: 'action-2',
                  content: 'ACT: Calculate key metrics per segment',
                  type: 'action',
                  timestamp: new Date(Date.now() + 5000),
                  children: []
                }
              ]
            }
          ]
        }
      ];
    }

    // 按照时间排序活动
    const sortedActivities = [...state.agentActivities].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );

    // 创建节点映射以快速访问
    const nodeMap = new Map<string, ThoughtNode>();
    
    // 创建根节点
    const rootNodes: ThoughtNode[] = [];

    // 处理每个活动
    sortedActivities.forEach(activity => {
      const nodeId = `${activity.agentId}-${activity.timestamp.getTime()}`;
      
      // 根据活动类型确定节点类型
      let nodeType: 'thought' | 'decision' | 'action' | 'result' = 'thought';
      if (activity.action.startsWith('DECIDE')) {
        nodeType = 'decision';
      } else if (activity.action.startsWith('ACT')) {
        nodeType = 'action';
      } else if (activity.action.startsWith('RESULT')) {
        nodeType = 'result';
      }
      
      // 创建节点
      const node: ThoughtNode = {
        id: nodeId,
        content: activity.action,
        type: nodeType,
        timestamp: activity.timestamp,
        children: [],
        metadata: {
          agentId: activity.agentId,
          details: activity.details
        }
      };
      
      nodeMap.set(nodeId, node);
      
      // 查找父节点
      // 对于给定的活动，查找同一个agent的上一个活动作为父节点
      const parentActivity = [...sortedActivities]
        .slice(0, sortedActivities.indexOf(activity))
        .reverse()
        .find(a => a.agentId === activity.agentId);
      
      if (parentActivity) {
        const parentId = `${parentActivity.agentId}-${parentActivity.timestamp.getTime()}`;
        const parent = nodeMap.get(parentId);
        if (parent) {
          parent.children.push(node);
        } else {
          rootNodes.push(node);
        }
      } else {
        rootNodes.push(node);
      }
    });
    
    return rootNodes;
  };

  // 默认使用内部转换的思考数据，除非提供了外部思考
  const thoughts = externalThoughts || convertActivitiesToThoughts();
  
  // 处理响应式布局
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const { width: containerWidth } = containerRef.current.getBoundingClientRect();
        setContainerSize({
          width: containerWidth,
          height: Math.max(500, containerWidth * 0.6),
        });
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [width, height]);
  
  // 构建树结构
  const buildTree = (nodes: ThoughtNode[], startX: number, startY: number, maxWidth: number, level: number = 0): void => {
    if (nodes.length === 0) return;
    
    const nodeHeight = 40;
    const levelHeight = 120;
    const horizontalSpacing = maxWidth / (nodes.length + 1);
    
    nodes.forEach((node, index) => {
      // 计算当前节点位置
      const x = startX + horizontalSpacing * (index + 1);
      const y = startY + levelHeight;
      
      // 保存节点位置信息到节点元数据中（用于事件处理）
      node.metadata = {
        ...node.metadata,
        x,
        y,
        width: 180,
        height: nodeHeight,
        level
      };
      
      // 递归构建子树
      if (node.children.length > 0) {
        buildTree(
          node.children, 
          x - horizontalSpacing * node.children.length / 2, 
          y, 
          Math.max(horizontalSpacing * node.children.length, 300), 
          level + 1
        );
      }
    });
  };
  
  // 绘制思考树
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const { width, height } = containerSize;
    canvas.width = width;
    canvas.height = height;
    
    ctx.clearRect(0, 0, width, height);
    
    // 应用缩放和平移
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);
    
    // 设置全局样式
    ctx.textBaseline = 'middle';
    ctx.font = '13px Arial';
    
    // 绘制背景
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(-pan.x / zoom, -pan.y / zoom, width / zoom, height / zoom);
    
    // 绘制网格
    const gridSize = 50;
    const gridOffsetX = -pan.x / zoom % gridSize;
    const gridOffsetY = -pan.y / zoom % gridSize;
    
    ctx.strokeStyle = '#e9ecef';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    
    for (let x = gridOffsetX; x < width / zoom; x += gridSize) {
      ctx.moveTo(x, -pan.y / zoom);
      ctx.lineTo(x, height / zoom);
    }
    
    for (let y = gridOffsetY; y < height / zoom; y += gridSize) {
      ctx.moveTo(-pan.x / zoom, y);
      ctx.lineTo(width / zoom, y);
    }
    
    ctx.stroke();
    
    // 如果没有数据，显示提示信息
    if (!thoughts || thoughts.length === 0) {
      ctx.fillStyle = '#6c757d';
      ctx.font = '18px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('No thought data available', width / (2 * zoom) - pan.x / zoom, height / (2 * zoom) - pan.y / zoom - 20);
      ctx.font = '14px Arial';
      ctx.fillText('Agent activities will appear here when available', width / (2 * zoom) - pan.x / zoom, height / (2 * zoom) - pan.y / zoom + 20);
      ctx.restore();
      return;
    }
    
    // 复制思考数据，构建树结构
    const treeData = JSON.parse(JSON.stringify(thoughts));
    buildTree(treeData, width / (2 * zoom) - pan.x / zoom, 50 - pan.y / zoom, width / zoom - 100);
    
    // 绘制连接线
    const drawConnections = (nodes: ThoughtNode[]) => {
      nodes.forEach(node => {
        const { x: parentX, y: parentY } = node.metadata as any;
        
        node.children.forEach(child => {
          const { x: childX, y: childY } = child.metadata as any;
          
          // 绘制贝塞尔曲线连接
          ctx.beginPath();
          ctx.moveTo(parentX, parentY + 20); // 从父节点底部开始
          
          // 控制点
          const controlPointY = (parentY + childY) / 2;
          
          ctx.bezierCurveTo(
            parentX, controlPointY, // 第一个控制点
            childX, controlPointY,  // 第二个控制点
            childX, childY - 20     // 终点
          );
          
          // 设置连接线样式
          ctx.strokeStyle = '#adb5bd';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          
          // 绘制子节点连接
          drawConnections([child]);
        });
      });
    };
    
    drawConnections(treeData);
    
    // 绘制节点
    const drawNodes = (nodes: ThoughtNode[]) => {
      nodes.forEach(node => {
        const { x, y, width: nodeWidth, height: nodeHeight, level } = node.metadata as any;
        
        // 节点背景颜色根据类型设置
        let bgColor = '#e9ecef';
        let borderColor = '#ced4da';
        let textColor = '#212529';
        let icon = '💭'; // 默认思考图标
        
        switch (node.type) {
          case 'thought':
            bgColor = '#e9ecef';
            borderColor = '#ced4da';
            icon = '💭';
            break;
          case 'decision':
            bgColor = '#e6f7ff';
            borderColor = '#91d5ff';
            icon = '🔍';
            break;
          case 'action':
            bgColor = '#f6ffed';
            borderColor = '#b7eb8f';
            icon = '🔄';
            break;
          case 'result':
            bgColor = '#fff7e6';
            borderColor = '#ffd591';
            icon = '✅';
            break;
        }
        
        // 高亮选中或悬停的节点
        if (selectedNode && node.id === selectedNode.id) {
          bgColor = '#4361ee';
          borderColor = '#3a0ca3';
          textColor = '#ffffff';
        } else if (hoveredNode && node.id === hoveredNode.id) {
          bgColor = '#d3d3d3';
          borderColor = '#a9a9a9';
        }
        
        // 绘制节点框
        ctx.fillStyle = bgColor;
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 2;
        
        // 绘制圆角矩形
        const radius = 8;
        ctx.beginPath();
        ctx.moveTo(x - nodeWidth / 2 + radius, y - nodeHeight / 2);
        ctx.lineTo(x + nodeWidth / 2 - radius, y - nodeHeight / 2);
        ctx.quadraticCurveTo(x + nodeWidth / 2, y - nodeHeight / 2, x + nodeWidth / 2, y - nodeHeight / 2 + radius);
        ctx.lineTo(x + nodeWidth / 2, y + nodeHeight / 2 - radius);
        ctx.quadraticCurveTo(x + nodeWidth / 2, y + nodeHeight / 2, x + nodeWidth / 2 - radius, y + nodeHeight / 2);
        ctx.lineTo(x - nodeWidth / 2 + radius, y + nodeHeight / 2);
        ctx.quadraticCurveTo(x - nodeWidth / 2, y + nodeHeight / 2, x - nodeWidth / 2, y + nodeHeight / 2 - radius);
        ctx.lineTo(x - nodeWidth / 2, y - nodeHeight / 2 + radius);
        ctx.quadraticCurveTo(x - nodeWidth / 2, y - nodeHeight / 2, x - nodeWidth / 2 + radius, y - nodeHeight / 2);
        ctx.closePath();
        
        ctx.fill();
        ctx.stroke();
        
        // 绘制图标和文本
        ctx.fillStyle = textColor;
        ctx.textAlign = 'left';
        ctx.font = '13px Arial';
        
        // 绘制图标
        ctx.fillText(icon, x - nodeWidth / 2 + 10, y);
        
        // 绘制文本，截断过长的文本
        const text = truncateText(node.content, nodeWidth - 40);
        ctx.fillText(text, x - nodeWidth / 2 + 30, y);
        
        // 显示节点层级（调试用）
        // ctx.fillStyle = '#999';
        // ctx.font = '10px Arial';
        // ctx.fillText(`Level: ${level}`, x - nodeWidth / 2 + 5, y + nodeHeight / 2 - 5);
        
        // 递归绘制子节点
        if (node.children.length > 0) {
          drawNodes(node.children);
        }
      });
    };
    
    // 文本截断函数
    const truncateText = (text: string, maxWidth: number): string => {
      if (!ctx) return text;
      
      if (ctx.measureText(text).width <= maxWidth) {
        return text;
      }
      
      let truncated = text;
      while (ctx.measureText(truncated + '...').width > maxWidth && truncated.length > 0) {
        truncated = truncated.slice(0, -1);
      }
      
      return truncated + '...';
    };
    
    drawNodes(treeData);
    ctx.restore();
    
    // 添加事件处理器
    const findNodeAtPosition = (x: number, y: number, nodes: ThoughtNode[]): ThoughtNode | null => {
      // 转换鼠标坐标到缩放和平移后的坐标系
      const transformedX = (x - pan.x) / zoom;
      const transformedY = (y - pan.y) / zoom;
      
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const { x: nodeX, y: nodeY, width: nodeWidth, height: nodeHeight } = node.metadata as any;
        
        // 检查点是否在节点内
        if (
          transformedX >= nodeX - nodeWidth / 2 &&
          transformedX <= nodeX + nodeWidth / 2 &&
          transformedY >= nodeY - nodeHeight / 2 &&
          transformedY <= nodeY + nodeHeight / 2
        ) {
          return node;
        }
        
        // 递归检查子节点
        const childNode = findNodeAtPosition(x, y, node.children);
        if (childNode) {
          return childNode;
        }
      }
      
      return null;
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // 如果正在拖动，更新平移
      if (isDragging) {
        setPan(prev => ({
          x: prev.x + (x - lastMousePos.x),
          y: prev.y + (y - lastMousePos.y)
        }));
        setLastMousePos({ x, y });
        return;
      }
      
      // 否则检查悬停
      const node = findNodeAtPosition(x, y, thoughts);
      setHoveredNode(node);
      
      // 更新鼠标样式
      canvas.style.cursor = node ? 'pointer' : isDragging ? 'grabbing' : 'grab';
    };
    
    const handleMouseDown = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      setLastMousePos({ x, y });
      
      // 检查是否点击了节点
      const node = findNodeAtPosition(x, y, thoughts);
      
      if (node) {
        // 点击节点时不开始拖动
        setSelectedNode(node);
        if (onNodeClick) {
          onNodeClick(node);
        }
      } else {
        // 点击空白区域时开始拖动
        setIsDragging(true);
        canvas.style.cursor = 'grabbing';
      }
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.style.cursor = 'grab';
      }
    };
    
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      
      // 计算新的缩放比例
      const delta = -e.deltaY * 0.01;
      const newZoom = Math.max(0.5, Math.min(2, zoom + delta));
      
      // 更新缩放比例
      setZoom(newZoom);
    };
    
    // 添加事件监听器
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseUp);
    canvas.addEventListener('wheel', handleWheel);
    
    // 清理函数
    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mouseleave', handleMouseUp);
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [thoughts, containerSize, hoveredNode, selectedNode, onNodeClick, zoom, pan, isDragging, lastMousePos]);
  
  // 渲染节点详情面板
  const renderNodeDetails = () => {
    if (!selectedNode) return null;
    
    return (
      <div className="bg-[#ffffff] rounded-lg shadow-sm p-4 mt-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-medium">节点详情</h3>
          <button 
            className="text-gray-500 hover:text-gray-700"
            onClick={() => setSelectedNode(null)}
          >
            关闭
          </button>
        </div>
        
        <div className="space-y-3">
          <div>
            <span className="text-gray-500 text-sm">类型：</span>
            <span className={`inline-block px-2 py-1 rounded text-xs ${
              selectedNode.type === 'thought' ? 'bg-muted' :
              selectedNode.type === 'decision' ? 'bg-[#dbeafe]' :
              selectedNode.type === 'action' ? 'bg-[#dcfce7]' :
              'bg-[#fef9c3]'
            }`}>
              {selectedNode.type === 'thought' ? '思考' :
               selectedNode.type === 'decision' ? '决策' :
               selectedNode.type === 'action' ? '行动' :
               '结果'}
            </span>
          </div>
          
          <div>
            <span className="text-gray-500 text-sm">内容：</span>
            <div className="bg-[#f9fafb] p-2 rounded mt-1 text-sm">
              {selectedNode.content}
            </div>
          </div>
          
          <div>
            <span className="text-gray-500 text-sm">时间：</span>
            <div className="text-sm">
              {selectedNode.timestamp.toLocaleString()}
            </div>
          </div>
          
          {selectedNode.metadata?.agentId && (
            <div>
              <span className="text-gray-500 text-sm">智能体ID：</span>
              <div className="text-sm">
                {selectedNode.metadata.agentId}
              </div>
            </div>
          )}
          
          {selectedNode.metadata?.details && Object.keys(selectedNode.metadata.details).length > 0 && (
            <div>
              <span className="text-gray-500 text-sm">额外详情：</span>
              <pre className="bg-[#f9fafb] p-2 rounded mt-1 text-xs overflow-auto max-h-32">
                {JSON.stringify(selectedNode.metadata.details, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    );
  };
  
  // 渲染控制面板
  const renderControls = () => {
    return (
      <div className="flex items-center space-x-2 mt-2 mb-2">
        <button
          className="bg-[#f0f1f3] hover:bg-[#e5e7eb] rounded p-1"
          onClick={() => setZoom(prev => Math.min(prev + 0.1, 2))}
          title="放大"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            <line x1="11" y1="8" x2="11" y2="14"></line>
            <line x1="8" y1="11" x2="14" y2="11"></line>
          </svg>
        </button>
        <button
          className="bg-[#f0f1f3] hover:bg-[#e5e7eb] rounded p-1"
          onClick={() => setZoom(prev => Math.max(prev - 0.1, 0.5))}
          title="缩小"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            <line x1="8" y1="11" x2="14" y2="11"></line>
          </svg>
        </button>
        <button
          className="bg-[#f0f1f3] hover:bg-[#e5e7eb] rounded p-1"
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
          title="重置视图"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 2v6h-6"></path>
            <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
            <path d="M3 22v-6h6"></path>
            <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
          </svg>
        </button>
        <span className="text-sm text-gray-500">
          缩放: {Math.round(zoom * 100)}%
        </span>
      </div>
    );
  };
  
  return (
    <div className="thought-visualizer">
      {renderControls()}
      <div 
        ref={containerRef} 
        className="relative bg-[#ffffff] rounded-lg shadow-sm overflow-hidden"
        style={{ width: '100%', height: containerSize.height }}
      >
        <canvas
          ref={canvasRef}
          width={containerSize.width}
          height={containerSize.height}
          className="block w-full h-full"
        />
      </div>
      {renderNodeDetails()}
    </div>
  );
};

export default ThoughtVisualizer; 