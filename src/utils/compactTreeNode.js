/**
 * 极限优化的树节点数据结构
 * 使用TypedArray和位运算减少内存占用
 */

// 节点状态位定义
const STATE_EXPANDED = 1;      // 0000 0001
const STATE_SELECTED = 2;      // 0000 0010
const STATE_CHECKED = 4;       // 0000 0100
const STATE_MATCHED = 8;       // 0000 1000
const STATE_LOADING = 16;      // 0001 0000
const STATE_INDETERMINATE = 32;// 0010 0000
const STATE_VISIBLE = 64;      // 0100 0000
const STATE_LEAF = 128;        // 1000 0000

// 节点类型定义
const TYPE_DEPARTMENT = 0;
const TYPE_USER = 1;

/**
 * 压缩树节点管理器
 */
export class CompactTreeNodeManager {
  constructor(capacity = 10000) {
    // 分配内存
    this.capacity = capacity;
    
    // 使用TypedArray存储节点数据，减少内存占用
    this.ids = new Int32Array(capacity);           // 节点ID
    this.parentIds = new Int32Array(capacity);     // 父节点ID
    this.firstChildIndices = new Int32Array(capacity); // 第一个子节点索引
    this.nextSiblingIndices = new Int32Array(capacity); // 下一个兄弟节点索引
    this.levels = new Uint8Array(capacity);        // 节点层级 (0-255)
    this.states = new Uint8Array(capacity);        // 节点状态位
    this.types = new Uint8Array(capacity);         // 节点类型
    this.offsetTops = new Float32Array(capacity);  // 节点顶部偏移
    
    // 字符串数据（使用Map存储以节省内存）
    this.stringData = new Map();
    
    // 节点数量
    this.nodeCount = 0;
    
    // 可见节点缓存
    this.visibleNodeIndices = [];
    this.visibilityDirty = true;
    
    // 字符串ID计数器
    this.stringIdCounter = 1;
    
    // 字符串ID映射
    this.stringIdMap = new Map();
    
    // 节点ID到索引的映射
    this.nodeIdToIndex = new Map();
  }
  
  /**
   * 获取或创建字符串ID
   * @param {String} str 字符串
   * @returns {Number} 字符串ID
   */
  getStringId(str) {
    if (!str) return 0;
    
    if (this.stringIdMap.has(str)) {
      return this.stringIdMap.get(str);
    }
    
    const id = this.stringIdCounter++;
    this.stringIdMap.set(str, id);
    this.stringData.set(id, str);
    
    return id;
  }
  
  /**
   * 获取字符串
   * @param {Number} id 字符串ID
   * @returns {String} 字符串
   */
  getString(id) {
    if (id === 0) return '';
    return this.stringData.get(id) || '';
  }
  
  /**
   * 添加节点
   * @param {Object} node 节点数据
   * @returns {Number} 节点索引
   */
  addNode(node) {
    if (this.nodeCount >= this.capacity) {
      this.expandCapacity();
    }
    
    const index = this.nodeCount++;
    const {
      id,
      parentId = 0,
      level = 0,
      expanded = false,
      selected = false,
      checked = false,
      matched = false,
      loading = false,
      indeterminate = false,
      isLeaf = false,
      type = 'department'
    } = node;
    
    // 存储节点ID
    this.ids[index] = id;
    this.parentIds[index] = parentId || 0;
    this.levels[index] = Math.min(level, 255);
    
    // 设置节点状态位
    let state = 0;
    if (expanded) state |= STATE_EXPANDED;
    if (selected) state |= STATE_SELECTED;
    if (checked) state |= STATE_CHECKED;
    if (matched) state |= STATE_MATCHED;
    if (loading) state |= STATE_LOADING;
    if (indeterminate) state |= STATE_INDETERMINATE;
    if (isLeaf) state |= STATE_LEAF;
    
    this.states[index] = state;
    this.types[index] = type === 'user' ? TYPE_USER : TYPE_DEPARTMENT;
    
    // 存储字符串数据
    if (node.name) {
      const nameId = this.getStringId(node.name);
      this.stringData.set(`name_${index}`, nameId);
    }
    
    if (node.title && node.title !== node.name) {
      const titleId = this.getStringId(node.title);
      this.stringData.set(`title_${index}`, titleId);
    }
    
    // 更新节点ID到索引的映射
    this.nodeIdToIndex.set(id, index);
    
    // 更新树结构关系
    this.updateTreeStructure(index, parentId);
    
    // 标记可见性缓存为脏
    this.visibilityDirty = true;
    
    return index;
  }
  
