/**
 * 处理树数据和操作的Web Worker
 * 负责搜索、节点状态更新等计算密集型任务
 * 优化大数据量树结构的性能表现
 */

// 全局状态
let nodeMap = new Map();
let visibilityCache = new Map();
let flattenedData = [];
const NODE_HEIGHT = 40; // 与主线程保持一致

// 增加优先级处理标志
let isProcessingHighPriority = false;

// 消息队列和处理状态
let messageQueue = [];
let isProcessing = false;

/**
 * 将消息添加到队列中，按优先级排序
 * @param {Object} message 消息对象
 * @param {number} priority 优先级(0-10)，数字越大优先级越高
 */
function queueMessage(message, priority = 0) {
  messageQueue.push({ message, priority });
  messageQueue.sort((a, b) => b.priority - a.priority);
  
  if (!isProcessing) {
    processNextMessage();
  }
}

/**
 * 处理队列中的下一条消息
 */
function processNextMessage() {
  if (messageQueue.length === 0) {
    isProcessing = false;
    return;
  }
  
  isProcessing = true;
  const { message } = messageQueue.shift();
  
  // 处理消息
  handleWorkerMessage(message);
  
  // 使用setTimeout确保不阻塞其他操作
  setTimeout(() => {
    processNextMessage();
  }, 0);
}

/**
 * Worker主处理函数
 */
self.onmessage = function(e) {
  // 高优先级消息直接处理，其他消息进入队列
  if (e.data.priority === 'high') {
    handleWorkerMessage(e);
  } else {
    // 根据消息类型设置优先级
    let priority = 0;
    switch (e.data.type) {
      case 'updateVisibleNodes':
        priority = 8; // 可见节点更新优先级高
        break;
      case 'search':
        priority = 5; // 搜索优先级中等
        break;
      case 'toggleNode':
        priority = 7; // 节点展开/折叠优先级较高
        break;
      case 'batchUpdate':
        priority = 3; // 批量更新优先级较低
        break;
      default:
        priority = 1;
    }
    queueMessage(e, priority);
  }
};

/**
 * 处理Worker消息
 */
function handleWorkerMessage(e) {
  const { type, priority = 'normal' } = e.data;
  
  // 高优先级任务处理
  if (priority === 'high') {
    isProcessingHighPriority = true;
  }
  
  let flattenedData, scrollTop, viewportHeight, buffer, nodeId, expanded, searchTerm, updatedNodes, nodeIds, checked;
  let visibleNodes, totalHeight, visibleCount, matchResult;

  switch (type) {
    case 'initialize':
      flattenedData = e.data.flattenedData;
      initializeData(flattenedData);
      break;

    case 'updateVisibleNodes':
      scrollTop = e.data.scrollTop;
      viewportHeight = e.data.viewportHeight;
      buffer = e.data.buffer;
      
      // 使用高性能计算模式
      if (priority === 'high' || !isProcessingHighPriority) {
        const result = calculateVisibleNodes(
          scrollTop,
          viewportHeight,
          NODE_HEIGHT,
          buffer
        );
        
        visibleNodes = result.visibleNodes;
        totalHeight = result.totalHeight;
        visibleCount = result.visibleCount;
        
        self.postMessage({ 
          type: 'visibleNodesUpdated', 
          visibleNodes, 
          totalHeight,
          visibleCount,
          scrollTop // 返回请求时的滚动位置，便于UI判断是否仍然有效
        });
      }
      break;

    case 'toggleNode':
      nodeId = e.data.nodeId;
      expanded = e.data.expanded;
      toggleNodeExpanded(nodeId, expanded);
      break;

    case 'search':
      searchTerm = e.data.searchTerm;
      matchResult = searchNodes(searchTerm);
      self.postMessage({ type: 'searchComplete', matchResult });
      break;
      
    case 'updateNodes':
      updatedNodes = e.data.updatedNodes;
      updateNodes(updatedNodes);
      break;
      
    case 'batchUpdate':
      nodeIds = e.data.nodeIds;
      checked = e.data.checked;
      batchUpdateNodes(nodeIds, checked);
      break;
  }
  
  // 重置高优先级标志
  if (priority === 'high') {
    isProcessingHighPriority = false;
  }
}

/**
 * 批量更新节点状态
 * @param {Array} nodeIds 需要更新的节点ID数组
 * @param {boolean} checked 选中状态
 */
