interface SkeletonProps {
  className?: string;
  variant?: "text" | "circular" | "rectangular";
  width?: string | number;
  height?: string | number;
  animation?: "pulse" | "wave" | "none";
}

// Base skeleton component
export function Skeleton({ 
  className, 
  variant = "rectangular", 
  width, 
  height,
  animation = "pulse" 
}: SkeletonProps) {
  const baseStyles = "bg-gray-200 dark:bg-navy-700";
  
  const variants = {
    text: "rounded",
    circular: "rounded-full",
    rectangular: "rounded-lg",
  };
  
  const animations = {
    pulse: "animate-pulse",
    wave: "animate-shimmer",
    none: "",
  };
  
  return (
    <div
      className={`${baseStyles} ${variants[variant]} ${animations[animation]} ${className || ""}`}
      style={{
        width: width || "100%",
        height: height || "1rem",
      }}
      aria-hidden="true"
    />
  );
}

// Room code skeleton
export function RoomCodeSkeleton() {
  return (
    <div className="flex flex-col items-center gap-3 p-6">
      <Skeleton width={120} height={48} className="mx-auto" />
      <Skeleton width={160} height={20} />
    </div>
  );
}

// Player card skeleton
export function PlayerCardSkeleton() {
  return (
    <div className="p-4 rounded-xl border-2 border-gray-200 dark:border-navy-600">
      <div className="flex items-center gap-3">
        <Skeleton variant="circular" width={48} height={48} />
        <div className="flex-1">
          <Skeleton width={100} height={20} className="mb-2" />
          <Skeleton width={80} height={16} />
        </div>
      </div>
    </div>
  );
}

// Connection status skeleton
export function ConnectionStatusSkeleton({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Skeleton variant="circular" width={16} height={16} />
        <Skeleton width={60} height={14} />
      </div>
    );
  }
  
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-navy-600">
      <div className="flex items-center gap-2">
        <Skeleton variant="circular" width={20} height={20} />
        <Skeleton width={80} height={16} />
      </div>
      <div className="flex items-center gap-4">
        <Skeleton width={50} height={14} />
        <Skeleton width={60} height={14} />
      </div>
    </div>
  );
}

// Ready button skeleton
export function ReadyButtonSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton width="100%" height={56} />
      <div className="flex items-center justify-between">
        <Skeleton width={80} height={14} />
        <Skeleton width={120} height={14} />
      </div>
    </div>
  );
}

// Sync indicator skeleton
export function SyncIndicatorSkeleton() {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-navy-600">
      <Skeleton variant="circular" width={24} height={24} />
      <Skeleton width={50} height={14} />
    </div>
  );
}

// Full page skeleton for multiplayer loading states
export function MultiplayerPageSkeleton() {
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-navy-900 p-4">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <Skeleton width={200} height={32} className="mx-auto mb-2" />
          <Skeleton width={280} height={20} className="mx-auto" />
        </div>
        
        {/* Room Code (if waiting) */}
        <RoomCodeSkeleton />
        
        {/* Player Selection */}
        <div className="grid grid-cols-2 gap-4">
          <PlayerCardSkeleton />
          <PlayerCardSkeleton />
        </div>
        
        {/* Connection Status */}
        <ConnectionStatusSkeleton />
        
        {/* Ready Button */}
        <ReadyButtonSkeleton />
        
        {/* Sync Indicator */}
        <div className="flex justify-end">
          <SyncIndicatorSkeleton />
        </div>
      </div>
    </div>
  );
}

// Inline loading skeleton with text
export function LoadingWithText() {
  return (
    <div className="flex items-center gap-2">
      <Skeleton variant="circular" width={16} height={16} />
      <Skeleton width={80} height={16} />
    </div>
  );
}

export default MultiplayerPageSkeleton;