/**
 * 处理树数据和操作的Web Worker
 * 负责搜索、节点状态更新等计算密集型任务
 */

// 全局数据
let treeData = [];

/**
 * 获取所有子节点的键
 * @param {Array} nodes 所有节点
 * @param {string} nodeId 父节点ID
 * @returns {Array} 子节点键数组
 */
function getChildrenKeys(nodes, nodeId) {
  const result = [];
  
  function findChildren(parentId) {
    nodes.forEach(node => {
      if (node.parentId === parentId) {
        result.push(node.key);
        findChildren(node.key);
      }
    });
  }
  
  findChildren(nodeId);
  return result;
}

/**
 * 获取所有父节点的键
 * @param {Array} nodes 所有节点
 * @param {string} nodeId 子节点ID
 * @returns {Array} 父节点键数组
 */
function getParentKeys(nodes, nodeId) {
  const result = [];
  let currentId = nodeId;
  
  while (currentId) {
    const parentNode = nodes.find(node => node.key === currentId);
    if (parentNode && parentNode.parentId) {
      result.push(parentNode.parentId);
      currentId = parentNode.parentId;
    } else {
      currentId = null;
    }
  }
  
  return result;
}

/**
 * 获取节点显示标题
 * @param {Object} node 节点对象
 * @returns {string} 节点标题
 */
function getNodeTitle(node) {
  if (node.type === 'user') {
    return `${node.realName || node.name}${node.position ? ` - ${node.position}` : ''}`;
  }
  return node.title || node.name || '';
}

/**
 * 搜索函数
 * @param {string} keyword 关键词
 * @param {Array} nodes 节点数组
 * @returns {Object} 匹配结果
 */
function performSearch(keyword, nodes) {
  if (!keyword || keyword.trim() === '') {
    return { matchedKeys: [], expandedKeys: [] };
  }
  
  const loweredKeyword = keyword.toLowerCase();
  const matchedKeys = [];
  const expandedKeys = new Set();
  
  // 搜索匹配节点
  nodes.forEach(node => {
    const nodeTitle = getNodeTitle(node);
    
    if (nodeTitle.toLowerCase().includes(loweredKeyword)) {
      matchedKeys.push(node.key);
      
      // 查找所有父节点并添加到expandedKeys
      let parentId = node.parentId;
      while (parentId) {
        expandedKeys.add(parentId);
        const parentNode = nodes.find(n => n.key === parentId);
        parentId = parentNode ? parentNode.parentId : null;
      }
    }
  });
  
  return {
    matchedKeys,
    expandedKeys: Array.from(expandedKeys)
  };
}

/**
 * 获取可见节点
 * @param {Array} nodes 所有节点
 * @param {Array} expandedKeys 已展开的节点键
 * @returns {Array} 可见节点数组
 */
function getVisibleNodes(nodes, expandedKeys = []) {
  if (!nodes || nodes.length === 0) return [];
  
  const visibleNodes = [];
  const expandedKeysSet = new Set(expandedKeys);
  
  // 遍历所有节点
  nodes.forEach(node => {
    // 如果是顶级节点或父节点已展开，则可见
    if (node.level === 0 || !node.parentId) {
      visibleNodes.push(node);
    } else {
      // 检查父节点是否展开
      let isVisible = true;
      let currentParentId = node.parentId;
      
      while (currentParentId) {
        if (!expandedKeysSet.has(currentParentId)) {
          // 父节点未展开，此节点不可见
          isVisible = false;
          break;
        }
        
        // 查找父节点的父节点
        const parentNode = nodes.find(n => n.key === currentParentId);
        currentParentId = parentNode ? parentNode.parentId : null;
      }
      
      if (isVisible) {
        visibleNodes.push(node);
      }
    }
  });
  
  return visibleNodes;
}

/**
 * 获取视口内节点
 * @param {Array} visibleNodes 可见节点
 * @param {Object} options 选项
 * @returns {Array} 视口内节点
 */
