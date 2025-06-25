/**
 * 搜索服务
 * 提供高效的搜索功能，支持即时搜索和完整搜索
 */

class SearchService {
  constructor() {
    // 缓存上一次搜索结果
    this.cache = new Map();
    // 最大缓存大小
    this.maxCacheSize = 50;
  }
  
  /**
   * 搜索员工节点
   * @param {Array} nodes 所有节点
   * @param {string} searchTerm 搜索词
   * @param {string} mode 搜索模式: 'immediate'(即时) 或 'complete'(完整)
   * @returns {Object} 搜索结果
   */
  searchUsers(nodes, searchTerm, mode = 'complete') {
    // 如果搜索词为空，返回空结果
    if (!searchTerm || typeof searchTerm !== 'string' || searchTerm.trim() === '') {
      return {
        matchedNodes: [],
        expandedKeys: [],
        matchCount: 0
      };
    }
    
    // 尝试从缓存获取结果
    const cacheKey = `${searchTerm}_${mode}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    
    const trimmedTerm = searchTerm.trim().toLowerCase();
    const matchedNodes = [];
    const expandedKeys = new Set();
    
    // 即时搜索模式下，只处理前100个节点，提高响应速度
    const nodesToProcess = mode === 'immediate' 
      ? nodes.slice(0, Math.min(nodes.length, 100)) 
      : nodes;
    
    // 第一步：找到所有匹配的节点（不限于员工节点）
    for (const node of nodesToProcess) {
      // 搜索所有节点
      const nodeTitle = (node.title || node.name || '').toLowerCase();
      const nodeEmail = (node.email || '').toLowerCase();
      const nodePosition = (node.position || '').toLowerCase();
      const nodeRealName = (node.realName || '').toLowerCase();
      const nodePhone = (node.phone || '').toLowerCase();
      const nodeUserId = (node.userId || '').toLowerCase();
      const nodeDepartment = (node.department || '').toLowerCase();
      
      if (
        nodeTitle.includes(trimmedTerm) ||
        nodeEmail.includes(trimmedTerm) ||
        nodePosition.includes(trimmedTerm) ||
        nodeRealName.includes(trimmedTerm) ||
        nodePhone.includes(trimmedTerm) ||
        nodeUserId.includes(trimmedTerm) ||
        nodeDepartment.includes(trimmedTerm)
      ) {
        node.matched = true;
        matchedNodes.push(node);
        
        // 收集父节点路径，用于展开
        let parentId = node.parentId;
        while (parentId) {
          expandedKeys.add(parentId);
          const parentNode = nodes.find(n => n.id === parentId || n.key === parentId);
          if (parentNode) {
            parentId = parentNode.parentId;
          } else {
            break;
          }
        }
      } else if (node.matched) {
        // 重置之前匹配的状态
        node.matched = false;
      }
    }
    
    const result = {
      matchedNodes,
      expandedKeys: Array.from(expandedKeys),
      matchCount: matchedNodes.length
    };
    
    // 缓存结果
    this.addToCache(cacheKey, result);
    
    return result;
  }
  
  /**
   * 添加结果到缓存
   * @param {string} key 缓存键
   * @param {Object} value 缓存值
   */
  addToCache(key, value) {
    // 如果缓存已满，删除最早的条目
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, value);
  }
  
  /**
   * 清除缓存
   */
  clearCache() {
    this.cache.clear();
  }
  
  /**
   * 重置所有节点的匹配状态
   * @param {Array} nodes 所有节点
   */
  resetMatchState(nodes) {
    if (!Array.isArray(nodes)) return;
    
    for (const node of nodes) {
      if (node.matched) {
        node.matched = false;
      }
    }
  }
}

// 导出单例
export default new SearchService(); 