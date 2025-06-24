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

/**
 * Worker主处理函数
 */
self.onmessage = function(e) {
  const { type } = e.data;
  let flattenedData, scrollTop, viewportHeight, buffer, nodeId, expanded, searchTerm, updatedNodes;
  let visibleNodes, totalHeight, matchResult;

  switch (type) {
    case 'initialize':
      flattenedData = e.data.flattenedData;
      initializeData(flattenedData);
      break;

    case 'updateVisibleNodes':
      scrollTop = e.data.scrollTop;
      viewportHeight = e.data.viewportHeight;
      buffer = e.data.buffer;
      
      ({ visibleNodes, totalHeight } = calculateVisibleNodes(
        scrollTop,
        viewportHeight,
        NODE_HEIGHT,
        buffer
      ));
      self.postMessage({ type: 'visibleNodesUpdated', visibleNodes, totalHeight });
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
  }
};

/**
 * 初始化Worker数据
 * @param {Array} data 扁平化的树节点数据
 */
function initializeData(data) {
  nodeMap.clear();
  visibilityCache.clear();
  flattenedData = [...data];

  // 构建节点索引Map
  data.forEach(node => {
    nodeMap.set(node.id, node);
  });

  // 计算初始可见节点和高度
  const initialHeight = calculateTotalHeight();
  self.postMessage({
    type: 'initialized',
    success: true,
    totalHeight: initialHeight
  });
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

  // 遍历所有节点，计算可见性和位置
  for (const [id, node] of nodeMap.entries()) {
    const isVisible = isNodeVisible(node);

    if (isVisible) {
      const offsetTop = accumulatedHeight;

      // 检查节点是否在可视区域内（包括缓冲区）
      if (offsetTop >= scrollTop - (buffer * nodeHeight) &&
          offsetTop <= scrollTop + viewportHeight + (buffer * nodeHeight)) {

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
    visibleCount: currentIndex
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