import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  accent?: "primary" | "accent" | "success" | "danger" | "none";
  onClick?: () => void;
}

export function Card({ children, className = "", accent = "none", onClick }: CardProps) {
  const accentBorder = accent === "none"
    ? "border border-border"
    : `border border-t-4 border-t-primary border-border`;

  return (
    <div
      onClick={onClick}
      className={`
        bg-card
        ${accentBorder}
        rounded-xl
        transition-all duration-200
        ${className}
      `}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function CardHeader({ children, action, className = "" }: CardHeaderProps) {
  return (
    <div className={`px-6 py-4 border-b border-border flex items-center justify-between ${className}`}>
      <h3 className="text-lg font-bold font-heading uppercase tracking-wide text-foreground">
        {children}
      </h3>
      {action}
    </div>
  );
}

interface CardBodyProps {
  children: ReactNode;
  className?: string;
}

export function CardBody({ children, className = "" }: CardBodyProps) {
  return <div className={`p-6 ${className}`}>{children}</div>;
}
