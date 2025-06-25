/**
 * 批处理Worker
 * 专门用于处理大规模数据操作，如全选、批量选择等
 */

self.onmessage = function(e) {
  const { type, data } = e.data;
  
  switch (type) {
    case 'selectAll':
      handleSelectAll(data);
      break;
    case 'selectUsers':
      handleSelectUsers(data);
      break;
    case 'batchProcess':
      handleBatchProcess(data);
      break;
    case 'prepareInvitation':
      handlePrepareInvitation(data);
      break;
    default:
      console.warn('未知的批处理操作:', type);
  }
};

/**
 * 处理全选操作
 * @param {Object} data 包含allNodes等数据
 */
function handleSelectAll(data) {
  const { allNodes } = data;
  
  if (!Array.isArray(allNodes) || allNodes.length === 0) {
    self.postMessage({
      type: 'selectAllCompleted',
      allKeys: [],
      userKeys: [],
      userNodes: []
    });
    return;
  }
  
  // 分批处理，每批1000个节点
  const batchSize = 1000;
  const allKeys = [];
  const userNodes = [];
  
  // 开始处理
  processBatch(0);
  
  function processBatch(startIndex) {
    if (startIndex >= allNodes.length) {
      // 处理完成，返回结果
      self.postMessage({
        type: 'selectAllCompleted',
        allKeys,
        userKeys: userNodes.map(node => node.key),
        userNodes
      });
      return;
    }
    
    const endIndex = Math.min(startIndex + batchSize, allNodes.length);
    
    // 处理当前批次
    for (let i = startIndex; i < endIndex; i++) {
      const node = allNodes[i];
      allKeys.push(node.key);
      
      if (node.type === 'user') {
        userNodes.push(node);
      }
    }
    
    // 发送进度消息
    self.postMessage({
      type: 'selectAllProgress',
      processed: endIndex,
      total: allNodes.length
    });
    
    // 处理下一批
    setTimeout(() => {
      processBatch(endIndex);
    }, 0);
  }
}

/**
 * 处理仅选择用户节点操作
 * @param {Object} data 包含allNodes等数据
 */
function handleSelectUsers(data) {
  const { allNodes } = data;
  
  if (!Array.isArray(allNodes) || allNodes.length === 0) {
    self.postMessage({
      type: 'selectUsersCompleted',
      userKeys: [],
      userNodes: []
    });
    return;
  }
  
  // 分批处理，每批1000个节点
  const batchSize = 1000;
  const userNodes = [];
  
  // 开始处理
  processBatch(0);
  
  function processBatch(startIndex) {
    if (startIndex >= allNodes.length) {
      // 处理完成，返回结果
      self.postMessage({
        type: 'selectUsersCompleted',
        userKeys: userNodes.map(node => node.key),
        userNodes
      });
      return;
    }
    
    const endIndex = Math.min(startIndex + batchSize, allNodes.length);
    
    // 处理当前批次
    for (let i = startIndex; i < endIndex; i++) {
      const node = allNodes[i];
      if (node.type === 'user') {
        userNodes.push(node);
      }
    }
    
    // 发送进度消息
    self.postMessage({
      type: 'selectUsersProgress',
      processed: endIndex,
      total: allNodes.length
    });
    
    // 处理下一批
    setTimeout(() => {
      processBatch(endIndex);
    }, 0);
  }
}

/**
 * 处理通用批处理操作
 * @param {Object} data 批处理数据
 */
function handleBatchProcess(data) {
  const { nodes, operation, batchSize = 1000 } = data;
  
  if (!Array.isArray(nodes) || nodes.length === 0) {
    self.postMessage({
      type: 'batchProcessCompleted',
      result: []
    });
    return;
  }
  
  const result = [];
  
  // 开始处理
  processBatch(0);
  
  function processBatch(startIndex) {
    if (startIndex >= nodes.length) {
      // 处理完成，返回结果
      self.postMessage({
        type: 'batchProcessCompleted',
        result
      });
      return;
    }
    
    const endIndex = Math.min(startIndex + batchSize, nodes.length);
    const currentBatch = nodes.slice(startIndex, endIndex);
    
    // 处理当前批次
    switch (operation) {
      case 'filter':
        // 过滤操作
        if (data.filterFn) {
          const filterCondition = new Function('node', `return ${data.filterFn}`);
          currentBatch.forEach(node => {
            try {
              if (filterCondition(node)) {
                result.push(node);
              }
            } catch (error) {
              console.error('过滤操作错误:', error);
            }
          });
        }
        break;
        
      case 'map':
        // 映射操作
        if (data.mapFn) {
          const mapFunction = new Function('node', `return ${data.mapFn}`);
          currentBatch.forEach(node => {
            try {
              result.push(mapFunction(node));
            } catch (error) {
              console.error('映射操作错误:', error);
            }
          });
        }
        break;
        
      default:
        // 默认只收集节点
        result.push(...currentBatch);
    }
    
    // 发送进度消息
    self.postMessage({
      type: 'batchProcessProgress',
      processed: endIndex,
      total: nodes.length
    });
    
    // 处理下一批
    setTimeout(() => {
      processBatch(endIndex);
    }, 0);
  }
}

/**
 * 处理会议邀请准备操作
 * 优化大量节点的处理，避免阻塞UI线程
 * @param {Object} data 包含checkedNodes等数据
 */
function handlePrepareInvitation(data) {
  const { checkedNodes, maxDisplayCount = 100 } = data;
  
  if (!Array.isArray(checkedNodes) || checkedNodes.length === 0) {
    self.postMessage({
      type: 'prepareInvitationCompleted',
      displayNodes: [],
      totalCount: 0,
      hasMore: false
    });
    return;
  }
  
  // 计算是否有更多节点
  const totalCount = checkedNodes.length;
  const hasMore = totalCount > maxDisplayCount;
  
  // 获取要显示的节点
  const displayNodes = hasMore 
    ? checkedNodes.slice(0, maxDisplayCount)
    : checkedNodes;
  
  // 对节点进行预处理，只保留必要的属性，减少数据传输量
  const processedNodes = displayNodes.map(node => ({
    key: node.key,
    name: node.realName || node.name,
    position: node.position || '',
    type: node.type,
    avatar: node.avatar
  }));
  
  // 返回处理结果
  self.postMessage({
    type: 'prepareInvitationCompleted',
    displayNodes: processedNodes,
    totalCount,
    hasMore
  });
} 