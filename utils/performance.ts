/**
 * Performance monitoring utilities for production
 */

interface PerformanceMetrics {
  componentName: string;
  action: string;
  duration: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private timers: Map<string, number> = new Map();
  private maxMetrics = 100; // Keep only last 100 metrics

  startTimer(key: string): void {
    this.timers.set(key, performance.now());
  }

  endTimer(
    key: string,
    componentName: string,
    action: string,
    metadata?: Record<string, any>
  ): number {
    const startTime = this.timers.get(key);
    if (!startTime) {
      console.warn(`[PerformanceMonitor] No start time found for key: ${key}`);
      return 0;
    }

    const duration = performance.now() - startTime;
    this.timers.delete(key);

    const metric: PerformanceMetrics = {
      componentName,
      action,
      duration,
      timestamp: Date.now(),
      metadata,
    };

    this.metrics.push(metric);

    // Keep only last N metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }

    // Log slow operations (> 1 second)
    if (duration > 1000) {
      console.warn(`[Performance] Slow operation detected:`, metric);
    }

    return duration;
  }

  getMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  getAverageTime(componentName?: string, action?: string): number {
    let filtered = this.metrics;

    if (componentName) {
      filtered = filtered.filter((m) => m.componentName === componentName);
    }

    if (action) {
      filtered = filtered.filter((m) => m.action === action);
    }

    if (filtered.length === 0) return 0;

    const total = filtered.reduce((sum, m) => sum + m.duration, 0);
    return total / filtered.length;
  }

  getStats() {
    const stats: Record<string, any> = {
      totalMetrics: this.metrics.length,
      components: {},
    };

    for (const metric of this.metrics) {
      if (!stats.components[metric.componentName]) {
        stats.components[metric.componentName] = {
          actions: {},
          totalCalls: 0,
          avgDuration: 0,
        };
      }

      const comp = stats.components[metric.componentName];
      comp.totalCalls++;

      if (!comp.actions[metric.action]) {
        comp.actions[metric.action] = {
          calls: 0,
          avgDuration: 0,
          minDuration: Infinity,
          maxDuration: 0,
        };
      }

      const action = comp.actions[metric.action];
      action.calls++;
      action.minDuration = Math.min(action.minDuration, metric.duration);
      action.maxDuration = Math.max(action.maxDuration, metric.duration);
    }

    // Calculate averages
    for (const compName in stats.components) {
      const comp = stats.components[compName];
      comp.avgDuration = this.getAverageTime(compName);

      for (const actionName in comp.actions) {
        const action = comp.actions[actionName];
        action.avgDuration = this.getAverageTime(compName, actionName);
      }
    }

    return stats;
  }

  clear(): void {
    this.metrics = [];
    this.timers.clear();
  }

  logStats(): void {
    console.group('[PerformanceMonitor] Statistics');
    console.table(this.getStats());
    console.groupEnd();
  }
}

export const perfMonitor = new PerformanceMonitor();

// Expose to window for debugging in development
if (import.meta.env.DEV) {
  (window as any).__perfMonitor = perfMonitor;
}

/**
 * React hook for monitoring component performance
 */
export const usePerformanceMonitor = (componentName: string) => {
  const startAction = (action: string, metadata?: Record<string, any>) => {
    const key = `${componentName}:${action}:${Date.now()}`;
    perfMonitor.startTimer(key);
    return {
      end: () => perfMonitor.endTimer(key, componentName, action, metadata),
    };
  };

  return { startAction };
};
