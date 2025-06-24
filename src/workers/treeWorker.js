/**
 * 树结构处理 Web Worker
 * 负责处理大数据量下的树节点计算，包括扁平化、过滤和可见性计算等
 */

// 扁平化树结构
const flattenTree = (data, options = {}) => {
  const {
    childrenKey = 'children',
    parentKey = 'parent',
    levelKey = 'level',
    isLeafKey = 'isLeaf',
    expanded = false,
    defaultExpandedKeys = [],
    defaultSelectedKeys = [],
    defaultCheckedKeys = [],
  } = options;

  const flatNodes = [];
  const nodeMap = new Map();

  const processNode = (node, parent = null, level = 0) => {
    const nodeKey = node.key || `node-${flatNodes.length}`;
    const children = node[childrenKey];
    const hasChildren = Array.isArray(children) && children.length > 0;

    const flatNode = {
      ...node,
      key: nodeKey,
      [levelKey]: level,
      [isLeafKey]: !hasChildren,
      [parentKey]: parent ? parent.key : null,
      expanded: defaultExpandedKeys.includes(nodeKey) || expanded,
      selected: defaultSelectedKeys.includes(nodeKey),
      checked: defaultCheckedKeys.includes(nodeKey),
    };

    nodeMap.set(nodeKey, flatNode);
    flatNodes.push(flatNode);

    if (hasChildren) {
      children.forEach(child => processNode(child, flatNode, level + 1));
    }
  };

  data.forEach(node => processNode(node));

  return { flatNodes, nodeMap };
};

// 过滤树节点
const filterTreeNodes = (nodes, searchValue) => {
  if (!searchValue) return nodes;

  const filteredNodes = [];
  const matchingKeys = new Set();

  // 第一遍找到所有匹配的节点
  nodes.forEach(node => {
    if (node.title && node.title.toLowerCase().includes(searchValue.toLowerCase())) {
      matchingKeys.add(node.key);
    }
  });

  // 第二遍找到所有匹配节点的父节点
  nodes.forEach(node => {
    if (matchingKeys.has(node.key)) {
      let currentNode = node;
      while (currentNode && currentNode.parent) {
        const parentNode = nodes.find(n => n.key === currentNode.parent);
        if (parentNode) {
          matchingKeys.add(parentNode.key);
          currentNode = parentNode;
        } else {
          break;
        }
      }
    }
  });

  // 构建过滤后的节点数组
  nodes.forEach(node => {
    if (matchingKeys.has(node.key)) {
      filteredNodes.push({
        ...node,
        expanded: true, // 搜索结果中的节点默认展开
      });
    }
  });

  return filteredNodes;
};

// 获取可见节点
const getVisibleNodes = (nodes, expandedKeys = []) => {
  if (!nodes || nodes.length === 0) return [];

  const visibleNodes = [];
  const expandedKeysSet = new Set(expandedKeys);

  nodes.forEach(node => {
    if (node.level === 0 || !node.parent) {
      visibleNodes.push(node);
    } else {
      let parent = nodes.find(n => n.key === node.parent);
      let isVisible = true;
      
      while (parent) {
        if (!expandedKeysSet.has(parent.key) && !parent.expanded) {
          isVisible = false;
          break;
        }
        parent = nodes.find(n => n.key === parent.parent);
      }

      if (isVisible) {
        visibleNodes.push(node);
      }
    }
  });

  return visibleNodes;
};

// 获取视图内的节点
const getNodesInViewport = (visibleNodes, options = {}) => {
  const { 
    scrollTop = 0, 
    viewportHeight, 
    nodeHeight = 28, 
    overscan = 10 
  } = options;
  
  if (!visibleNodes || visibleNodes.length === 0) return [];
  
  const startIndex = Math.max(0, Math.floor(scrollTop / nodeHeight) - overscan);
  const endIndex = Math.min(
    visibleNodes.length - 1,
    Math.ceil((scrollTop + viewportHeight) / nodeHeight) + overscan
  );

  return visibleNodes.slice(startIndex, endIndex + 1);
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
        visibleNodes
      });
      break;
    }

    case 'GET_VIEWPORT_NODES': {
      const { visibleNodes: vNodes, scrollOptions } = data;
      const viewportNodes = getNodesInViewport(vNodes, scrollOptions);
      self.postMessage({
        type: 'VIEWPORT_NODES_RESULT',
        viewportNodes
      });
      break;
    }

    case 'SEARCH_NODES': {
      const { nodes: searchNodes, searchValue } = data;
      const filteredNodes = filterTreeNodes(searchNodes, searchValue);
      self.postMessage({
        type: 'SEARCH_RESULT',
        filteredNodes
      });
      break;
    }

    default:
      break;
  }
}; 