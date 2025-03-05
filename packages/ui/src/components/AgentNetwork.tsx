import React, { useEffect, useRef } from 'react';
import { useMetaGPT } from './MetaGPTProvider';

interface Agent {
  id: string;
  name: string;
  status: 'idle' | 'working' | 'error';
  connections: string[];
}

interface AgentNetworkProps {
  agents: Agent[];
  width?: number;
  height?: number;
  onAgentClick?: (agentId: string) => void;
}

export const AgentNetwork: React.FC<AgentNetworkProps> = ({
  agents,
  width = 800,
  height = 600,
  onAgentClick,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { config } = useMetaGPT();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 清除画布
    ctx.clearRect(0, 0, width, height);

    // 计算节点位置（简单圆形布局）
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.35;
    const positions = new Map<string, { x: number; y: number }>();

    agents.forEach((agent, index) => {
      const angle = (2 * Math.PI * index) / agents.length;
      positions.set(agent.id, {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      });
    });

    // 绘制连接线
    ctx.strokeStyle = '#999';
    ctx.lineWidth = 1;
    agents.forEach(agent => {
      const pos1 = positions.get(agent.id);
      if (!pos1) return;

      agent.connections.forEach(targetId => {
        const pos2 = positions.get(targetId);
        if (!pos2) return;

        ctx.beginPath();
        ctx.moveTo(pos1.x, pos1.y);
        ctx.lineTo(pos2.x, pos2.y);
        ctx.stroke();
      });
    });

    // 绘制节点
    agents.forEach(agent => {
      const pos = positions.get(agent.id);
      if (!pos) return;

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 20, 0, 2 * Math.PI);
      
      // 根据状态设置颜色
      switch (agent.status) {
        case 'working':
          ctx.fillStyle = '#4CAF50';
          break;
        case 'error':
          ctx.fillStyle = '#F44336';
          break;
        default:
          ctx.fillStyle = '#2196F3';
      }
      
      ctx.fill();
      ctx.stroke();

      // 绘制标签
      ctx.fillStyle = '#000';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(agent.name, pos.x, pos.y);
    });

  }, [agents, width, height]);

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onAgentClick || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // 检测点击是否在某个代理节点上
    agents.forEach(agent => {
      const pos = { x: width / 2, y: height / 2 }; // 这里应该使用实际位置
      const distance = Math.sqrt(Math.pow(x - pos.x, 2) + Math.pow(y - pos.y, 2));
      if (distance <= 20) {
        onAgentClick(agent.id);
      }
    });
  };

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      onClick={handleCanvasClick}
      style={{ border: '1px solid #ccc' }}
    />
  );
};

export default AgentNetwork; 