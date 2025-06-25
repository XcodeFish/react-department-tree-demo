/**
 * 批处理Worker
 * 用于处理大量数据的选择操作，避免阻塞主线程
 */

// 处理消息
self.onmessage = function(e) {
  const { type, data } = e.data;

  switch (type) {
    case 'selectUsers':
      selectAllUsers(data);
      break;
    case 'batchUpdate':
      batchUpdateNodes(data);
      break;
    case 'prepareInvitation':
      prepareInvitation(data);
      break;
    default:
      console.warn('BatchWorker: 未知的操作类型', type);
  }
};

/**
 * 处理会议邀请数据
 * @param {Object} data 数据对象
 */
async function prepareInvitation(data) {
  const { checkedNodes, maxDisplayCount = 100 } = data;
  
  if (!checkedNodes || !Array.isArray(checkedNodes)) {
    self.postMessage({
      type: 'prepareInvitationCompleted',
      displayNodes: [],
      totalCount: 0,
      hasMore: false
    });
    return;
  }
  
  // 处理显示节点
  const totalCount = checkedNodes.length;
  const hasMore = totalCount > maxDisplayCount;
  const displayNodes = hasMore 
    ? checkedNodes.slice(0, maxDisplayCount) 
    : checkedNodes;
  
  // 发送完成消息
  self.postMessage({
    type: 'prepareInvitationCompleted',
    displayNodes,
    totalCount,
    hasMore
  });
}

/**
 * 选择所有用户节点
 * @param {Object} data 数据对象
 */
async function selectAllUsers(data) {
  const { allNodes } = data;
  
  if (!allNodes || !Array.isArray(allNodes)) {
    self.postMessage({
      type: 'selectUsersCompleted',
      userKeys: [],
      userNodes: [],
      processed: 0,
      total: 0
    });
    return;
  }
  
  // 筛选用户节点
  const userNodes = [];
  const userKeys = [];
  let processed = 0;
  const total = allNodes.length;
  
  // 使用分批处理避免长时间阻塞
  const batchSize = 1000;
  const totalBatches = Math.ceil(total / batchSize);
  
  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const startIdx = batchIndex * batchSize;
    const endIdx = Math.min(startIdx + batchSize, total);
    
    // 处理当前批次
    for (let i = startIdx; i < endIdx; i++) {
      const node = allNodes[i];
      
      // 只选择用户节点
      if (node && node.type === 'user') {
        userNodes.push(node);
        userKeys.push(node.key);
      }
      
      processed++;
      
      // 每处理200个节点发送一次进度更新
      if (processed % 200 === 0 || processed === total) {
        self.postMessage({
          type: 'selectUsersProgress',
          processed,
          total
        });
      }
    }
    
    // 让出执行权，避免Worker阻塞
    if (batchIndex < totalBatches - 1) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  
  // 发送完成消息
  self.postMessage({
    type: 'selectUsersCompleted',
    userKeys,
    userNodes,
    processed,
    total
  });
}

/**
 * 批量更新节点状态
 * @param {Object} data 数据对象
 */
async function batchUpdateNodes(data) {
  const { nodeIds, checked } = data;
  
  if (!nodeIds || !Array.isArray(nodeIds)) {
    self.postMessage({
      type: 'batchUpdateCompleted',
      success: false,
      message: '无效的节点ID列表'
    });
    return;
  }
  
  // 处理节点状态
  let processed = 0;
  const total = nodeIds.length;
  
  // 分批处理
  const batchSize = 1000;
  const totalBatches = Math.ceil(total / batchSize);
  
  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const startIdx = batchIndex * batchSize;
    const endIdx = Math.min(startIdx + batchSize, total);
    
    // 处理当前批次
    for (let i = startIdx; i < endIdx; i++) {
      processed++;
      
      // 每处理500个节点发送一次进度更新
      if (processed % 500 === 0 || processed === total) {
        self.postMessage({
          type: 'batchUpdateProgress',
          processed,
          total
        });
      }
    }
    
    // 让出执行权，避免Worker阻塞
    if (batchIndex < totalBatches - 1) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  
  // 发送完成消息
  self.postMessage({
    type: 'batchUpdateCompleted',
    success: true,
    processed,
    total
  });
} 