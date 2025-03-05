import * as React from "react"
import { cn } from "../../lib/utils"

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  width?: string;
  hideCloseButton?: boolean;
}

export interface DialogHeaderProps {
  className?: string;
  children: React.ReactNode;
}

const DialogHeader: React.FC<DialogHeaderProps> = ({
  className,
  children,
  ...props
}) => (
  <div
    className={cn("mb-4 flex flex-col space-y-1.5", className)}
    {...props}
  >
    {children}
  </div>
);

export interface DialogFooterProps {
  className?: string;
  children: React.ReactNode;
}

const DialogFooter: React.FC<DialogFooterProps> = ({
  className,
  children,
  ...props
}) => (
  <div
    className={cn("mt-4 flex justify-end space-x-2", className)}
    {...props}
  >
    {children}
  </div>
);

const Dialog: React.FC<DialogProps> & {
  Header: typeof DialogHeader;
  Footer: typeof DialogFooter;
} = ({
  isOpen,
  onClose,
  title,
  children,
  className,
  width = "max-w-lg",
  hideCloseButton = false,
}) => {
  // 当对话框打开时，禁止body滚动
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isOpen]);

  // 点击对话框外部时关闭
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // 按ESC键关闭
  React.useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      onClick={handleOverlayClick}
    >
      <div
        className={cn(
          "relative rounded-lg bg-white shadow-xl",
          width,
          className
        )}
        role="dialog"
        aria-modal="true"
      >
        {title && (
          <div className="border-b border-gray-200 px-6 py-4">
            <h3 className="text-lg font-medium text-gray-900">{title}</h3>
          </div>
        )}
        {!hideCloseButton && (
          <button
            type="button"
            className="absolute right-4 top-4 text-gray-400 hover:text-gray-500"
            onClick={onClose}
          >
            <span className="sr-only">关闭</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
        <div className={title ? "px-6 py-4" : "p-6"}>{children}</div>
      </div>
    </div>
  );
};

Dialog.Header = DialogHeader;
Dialog.Footer = DialogFooter;

export { Dialog, DialogHeader, DialogFooter }; 