/**
 * 树结构处理 Web Worker
 * 负责处理大数据量下的树节点计算，包括扁平化、过滤和可见性计算等
 */

// 节点高度固定为40px
const NODE_HEIGHT = 40;

// 扁平化树结构
const flattenTree = (data, options = {}) => {
  const {
    childrenKey = 'children',
    parentKey = 'parentId',
    levelKey = 'level',
    isLeafKey = 'isLeaf',
    expanded = false,
    defaultExpandedKeys = [],
    defaultSelectedKeys = [],
    defaultCheckedKeys = [],
  } = options;

  const flatNodes = [];
  const nodeMap = new Map();

  const processNode = (node, parent = null, level = 0, parentPath = []) => {
    const nodeId = node.id || node.key;
    const children = node[childrenKey];
    const hasChildren = Array.isArray(children) && children.length > 0;
    const currentPath = [...parentPath, nodeId];
    const pathKey = currentPath.join('/');

    const flatNode = {
      ...node,
      key: nodeId,
      id: nodeId,
      [levelKey]: level,
      [isLeafKey]: !hasChildren,
      [parentKey]: parent ? parent.id : null,
      expanded: defaultExpandedKeys.includes(nodeId) || expanded,
      selected: defaultSelectedKeys.includes(nodeId),
      checked: defaultCheckedKeys.includes(nodeId),
      pathKey,
      loaded: true,
      // 支持部门和人员两种类型
      type: node.type || 'department',
    };

    nodeMap.set(nodeId, flatNode);
    flatNodes.push(flatNode);

    if (hasChildren) {
      children.forEach(child => processNode(child, flatNode, level + 1, currentPath));
    }
  };

  data.forEach(node => processNode(node));

  return { flatNodes, nodeMap };
};

// 过滤树节点
const filterTreeNodes = (nodes, searchValue) => {
  if (!searchValue || typeof searchValue !== 'string' || searchValue.trim() === '') {
    return nodes.map(node => ({
      ...node,
      matched: false
    }));
  }

  const matchingKeys = new Set();
  const valueLower = searchValue.toLowerCase();

  // 第一遍找到所有匹配的节点
  nodes.forEach(node => {
    const nodeTitle = (node.title || node.name || '').toLowerCase();
    const nodeEmail = (node.email || '').toLowerCase();
    const nodePosition = (node.position || '').toLowerCase();
    // 添加对新增字段的搜索支持
    const nodeRealName = (node.realName || '').toLowerCase();
    const nodePhone = (node.phone || '').toLowerCase();
    const nodeDepartmentName = (node.departmentName || '').toLowerCase();
    
    const isMatch = 
      nodeTitle.includes(valueLower) || 
      nodeEmail.includes(valueLower) || 
      nodePosition.includes(valueLower) ||
      nodeRealName.includes(valueLower) ||
      nodePhone.includes(valueLower) ||
      nodeDepartmentName.includes(valueLower);
      
    if (isMatch) {
      matchingKeys.add(node.key || node.id);
    }
  });

  // 第二遍找到所有匹配节点的父节点
  nodes.forEach(node => {
    if (matchingKeys.has(node.key || node.id)) {
      let currentNode = node;
      while (currentNode && currentNode.parentId) {
        const parentNode = nodes.find(n => n.id === currentNode.parentId || n.key === currentNode.parentId);
        if (parentNode) {
          matchingKeys.add(parentNode.id || parentNode.key);
          currentNode = parentNode;
        } else {
          break;
        }
      }
    }
  });

  // 标记匹配的节点并展开路径
  return nodes.map(node => {
    const nodeMatched = matchingKeys.has(node.id || node.key);
    return {
      ...node,
      matched: nodeMatched,
      expanded: node.expanded || nodeMatched,
    };
  });
};

