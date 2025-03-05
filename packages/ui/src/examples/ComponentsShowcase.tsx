import React, { useState } from 'react';
import {
  Button,
  Card,
  Checkbox,
  Dialog,
  Input,
  Tabs,
  Toggle,
  Tooltip,
  cn
} from '../components/ui';

interface ShowcaseProps {
  title: string;
  children: React.ReactNode;
}

const Showcase: React.FC<ShowcaseProps> = ({ title, children }) => (
  <div className="mb-8">
    <h2 className="text-lg font-semibold mb-4 text-gray-800">{title}</h2>
    <div className="p-6 border border-gray-200 rounded-lg bg-white">
      {children}
    </div>
  </div>
);

export const ComponentsShowcase: React.FC = () => {
  // 状态
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [checkedState, setCheckedState] = useState(false);
  const [toggleState, setToggleState] = useState(false);
  const [inputValue, setInputValue] = useState('');

  // Tab示例数据
  const tabItems = [
    {
      id: 'tab1',
      label: '基础组件',
      content: (
        <div className="p-4">
          <p>基础组件展示了核心UI元素，如按钮、输入框等。</p>
        </div>
      ),
    },
    {
      id: 'tab2',
      label: '表单组件',
      content: (
        <div className="p-4">
          <p>表单组件便于构建交互式表单，包括复选框、单选框等。</p>
        </div>
      ),
    },
    {
      id: 'tab3',
      label: '布局组件',
      content: (
        <div className="p-4">
          <p>布局组件帮助构建页面结构，如卡片、分栏布局等。</p>
        </div>
      ),
      disabled: true,
    },
  ];

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8 text-center text-gray-900">MetaGPT UI 组件库</h1>
      
      {/* 按钮组件展示 */}
      <Showcase title="按钮 Button">
        <div className="flex flex-wrap gap-4">
          <Button>默认按钮</Button>
          <Button variant="primary">主要按钮</Button>
          <Button variant="secondary">次要按钮</Button>
          <Button variant="outline">轮廓按钮</Button>
          <Button variant="ghost">幽灵按钮</Button>
          <Button variant="link">链接按钮</Button>
          <Button disabled>禁用按钮</Button>
          <Button isLoading>加载中...</Button>
          <Button size="sm">小按钮</Button>
          <Button size="lg">大按钮</Button>
        </div>
      </Showcase>

      {/* 卡片组件展示 */}
      <Showcase title="卡片 Card">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <Card.Header>
              <Card.Title>基础卡片</Card.Title>
              <Card.Description>这是一个基础卡片示例</Card.Description>
            </Card.Header>
            <Card.Content>
              <p>卡片内容区域，可以放置任何内容。</p>
            </Card.Content>
            <Card.Footer>
              <Button size="sm">操作按钮</Button>
            </Card.Footer>
          </Card>
          
          <Card>
            <Card.Header>
              <Card.Title>带图片的卡片</Card.Title>
            </Card.Header>
            <img 
              src="https://via.placeholder.com/400x200" 
              alt="示例图片"
              className="w-full h-40 object-cover"
            />
            <Card.Content>
              <p>包含图片的卡片示例</p>
            </Card.Content>
          </Card>
        </div>
      </Showcase>

      {/* 输入框组件展示 */}
      <Showcase title="输入框 Input">
        <div className="flex flex-col gap-4 max-w-md">
          <Input 
            placeholder="基础输入框" 
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />
          
          <Input 
            type="password" 
            placeholder="密码输入框"
          />
          
          <Input 
            placeholder="禁用状态" 
            disabled
          />
          
          <Input 
            placeholder="带前缀图标"
            prefix={
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            }
          />
          
          <Input 
            placeholder="带后缀图标"
            suffix={
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            }
          />
        </div>
      </Showcase>

      {/* 复选框组件展示 */}
      <Showcase title="复选框 Checkbox">
        <div className="flex flex-col gap-4">
          <Checkbox 
            label="基础复选框" 
            checked={checkedState}
            onChange={(e) => setCheckedState(e.target.checked)}
          />
          
          <Checkbox 
            label="默认选中" 
            defaultChecked
          />
          
          <Checkbox 
            label="禁用状态" 
            disabled
          />
          
          <Checkbox 
            label="禁用且选中" 
            disabled 
            defaultChecked
          />
        </div>
      </Showcase>

      {/* 对话框组件展示 */}
      <Showcase title="对话框 Dialog">
        <div>
          <Button onClick={() => setIsDialogOpen(true)}>
            打开对话框
          </Button>
          
          <Dialog 
            isOpen={isDialogOpen} 
            onClose={() => setIsDialogOpen(false)}
            title="对话框示例"
          >
            <div className="py-4">
              <p>这是一个对话框示例内容。</p>
              <p className="mt-2">对话框可以包含任何类型的内容。</p>
            </div>
            
            <Dialog.Footer>
              <Button 
                variant="outline" 
                onClick={() => setIsDialogOpen(false)}
                className="mr-2"
              >
                取消
              </Button>
              <Button onClick={() => setIsDialogOpen(false)}>
                确认
              </Button>
            </Dialog.Footer>
          </Dialog>
        </div>
      </Showcase>

      {/* 切换开关组件展示 */}
      <Showcase title="切换开关 Toggle">
        <div className="flex flex-col gap-4">
          <Toggle 
            label="基础开关" 
            checked={toggleState}
            onChange={(e) => setToggleState(e.target.checked)}
          />
          
          <Toggle 
            label="小尺寸" 
            size="sm"
          />
          
          <Toggle 
            label="大尺寸" 
            size="lg"
          />
          
          <Toggle 
            label="标签在左侧" 
            labelPosition="left"
          />
          
          <Toggle 
            label="禁用状态" 
            disabled
          />
        </div>
      </Showcase>

      {/* 工具提示组件展示 */}
      <Showcase title="工具提示 Tooltip">
        <div className="flex flex-wrap gap-4">
          <Tooltip content="上方提示" position="top">
            <Button variant="outline">上方提示</Button>
          </Tooltip>
          
          <Tooltip content="右侧提示" position="right">
            <Button variant="outline">右侧提示</Button>
          </Tooltip>
          
          <Tooltip content="下方提示" position="bottom">
            <Button variant="outline">下方提示</Button>
          </Tooltip>
          
          <Tooltip content="左侧提示" position="left">
            <Button variant="outline">左侧提示</Button>
          </Tooltip>
          
          <Tooltip 
            content={
              <div>
                <strong>富文本提示</strong>
                <p>支持HTML和React元素</p>
              </div>
            }
          >
            <Button variant="outline">富文本提示</Button>
          </Tooltip>
        </div>
      </Showcase>

      {/* 选项卡组件展示 */}
      <Showcase title="选项卡 Tabs">
        <div>
          <h3 className="mb-4 font-medium">默认样式</h3>
          <Tabs items={tabItems} />
          
          <h3 className="mt-8 mb-4 font-medium">药丸样式</h3>
          <Tabs items={tabItems} variant="pills" />
          
          <h3 className="mt-8 mb-4 font-medium">下划线样式</h3>
          <Tabs items={tabItems} variant="underline" />
          
          <h3 className="mt-8 mb-4 font-medium">垂直方向</h3>
          <Tabs items={tabItems} orientation="vertical" />
        </div>
      </Showcase>
    </div>
  );
};

export default ComponentsShowcase; 