import React, { useState, useCallback, useEffect } from 'react'
import { cn } from '../../lib/utils'

export interface TabItem {
  /**
   * 选项卡唯一标识
   */
  id: string
  /**
   * 选项卡标题
   */
  label: React.ReactNode
  /**
   * 选项卡内容
   */
  content: React.ReactNode
  /**
   * 是否禁用
   */
  disabled?: boolean
  /**
   * 自定义图标
   */
  icon?: React.ReactNode
}

export interface TabsProps {
  /**
   * 选项卡项目列表
   */
  items: TabItem[]
  /**
   * 当前选中的选项卡ID
   */
  activeTab?: string
  /**
   * 选项卡切换回调
   */
  onChange?: (tabId: string) => void
  /**
   * 选项卡方向
   */
  orientation?: 'horizontal' | 'vertical'
  /**
   * 选项卡样式
   */
  variant?: 'default' | 'pills' | 'underline'
  /**
   * 自定义类名
   */
  className?: string
  /**
   * 选项卡列表类名
   */
  tabListClassName?: string
  /**
   * 选项卡面板类名
   */
  tabPanelClassName?: string
  /**
   * 是否自动激活第一个非禁用的选项卡
   */
  autoActivateFirst?: boolean
}

export const Tabs: React.FC<TabsProps> = ({
  items,
  activeTab,
  onChange,
  orientation = 'horizontal',
  variant = 'default',
  className = '',
  tabListClassName = '',
  tabPanelClassName = '',
  autoActivateFirst = true,
}) => {
  // 找到第一个非禁用的选项卡
  const findFirstEnabledTab = useCallback(() => {
    return items.find(item => !item.disabled)?.id || ''
  }, [items])

  // 初始化选中的选项卡
  const [activeTabId, setActiveTabId] = useState<string>(
    activeTab || (autoActivateFirst ? findFirstEnabledTab() : '')
  )

  // 当activeTab prop改变时更新内部状态
  useEffect(() => {
    if (activeTab !== undefined) {
      setActiveTabId(activeTab)
    }
  }, [activeTab])

  // 处理选项卡点击
  const handleTabClick = (tabId: string, disabled: boolean = false) => {
    if (disabled) return
    
    setActiveTabId(tabId)
    onChange?.(tabId)
  }

  // 获取当前激活选项卡的内容
  const activeContent = items.find(item => item.id === activeTabId)?.content

  // 选项卡列表样式
  const tabListStyles = cn(
    'flex',
    orientation === 'horizontal' ? 'flex-row' : 'flex-col',
    {
      'border-b border-gray-200': variant === 'default' && orientation === 'horizontal',
      'border-r border-gray-200': variant === 'default' && orientation === 'vertical',
      'space-x-2': variant === 'pills' && orientation === 'horizontal',
      'space-y-2': variant === 'pills' && orientation === 'vertical',
      'border-b-2 border-gray-200': variant === 'underline' && orientation === 'horizontal',
    },
    tabListClassName
  )

  // 根据变体获取选项卡样式
  const getTabStyles = (isActive: boolean, disabled: boolean = false) => {
    return cn(
      'px-4 py-2 text-sm font-medium focus:outline-none transition',
      disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
      {
        // 默认变体
        'text-blue-600 border-blue-600': isActive && variant === 'default',
        'text-gray-500 hover:text-gray-700 hover:border-gray-300': !isActive && !disabled && variant === 'default',
        'border-b-2 -mb-px': isActive && variant === 'default' && orientation === 'horizontal',
        'border-r-2 -mr-px': isActive && variant === 'default' && orientation === 'vertical',
        
        // 药丸变体
        'bg-blue-600 text-white rounded-md': isActive && variant === 'pills',
        'text-gray-700 hover:bg-gray-100 rounded-md': !isActive && !disabled && variant === 'pills',
        
        // 下划线变体
        'border-blue-600 text-blue-600': isActive && variant === 'underline',
        'text-gray-500 hover:text-gray-700 hover:border-gray-300': !isActive && !disabled && variant === 'underline',
      }
    )
  }

  return (
    <div className={cn('w-full', className)}>
      <div className={tabListStyles} role="tablist">
        {items.map(item => (
          <button
            key={item.id}
            role="tab"
            aria-selected={activeTabId === item.id}
            aria-controls={`panel-${item.id}`}
            tabIndex={activeTabId === item.id ? 0 : -1}
            className={getTabStyles(activeTabId === item.id, item.disabled)}
            onClick={() => handleTabClick(item.id, item.disabled)}
            disabled={item.disabled}
          >
            {item.icon && (
              <span className="mr-2">{item.icon}</span>
            )}
            {item.label}
          </button>
        ))}
      </div>
      
      <div
        role="tabpanel"
        id={`panel-${activeTabId}`}
        aria-labelledby={activeTabId}
        className={cn('mt-4', tabPanelClassName)}
      >
        {activeContent}
      </div>
    </div>
  )
}

export default Tabs 