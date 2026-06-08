import type { InputHTMLAttributes, ReactNode } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  iconLeft?: ReactNode;
}

export function Input({
  label,
  error,
  helperText,
  iconLeft,
  className = "",
  ...props
}: InputProps) {
  return (
    <div>
      {label && (
        <label className="block text-xs font-heading font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        {iconLeft && (
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
            {iconLeft}
          </div>
        )}
        <input
          className={`w-full bg-gray-50 dark:bg-navy-900 border text-gray-900 dark:text-white rounded-lg p-3 outline-none focus:ring-2 transition-all placeholder:text-gray-400 dark:placeholder:text-gray-500 ${
            iconLeft ? "pl-10" : ""
          } ${
            error
              ? "border-red-400 dark:border-red-500 focus:border-red-500 focus:ring-red-500/20"
              : "border-gray-300 dark:border-navy-600 focus:border-primary-500 focus:ring-primary-500/20"
          } ${className}`}
          {...props}
        />
      </div>
      {error && (
        <p className="flex items-center gap-1 text-xs text-red-500 mt-1">{error}</p>
      )}
      {helperText && !error && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{helperText}</p>
      )}
    </div>
  );
}