function getNodesInViewport(visibleNodes, options = {}) {
  const { 
    scrollTop = 0, 
    viewportHeight = 500, 
    nodeHeight = 40, 
    overscan = 10 
  } = options;
  
  if (!visibleNodes || visibleNodes.length === 0) return [];
  
  // 计算起始和结束索引
  const startIndex = Math.max(0, Math.floor(scrollTop / nodeHeight) - overscan);
  const endIndex = Math.min(
    visibleNodes.length - 1,
    Math.ceil((scrollTop + viewportHeight) / nodeHeight) + overscan
  );
  
  // 返回视口内节点
  return visibleNodes.slice(startIndex, endIndex + 1).map((node, idx) => ({
    ...node,
    offsetTop: (startIndex + idx) * nodeHeight,
    index: startIndex + idx
  }));
}

// 主处理函数
self.onmessage = function(e) {
  const { type, data } = e.data;
  
  console.log(`Worker收到消息: ${type}`);
  
  switch (type) {
    case 'INIT_DATA': {
      // 初始化数据
      if (!data || !data.treeData) {
        console.error('初始化数据错误: 缺少必要数据');
        return;
      }
      
      console.log(`Worker初始化，接收到${data.treeData.length}个节点数据`);
      
      // 保存数据
      treeData = data.treeData;
      
      // 发送初始化完成消息
      self.postMessage({
        type: 'INIT_COMPLETE',
        data: { success: true }
      });
      break;
    }
    
    case 'GET_VISIBLE_NODES': {
      // 获取可见节点
      const { nodes, expandedKeys } = data;
      console.log(`Worker处理GET_VISIBLE_NODES，节点数量: ${nodes?.length || 0}, 展开节点: ${expandedKeys?.length || 0}`);
      
      const visibleNodes = getVisibleNodes(nodes, expandedKeys);
      console.log(`Worker计算得到可见节点数量: ${visibleNodes?.length || 0}`);
      
      self.postMessage({
        type: 'VISIBLE_NODES_RESULT',
        data: { 
          visibleNodes,
          totalHeight: visibleNodes.length * 40 // 节点高度固定为40px
        }
      });
      break;
    }
    
    case 'GET_VIEWPORT_NODES': {
      // 获取视口内节点
      const { visibleNodes, scrollOptions } = data;
      console.log(`Worker处理GET_VIEWPORT_NODES，可见节点数量: ${visibleNodes?.length || 0}`);
      
      const nodesInViewport = getNodesInViewport(visibleNodes, scrollOptions);
      console.log(`Worker计算得到视口内节点数量: ${nodesInViewport?.length || 0}`);
      
      self.postMessage({
        type: 'VIEWPORT_NODES_RESULT',
        data: { 
          nodes: nodesInViewport
        }
      });
      break;
    }
    
    case 'SEARCH': {
      // 搜索节点
      const { keyword, nodes } = data;
      console.log(`Worker执行搜索: "${keyword}"`);
      
      const results = performSearch(keyword, nodes);
      
      self.postMessage({
        type: 'SEARCH_RESULT',
        data: { 
          keyword, 
          matchedKeys: results.matchedKeys, 
          expandedKeys: results.expandedKeys 
        }
      });
      break;
    }
    
    case 'CHECK_NODE': {
      // 处理节点选中状态变更
      const { nodeId, checked, currentCheckedKeys, nodes } = data;
      console.log(`Worker处理CHECK_NODE: 节点 ${nodeId}, 设置checked=${checked}, 当前选中数量: ${currentCheckedKeys?.length || 0}`);
      
      // 创建节点Map以便快速查找
      const nodeMap = {};
      const flatNodes = [];
      
      nodes.forEach(node => {
        nodeMap[node.key] = node;
        flatNodes.push(node);
      });
      
      // 获取当前节点
      const currentNode = nodeMap[nodeId];
      if (!currentNode) {
        console.error('未找到节点:', nodeId);
        return;
      }
      
      // 更新节点选中状态
      let newCheckedKeys = [...(currentCheckedKeys || [])];
      const updatedNodes = [];
      
      // 处理当前节点
      currentNode.checked = checked;
      currentNode.indeterminate = false;
      updatedNodes.push({
        key: currentNode.key,
        checked: currentNode.checked,
        indeterminate: currentNode.indeterminate
      });
      
      // 处理选中操作
      if (checked) {
        // 添加当前节点到选中列表
        if (!newCheckedKeys.includes(nodeId)) {
          newCheckedKeys.push(nodeId);
        }
        
        // 处理子节点(级联选择)
        if (currentNode.type === 'department') {
          const childKeys = getChildrenKeys(nodes, nodeId);
          childKeys.forEach(childKey => {
            const childNode = nodeMap[childKey];
            if (childNode) {
              childNode.checked = true;
              childNode.indeterminate = false;
              
              if (!newCheckedKeys.includes(childKey)) {
                newCheckedKeys.push(childKey);
              }
              
              updatedNodes.push({
                key: childKey,
                checked: true,
                indeterminate: false
              });
            }
          });
        }
      } else {
        // 移除当前节点从选中列表
        newCheckedKeys = newCheckedKeys.filter(key => key !== nodeId);
        
        // 处理子节点(级联取消选择)
        if (currentNode.type === 'department') {
          const childKeys = getChildrenKeys(nodes, nodeId);
          childKeys.forEach(childKey => {
            const childNode = nodeMap[childKey];
            if (childNode) {
              childNode.checked = false;
              childNode.indeterminate = false;
              
              newCheckedKeys = newCheckedKeys.filter(key => key !== childKey);
              
              updatedNodes.push({
                key: childKey,
                checked: false,
                indeterminate: false
              });
            }
          });
        }
      }
      
      // 更新父节点状态
      const parentKeys = getParentKeys(nodes, nodeId);
      parentKeys.forEach(parentKey => {
        const parentNode = nodeMap[parentKey];
        if (parentNode) {
          // 获取该父节点的所有子节点
          const children = nodes.filter(node => node.parentId === parentKey);
          
          // 检查子节点状态
          const checkedChildren = children.filter(child => newCheckedKeys.includes(child.key));
          
          console.log(`更新父节点 ${parentNode.name || parentNode.title} (${parentKey}) 状态: 子节点${children.length}个, 选中${checkedChildren.length}个`);
          
          if (checkedChildren.length === 0) {
            // 没有选中的子节点
            parentNode.checked = false;
            parentNode.indeterminate = false;
            
            // 确保从选中列表移除
            newCheckedKeys = newCheckedKeys.filter(key => key !== parentKey);
          } else if (checkedChildren.length === children.length) {
            // 所有子节点都选中
            parentNode.checked = true;
            parentNode.indeterminate = false;
            
            // 如果父节点之前不在选中列表中，添加它
            if (!newCheckedKeys.includes(parentKey)) {
              newCheckedKeys.push(parentKey);
            }
          } else {
            // 部分子节点选中 - 半选状态
            parentNode.checked = false;
            parentNode.indeterminate = true;
            
            // 如果父节点在选中列表中，移除它
            newCheckedKeys = newCheckedKeys.filter(key => key !== parentKey);
          }
          
          updatedNodes.push({
            key: parentKey,
            checked: parentNode.checked,
            indeterminate: parentNode.indeterminate
          });
          
          console.log(`父节点 ${parentNode.name || parentNode.title} (${parentKey}) 更新后状态: checked=${parentNode.checked}, indeterminate=${parentNode.indeterminate}`);
        }
      });
      
      // 返回更新后的状态
      self.postMessage({
        type: 'NODE_CHECKED',
        data: {
          nodeId,
          checked,
          checkedKeys: newCheckedKeys,
          updatedNodes
        }
      });
      break;
    }
    
    default:
      console.warn('Worker收到未知类型消息:', type);
  }
}; 