/**
 * 节点对象池工具
 * 专门用于复用树节点对象，减少内存分配和GC压力
 */
import { createObjectPool } from './objectPool';

/**
 * 创建节点对象池
 * @param {Number} initialSize 初始池大小
 * @param {Number} maxSize 最大池大小
 * @return {Object} 节点对象池
 */
export const createNodePool = (initialSize = 100, maxSize = 1000) => {
  // 节点对象池
  const nodePool = createObjectPool(
    // 工厂函数 - 创建新节点
    () => ({
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
    }),
    
    // 重置函数 - 重置节点属性
    (node) => {
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
    },
    
    // 初始大小
    initialSize
  );
  
  // 节点映射 - 用于跟踪已分配的节点
  const allocatedNodes = new Map();
  
  // 增强的节点池
  return {
    /**
     * 获取节点
     * @param {String|Number} id 节点ID
     * @param {Object} props 节点属性
     * @return {Object} 节点对象
     */
    get(id, props = {}) {
      // 检查是否已分配
      if (allocatedNodes.has(id)) {
        const node = allocatedNodes.get(id);
        
        // 更新属性
        Object.assign(node, props);
        
        return node;
      }
      
      // 从池中获取新节点
      const node = nodePool.get();
      
      // 设置ID和属性
      node.id = id;
      node.key = id;
      Object.assign(node, props);
      
      // 记录分配
      allocatedNodes.set(id, node);
      
      return node;
    },
    
    /**
     * 释放节点
     * @param {String|Number} id 节点ID
     */
    release(id) {
      if (allocatedNodes.has(id)) {
        const node = allocatedNodes.get(id);
        allocatedNodes.delete(id);
        
        // 如果池未满，归还节点
        if (nodePool.size() < maxSize) {
          nodePool.release(node);
        }
      }
    },
    
    /**
     * 释放所有节点
     */
    releaseAll() {
      // 获取所有分配的节点ID
      const ids = Array.from(allocatedNodes.keys());
      
      // 释放所有节点
      ids.forEach(id => this.release(id));
    },
    
    /**
     * 获取已分配节点数量
     * @return {Number} 已分配节点数量
     */
    getAllocatedCount() {
      return allocatedNodes.size;
    },
    
    /**
     * 获取池大小
     * @return {Number} 池大小
     */
    getPoolSize() {
      return nodePool.size();
    },
    
    /**
     * 获取内存使用情况
     * @return {Object} 内存使用情况
     */
    getMemoryUsage() {
      return {
        allocatedCount: allocatedNodes.size,
        poolSize: nodePool.size(),
        estimatedBytes: allocatedNodes.size * 200 // 每个节点约200字节
      };
    },
    
    /**
     * 预热对象池
     * @param {Number} count 预热数量
     */
    warmup(count) {
      nodePool.warmup(count);
    },
    
    /**
     * 清空对象池
     */
    clear() {
      this.releaseAll();
      nodePool.clear();
    }
  };
}; 