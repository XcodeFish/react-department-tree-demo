/**
 * 模拟数据生成工具
 * 用于生成不同规模的部门和人员树形数据
 */

// 部门名称列表
const departmentNames = [
  '技术部', '产品部', '设计部', '市场部', '销售部', '人力资源部', '财务部', '行政部',
  '客服部', '法务部', '研发中心', '数据中心', '运营部', '采购部', '质量控制部',
  '战略发展部', '公关部', '培训部', '安全部', '国际业务部'
];

// 职位名称列表
const positions = [
  '经理', '主管', '专员', '助理', '总监', '副总监', '组长', '高级工程师',
  '工程师', '实习生', '顾问', '总经理', '副总经理', '总监助理', '主管助理'
];

// 姓氏列表
const lastNames = [
  '张', '王', '李', '赵', '刘', '陈', '杨', '黄', '周', '吴',
  '徐', '孙', '马', '朱', '胡', '林', '郭', '何', '高', '罗',
  '郑', '梁', '谢', '宋', '唐', '许', '韩', '冯', '邓', '曹',
  '彭', '曾', '蔡', '潘', '田', '董', '袁', '于', '余', '叶'
];

// 名字列表
const firstNames = [
  '伟', '芳', '娜', '秀英', '敏', '静', '丽', '强', '磊', '洋',
  '艳', '勇', '军', '杰', '娟', '涛', '明', '超', '秀兰', '霞',
  '平', '刚', '桂英', '文', '辉', '力', '红', '翔', '玉', '玲',
  '桂兰', '芬', '鹏', '健', '俊', '雷', '浩', '帆', '建华', '建国'
];

/**
 * 生成随机整数
 * @param {number} min 最小值
 * @param {number} max 最大值
 * @returns {number} 随机整数
 */
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 生成随机姓名
 * @returns {string} 随机姓名
 */
function generateRandomName() {
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  return lastName + firstName;
}

/**
 * 生成随机职位
 * @returns {string} 随机职位
 */
function generateRandomPosition() {
  return positions[Math.floor(Math.random() * positions.length)];
}

/**
 * 生成随机部门名称
 * @returns {string} 随机部门名称
 */
function generateRandomDepartment() {
  return departmentNames[Math.floor(Math.random() * departmentNames.length)];
}

/**
 * 生成唯一ID
 * @param {string} prefix ID前缀
 * @returns {string} 唯一ID
 */
function generateId(prefix) {
  return `${prefix}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 生成部门节点
 * @param {string} name 部门名称
 * @param {number} level 层级
 * @param {number} index 索引
 * @returns {Object} 部门节点
 */
function generateDepartmentNode(name, level, index) {
  const id = generateId('dept');
  return {
    id,
    key: id,
    name,
    type: 'department',
    level,
    index,
    isLeaf: false,
    expanded: level < 1, // 默认展开第一级
    children: []
  };
}

/**
 * 生成用户节点
 * @param {string} deptId 所属部门ID
 * @param {number} level 层级
 * @param {number} index 索引
 * @returns {Object} 用户节点
 */
function generateUserNode(deptId, level, index) {
  const name = generateRandomName();
  const id = generateId('user');
  return {
    id,
    key: id,
    name,
    realName: name,
    type: 'user',
    position: generateRandomPosition(),
    deptId,
    level,
    index,
    isLeaf: true,
    email: `${name}@example.com`.toLowerCase(),
    avatar: null
  };
}

/**
 * 递归生成部门和人员树
 * @param {number} depth 当前深度
 * @param {number} maxDepth 最大深度
 * @param {number} maxDeptPerLevel 每层最大部门数
 * @param {number} maxUserPerDept 每个部门最大用户数
 * @param {number} userProbability 生成用户的概率
 * @returns {Array} 部门和人员树
 */
function generateDepartmentTree(depth = 0, maxDepth = 3, maxDeptPerLevel = 5, maxUserPerDept = 10, userProbability = 0.7) {
  // 如果达到最大深度，则不再生成子部门
  if (depth >= maxDepth) {
    return [];
  }
  
  // 生成当前层级的部门数量
  const deptCount = depth === 0 ? maxDeptPerLevel : getRandomInt(1, maxDeptPerLevel);
  const departments = [];
  
  // 生成部门
  for (let i = 0; i < deptCount; i++) {
    // 生成部门名称
    let deptName;
    if (depth === 0) {
      // 顶级部门使用预设名称
      deptName = departmentNames[i % departmentNames.length];
    } else {
      // 子部门添加随机编号
      deptName = `${generateRandomDepartment()}${getRandomInt(1, 5)}组`;
    }
    
    // 创建部门节点
    const department = generateDepartmentNode(deptName, depth, i);
    
    // 生成子部门
    const childDeptCount = depth < maxDepth - 1 ? getRandomInt(0, maxDeptPerLevel - 1) : 0;
    if (childDeptCount > 0) {
      department.children = [
        ...generateDepartmentTree(
          depth + 1,
          maxDepth,
          Math.max(2, maxDeptPerLevel - 1),
          Math.max(3, maxUserPerDept - 2),
          userProbability
        )
      ];
    }
    
    // 生成用户
    if (Math.random() < userProbability) {
      const userCount = getRandomInt(1, maxUserPerDept);
      for (let j = 0; j < userCount; j++) {
        const user = generateUserNode(department.id, depth + 1, j);
        department.children.push(user);
      }
    }
    
    departments.push(department);
  }
  
  return departments;
}

/**
 * 生成树形数据
 * @param {number} totalNodes 总节点数量
 * @returns {Array} 树形数据
 */
export function generateTreeData(totalNodes = 2000) {
  // 根据总节点数调整参数
  let maxDepth, maxDeptPerLevel, maxUserPerDept;
  
  if (totalNodes <= 500) {
    maxDepth = 3;
    maxDeptPerLevel = 4;
    maxUserPerDept = 8;
  } else if (totalNodes <= 2000) {
    maxDepth = 4;
    maxDeptPerLevel = 5;
    maxUserPerDept = 12;
  } else if (totalNodes <= 8000) {
    maxDepth = 5;
    maxDeptPerLevel = 6;
    maxUserPerDept = 20;
  } else {
    maxDepth = 6;
    maxDeptPerLevel = 7;
    maxUserPerDept = 30;
  }
  
  // 生成树形数据
  return generateDepartmentTree(0, maxDepth, maxDeptPerLevel, maxUserPerDept, 0.8);
}

/**
 * 计算树中的节点总数
 * @param {Array} tree 树形数据
 * @returns {number} 节点总数
 */
export function countTreeNodes(tree) {
  let count = 0;
  
  function traverse(nodes) {
    if (!nodes || !nodes.length) return;
    count += nodes.length;
    
    nodes.forEach(node => {
      if (node.children && node.children.length) {
        traverse(node.children);
      }
    });
  }
  
  traverse(tree);
  return count;
}

/**
 * 估算树的内存占用
 * @param {Array} tree 树形数据
 * @returns {Object} 内存占用估算
 */
export function estimateMemoryUsage(tree) {
  const nodeCount = countTreeNodes(tree);
  // 假设每个节点平均占用200字节
  const bytes = nodeCount * 200;
  
  return {
    nodeCount,
    kiloBytes: Math.round(bytes / 1024),
    megaBytes: Math.round((bytes / (1024 * 1024)) * 100) / 100
  };
} 