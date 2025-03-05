import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../../lib/utils'

export interface TooltipProps {
  /**
   * 提示内容
   */
  content: React.ReactNode
  /**
   * 子元素，必须是可以接收ref的React元素
   */
  children: React.ReactElement
  /**
   * 位置
   */
  position?: 'top' | 'bottom' | 'left' | 'right'
  /**
   * 延迟显示的时间（毫秒）
   */
  delay?: number
  /**
   * 自定义类名
   */
  className?: string
  /**
   * 禁用状态
   */
  disabled?: boolean
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  delay = 300,
  className = '',
  disabled = false
}) => {
  const [visible, setVisible] = useState(false)
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 })
  const targetRef = useRef<HTMLElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // 计算tooltip位置
  const updatePosition = () => {
    if (!targetRef.current || !tooltipRef.current) return

    const targetRect = targetRef.current.getBoundingClientRect()
    const tooltipRect = tooltipRef.current.getBoundingClientRect()
    
    let top = 0
    let left = 0

    switch (position) {
      case 'top':
        top = targetRect.top - tooltipRect.height - 8
        left = targetRect.left + (targetRect.width - tooltipRect.width) / 2
        break
      case 'bottom':
        top = targetRect.bottom + 8
        left = targetRect.left + (targetRect.width - tooltipRect.width) / 2
        break
      case 'left':
        top = targetRect.top + (targetRect.height - tooltipRect.height) / 2
        left = targetRect.left - tooltipRect.width - 8
        break
      case 'right':
        top = targetRect.top + (targetRect.height - tooltipRect.height) / 2
        left = targetRect.right + 8
        break
    }

    // 确保不超出视口边界
    if (left < 10) left = 10
    if (top < 10) top = 10
    if (left + tooltipRect.width > window.innerWidth - 10) {
      left = window.innerWidth - tooltipRect.width - 10
    }
    if (top + tooltipRect.height > window.innerHeight - 10) {
      top = window.innerHeight - tooltipRect.height - 10
    }

    setTooltipPosition({
      top: top + window.scrollY,
      left: left + window.scrollX
    })
  }

  const handleMouseEnter = () => {
    if (disabled) return
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    
    timeoutRef.current = setTimeout(() => {
      setVisible(true)
    }, delay)
  }

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setVisible(false)
  }

  useEffect(() => {
    if (visible) {
      updatePosition()
      // 添加窗口大小变化监听
      window.addEventListener('resize', updatePosition)
      window.addEventListener('scroll', updatePosition)
    }

    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition)
    }
  }, [visible, content])

  // 清理延时器
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  // 克隆子元素并添加事件监听器
  const childWithListeners = React.cloneElement(children, {
    ref: targetRef,
    onMouseEnter: (e: React.MouseEvent) => {
      handleMouseEnter()
      // 保持原有的事件处理器
      if (children.props.onMouseEnter) {
        children.props.onMouseEnter(e)
      }
    },
    onMouseLeave: (e: React.MouseEvent) => {
      handleMouseLeave()
      if (children.props.onMouseLeave) {
        children.props.onMouseLeave(e)
      }
    }
  })

  // 计算tooltip类名
  const tooltipClasses = cn(
    'fixed z-50 px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded shadow-sm max-w-xs',
    `tooltip-${position}`,
    className
  )

  return (
    <>
      {childWithListeners}
      {visible && typeof window !== 'undefined' && createPortal(
        <div 
          ref={tooltipRef}
          className={tooltipClasses}
          style={{
            top: `${tooltipPosition.top}px`,
            left: `${tooltipPosition.left}px`,
          }}
        >
          {content}
        </div>,
        document.body
      )}
    </>
  )
}

export default Tooltip 