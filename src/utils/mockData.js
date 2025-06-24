/**
 * 模拟数据生成工具
 * 用于生成测试用的部门和员工数据
 */

// 部门名称
const departmentNames = [
  '技术部', '产品部', '设计部', '市场部', '销售部', 
  '人力资源部', '财务部', '法务部', '行政部', '客服部',
  '运营部', '采购部', '质控部', '研发部', '公关部',
  '培训部', '商务部', '内容部', '社区运营部', '国际业务部',
  '技术部1组', '技术部2组', '产品部1组', '产品部2组', '销售部1组',
  '销售部2组', '安全部'
];

// 职位名称
const positions = [
  '前端工程师', '后端工程师', '全栈工程师', '产品经理', 'UI设计师',
  '设计师', '测试工程师', '运维工程师', '项目经理', '数据分析师'
];

// 姓氏
const lastNames = [
  '张', '王', '李', '赵', '刘', '陈', '杨', '黄', '周', '吴',
  '徐', '孙', '马', '朱', '胡', '林', '郭', '何', '高', '罗'
];

// 名字
const firstNames = [
  '伟', '芳', '娜', '秀英', '敏', '静', '丽', '强', '磊', '洋', 
  '艳', '勇', '杰', '娟', '涛', '明', '超', '秀兰', '霞', '平', 
  '刚', '桂英', '玉梅', '红', '军', '丽华', '建华', '建国', '建军', '志强',
  '丽娟', '秀芳', '桂芳', '玉珍', '秀珍', '建平', '国庆', '秀华', '宁宁', '志华',
  '婷婷'
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
 * 生成随机名字
 * @returns {string} 随机生成的姓名
 */
function generateRandomName() {
  const lastName = lastNames[getRandomInt(0, lastNames.length - 1)];
  const firstName = firstNames[getRandomInt(0, firstNames.length - 1)];
  return lastName + firstName;
}

/**
 * 生成随机职位
 * @returns {string} 随机职位
 */
function generateRandomPosition() {
  return positions[getRandomInt(0, positions.length - 1)];
}

/**
 * 生成唯一ID
 * @returns {string} 唯一ID
 */
function generateUniqueId() {
  return Math.random().toString(36).substr(2, 9);
}

/**
 * 生成部门树形数据
 * @param {number} [departmentCount=10] 部门数量
 * @param {number} [employeesPerDepartment=5] 每个部门的员工数量
 * @returns {Array} 树形数据
 */
export function generateTreeData(departmentCount = 10, employeesPerDepartment = 10) {
  const data = [];
  
  // 随机选择部门名称
  const selectedDepartments = [...departmentNames];
  
  // 随机打乱部门名称
  for (let i = selectedDepartments.length - 1; i > 0; i--) {
    const j = getRandomInt(0, i);
    [selectedDepartments[i], selectedDepartments[j]] = [selectedDepartments[j], selectedDepartments[i]];
  }
  
  // 生成部门
  for (let i = 0; i < Math.min(departmentCount, selectedDepartments.length); i++) {
    const departmentId = `dept-${i + 1}`;
    const departmentName = selectedDepartments[i];
    
    // 创建部门节点
    const department = {
      key: departmentId,
      id: departmentId,
      name: departmentName,
      title: departmentName,
      type: 'department',
      isLeaf: false,
      level: 0,
      expanded: i < 3, // 默认展开前3个部门
      children: []
    };
    
    // 生成员工
    for (let j = 0; j < employeesPerDepartment; j++) {
      const employeeId = `emp-${i + 1}-${j + 1}`;
      const name = generateRandomName();
      const position = generateRandomPosition();
      
      // 创建员工节点
      const employee = {
        key: employeeId,
        id: employeeId,
        name: `employee-${i + 1}-${j + 1}`,
        realName: name,
        position: position,
        type: 'user',
        isLeaf: true,
        level: 1,
        parentId: departmentId
      };
      
      department.children.push(employee);
    }
    
    data.push(department);
  }
  
  return data;
}

/**
 * 扁平化树形数据
 * @param {Array} treeData 树形数据
 * @returns {Object} 扁平化结果
 */
export function flattenTreeData(treeData) {
  const flattenedData = [];
  const nodeMap = new Map();
  
  function flatten(nodes, parentId = null, level = 0) {
    if (!nodes || !Array.isArray(nodes)) return;
    
    nodes.forEach(node => {
      // 创建新节点，添加parentId和level
      const newNode = {
        ...node,
        parentId,
        level
      };
      
      // 处理children
      const children = node.children;
      if (children && children.length) {
        delete newNode.children; // 移除children属性
      }
      
      // 添加到结果
      flattenedData.push(newNode);
      nodeMap.set(node.key, newNode);
      
      // 递归处理子节点
      if (children && children.length) {
        flatten(children, node.key, level + 1);
      }
    });
  }
  
  flatten(treeData);
  
  return { flattenedData, nodeMap };
} 