function batchUpdateNodes(nodeIds, checked) {
  if (!Array.isArray(nodeIds) || nodeIds.length === 0) return;
  
  // 分批处理，每批500个节点
  const batchSize = 500;
  const batches = [];
  
  for (let i = 0; i < nodeIds.length; i += batchSize) {
    batches.push(nodeIds.slice(i, i + batchSize));
  }
  
  // 处理第一批
  processBatch(0);
  
  function processBatch(batchIndex) {
    if (batchIndex >= batches.length) {
      // 所有批次处理完成，发送完成消息
      self.postMessage({
        type: 'batchUpdateCompleted',
        nodeIds,
        checked,
        totalProcessed: nodeIds.length
      });
      return;
    }
    
    const currentBatch = batches[batchIndex];
    
    // 更新当前批次的节点
    currentBatch.forEach(nodeId => {
      const node = nodeMap.get(nodeId);
      if (node) {
        node.checked = checked;
      }
    });
    
    // 如果不是最后一批，发送进度消息
    if (batchIndex < batches.length - 1) {
      self.postMessage({
        type: 'batchUpdateProgress',
        processed: (batchIndex + 1) * batchSize,
        total: nodeIds.length
      });
    }
    
    // 使用setTimeout处理下一批，避免阻塞
    setTimeout(() => {
      processBatch(batchIndex + 1);
    }, 0);
  }
}

/**
 * 初始化Worker数据
 * @param {Array} data 扁平化的树节点数据
 */
function initializeData(flattenedData) {
  console.time('worker:initialize');
  nodeMap.clear();
  visibilityCache.clear();

  // 优化：批量处理初始数据
  flattenedData.forEach(node => {
    nodeMap.set(node.id, node);
  });

  console.timeEnd('worker:initialize');

  // 计算初始可见节点和总高度
  const initialHeight = calculateTotalHeight();
  
  // 立即返回初始化成功消息和总高度
  self.postMessage({
    type: 'initialized',
    success: true,
    totalHeight: initialHeight.totalHeight,
    visibleCount: initialHeight.visibleCount
  });
  
  // 额外的优化：立即计算初始可见节点并返回，避免UI空白时间
  const initialNodes = calculateInitialVisibleNodes();
  
  // 延迟一帧后发送初始可见节点，确保UI能立即响应初始化完成事件
  setTimeout(() => {
    self.postMessage({
      type: 'visibleNodesUpdated',
      visibleNodes: initialNodes.visibleNodes,
      totalHeight: initialNodes.totalHeight,
      visibleCount: initialNodes.visibleCount
    });
  }, 0);
}

/**
 * 计算初始可见节点（无需滚动位置信息）
 * @returns {Object} 可见节点和总高度
 */
function calculateInitialVisibleNodes() {
  console.time('worker:initialVisibleNodes');
  
  const visibleNodes = [];
  let accumulatedHeight = 0;
  let currentIndex = 0;
  
  // 获取根节点和前几层可见节点
  const maxInitialNodes = 20; // 限制初始返回的节点数量，避免传输过多数据
  
  for (const [id, node] of nodeMap.entries()) {
    const isVisible = isNodeVisible(node);
    
    if (isVisible) {
      const offsetTop = accumulatedHeight;
      
      // 只返回初始可见范围内的节点
      if (currentIndex < maxInitialNodes) {
        visibleNodes.push({
          ...node,
          offsetTop,
          index: currentIndex
        });
      }
      
      accumulatedHeight += NODE_HEIGHT;
      currentIndex++;
      
      // 达到最大初始节点数量时停止
      if (currentIndex >= maxInitialNodes) {
        break;
      }
    }
  }
  
  console.timeEnd('worker:initialVisibleNodes');
  
  return {
    visibleNodes,
    totalHeight: accumulatedHeight,
    visibleCount: currentIndex
  };
}

/**
 * 更新节点数据
 * @param {Array} updatedNodes 需要更新的节点数组
 */
function updateNodes(updatedNodes) {
  if (!Array.isArray(updatedNodes) || updatedNodes.length === 0) return;
  
  // 更新节点
  updatedNodes.forEach(node => {
    if (nodeMap.has(node.id)) {
      // 更新现有节点
      const existingNode = nodeMap.get(node.id);
      nodeMap.set(node.id, { ...existingNode, ...node });
      
      // 更新扁平化数据中的节点
      const index = flattenedData.findIndex(item => item.id === node.id);
      if (index !== -1) {
        flattenedData[index] = { ...flattenedData[index], ...node };
      }
    } else {
      // 添加新节点
      nodeMap.set(node.id, node);
      flattenedData.push(node);
    }
  });
  
  // 清除可见性缓存
  visibilityCache.clear();
  
  // 重新计算高度并通知主线程
  const { totalHeight, visibleCount } = calculateTotalHeight();
  self.postMessage({
    type: 'nodesUpdated',
    totalHeight,
    visibleCount
  });
}

/**
 * 计算可见节点
 * @param {number} scrollTop 滚动位置
 * @param {number} viewportHeight 可视区域高度
 * @param {number} nodeHeight 节点高度
 * @param {number} buffer 缓冲区大小
 * @returns {Object} 可见节点和总高度
 */