  /**
   * 更新树结构关系
   * @param {Number} index 节点索引
   * @param {Number} parentId 父节点ID
   */
  updateTreeStructure(index, parentId) {
    if (!parentId) return;
    
    const parentIndex = this.nodeIdToIndex.get(parentId);
    if (parentIndex === undefined) return;
    
    // 如果父节点没有子节点，设置为第一个子节点
    if (this.firstChildIndices[parentIndex] === 0) {
      this.firstChildIndices[parentIndex] = index;
    } else {
      // 否则，添加到兄弟节点链表末尾
      let siblingIndex = this.firstChildIndices[parentIndex];
      while (this.nextSiblingIndices[siblingIndex] !== 0) {
        siblingIndex = this.nextSiblingIndices[siblingIndex];
      }
      this.nextSiblingIndices[siblingIndex] = index;
    }
  }
  
  /**
   * 扩展容量
   */
  expandCapacity() {
    const newCapacity = this.capacity * 2;
    
    // 创建新的数组
    const newIds = new Int32Array(newCapacity);
    const newParentIds = new Int32Array(newCapacity);
    const newFirstChildIndices = new Int32Array(newCapacity);
    const newNextSiblingIndices = new Int32Array(newCapacity);
    const newLevels = new Uint8Array(newCapacity);
    const newStates = new Uint8Array(newCapacity);
    const newTypes = new Uint8Array(newCapacity);
    const newOffsetTops = new Float32Array(newCapacity);
    
    // 复制数据
    newIds.set(this.ids);
    newParentIds.set(this.parentIds);
    newFirstChildIndices.set(this.firstChildIndices);
    newNextSiblingIndices.set(this.nextSiblingIndices);
    newLevels.set(this.levels);
    newStates.set(this.states);
    newTypes.set(this.types);
    newOffsetTops.set(this.offsetTops);
    
    // 更新引用
    this.ids = newIds;
    this.parentIds = newParentIds;
    this.firstChildIndices = newFirstChildIndices;
    this.nextSiblingIndices = newNextSiblingIndices;
    this.levels = newLevels;
    this.states = newStates;
    this.types = newTypes;
    this.offsetTops = newOffsetTops;
    
    // 更新容量
    this.capacity = newCapacity;
  }
  
  /**
   * 获取节点状态
   * @param {Number} index 节点索引
   * @param {Number} stateBit 状态位
   * @returns {Boolean} 状态值
   */
  getNodeState(index, stateBit) {
    if (index < 0 || index >= this.nodeCount) return false;
    return (this.states[index] & stateBit) !== 0;
  }
  
  /**
   * 设置节点状态
   * @param {Number} index 节点索引
   * @param {Number} stateBit 状态位
   * @param {Boolean} value 状态值
   */
  setNodeState(index, stateBit, value) {
    if (index < 0 || index >= this.nodeCount) return;
    
    if (value) {
      this.states[index] |= stateBit;
    } else {
      this.states[index] &= ~stateBit;
    }
    
    // 如果修改了展开状态，标记可见性缓存为脏
    if (stateBit === STATE_EXPANDED) {
      this.visibilityDirty = true;
    }
  }
  
  /**
   * 获取节点
   * @param {Number} id 节点ID
   * @returns {Object} 节点对象
   */
  getNode(id) {
    const index = this.nodeIdToIndex.get(id);
    if (index === undefined) return null;
    
    return this.getNodeByIndex(index);
  }
  