// 获取可见节点
const getVisibleNodes = (nodes, expandedKeys = []) => {
  if (!nodes || nodes.length === 0) return [];

  const visibleNodes = [];
  const expandedKeysSet = new Set(expandedKeys);
  const visibilityCache = new Map();

  // 获取指定节点的所有父节点ID
  const getParentKeys = (node) => {
    const parents = [];
    let current = node;
    
    while (current && current.parentId) {
      parents.push(current.parentId);
      current = nodes.find(n => n.id === current.parentId || n.key === current.parentId);
    }
    
    return parents;
  };

  // 判断节点是否可见
  const isNodeVisible = (node) => {
    // 检查缓存
    if (visibilityCache.has(node.id || node.key)) {
      return visibilityCache.get(node.id || node.key);
    }

    // 根节点总是可见
    if (node.level === 0 || !node.parentId) {
      visibilityCache.set(node.id || node.key, true);
      return true;
    }

    // 检查父节点的展开状态
    const parentKeys = getParentKeys(node);
    let isVisible = true;
    
    for (const parentKey of parentKeys) {
      const parent = nodes.find(n => n.id === parentKey || n.key === parentKey);
      if (!parent || (!expandedKeysSet.has(parentKey) && !parent.expanded)) {
        isVisible = false;
        break;
      }
    }
    
    // 存入缓存
    visibilityCache.set(node.id || node.key, isVisible);
    return isVisible;
  };

  // 筛选可见节点
  nodes.forEach(node => {
    if (isNodeVisible(node)) {
      visibleNodes.push(node);
    }
  });

  return visibleNodes;
};

// 获取视图内的节点
const getNodesInViewport = (visibleNodes, options = {}) => {
  const { 
    scrollTop = 0, 
    viewportHeight = 500, 
    nodeHeight = NODE_HEIGHT, 
    overscan = 10 
  } = options;
  
  if (!visibleNodes || visibleNodes.length === 0) return [];
  
  const startIndex = Math.max(0, Math.floor(scrollTop / nodeHeight) - overscan);
  const endIndex = Math.min(
    visibleNodes.length - 1,
    Math.ceil((scrollTop + viewportHeight) / nodeHeight) + overscan
  );

  return visibleNodes.slice(startIndex, endIndex + 1).map((node, idx) => ({
    ...node,
    offsetTop: (startIndex + idx) * nodeHeight,
    index: startIndex + idx
  }));
};

// 消息处理
self.onmessage = (e) => {
  const { type, data } = e.data;

  switch (type) {
    case 'INITIALIZE': {
      const { treeData, options } = data;
      const result = flattenTree(treeData, options);
      self.postMessage({
        type: 'INITIALIZED',
        flatNodes: result.flatNodes,
        nodeMap: [...result.nodeMap]  // 转换为可序列化的数组形式
      });
      break;
    }

    case 'GET_VISIBLE_NODES': {
      const { nodes, expandedKeys } = data;
      const visibleNodes = getVisibleNodes(nodes, expandedKeys);
      self.postMessage({
        type: 'VISIBLE_NODES_RESULT',
        data: { visibleNodes }
      });
      break;
    }

    case 'GET_VIEWPORT_NODES': {
      const { visibleNodes: vNodes, scrollOptions } = data;
      const viewportNodes = getNodesInViewport(vNodes, scrollOptions);
      self.postMessage({
        type: 'VIEWPORT_NODES_RESULT',
        data: { viewportNodes }
      });
      break;
    }

    case 'SEARCH_NODES': {
      const { nodes: searchNodes, searchValue } = data;
      const filteredNodes = filterTreeNodes(searchNodes, searchValue);
      self.postMessage({
        type: 'SEARCH_RESULT',
        data: { filteredNodes }
      });
      break;
    }

    case 'UPDATE_NODE': {
      const { nodeId, updates } = data;
      // 节点更新逻辑将在这里实现
      self.postMessage({
        type: 'NODE_UPDATED',
        data: { nodeId }
      });
      break;
    }

    default:
      break;
  }
}; 