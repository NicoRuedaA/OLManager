import type { TextareaHTMLAttributes } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({
  label,
  error,
  className = "",
  ...props
}: TextareaProps) {
  return (
    <div>
      {label && (
        <label className="block text-xs font-heading font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
          {label}
        </label>
      )}
      <textarea
        className={`w-full bg-gray-50 dark:bg-navy-900 border text-gray-900 dark:text-white rounded-lg p-3 outline-none focus:ring-2 transition-all placeholder:text-gray-400 dark:placeholder:text-gray-500 resize-y min-h-[80px] ${
          error
            ? "border-red-400 dark:border-red-500 focus:border-red-500 focus:ring-red-500/20"
            : "border-gray-300 dark:border-navy-600 focus:border-primary-500 focus:ring-primary-500/20"
        } ${className}`}
        {...props}
      />
      {error && (
        <p className="flex items-center gap-1 text-xs text-red-500 mt-1">{error}</p>
      )}
    </div>
  );
}