  /**
   * 根据索引获取节点
   * @param {Number} index 节点索引
   * @returns {Object} 节点对象
   */
  getNodeByIndex(index) {
    if (index < 0 || index >= this.nodeCount) return null;
    
    const id = this.ids[index];
    const parentId = this.parentIds[index];
    const level = this.levels[index];
    const state = this.states[index];
    const type = this.types[index] === TYPE_USER ? 'user' : 'department';
    
    // 获取字符串数据
    const nameId = this.stringData.get(`name_${index}`);
    const titleId = this.stringData.get(`title_${index}`);
    
    return {
      id,
      key: id,
      parentId,
      level,
      expanded: (state & STATE_EXPANDED) !== 0,
      selected: (state & STATE_SELECTED) !== 0,
      checked: (state & STATE_CHECKED) !== 0,
      matched: (state & STATE_MATCHED) !== 0,
      loading: (state & STATE_LOADING) !== 0,
      indeterminate: (state & STATE_INDETERMINATE) !== 0,
      isLeaf: (state & STATE_LEAF) !== 0,
      type,
      name: this.getString(nameId),
      title: this.getString(titleId) || this.getString(nameId),
      offsetTop: this.offsetTops[index]
    };
  }
  
  /**
   * 获取可见节点
   * @param {Number} nodeHeight 节点高度
   * @returns {Array} 可见节点数组
   */
  getVisibleNodes(nodeHeight = 40) {
    // 如果可见性缓存脏，重新计算
    if (this.visibilityDirty) {
      this.calculateVisibleNodes();
    }
    
    // 计算节点偏移
    let offsetTop = 0;
    for (let i = 0; i < this.visibleNodeIndices.length; i++) {
      const index = this.visibleNodeIndices[i];
      this.offsetTops[index] = offsetTop;
      offsetTop += nodeHeight;
    }
    
    // 返回可见节点
    return this.visibleNodeIndices.map(index => this.getNodeByIndex(index));
  }
  
  /**
   * 计算可见节点
   */
  calculateVisibleNodes() {
    this.visibleNodeIndices = [];
    
    for (let i = 0; i < this.nodeCount; i++) {
      if (this.isNodeVisible(i)) {
        this.visibleNodeIndices.push(i);
        this.setNodeState(i, STATE_VISIBLE, true);
      } else {
        this.setNodeState(i, STATE_VISIBLE, false);
      }
    }
    
    this.visibilityDirty = false;
  }
  
  /**
   * 判断节点是否可见
   * @param {Number} index 节点索引
   * @returns {Boolean} 是否可见
   */
  isNodeVisible(index) {
    if (index < 0 || index >= this.nodeCount) return false;
    
    // 根节点总是可见的
    if (this.levels[index] === 0 || this.parentIds[index] === 0) {
      return true;
    }
    
    // 检查该节点的所有父节点是否都是展开的
    let parentId = this.parentIds[index];
    while (parentId !== 0) {
      const parentIndex = this.nodeIdToIndex.get(parentId);
      if (parentIndex === undefined) return false;
      
      // 如果父节点未展开，则不可见
      if ((this.states[parentIndex] & STATE_EXPANDED) === 0) {
        return false;
      }
      
      parentId = this.parentIds[parentIndex];
    }
    
    return true;
  }
  
  /**
   * 获取可视区域内的节点
   * @param {Number} scrollTop 滚动位置
   * @param {Number} viewportHeight 视口高度
   * @param {Number} nodeHeight 节点高度
   * @param {Number} overscan 过扫描行数
   * @returns {Array} 可视区域内的节点
   */
  getNodesInViewport(scrollTop, viewportHeight, nodeHeight = 40, overscan = 5) {
    // 获取可见节点
    if (this.visibilityDirty) {
      this.calculateVisibleNodes();
    }
    
    const visibleCount = this.visibleNodeIndices.length;
    if (visibleCount === 0) return [];
    
    // 计算可视区域内的节点范围
    const startIndex = Math.max(0, Math.floor(scrollTop / nodeHeight) - overscan);
    const endIndex = Math.min(
      visibleCount - 1,
      Math.ceil((scrollTop + viewportHeight) / nodeHeight) + overscan
    );
    
    // 获取可视区域内的节点
    const viewportNodes = [];
    for (let i = startIndex; i <= endIndex; i++) {
      if (i >= 0 && i < visibleCount) {
        const nodeIndex = this.visibleNodeIndices[i];
        const node = this.getNodeByIndex(nodeIndex);
        if (node) {
          node.offsetTop = i * nodeHeight;
          node.index = i;
          viewportNodes.push(node);
        }
      }
    }
    
    return viewportNodes;
  }
  