function calculateVisibleNodes(scrollTop, viewportHeight, nodeHeight, buffer) {
  const visibleNodes = [];
  let accumulatedHeight = 0;
  let currentIndex = 0;

  // 优化：预计算开始和结束索引范围
  const startPosition = Math.max(0, scrollTop - (buffer * nodeHeight));
  const endPosition = scrollTop + viewportHeight + (buffer * nodeHeight);
  
  // 优化：使用二分查找快速定位开始位置
  let startIndex = 0;
  let visibleCount = 0;
  
  // 遍历所有节点，计算可见性和位置
  for (const [id, node] of nodeMap.entries()) {
    const isVisible = isNodeVisible(node);

    if (isVisible) {
      const offsetTop = accumulatedHeight;
      visibleCount++;

      // 检查节点是否在可视区域内（包括缓冲区）
      if (offsetTop >= startPosition && offsetTop <= endPosition) {
        visibleNodes.push({
          ...node,
          offsetTop,
          index: currentIndex
        });
      }

      accumulatedHeight += nodeHeight;
      currentIndex++;
    }
  }

  return {
    visibleNodes,
    totalHeight: accumulatedHeight,
    visibleCount
  };
}

/**
 * 节点可见性判断（带缓存）
 * @param {Object} node 节点对象
 * @returns {boolean} 是否可见
 */
function isNodeVisible(node) {
  if (visibilityCache.has(node.id)) {
    return visibilityCache.get(node.id);
  }

  // 根节点总是可见
  if (!node.parentId) {
    visibilityCache.set(node.id, true);
    return true;
  }

  // 递归检查父节点展开状态
  let currentNode = node;
  let isVisible = true;

  while (currentNode.parentId) {
    const parent = nodeMap.get(currentNode.parentId);
    if (!parent || !parent.expanded) {
      isVisible = false;
      break;
    }
    currentNode = parent;
  }

  visibilityCache.set(node.id, isVisible);
  return isVisible;
}

/**
 * 切换节点展开状态
 * @param {string} nodeId 节点ID
 * @param {boolean} expanded 是否展开
 * @returns {boolean} 操作是否成功
 */
function toggleNodeExpanded(nodeId, expanded) {
  const node = nodeMap.get(nodeId);
  if (!node) return false;

  node.expanded = expanded;
  visibilityCache.clear(); // 清除可见性缓存

  // 计算更新后的高度和可见节点
  const { totalHeight, visibleCount } = calculateTotalHeight();

  self.postMessage({
    type: 'nodeToggled',
    nodeId,
    expanded,
    totalHeight,
    visibleCount,
  });

  return true;
}

/**
 * 计算整个树的高度
 * @returns {Object} 总高度和可见节点数
 */
function calculateTotalHeight() {
  let visibleCount = 0;

  for (const [id, node] of nodeMap.entries()) {
    if (isNodeVisible(node)) {
      visibleCount++;
    }
  }

  return {
    totalHeight: visibleCount * NODE_HEIGHT,
    visibleCount
  };
}

/**
 * 搜索节点
 * @param {string} term 搜索关键字
 * @returns {Object} 匹配结果
 */
function searchNodes(term) {
  // 确保term是字符串
  const searchTerm = String(term || '');
  
  // 如果搜索词为空，清除所有匹配状态
  if (!searchTerm || searchTerm.trim() === '') {
    // 重置搜索状态而不修改节点展开状态
    for (const [id, node] of nodeMap.entries()) {
      if (node.matched) {
        node.matched = false;
      }
    }
    
    // 不清除可见性缓存，避免重新计算所有节点可见性
    return { 
      matchCount: 0, 
      matches: [],
      searchTerm: '' // 明确标记这是一个清除搜索的操作
    };
  }

  const termLower = searchTerm.toLowerCase();
  const matches = [];

  // 标记匹配的节点
  for (const [id, node] of nodeMap.entries()) {
    // 重置先前的匹配状态
    const wasMatched = node.matched;
    node.matched = false;
    
    // 部门和人员都支持搜索
    const isMatch = 
      (node.name && node.name.toLowerCase().includes(termLower)) ||
      (node.email && node.email.toLowerCase().includes(termLower)) ||
      (node.position && node.position.toLowerCase().includes(termLower)) ||
      (node.realName && node.realName.toLowerCase().includes(termLower));
    
    // 只有在状态变化时才更新
    if (isMatch) {
      node.matched = true;
      matches.push(node.id);
    } else if (wasMatched !== isMatch) {
      // 状态发生变化
      node.matched = false;
    }
  }

  // 仅当有匹配结果时才展开包含匹配节点的路径
  if (matches.length > 0) {
    matches.forEach(matchId => {
      expandNodePath(matchId);
    });
    
    // 清除可见性缓存以便重新计算
    visibilityCache.clear();
  }

  return {
    matchCount: matches.length,
    matches,
    searchTerm: searchTerm // 包含搜索词，以便主线程判断
  };
}

/**
 * 展开包含节点的所有父路径
 * @param {string} nodeId 节点ID
 */
function expandNodePath(nodeId) {
  let currentId = nodeMap.get(nodeId)?.parentId;

  while (currentId) {
    const parent = nodeMap.get(currentId);
    if (parent) {
      parent.expanded = true;
      currentId = parent.parentId;
    } else {
      break;
    }
  }
} 