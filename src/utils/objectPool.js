/**
 * 对象池工具
 * 用于复用对象，减少内存分配和GC压力
 */

/**
 * 创建对象池
 * @param {Function} factory 创建对象的工厂函数
 * @param {Function} reset 重置对象的函数
 * @param {Number} initialSize 初始池大小
 * @return {Object} 对象池接口
 */
export const createObjectPool = (factory, reset, initialSize = 20) => {
  const pool = [];
  
  // 初始化对象池
  for (let i = 0; i < initialSize; i++) {
    pool.push(factory());
  }
  
  return {
    /**
     * 从池中获取对象
     * @return {Object} 池中对象
     */
    get() {
      if (pool.length > 0) {
        return pool.pop();
      }
      return factory();
    },
    
    /**
     * 将对象归还池中
     * @param {Object} obj 归还的对象
     */
    release(obj) {
      if (obj && typeof reset === 'function') {
        reset(obj);
        pool.push(obj);
      }
    },
    
    /**
     * 获取当前池大小
     * @return {Number} 池大小
     */
    size() {
      return pool.length;
    },
    
    /**
     * 清空对象池
     */
    clear() {
      pool.length = 0;
    },
    
    /**
     * 预热对象池
     * @param {Number} count 预热数量
     */
    warmup(count) {
      for (let i = 0; i < count; i++) {
        pool.push(factory());
      }
    }
  };
};

/**
 * 创建节点对象池
 * @param {Number} initialSize 初始池大小
 * @return {Object} 节点对象池
 */
export const createNodePool = (initialSize = 100) => {
  // 创建节点工厂函数
  const createNode = () => ({
    id: null,
    key: null,
    parentId: null,
    level: 0,
    name: '',
    title: '',
    expanded: false,
    selected: false,
    checked: false,
    matched: false,
    loading: false,
    indeterminate: false,
    isLeaf: false,
    type: '',
    offsetTop: 0,
    index: 0,
    children: null
  });
  
  // 重置节点函数
  const resetNode = (node) => {
    node.id = null;
    node.key = null;
    node.parentId = null;
    node.level = 0;
    node.name = '';
    node.title = '';
    node.expanded = false;
    node.selected = false;
    node.checked = false;
    node.matched = false;
    node.loading = false;
    node.indeterminate = false;
    node.isLeaf = false;
    node.type = '';
    node.offsetTop = 0;
    node.index = 0;
    node.children = null;
  };
  
  return createObjectPool(createNode, resetNode, initialSize);
};

/**
 * 创建DOM元素池
 * @param {String} tagName 标签名
 * @param {Function} setupFn 设置元素的函数
 * @param {Number} initialSize 初始池大小
 * @return {Object} DOM元素池
 */
export const createDOMPool = (tagName, setupFn, initialSize = 50) => {
  // 创建DOM元素工厂函数
  const createEl = () => {
    const el = document.createElement(tagName);
    if (typeof setupFn === 'function') {
      setupFn(el);
    }
    return el;
  };
  
  // 重置DOM元素函数
  const resetEl = (el) => {
    // 移除所有子元素
    while (el.firstChild) {
      el.removeChild(el.firstChild);
    }
    
    // 移除所有属性
    while (el.attributes.length > 0) {
      el.removeAttribute(el.attributes[0].name);
    }
    
    // 重新设置
    if (typeof setupFn === 'function') {
      setupFn(el);
    }
  };
  
  return createObjectPool(createEl, resetEl, initialSize);
};

/**
 * 创建事件对象池
 * @param {Number} initialSize 初始池大小
 * @return {Object} 事件对象池
 */
export const createEventPool = (initialSize = 20) => {
  // 创建事件对象工厂函数
  const createEvent = () => ({
    type: '',
    target: null,
    currentTarget: null,
    bubbles: false,
    cancelable: false,
    defaultPrevented: false,
    timeStamp: 0,
    stopPropagation: () => {},
    preventDefault: () => {},
    data: null
  });
  
  // 重置事件对象函数
  const resetEvent = (event) => {
    event.type = '';
    event.target = null;
    event.currentTarget = null;
    event.bubbles = false;
    event.cancelable = false;
    event.defaultPrevented = false;
    event.timeStamp = 0;
    event.data = null;
  };
  
  return createObjectPool(createEvent, resetEvent, initialSize);
};

/**
 * 创建数组池
 * @param {Number} initialSize 初始池大小
 * @return {Object} 数组池
 */
export const createArrayPool = (initialSize = 20) => {
  // 创建数组工厂函数
  const createArray = () => [];
  
  // 重置数组函数
  const resetArray = (arr) => {
    arr.length = 0;
  };
  
  return createObjectPool(createArray, resetArray, initialSize);
};

/**
 * 创建Map池
 * @param {Number} initialSize 初始池大小
 * @return {Object} Map池
 */
export const createMapPool = (initialSize = 10) => {
  // 创建Map工厂函数
  const createMap = () => new Map();
  
  // 重置Map函数
  const resetMap = (map) => {
    map.clear();
  };
  
  return createObjectPool(createMap, resetMap, initialSize);
};

/**
 * 创建Set池
 * @param {Number} initialSize 初始池大小
 * @return {Object} Set池
 */
export const createSetPool = (initialSize = 10) => {
  // 创建Set工厂函数
  const createSet = () => new Set();
  
  // 重置Set函数
  const resetSet = (set) => {
    set.clear();
  };
  
  return createObjectPool(createSet, resetSet, initialSize);
}; 