  /**
   * 切换节点展开状态
   * @param {Number} id 节点ID
   * @returns {Boolean} 操作是否成功
   */
  toggleNodeExpanded(id) {
    const index = this.nodeIdToIndex.get(id);
    if (index === undefined) return false;
    
    const expanded = this.getNodeState(index, STATE_EXPANDED);
    this.setNodeState(index, STATE_EXPANDED, !expanded);
    
    return true;
  }
  
  /**
   * 设置节点选中状态
   * @param {Number} id 节点ID
   * @param {Boolean} selected 是否选中
   * @returns {Boolean} 操作是否成功
   */
  setNodeSelected(id, selected) {
    const index = this.nodeIdToIndex.get(id);
    if (index === undefined) return false;
    
    this.setNodeState(index, STATE_SELECTED, selected);
    
    return true;
  }
  
  /**
   * 设置节点勾选状态
   * @param {Number} id 节点ID
   * @param {Boolean} checked 是否勾选
   * @returns {Boolean} 操作是否成功
   */
  setNodeChecked(id, checked) {
    const index = this.nodeIdToIndex.get(id);
    if (index === undefined) return false;
    
    this.setNodeState(index, STATE_CHECKED, checked);
    
    // 更新子节点
    this.updateChildrenChecked(index, checked);
    
    // 更新父节点
    this.updateParentChecked(index);
    
    return true;
  }
  
  /**
   * 更新子节点勾选状态
   * @param {Number} index 节点索引
   * @param {Boolean} checked 是否勾选
   */
  updateChildrenChecked(index, checked) {
    const firstChildIndex = this.firstChildIndices[index];
    if (firstChildIndex === 0) return;
    
    // 遍历所有子节点
    let childIndex = firstChildIndex;
    while (childIndex !== 0) {
      // 设置子节点勾选状态
      this.setNodeState(childIndex, STATE_CHECKED, checked);
      this.setNodeState(childIndex, STATE_INDETERMINATE, false);
      
      // 递归更新子节点的子节点
      this.updateChildrenChecked(childIndex, checked);
      
      // 移动到下一个兄弟节点
      childIndex = this.nextSiblingIndices[childIndex];
    }
  }
  
  /**
   * 更新父节点勾选状态
   * @param {Number} index 节点索引
   */
  updateParentChecked(index) {
    const parentId = this.parentIds[index];
    if (parentId === 0) return;
    
    const parentIndex = this.nodeIdToIndex.get(parentId);
    if (parentIndex === undefined) return;
    
    // 获取父节点的所有子节点
    const childIndices = this.getChildIndices(parentIndex);
    
    // 统计子节点勾选状态
    let checkedCount = 0;
    let indeterminateCount = 0;
    
    for (const childIndex of childIndices) {
      if (this.getNodeState(childIndex, STATE_CHECKED)) {
        checkedCount++;
      }
      if (this.getNodeState(childIndex, STATE_INDETERMINATE)) {
        indeterminateCount++;
      }
    }
    
    // 更新父节点状态
    if (checkedCount === 0 && indeterminateCount === 0) {
      // 所有子节点都未勾选
      this.setNodeState(parentIndex, STATE_CHECKED, false);
      this.setNodeState(parentIndex, STATE_INDETERMINATE, false);
    } else if (checkedCount === childIndices.length) {
      // 所有子节点都已勾选
      this.setNodeState(parentIndex, STATE_CHECKED, true);
      this.setNodeState(parentIndex, STATE_INDETERMINATE, false);
    } else {
      // 部分子节点已勾选
      this.setNodeState(parentIndex, STATE_CHECKED, false);
      this.setNodeState(parentIndex, STATE_INDETERMINATE, true);
    }
    
    // 递归更新父节点的父节点
    this.updateParentChecked(parentIndex);
  }
  
