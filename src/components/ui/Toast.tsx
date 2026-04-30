import { create } from "zustand";
import { useEffect, useState } from "react";
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Info, 
  X,
  Loader2,
} from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newToast = { ...toast, id };
    set((state) => ({ toasts: [...state.toasts, newToast] }));
    return id;
  },
  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
  clearToasts: () => set({ toasts: [] }),
}));

// Helper function to show toasts - can be imported from anywhere
export const showMultiplayerToast = (
  type: ToastType,
  title: string,
  message?: string,
  duration: number = 5000
) => {
  return useToastStore.getState().addToast({ type, title, message, duration });
};

// Convenience helpers for common toast types
export const toast = {
  success: (title: string, message?: string) => 
    showMultiplayerToast("success", title, message),
  error: (title: string, message?: string) => 
    showMultiplayerToast("error", title, message),
  warning: (title: string, message?: string) => 
    showMultiplayerToast("warning", title, message),
  info: (title: string, message?: string) => 
    showMultiplayerToast("info", title, message),
};

// Toast item component
interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const [isExiting, setIsExiting] = useState(false);
  
  const icons = {
    success: <CheckCircle className="w-5 h-5 text-success-500" />,
    error: <XCircle className="w-5 h-5 text-red-500" />,
    warning: <AlertTriangle className="w-5 h-5 text-yellow-500" />,
    info: <Info className="w-5 h-5 text-primary-500" />,
  };
  
  const colors = {
    success: "bg-success-50 dark:bg-success-500/10 border-success-200 dark:border-success-500/30",
    error: "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30",
    warning: "bg-yellow-50 dark:bg-yellow-500/10 border-yellow-200 dark:border-yellow-500/30",
    info: "bg-primary-50 dark:bg-primary-500/10 border-primary-200 dark:border-primary-500/30",
  };
  
  useEffect(() => {
    const duration = toast.duration || 5000;
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onDismiss(toast.id), 300);
    }, duration);
    
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);
  
  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => onDismiss(toast.id), 300);
  };
  
  return (
    <div 
      className={`
        flex items-start gap-3 p-4 rounded-lg border shadow-lg
        ${colors[toast.type]}
        transition-all duration-300
        ${isExiting ? "opacity-0 translate-x-4" : "opacity-100 translate-x-0"}
      `}
      role="alert"
    >
      {/* Icon */}
      <div className="shrink-0 mt-0.5">
        {icons[toast.type]}
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 dark:text-white">
          {toast.title}
        </p>
        {toast.message && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {toast.message}
          </p>
        )}
      </div>
      
      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        className="shrink-0 p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4 text-gray-400" />
      </button>
    </div>
  );
}

// Toast container component
export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();
  
  if (toasts.length === 0) return null;
  
  return (
    <div 
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <ToastItem 
          key={toast.id} 
          toast={toast} 
          onDismiss={removeToast} 
        />
      ))}
    </div>
  );
}

// Legacy simple toast for simpler use cases
interface SimpleToastProps {
  type: ToastType;
  title: string;
  message?: string;
  isLoading?: boolean;
}

export function SimpleToast({ type, title, message, isLoading }: SimpleToastProps) {
  const icons = {
    success: <CheckCircle className="w-5 h-5 text-success-500" />,
    error: <XCircle className="w-5 h-5 text-red-500" />,
    warning: <AlertTriangle className="w-5 h-5 text-yellow-500" />,
    info: <Info className="w-5 h-5 text-primary-500" />,
  };
  
  const colors = {
    success: "bg-success-50 dark:bg-success-500/10 border-success-200 dark:border-success-500/30",
    error: "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30",
    warning: "bg-yellow-50 dark:bg-yellow-500/10 border-yellow-200 dark:border-yellow-500/30",
    info: "bg-primary-50 dark:bg-primary-500/10 border-primary-200 dark:border-primary-500/30",
  };
  
  return (
    <div className={`flex items-center gap-3 p-4 rounded-lg border ${colors[type]}`}>
      {isLoading ? (
        <Loader2 className="w-5 h-5 text-primary-500 animate-spin" />
      ) : (
        icons[type]
      )}
      <div>
        <p className="font-medium text-gray-900 dark:text-white">{title}</p>
        {message && (
          <p className="text-sm text-gray-600 dark:text-gray-400">{message}</p>
        )}
      </div>
    </div>
  );
}

export default ToastContainer;