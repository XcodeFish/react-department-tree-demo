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
        position: node.position,         // 用户职位
        // 新增字段
        realName: node.realName,         // 真实姓名
        phone: node.phone,               // 电话
        userId: node.userId,             // 员工编号
        departmentId: node.departmentId, // 所属部门ID
        departmentName: node.departmentName, // 所属部门名称
        entryDate: node.entryDate,       // 入职日期
        deptId: node.deptId,             // 部门编号
        employeeCount: node.employeeCount, // 部门人数
        createTime: node.createTime      // 部门创建时间
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
  
  // 职位列表
  const positions = ['产品经理', '前端工程师', '后端工程师', '设计师', 'UI设计师', '测试工程师', '运维工程师', '项目经理'];
  
  // 姓氏列表
  const lastNames = ['张', '王', '李', '赵', '陈', '刘', '杨', '黄', '周', '吴', '徐', '孙', '胡', '朱', '高', '林', '何', '郭', '马', '罗'];
  
  // 名字列表（单字）
  const firstNamesOne = ['伟', '芳', '娜', '秀英', '敏', '静', '丽', '强', '磊', '洋', '艳', '勇', '军', '杰', '娟', '涛', '明', '超', '秀兰', '霞'];
  
  // 名字列表（双字）
  const firstNamesTwo = ['志强', '建国', '文革', '建华', '国庆', '敏华', '秀华', '秀芳', '桂芳', '桂英', '玉梅', '秀珍', '建军', '建平', '志华', '丽华', '丽娟', '婷婷', '佳佳', '宁宁'];
  
  // 部门名称列表
  const departmentNames = [
    '研发部', '技术部', '产品部', '设计部', '市场部', '销售部', '客服部', 
    '人力资源部', '财务部', '行政部', '法务部', '运营部', '商务部', '采购部', 
    '质控部', '物流部', '公关部', '战略部', '投资部', '数据部', '安全部',
    '培训部', '国际业务部', '客户体验部', '社区运营部', '内容部', '创新部'
  ];
  
  // 部门类型（用于组合部门名称）
  const departmentTypes = ['中心', '部门', '组', '团队', '事业部'];
  
  // 生成随机中文姓名
  const generateChineseName = () => {
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    // 50%概率使用单字名，50%概率使用双字名
    if (Math.random() > 0.5) {
      return lastName + firstNamesOne[Math.floor(Math.random() * firstNamesOne.length)];
    } else {
      return lastName + firstNamesTwo[Math.floor(Math.random() * firstNamesTwo.length)];
    }
  };
  
  // 生成随机手机号
  const generatePhoneNumber = () => {
    const prefixes = ['138', '139', '158', '188', '159', '186', '135', '136', '137'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    let number = '';
    for (let i = 0; i < 8; i++) {
      number += Math.floor(Math.random() * 10);
    }
    return prefix + number;
  };
  
  // 生成部门名称
  const generateDepartmentName = (level = 1, parentName = '') => {
    if (parentName && Math.random() < 0.3) {
      // 30%概率生成子部门名称（基于父部门）
      const subType = departmentTypes[Math.floor(Math.random() * departmentTypes.length)];
      return `${parentName}${subType}${Math.floor(Math.random() * 3) + 1}组`;
    } else {
      // 随机部门名称
      const deptName = departmentNames[Math.floor(Math.random() * departmentNames.length)];
      if (level > 1 && Math.random() < 0.5) {
        // 对于非顶级部门，50%概率添加编号
        return `${deptName}${Math.floor(Math.random() * 3) + 1}组`;
      }
      return deptName;
    }
  };
  
  const generateDepartment = (prefix = '', level = 1, deptIndex = 0) => {
    const deptId = prefix ? `${prefix}-dept-${deptIndex}` : `dept-${deptIndex}`;
    const deptCode = `D${String(level).padStart(2, '0')}${String(deptIndex).padStart(3, '0')}`;
    
    // 使用新的部门名称生成函数
    const deptName = generateDepartmentName(level, prefix);
    
    const department = {
      id: deptId,        // 部门ID
      deptId: deptCode,  // 部门编号
      key: deptId,
      name: deptName,
      title: deptName,
      type: 'department',
      employeeCount: usersPerDept,  // 部门人数
      createTime: new Date(Date.now() - Math.random() * 31536000000).toISOString().split('T')[0], // 随机创建日期（一年内）
      children: []
    };
    
    // 添加用户
    for (let j = 0; j < usersPerDept; j++) {
      const userId = `${deptId}-user-${j}`;
      const userCode = `U${String(level).padStart(2, '0')}${String(deptIndex).padStart(3, '0')}${String(j).padStart(3, '0')}`;
      const displayName = `${department.name}的用户 ${j + 1}`; // 显示用名称
      const realName = generateChineseName(); // 真实姓名
      const position = positions[Math.floor(Math.random() * positions.length)];
      const email = `user${j}_${deptCode}@example.com`;
      const phone = generatePhoneNumber();
      
      department.children.push({
        id: userId,        // ID
        userId: userCode,  // 员工编号
        key: userId,
        name: displayName, // 用于显示的名称
        title: displayName, // Ant Design Tree组件用的title属性
        realName: realName, // 真实姓名
        type: 'user',
        departmentId: deptId,        // 所属部门ID
        departmentName: deptName,    // 所属部门名称
        email: email,                // 邮箱
        phone: phone,                // 电话
        position: position,          // 职位
        entryDate: new Date(Date.now() - Math.random() * 31536000000).toISOString().split('T')[0], // 入职日期
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