  /**
   * 获取节点的所有子节点索引
   * @param {Number} index 节点索引
   * @returns {Array} 子节点索引数组
   */
  getChildIndices(index) {
    const childIndices = [];
    
    let childIndex = this.firstChildIndices[index];
    while (childIndex !== 0) {
      childIndices.push(childIndex);
      childIndex = this.nextSiblingIndices[childIndex];
    }
    
    return childIndices;
  }
  
  /**
   * 搜索节点
   * @param {String} term 搜索词
   * @returns {Object} 搜索结果
   */
  searchNodes(term) {
    if (!term) {
      // 清除所有匹配状态
      for (let i = 0; i < this.nodeCount; i++) {
        this.setNodeState(i, STATE_MATCHED, false);
      }
      
      return { matchCount: 0, matches: [] };
    }
    
    const termLower = term.toLowerCase();
    const matches = [];
    
    // 标记匹配的节点
    for (let i = 0; i < this.nodeCount; i++) {
      const nameId = this.stringData.get(`name_${i}`);
      const titleId = this.stringData.get(`title_${i}`);
      
      const name = this.getString(nameId).toLowerCase();
      const title = this.getString(titleId).toLowerCase();
      
      const isMatch = name.includes(termLower) || title.includes(termLower);
      
      this.setNodeState(i, STATE_MATCHED, isMatch);
      
      if (isMatch) {
        matches.push(this.ids[i]);
      }
    }
    
    // 展开包含匹配节点的路径
    for (const id of matches) {
      this.expandNodePath(id);
    }
    
    // 标记可见性缓存为脏
    this.visibilityDirty = true;
    
    return {
      matchCount: matches.length,
      matches
    };
  }
  
  /**
   * 展开节点路径
   * @param {Number} id 节点ID
   */
  expandNodePath(id) {
    const index = this.nodeIdToIndex.get(id);
    if (index === undefined) return;
    
    let parentId = this.parentIds[index];
    while (parentId !== 0) {
      const parentIndex = this.nodeIdToIndex.get(parentId);
      if (parentIndex === undefined) break;
      
      this.setNodeState(parentIndex, STATE_EXPANDED, true);
      
      parentId = this.parentIds[parentIndex];
    }
  }
  
  /**
   * 获取内存使用情况
   * @returns {Object} 内存使用情况
   */
  getMemoryUsage() {
    // 计算TypedArray内存
    const typedArrayBytes = 
      this.ids.byteLength +
      this.parentIds.byteLength +
      this.firstChildIndices.byteLength +
      this.nextSiblingIndices.byteLength +
      this.levels.byteLength +
      this.states.byteLength +
      this.types.byteLength +
      this.offsetTops.byteLength;
    
    // 估计字符串数据内存
    let stringBytes = 0;
    for (const [, str] of this.stringData) {
      if (typeof str === 'string') {
        stringBytes += str.length * 2; // JavaScript字符串是UTF-16编码，每个字符2字节
      }
    }
    
    // 估计Map内存
    const mapBytes = 
      this.nodeIdToIndex.size * 16 + // 每个键值对约16字节
      this.stringIdMap.size * 16 +
      this.stringData.size * 16;
    
    return {
      typedArrayBytes,
      stringBytes,
      mapBytes,
      totalBytes: typedArrayBytes + stringBytes + mapBytes,
      nodeCount: this.nodeCount,
      visibleNodeCount: this.visibleNodeIndices.length,
      bytesPerNode: this.nodeCount ? Math.round((typedArrayBytes + stringBytes + mapBytes) / this.nodeCount) : 0
    };
  }
} 