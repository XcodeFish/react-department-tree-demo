/**
 * 内存监控工具
 * 用于监控和优化内存使用
 */

// 内存使用记录
let memoryRecords = [];
const MAX_RECORDS = 100;

/**
 * 获取当前内存使用情况
 * @returns {Object|null} 内存使用情况
 */
export const getMemoryInfo = () => {
  if (!window.performance || !window.performance.memory) {
    return null;
  }

  const memory = window.performance.memory;
  
  return {
    // 已使用的JS堆大小（MB）
    usedJSHeapSize: Math.round(memory.usedJSHeapSize / (1024 * 1024)),
    // 总的JS堆大小（MB）
    totalJSHeapSize: Math.round(memory.totalJSHeapSize / (1024 * 1024)),
    // JS堆大小限制（MB）
    jsHeapSizeLimit: Math.round(memory.jsHeapSizeLimit / (1024 * 1024)),
    // 使用率
    usageRate: Math.round((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100) / 100,
    // 时间戳
    timestamp: Date.now()
  };
};

/**
 * 记录内存使用情况
 * @param {String} label 标签
 * @param {Object} extraInfo 额外信息
 * @returns {Object|null} 内存使用情况
 */
export const recordMemoryUsage = (label = '', extraInfo = {}) => {
  const memoryInfo = getMemoryInfo();
  
  if (!memoryInfo) {
    return null;
  }
  
  const record = {
    ...memoryInfo,
    label,
    ...extraInfo
  };
  
  memoryRecords.push(record);
  
  // 限制记录数量
  if (memoryRecords.length > MAX_RECORDS) {
    memoryRecords = memoryRecords.slice(-MAX_RECORDS);
  }
  
  return record;
};

/**
 * 清理内存记录
 */
export const clearMemoryRecords = () => {
  memoryRecords = [];
};

/**
 * 获取内存使用记录
 * @returns {Array} 内存使用记录
 */
export const getMemoryRecords = () => {
  return [...memoryRecords];
};

/**
 * 获取内存使用统计
 * @returns {Object} 内存使用统计
 */
export const getMemoryStats = () => {
  if (memoryRecords.length === 0) {
    return null;
  }
  
  const usedHeapSizes = memoryRecords.map(record => record.usedJSHeapSize);
  const maxUsed = Math.max(...usedHeapSizes);
  const minUsed = Math.min(...usedHeapSizes);
  const avgUsed = usedHeapSizes.reduce((a, b) => a + b, 0) / usedHeapSizes.length;
  
  // 计算泄漏趋势
  const leakTrend = memoryRecords.length > 5 
    ? (memoryRecords[memoryRecords.length - 1].usedJSHeapSize - memoryRecords[0].usedJSHeapSize) / memoryRecords.length
    : 0;
  
  return {
    maxUsed,
    minUsed,
    avgUsed: Math.round(avgUsed * 100) / 100,
    currentUsed: memoryRecords[memoryRecords.length - 1].usedJSHeapSize,
    recordCount: memoryRecords.length,
    leakTrend: Math.round(leakTrend * 100) / 100,
    hasLeak: leakTrend > 0.5, // 如果平均每次增加超过0.5MB，可能存在泄漏
    firstRecord: memoryRecords[0],
    lastRecord: memoryRecords[memoryRecords.length - 1]
  };
};

/**
 * 强制垃圾回收（仅在开发环境和支持的浏览器中有效）
 */
export const forceGC = () => {
  if (typeof window !== 'undefined' && window.gc) {
    try {
      window.gc();
      return true;
    } catch (e) {
      console.error('Failed to force GC:', e);
    }
  }
  return false;
};

/**
 * 内存使用监控Hook
 * @param {Object} options 选项
 * @returns {Object} 监控对象
 */
export const useMemoryMonitor = (options = {}) => {
  const { 
    enabled = true,
    interval = 5000,
    label = 'memory-monitor',
    autoStart = true
  } = options;
  
  let timerId = null;
  
  // 开始监控
  const start = () => {
    if (!enabled) return;
    
    stop(); // 确保之前的监控已停止
    
    // 记录初始内存使用
    recordMemoryUsage(`${label}-start`);
    
    // 定期记录内存使用
    timerId = setInterval(() => {
      recordMemoryUsage(label);
    }, interval);
  };
  
  // 停止监控
  const stop = () => {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
      
      // 记录最终内存使用
      recordMemoryUsage(`${label}-end`);
    }
  };
  
  // 自动开始监控
  if (autoStart) {
    start();
  }
  
  return {
    start,
    stop,
    getStats: getMemoryStats,
    getRecords: getMemoryRecords,
    clear: clearMemoryRecords,
    forceGC
  };
};

/**
 * 检测DOM节点泄漏
 * @param {String} selector 选择器
 * @param {Number} expectedCount 预期数量
 * @returns {Object} 检测结果
 */
export const detectDOMLeaks = (selector, expectedCount) => {
  if (typeof document === 'undefined') {
    return null;
  }
  
  const elements = document.querySelectorAll(selector);
  const actualCount = elements.length;
  
  return {
    selector,
    expectedCount,
    actualCount,
    hasLeak: expectedCount !== null && actualCount > expectedCount,
    difference: expectedCount !== null ? actualCount - expectedCount : null
  };
}; 