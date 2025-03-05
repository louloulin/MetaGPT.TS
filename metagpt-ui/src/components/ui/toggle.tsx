import React from 'react'
import { cn } from '../../lib/utils'

export interface ToggleProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /**
   * 切换开关的大小
   */
  size?: 'sm' | 'md' | 'lg'
  /**
   * 自定义类名
   */
  className?: string
  /**
   * 自定义开关滑块类名
   */
  thumbClassName?: string
  /**
   * 标签文本
   */
  label?: string
  /**
   * 标签位置
   */
  labelPosition?: 'left' | 'right'
  /**
   * 禁用状态
   */
  disabled?: boolean
}

export const Toggle = React.forwardRef<HTMLInputElement, ToggleProps>(
  (
    {
      size = 'md',
      className = '',
      thumbClassName = '',
      label,
      labelPosition = 'right',
      disabled = false,
      ...props
    },
    ref
  ) => {
    // 根据尺寸设置不同的样式
    const sizeClasses = {
      sm: {
        container: 'w-8 h-4',
        thumb: 'w-3 h-3',
        translate: 'translate-x-4',
      },
      md: {
        container: 'w-11 h-6',
        thumb: 'w-5 h-5',
        translate: 'translate-x-5',
      },
      lg: {
        container: 'w-14 h-7',
        thumb: 'w-6 h-6',
        translate: 'translate-x-7',
      },
    }

    const containerClasses = cn(
      'relative inline-flex flex-shrink-0 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500',
      sizeClasses[size].container,
      disabled ? 'opacity-50 cursor-not-allowed' : '',
      props.checked ? 'bg-blue-600' : 'bg-gray-200',
      className
    )

    const thumbClasses = cn(
      'pointer-events-none inline-block rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200',
      sizeClasses[size].thumb,
      props.checked ? sizeClasses[size].translate : 'translate-x-0',
      thumbClassName
    )

    const labelClasses = cn(
      'select-none',
      disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
      labelPosition === 'left' ? 'mr-2' : 'ml-2'
    )

    const handleClick = (e: React.MouseEvent<HTMLLabelElement>) => {
      if (disabled) {
        e.preventDefault()
        return
      }
    }

    // 包装组件，处理标签的显示
    const renderToggle = () => (
      <span className="inline-flex items-center">
        {label && labelPosition === 'left' && (
          <span className={labelClasses}>{label}</span>
        )}
        <span className={containerClasses}>
          <span
            className="absolute inset-0 flex items-center justify-center"
            aria-hidden="true"
          >
            <input
              type="checkbox"
              className="absolute w-full h-full opacity-0 cursor-pointer"
              disabled={disabled}
              ref={ref}
              {...props}
            />
          </span>
          <span
            aria-hidden="true"
            className={thumbClasses}
          />
        </span>
        {label && labelPosition === 'right' && (
          <span className={labelClasses}>{label}</span>
        )}
      </span>
    )

    return label ? (
      <label onClick={handleClick} className="inline-flex items-center">
        {renderToggle()}
      </label>
    ) : (
      renderToggle()
    )
  }
)

Toggle.displayName = 'Toggle'

export default Toggle 