/**
 * 树数据处理工具
 * 用于处理树形结构数据，支持扁平化、索引、可见性缓存等功能
 */

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

  const processNode = (node, parent = null, level = 0, parentPath = []) => {
    const nodeKey = node.key || `node-${flatNodes.length}`;
    const children = node[childrenKey];
    const hasChildren = Array.isArray(children) && children.length > 0;
    const currentPath = [...parentPath, nodeKey];
    const pathKey = currentPath.join('/');

    const flatNode = {
      ...node,
      key: nodeKey,
      [levelKey]: level,
      [isLeafKey]: !hasChildren,
      [parentKey]: parent ? parent.key : null,
      expanded: defaultExpandedKeys.includes(nodeKey) || expanded,
      selected: defaultSelectedKeys.includes(nodeKey),
      checked: defaultCheckedKeys.includes(nodeKey),
      pathKey,
      loaded: true,
      // 支持部门和人员两种类型
      type: node.type || 'department',
    };

    nodeMap.set(nodeKey, flatNode);
    flatNodes.push(flatNode);

    if (hasChildren) {
      children.forEach(child => processNode(child, flatNode, level + 1, currentPath));
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
  const { expandedKeys = [], visibilityCache = new Map() } = options;
  if (!nodes || nodes.length === 0) return [];

  const visibleNodes = [];
  const expandedKeysSet = new Set(expandedKeys);

  // 根节点总是可见的
  nodes.forEach(node => {
    // 首先检查缓存
    if (visibilityCache.has(node.key)) {
      if (visibilityCache.get(node.key)) {
        visibleNodes.push(node);
      }
      return;
    }

    // 如果是顶级节点或者父节点已展开，则该节点可见
    if (node.level === 0 || !node.parent) {
      visibilityCache.set(node.key, true);
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

      visibilityCache.set(node.key, isVisible);
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
    nodeHeight = 40, // 节点高度调整为40px
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

/**
 * 完整的树数据处理函数
 * @param {Array} treeData 原始树形数据
 * @param {Object} options 配置选项
 * @returns {Object} 处理后的数据结果
 */
export const processTreeData = (treeData, options = {}) => {
  const {
    defaultExpandedKeys = [],
    defaultSelectedKeys = [],
    defaultCheckedKeys = [],
    defaultExpandAll = false,
  } = options;

  const flattenedData = [];
  const nodeMap = new Map();
  const visibilityCache = new Map();
  let expandedCount = 0;

  // 递归扁平化树结构
  function flatten(nodes, level = 0, parentId = null, parentPath = []) {
    nodes.forEach(node => {
      const nodeId = node.id || node.key;
      const currentPath = [...parentPath, nodeId];
      const pathKey = currentPath.join('/');
      const isExpandedByDefault = defaultExpandAll || level === 0 || defaultExpandedKeys.includes(nodeId);

      const flatNode = {
        id: nodeId,
        key: nodeId,
        name: node.name || node.title,
        title: node.title || node.name, // 兼容Ant Design的title字段
        parentId,
        level,
        expanded: isExpandedByDefault,
        selected: defaultSelectedKeys.includes(nodeId),
        checked: defaultCheckedKeys.includes(nodeId),
        children: node.children?.map(child => child.id || child.key) || [],
        isLeaf: !node.children || node.children.length === 0,
        pathKey,
        loaded: true,
        // 扩展支持人员节点
        type: node.type || 'department', // 'department' 或 'user'
        avatar: node.avatar,             // 用户头像
        email: node.email,               // 用户邮箱
        position: node.position          // 用户职位
      };

      // 计算初始展开的节点数量
      if (flatNode.expanded) {
        expandedCount++;
      }

      flattenedData.push(flatNode);
      nodeMap.set(nodeId, flatNode);

      if (node.children?.length) {
        flatten(node.children, level + 1, nodeId, currentPath);
      }
    });
  }

  flatten(treeData);

  return {
    flattenedData,
    nodeMap,
    visibilityCache,
    expandedCount
  };
};

/**
 * 生成测试数据
 * @param {Number} departments 部门数量
 * @param {Number} usersPerDept 每个部门的用户数量
 * @param {Number} maxLevel 最大层级
 * @returns {Array} 测试数据
 */
export const generateTestData = (departments = 10, usersPerDept = 8, maxLevel = 3) => {
  const data = [];
  
  const generateDepartment = (prefix = '', level = 1, deptIndex = 0) => {
    const deptId = prefix ? `${prefix}-dept-${deptIndex}` : `dept-${deptIndex}`;
    const department = {
      id: deptId,
      key: deptId,
      name: prefix ? `${prefix}部门 ${deptIndex}` : `部门 ${deptIndex}`,
      title: prefix ? `${prefix}部门 ${deptIndex}` : `部门 ${deptIndex}`,
      type: 'department',
      children: []
    };
    
    // 添加用户
    for (let j = 0; j < usersPerDept; j++) {
      const userId = `${deptId}-user-${j}`;
      department.children.push({
        id: userId,
        key: userId,
        name: `${department.name}的用户 ${j + 1}`,
        title: `${department.name}的用户 ${j + 1}`,
        type: 'user',
        email: `user${j}@example.com`,
        position: '员工',
        avatar: null
      });
    }
    
    // 如果没有达到最大层级，为部门添加子部门
    if (level < maxLevel) {
      const subDeptCount = Math.max(1, Math.floor(Math.random() * 3)); // 1-3个子部门
      for (let k = 0; k < subDeptCount; k++) {
        const subDept = generateDepartment(department.name, level + 1, k);
        department.children.push(subDept);
      }
    }
    
    return department;
  };
  
  // 生成顶级部门
  for (let i = 0; i < departments; i++) {
    data.push(generateDepartment('', 1, i));
  }
  
  return data;
};

/**
 * 预估内存占用
 * @param {Array} treeData 树形数据
 * @returns {Object} 内存占用信息
 */
export const estimateMemoryUsage = (treeData) => {
  // 计算节点总数
  let nodeCount = 0;
  
  const countNodes = (nodes) => {
    if (!nodes) return;
    nodeCount += nodes.length;
    nodes.forEach(node => {
      if (node.children && node.children.length) {
        countNodes(node.children);
      }
    });
  };
  
  countNodes(treeData);
  
  // 假设每个节点使用约200字节
  const estimatedBytes = nodeCount * 200;
  return {
    nodeCount,
    estimatedKB: Math.round(estimatedBytes / 1024),
    estimatedMB: Math.round(estimatedBytes / (1024 * 1024) * 100) / 100
  };
}; 