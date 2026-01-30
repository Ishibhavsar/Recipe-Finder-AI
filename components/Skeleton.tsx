/**
 * Reusable skeleton loader component for better loading UX
 */
interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
}

export const Skeleton = ({
  className = '',
  variant = 'rectangular',
  width,
  height,
}: SkeletonProps) => {
  const baseClasses = 'animate-pulse bg-gray-300';

  const variantClasses = {
    text: 'rounded h-4',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  };

  const style = {
    ...(width && { width: typeof width === 'number' ? `${width}px` : width }),
    ...(height && { height: typeof height === 'number' ? `${height}px` : height }),
  };

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      style={style}
      aria-label="Loading..."
      role="status"
    />
  );
};

/**
 * Recipe card skeleton for consistent loading states
 */
export const RecipeCardSkeleton = () => {
  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
      <Skeleton height={200} className="w-full" />
      <div className="p-6 space-y-3">
        <Skeleton width="70%" height={24} />
        <Skeleton width="100%" />
        <Skeleton width="90%" />
        <div className="flex gap-2 mt-4">
          <Skeleton width={60} height={24} className="rounded-full" />
          <Skeleton width={60} height={24} className="rounded-full" />
        </div>
      </div>
    </div>
  );
};

/**
 * Recipe detail skeleton for loading state
 */
export const RecipeDetailSkeleton = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Skeleton width="60%" height={40} className="mb-4" />
      <Skeleton height={400} className="w-full mb-6 rounded-2xl" />

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div className="space-y-3">
          <Skeleton width="40%" height={24} />
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} width="90%" />
          ))}
        </div>
        <div className="space-y-3">
          <Skeleton width="40%" height={24} />
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} width="95%" />
          ))}
        </div>
      </div>
    </div>
  );
};
