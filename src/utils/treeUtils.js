/**
 * 将树形结构数据扁平化处理
 * @param {Array} data 树形数据
 * @param {Object} options 配置选项
 * @returns {Array} 扁平化后的节点数组
 */
export const flattenTree = (data, options = {}) => {
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

/**
 * 过滤树节点
 * @param {Array} nodes 扁平化的节点数组
 * @param {Function} predicate 过滤函数
 * @returns {Array} 过滤后的节点数组
 */
export const filterTreeNodes = (nodes, predicate) => {
  if (!predicate || typeof predicate !== 'function') return nodes;

  const filteredNodes = [];
  const matchingKeys = new Set();

  // 第一遍找到所有匹配的节点
  nodes.forEach(node => {
    if (predicate(node)) {
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

/**
 * 根据可见性计算可视区域内的节点
 * @param {Array} nodes 扁平化的节点数组
 * @param {Object} options 配置选项
 * @returns {Array} 可见的节点数组
 */
export const getVisibleNodes = (nodes, options = {}) => {
  const { expandedKeys = [] } = options;
  if (!nodes || nodes.length === 0) return [];

  const visibleNodes = [];
  const expandedKeysSet = new Set(expandedKeys);

  // 根节点总是可见的
  nodes.forEach(node => {
    // 如果是顶级节点或者父节点已展开，则该节点可见
    if (node.level === 0 || !node.parent) {
      visibleNodes.push(node);
    } else {
      // 检查该节点的所有父节点是否都是展开的
      let parent = nodes.find(n => n.key === node.parent);
      let isVisible = true;
      
      while (parent) {
        // 如果任何一个父节点是折叠的，则不可见
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

/**
 * 计算可视区域内需要渲染的节点
 * @param {Array} visibleNodes 可见节点数组
 * @param {Object} options 滚动相关配置
 * @returns {Array} 需要渲染的节点数组
 */
export const getNodesInViewport = (visibleNodes, options = {}) => {
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

/**
 * 生成测试数据
 * @param {Number} departments 部门数量
 * @param {Number} usersPerDept 每个部门的用户数量
 * @returns {Array} 测试数据
 */
export const generateTestData = (departments = 10, usersPerDept = 8) => {
  const data = [];

  for (let i = 0; i < departments; i++) {
    const deptId = `dept-${i}`;
    const department = {
      key: deptId,
      title: `部门 ${i + 1}`,
      type: 'department',
      children: []
    };

    // 添加用户
    for (let j = 0; j < usersPerDept; j++) {
      const userId = `user-${i}-${j}`;
      department.children.push({
        key: userId,
        title: `用户 ${i + 1}-${j + 1}`,
        type: 'user'
      });
    }

    // 为部分部门添加子部门
    if (i < departments / 2) {
      for (let k = 0; k < 2; k++) {
        const subDeptId = `dept-${i}-${k}`;
        const subDepartment = {
          key: subDeptId,
          title: `子部门 ${i + 1}-${k + 1}`,
          type: 'department',
          children: []
        };

        // 为子部门添加用户
        for (let l = 0; l < usersPerDept / 2; l++) {
          const subUserId = `user-${i}-${k}-${l}`;
          subDepartment.children.push({
            key: subUserId,
            title: `子部门用户 ${i + 1}-${k + 1}-${l + 1}`,
            type: 'user'
          });
        }

        department.children.push(subDepartment);
      }
    }

    data.push(department);
  }

  return data;
}; 