/**
 * 虚拟树组件
 * 用于高效渲染大数据量的树形结构
 * @param {Object} props 组件属性
 * @param {Array} props.treeData 树形数据
 * @param {Number} props.height 容器高度
 * @param {Boolean} props.loading 加载状态
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Spin, Input, Empty, Checkbox } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import VirtualTreeNode from './VirtualTreeNode';
import { processTreeData, getNodesInViewport, getVisibleNodes } from '../../utils/treeUtils';
import './styles.scss';

// 节点高度固定为40px
const NODE_HEIGHT = 40; 

// 获取指定节点的所有子节点键值
const getChildrenKeys = (nodes, nodeId) => {
  const result = [];
  
  const findChildren = (parentId) => {
    nodes.forEach(node => {
      if (node.parentId === parentId) {
        result.push(node.key);
        findChildren(node.key);
      }
    });
  };
  
  findChildren(nodeId);
  return result;
};

// 获取指定节点的所有父节点键值
const getParentKeys = (nodes, nodeId) => {
  const result = [];
  let currentId = nodeId;
  
  while (currentId) {
    const parent = nodes.find(node => node.key === currentId)?.parentId;
    if (parent) {
      result.push(parent);
      currentId = parent;
    } else {
      currentId = null;
    }
  }
  
  return result;
};

// 更新父节点选中状态
const updateParentCheckedState = (nodes, nodeMap, nodeId, checkedKeys) => {
  const updateParentState = (id) => {
    const node = nodes.find(n => n.key === id);
    if (!node || !node.parentId) return;
    
    const parentId = node.parentId;
    const parentNode = nodeMap.get(parentId);
    if (!parentNode) return;
    
    // 获取所有直接子节点
    const childrenNodes = nodes.filter(n => n.parentId === parentId);
    if (childrenNodes.length === 0) return;
    
    // 统计子节点状态
    const checkedChildrenCount = childrenNodes.filter(child => 
      checkedKeys.includes(child.key)
    ).length;
    
    // 更新父节点状态
    if (checkedChildrenCount === 0) {
      // 无子节点选中，父节点未选中且不是半选
      parentNode.checked = false;
      parentNode.indeterminate = false;
      
      // 如果父节点在选中列表中，移除它
      if (checkedKeys.includes(parentId)) {
        const index = checkedKeys.indexOf(parentId);
        if (index > -1) {
          checkedKeys.splice(index, 1);
        }
      }
    } else if (checkedChildrenCount === childrenNodes.length) {
      // 所有子节点选中，父节点选中且不是半选
      parentNode.checked = true;
      parentNode.indeterminate = false;
      
      // 添加父节点到选中列表
      if (!checkedKeys.includes(parentId)) {
        checkedKeys.push(parentId);
      }
    } else {
      // 部分子节点选中，父节点半选
      parentNode.checked = false;
      parentNode.indeterminate = true;
      
      // 如果父节点已选中，移除它
      if (checkedKeys.includes(parentId)) {
        const index = checkedKeys.indexOf(parentId);
        if (index > -1) {
          checkedKeys.splice(index, 1);
        }
      }
    }
    
    // 递归更新上层父节点
    if (parentNode.parentId) {
      updateParentState(parentId);
    }
  };
  
  // 更新当前节点的父节点
  updateParentState(nodeId);
};

// 创建内联Worker函数
const createInlineWorker = (workerFunction) => {
  // 将函数体转换为字符串
  const functionBody = workerFunction.toString();
  // 创建一个自执行函数
  const blob = new Blob([
    `(${functionBody})()`
  ], { type: 'application/javascript' });
  
  return new Worker(URL.createObjectURL(blob));
};

// Worker函数
const workerFunction = () => {
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
        // 添加我们新增的字段，确保它们被传递
        realName: node.realName,
        phone: node.phone,
        userId: node.userId,
        departmentId: node.departmentId,
        departmentName: node.departmentName,
        entryDate: node.entryDate,
        position: node.position,
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
      const nodeRealName = (node.realName || '').toLowerCase();
      const nodePhone = (node.phone || '').toLowerCase();
      const nodeUserId = (node.userId || '').toLowerCase();
      
      const isMatch = 
        nodeTitle.includes(valueLower) || 
        nodeEmail.includes(valueLower) || 
        nodePosition.includes(valueLower) ||
        nodeRealName.includes(valueLower) ||
        nodePhone.includes(valueLower) ||
        nodeUserId.includes(valueLower);
        
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
      case 'INIT_DATA': {
        // 初始化数据
        console.log('Worker初始化数据:', data);
        break;
      }
      
      case 'SEARCH': {
        // 搜索节点
        console.log('Worker搜索节点:', data);
        break;
      }
      
      case 'UPDATE_NODE': {
        // 更新节点状态
        console.log('Worker更新节点状态:', data);
        
        if (data.updatedNodes && Array.isArray(data.updatedNodes)) {
          // 更新节点状态
          data.updatedNodes.forEach(updatedNode => {
            const node = nodeMap.get(updatedNode.key);
            if (node) {
              node.checked = updatedNode.checked;
              node.indeterminate = updatedNode.indeterminate;
            }
          });
          
          // 更新视图中的节点
          self.postMessage({
            type: 'NODE_UPDATED',
            data: {
              updatedNodes: data.updatedNodes
            }
          });
        }
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

      case 'SELECT_NODE': {
        const { nodeId, selected, multiple, currentSelectedKeys } = data;
        let newSelectedKeys;
        
        if (multiple) {
          if (selected) {
            newSelectedKeys = [...currentSelectedKeys, nodeId];
          } else {
            newSelectedKeys = currentSelectedKeys.filter(k => k !== nodeId);
          }
        } else {
          newSelectedKeys = selected ? [nodeId] : [];
        }
        
        self.postMessage({
          type: 'NODE_SELECTED',
          data: { 
            nodeId, 
            selected, 
            selectedKeys: newSelectedKeys 
          }
        });
        break;
      }

      case 'CHECK_NODE': {
        const { nodeId, checked, currentCheckedKeys, nodes } = data;
        let newCheckedKeys;
        
        if (checked) {
          newCheckedKeys = [...currentCheckedKeys, nodeId];
        } else {
          newCheckedKeys = currentCheckedKeys.filter(k => k !== nodeId);
        }
        
        self.postMessage({
          type: 'NODE_CHECKED',
          data: { 
            nodeId, 
            checked, 
            checkedKeys: newCheckedKeys,
            nodes: nodes || []
          }
        });
        
        // 处理级联选择和半选状态更新
        if (data.updatedNodes && Array.isArray(data.updatedNodes)) {
          // 更新节点状态
          data.updatedNodes.forEach(updatedNode => {
            const node = nodes.find(n => n.id === updatedNode.id || n.key === updatedNode.key);
            if (node) {
              node.checked = updatedNode.checked;
              node.indeterminate = updatedNode.indeterminate;
            }
          });
          
          // 更新视图中的节点
          self.postMessage({
            type: 'NODE_UPDATED',
            data: {
              updatedNodes: data.updatedNodes
            }
          });
        }
        break;
      }

      case 'NODE_CHECKED': {
        // 处理节点复选框结果
        console.log(`Worker返回选中结果: 节点${data.nodeId}, checked=${data.checked}, 选中数量=${data.checkedKeys.length}`);
        
        if (data.checkedKeys) {
          setCheckedKeys(data.checkedKeys);
        }
        
        // 处理级联选择和半选状态更新
        if (data.updatedNodes && Array.isArray(data.updatedNodes)) {
          console.log('收到Worker更新:', data.updatedNodes.length, '个节点状态变更');
          
          // 更新节点状态
          data.updatedNodes.forEach(updatedNode => {
            const node = processedDataRef.current?.nodeMap.get(updatedNode.key);
            if (node) {
              node.checked = updatedNode.checked;
              node.indeterminate = updatedNode.indeterminate;
              console.log(`更新节点 ${node.name || node.title} (${updatedNode.key}) 状态: checked=${updatedNode.checked}, indeterminate=${updatedNode.indeterminate}`);
            }
          });
          
          // 强制重新渲染
          setForceUpdate(prev => prev + 1);
          
          // 如果有回调，调用它
          if (onCheck) {
            // 获取所有选中的节点
            const checkedNodes = data.checkedKeys.map(key => {
              return processedDataRef.current?.nodeMap.get(key);
            }).filter(Boolean);
            
            // 调用回调
            onCheck(data.checkedKeys, {
              checkedNodes,
              node: processedDataRef.current?.nodeMap.get(data.nodeId),
              checked: data.checked,
              // 添加flattenedData以便App组件使用
              flattenedData: processedDataRef.current?.flattenedData
            });
          }
        }
        break;
      }

      case 'VISIBLE_NODES_RESULT': {
        // 处理可见节点结果
        console.log(`Worker返回可见节点结果: ${data.visibleNodes?.length || 0}个节点`);
        
        // 更新总高度
        setTotalHeight(data.totalHeight || 0);
        
        // 更新视口内节点
        if (data.visibleNodes && data.visibleNodes.length > 0) {
          updateNodesInViewport(data.visibleNodes);
        } else {
          setVisibleNodes([]);
        }
        
        // 通知可见节点变化
        onVisibleNodesChange && onVisibleNodesChange(data.visibleNodes || []);
        break;
      }
      
      case 'VIEWPORT_NODES_RESULT': {
        // 处理视口内节点结果
        console.log(`Worker返回视口内节点结果: ${data.nodes?.length || 0}个节点`);
        
        // 更新视口内节点
        if (data.nodes && data.nodes.length > 0) {
          setVisibleNodes(data.nodes);
        } else {
          setVisibleNodes([]);
        }
        break;
      }

      case 'searchComplete':
        if (options.onSearchComplete && data.matchResult) {
          options.onSearchComplete(data.matchResult);
        }
        
        // 仅在特定条件下更新可见节点，避免过度刷新
        // 1. 只有当搜索有明确结果时才更新
        // 2. 当清除搜索时只更新一次
        if (options.scrollTop !== undefined) {
          // 使用节流函数避免过度刷新
          const shouldUpdate = 
            // 有明确的匹配结果
            (data.matchResult && data.matchResult.matchCount > 0) || 
            // 明确是清除搜索的操作（搜索结果为0且搜索词为空）
            (data.matchResult && 
             data.matchResult.matchCount === 0 && 
             (!data.matchResult.searchTerm || data.matchResult.searchTerm === ''));
          
          if (shouldUpdate) {
            // 使用requestAnimationFrame延迟更新，避免连续多次更新
            requestAnimationFrame(() => {
              updateVisibleNodes(options.scrollTop);
            });
          }
        }
        break;

      default:
        console.warn('收到未知类型Worker消息:', type);
    }
  };
};

/**
 * 创建Web Worker实例
 * 使用方法：
 * const worker = createTreeWorker();
 * worker.postMessage({type: 'initialize', flattenedData: [...] });
 */
const createTreeWorker = () => {
  try {
    return new Worker('/src/workers/treeWorker.js', { type: 'module' });
  } catch (error) {
    console.error('创建Worker失败:', error);
    return null;
  }
};

/**
 * 自定义Hook: 管理树形组件的Web Worker
 * @param {Object} options Worker配置选项
 * @returns {Object} Worker相关状态和方法
 */
const useTreeWorker = (options) => {
  const { 
    performanceMode, 
    processedData, 
    height,
    nodeHeight = NODE_HEIGHT,
    onVisibleNodesChange
  } = options;

  const workerRef = useRef(null);
  const [workerReady, setWorkerReady] = useState(false);
  const [workerError, setWorkerError] = useState(null);

  // 更新Worker中的可见节点
  const updateVisibleNodes = useCallback((scrollPosition) => {
    if (!workerRef.current || !workerReady) return;
    
    const buffer = Math.ceil(height / nodeHeight) * 2;
    
    workerRef.current.postMessage({
      type: 'updateVisibleNodes',
      scrollTop: scrollPosition,
      viewportHeight: height,
      buffer
    });
  }, [height, nodeHeight, workerReady]);

  // Worker消息处理
  const handleWorkerMessage = useCallback((event) => {
    const { type, ...data } = event.data;
    
    switch (type) {
      case 'initialized':
        setWorkerReady(true);
        if (data.totalHeight && options.onInitialized) {
          options.onInitialized(data.totalHeight);
        }
        // 初始化完成后，请求可见节点
        if (options.scrollTop !== undefined) {
          updateVisibleNodes(options.scrollTop);
        }
        break;
        
      case 'visibleNodesUpdated':
        if (options.onVisibleNodesUpdated) {
          options.onVisibleNodesUpdated(data.visibleNodes || [], data.totalHeight || 0);
        }
        // 通知可见节点数量变化
        if (onVisibleNodesChange && data.visibleNodes) {
          onVisibleNodesChange(data.visibleNodes.length);
        }
        break;
        
      case 'nodeToggled':
        if (options.onNodeToggled) {
          options.onNodeToggled(data.nodeId, data.expanded, data.totalHeight || 0);
        }
        // 更新可见节点
        if (options.scrollTop !== undefined) {
          updateVisibleNodes(options.scrollTop);
        }
        break;
        
      case 'searchComplete':
        if (options.onSearchComplete && data.matchResult) {
          options.onSearchComplete(data.matchResult);
        }
        
        // 仅在特定条件下更新可见节点，避免过度刷新
        // 1. 只有当搜索有明确结果时才更新
        // 2. 当清除搜索时只更新一次
        if (options.scrollTop !== undefined) {
          // 使用节流函数避免过度刷新
          const shouldUpdate = 
            // 有明确的匹配结果
            (data.matchResult && data.matchResult.matchCount > 0) || 
            // 明确是清除搜索的操作（搜索结果为0且搜索词为空）
            (data.matchResult && 
             data.matchResult.matchCount === 0 && 
             (!data.matchResult.searchTerm || data.matchResult.searchTerm === ''));
          
          if (shouldUpdate) {
            // 使用requestAnimationFrame延迟更新，避免连续多次更新
            requestAnimationFrame(() => {
              updateVisibleNodes(options.scrollTop);
            });
          }
        }
        break;
        
      case 'nodesUpdated':
        if (options.onNodesUpdated) {
          options.onNodesUpdated(data.totalHeight || 0);
        }
        // 更新可见节点
        if (options.scrollTop !== undefined) {
          updateVisibleNodes(options.scrollTop);
        }
        break;
      
      default:
        console.warn('收到未知类型Worker消息:', type);
    }
  }, [options, updateVisibleNodes, onVisibleNodesChange]);

  // 初始化Worker
  useEffect(() => {
    if (!performanceMode) return;
    
    try {
      // 创建Worker
      const worker = createTreeWorker();
      
      if (worker) {
        workerRef.current = worker;
        
        // 设置Worker消息处理
        worker.onmessage = handleWorkerMessage;
        worker.onerror = (error) => {
          console.error('Worker错误:', error);
          setWorkerError(error);
          setWorkerReady(false);
          if (options.onWorkerError) {
            options.onWorkerError(error);
          }
        };
        
        // 初始化Worker数据
        if (processedData && processedData.flattenedData && processedData.flattenedData.length > 0) {
          worker.postMessage({
            type: 'initialize',
            flattenedData: processedData.flattenedData
          });
        }
      }
    } catch (error) {
      console.error('初始化Worker失败:', error);
      setWorkerError(error);
      if (options.onWorkerError) {
        options.onWorkerError(error);
      }
    }
    
    // 组件销毁时终止Worker
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [performanceMode, processedData, handleWorkerMessage, options]);

  // 提供Worker方法
  const workerApi = {
    // 切换节点展开状态
    toggleNode: useCallback((nodeId, expanded) => {
      if (!workerRef.current || !workerReady) return;
      workerRef.current.postMessage({
        type: 'toggleNode',
        nodeId,
        expanded
      });
    }, [workerReady]),
    
    // 搜索节点
    search: useCallback((term) => {
      if (!workerRef.current || !workerReady) return;
      workerRef.current.postMessage({
        type: 'search',
        searchTerm: term
      });
    }, [workerReady]),
    
    // 更新节点
    updateNodes: useCallback((nodes) => {
      if (!workerRef.current || !workerReady) return;
      workerRef.current.postMessage({
        type: 'updateNodes',
        updatedNodes: nodes
      });
    }, [workerReady]),
    
    // 更新可见节点
    updateVisibleNodes
  };

  return {
    worker: workerRef.current,
    workerReady,
    workerError,
    ...workerApi
  };
};

const VirtualAntTree = ({
  treeData = [],
  height = 500,
  loading = false,
  performanceMode = true, // 默认启用高性能模式
  showSearch = true,
  searchPlaceholder = '搜索...',
  multiple = false,
  checkable = false,
  emptyText = '暂无数据',
  onSelect,
  onCheck,
  onExpand,
  defaultExpandedKeys = [],
  defaultSelectedKeys = [],
  defaultCheckedKeys = [],
  defaultExpandAll = false,
  selectable = true,
  showIcon = true,
  showLine = false,
  blockNode = true,
  autoExpandParent = true,
  loadData = null,
  onLoad,
  onVisibleNodesChange
}) => {
  // 状态定义
  const [visibleNodes, setVisibleNodes] = useState([]);
  const [searchValue, setSearchValue] = useState('');
  const [scrollTop, setScrollTop] = useState(0);
  const [totalHeight, setTotalHeight] = useState(0);
  const [expandedKeys, setExpandedKeys] = useState(defaultExpandedKeys);
  const [selectedKeys, setSelectedKeys] = useState(defaultSelectedKeys);
  const [checkedKeys, setCheckedKeys] = useState(defaultCheckedKeys);
  const [isLoading, setIsLoading] = useState(loading);
  const [searchLoading, setSearchLoading] = useState(false);
  const [matchedKeys, setMatchedKeys] = useState([]);
  const [forceUpdate, setForceUpdate] = useState(0);

  // Refs
  const containerRef = useRef(null);
  const processedDataRef = useRef(null);
  const lastSelectedNodeRef = useRef(null);
  const searchTimerRef = useRef(null); // 用于debounce搜索

  // 处理树数据
  const processedData = useMemo(() => {
    if (!treeData || treeData.length === 0) return { 
      flattenedData: [], 
      nodeMap: new Map(), 
      visibilityCache: new Map(),
      expandedCount: 0 
    };
    
    const result = processTreeData(treeData, {
      defaultExpandedKeys: expandedKeys,
      defaultSelectedKeys: selectedKeys,
      defaultCheckedKeys: checkedKeys,
      defaultExpandAll
    });
    
    processedDataRef.current = result;
    return result;
  }, [treeData, expandedKeys.length, selectedKeys.length, checkedKeys.length, defaultExpandAll]);

  // 监听loading属性变化
  useEffect(() => {
    setIsLoading(loading);
  }, [loading]);

  // 初始化Worker
  const {
    workerReady,
    workerError,
    toggleNode: workerToggleNode,
    search: workerSearch,
    updateNodes: workerUpdateNodes,
    updateVisibleNodes: workerUpdateVisibleNodes
  } = useTreeWorker({
    performanceMode,
    processedData,
    height,
    scrollTop,
    onVisibleNodesChange,
    onInitialized: (totalHeight) => {
      setTotalHeight(totalHeight);
    },
    onVisibleNodesUpdated: (nodes, totalHeight) => {
      setVisibleNodes(nodes);
      setTotalHeight(totalHeight);
    },
    onNodeToggled: (nodeId, expanded, totalHeight) => {
      setTotalHeight(totalHeight);
      
      // 更新节点展开状态
      if (processedDataRef.current?.nodeMap.has(nodeId)) {
        const node = processedDataRef.current.nodeMap.get(nodeId);
        node.expanded = expanded;
      }
      
      // 更新expandedKeys
      if (expanded) {
        setExpandedKeys(prev => prev.includes(nodeId) ? prev : [...prev, nodeId]);
      } else {
        setExpandedKeys(prev => prev.filter(key => key !== nodeId));
      }
    },
    onSearchComplete: (result) => {
      setMatchedKeys(result.matches || []);
      setSearchLoading(false);
    },
    onNodesUpdated: (totalHeight) => {
      setTotalHeight(totalHeight);
    },
    onWorkerError: (error) => {
      console.error('Worker错误:', error);
    }
  });

  // 主线程更新可见节点
  const updateVisibleNodesMainThread = useCallback(() => {
    const { flattenedData, visibilityCache } = processedDataRef.current || processedData;
    
    // 获取可见节点
    const vNodes = getVisibleNodes(flattenedData, { 
      expandedKeys,
      visibilityCache
    });
    
    // 更新总高度
    setTotalHeight(vNodes.length * NODE_HEIGHT);
    
    // 更新视口内节点
    updateNodesInViewport(vNodes);
  }, [expandedKeys, processedData]);
  
  // 更新视口内需要渲染的节点
  const updateNodesInViewport = useCallback((vNodes) => {
    if (!containerRef.current) return;
    
    const currentScrollTop = containerRef.current.scrollTop;
    
    if (performanceMode && !workerError && workerReady) {
      workerUpdateVisibleNodes(currentScrollTop);
    } else {
      const nodes = getNodesInViewport(vNodes, {
        scrollTop: currentScrollTop,
        viewportHeight: height,
        nodeHeight: NODE_HEIGHT,
        overscan: 10
      });
      
      setVisibleNodes(nodes);
    }
  }, [performanceMode, height, workerError, workerReady, workerUpdateVisibleNodes]);
  
  // 处理滚动事件
  const handleScroll = useCallback((e) => {
    const newScrollTop = e.target.scrollTop;
    setScrollTop(newScrollTop);

    // 使用requestAnimationFrame优化滚动性能
    requestAnimationFrame(() => {
      if (performanceMode && !workerError && workerReady) {
        workerUpdateVisibleNodes(newScrollTop);
      } else {
        // 主线程计算可见节点
        if (processedDataRef.current) {
          const { flattenedData, visibilityCache } = processedDataRef.current;
          
          const vNodes = getVisibleNodes(flattenedData, { 
            expandedKeys,
            visibilityCache 
          });
          
          const nodes = getNodesInViewport(vNodes, {
            scrollTop: newScrollTop,
            viewportHeight: height,
            nodeHeight: NODE_HEIGHT,
            overscan: 10
          });
          
          setVisibleNodes(nodes);
        }
      }
    });
  }, [expandedKeys, height, performanceMode, workerError, workerReady, workerUpdateVisibleNodes]);
  
  // 处理节点展开/折叠
  const handleToggle = useCallback((nodeId) => {
    const node = processedDataRef.current?.nodeMap.get(nodeId);
    if (!node) return;

    const newExpandedState = !node.expanded;
    
    // 更新本地状态
    node.expanded = newExpandedState;
    
    // 使用Worker处理或主线程处理
    if (performanceMode && !workerError && workerReady) {
      workerToggleNode(nodeId, newExpandedState);
    } else {
      // 主线程处理展开/折叠
      if (newExpandedState) {
        setExpandedKeys(prev => prev.includes(nodeId) ? prev : [...prev, nodeId]);
      } else {
        setExpandedKeys(prev => prev.filter(key => key !== nodeId));
      }
      
      // 更新可见节点
      updateVisibleNodesMainThread();
    }
    
    // 触发回调
    if (onExpand) {
      onExpand(
        newExpandedState ? 
          [...expandedKeys, nodeId].filter((v, i, a) => a.indexOf(v) === i) : 
          expandedKeys.filter(k => k !== nodeId),
        { 
          expanded: newExpandedState, 
          node: processedDataRef.current?.nodeMap.get(nodeId) 
        }
      );
    }
  }, [expandedKeys, onExpand, performanceMode, updateVisibleNodesMainThread, workerError, workerReady, workerToggleNode]);
  
  // 处理搜索
  const handleSearch = useCallback((e) => {
    const value = typeof e === 'string' ? e : e.target.value;
    
    // 避免相同值的重复设置
    if (value === searchValue) return;
    
    setSearchValue(value);
    
    if (value) {
      setSearchLoading(true);
    } else {
      setSearchLoading(false);
    }
    
    // 使用debounce延迟执行搜索（通过闭包保存上一个定时器ID）
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }
    
    searchTimerRef.current = setTimeout(() => {
      // 处理搜索操作
      const searchAction = () => {
        if (performanceMode && !workerError && workerReady) {
          workerSearch(value);
        } else {
          // 主线程处理搜索
          if (processedDataRef.current) {
            const { flattenedData, visibilityCache } = processedDataRef.current;
            
            // 清除之前的匹配状态
            flattenedData.forEach(node => {
              node.matched = false;
            });
            
            // 如果有搜索词，标记匹配的节点并展开路径
            if (value) {
              const lowerValue = value.toLowerCase();
              const matchedNodeIds = [];
              
              // 查找匹配的节点
              flattenedData.forEach(node => {
                const nodeTitle = (node.title || node.name || '').toLowerCase();
                const nodeEmail = (node.email || '').toLowerCase();
                const nodePosition = (node.position || '').toLowerCase();
                const nodeRealName = (node.realName || '').toLowerCase();
                
                if (
                  nodeTitle.includes(lowerValue) ||
                  nodeEmail.includes(lowerValue) ||
                  nodePosition.includes(lowerValue) ||
                  nodeRealName.includes(lowerValue)
                ) {
                  node.matched = true;
                  matchedNodeIds.push(node.id);
                }
              });
              
              // 展开匹配节点的父路径
              if (matchedNodeIds.length > 0) {
                const newExpandedKeys = [...expandedKeys];
                
                matchedNodeIds.forEach(nodeId => {
                  let currentNode = flattenedData.find(n => n.id === nodeId);
                  while (currentNode && currentNode.parentId) {
                    const parentNode = flattenedData.find(n => n.id === currentNode.parentId);
                    if (parentNode) {
                      parentNode.expanded = true;
                      if (!newExpandedKeys.includes(parentNode.id)) {
                        newExpandedKeys.push(parentNode.id);
                      }
                      currentNode = parentNode;
                    } else {
                      break;
                    }
                  }
                });
                
                // 更新展开的节点集合
                setExpandedKeys(newExpandedKeys);
              }
            }
            
            // 清除可见性缓存
            visibilityCache.clear();
            
            // 计算新的可见节点
            const vNodes = getVisibleNodes(flattenedData, { 
              expandedKeys,
              visibilityCache 
            });
            
            // 更新高度
            setTotalHeight(vNodes.length * NODE_HEIGHT);
            
            // 更新视图内节点
            if (containerRef.current) {
              const nodes = getNodesInViewport(vNodes, {
                scrollTop: containerRef.current.scrollTop || 0,
                viewportHeight: height,
                nodeHeight: NODE_HEIGHT,
                overscan: 10
              });
              
              setVisibleNodes(nodes);
            }
            
            // 更新搜索状态
            setSearchLoading(false);
          }
        }
      };
      
      // 使用React 18的并发特性降低UI阻塞风险
      if (typeof React.startTransition === 'function') {
        React.startTransition(searchAction);
      } else {
        searchAction();
      }
    }, 300); // 300ms延迟，防止快速输入时频繁触发搜索
    
  }, [
    searchValue, 
    performanceMode, 
    workerError, 
    workerReady, 
    workerSearch, 
    expandedKeys, 
    height
  ]);
  
  // 处理节点异步加载
  const handleLoadData = useCallback(async (node) => {
    if (!loadData || node.loaded || node.isLeaf) {
      return;
    }

    // 更新加载状态
    const currentNode = processedDataRef.current?.nodeMap.get(node.key);
    if (currentNode) {
      currentNode.loading = true;

      // 更新当前可见节点的加载状态
      setVisibleNodes(prev =>
        prev.map(n => n.key === node.key ? { ...n, loading: true } : n)
      );
    }

    try {
      const childNodes = await loadData(node);

      if (Array.isArray(childNodes) && childNodes.length > 0) {
        // 扁平化新子节点
        const { flattenedData: newNodes } = processTreeData(childNodes);

        // 设置parent关联
        newNodes.forEach(childNode => {
          childNode.parentId = node.key;
          childNode.level = (currentNode?.level || 0) + 1;
          processedDataRef.current?.nodeMap.set(childNode.key, childNode);
        });

        // 更新当前节点
        if (currentNode) {
          currentNode.children = newNodes.map(n => n.key);
          currentNode.isLeaf = false;
          currentNode.expanded = true;
          currentNode.loaded = true;
          currentNode.loading = false;

          // 通知Worker更新数据
          if (performanceMode && !workerError && workerReady) {
            workerUpdateNodes([currentNode, ...newNodes]);
          }
        }
        
        // 触发回调
        if (onLoad) {
          onLoad(childNodes, node);
        }
      }
    } catch (error) {
      console.error('加载子节点失败:', error);
    } finally {
      // 更新加载状态
      if (currentNode) {
        currentNode.loading = false;
        currentNode.loaded = true;

        // 强制更新视图
        if (performanceMode && !workerError && workerReady) {
          workerUpdateVisibleNodes(scrollTop);
        } else {
          // 主线程处理
          updateVisibleNodesMainThread();
        }
      }
    }
  }, [loadData, onLoad, performanceMode, scrollTop, updateVisibleNodesMainThread, workerError, workerReady, workerUpdateNodes, workerUpdateVisibleNodes]);

  // 处理节点选择
  const handleSelect = useCallback((nodeId) => {
    const node = processedDataRef.current?.nodeMap.get(nodeId);
    if (!node) return;

    // 更新选中状态
    if (multiple) {
      // 多选模式
      setSelectedKeys(prev => {
        const isSelected = prev.includes(nodeId);
        if (isSelected) {
          // 如果已选中，则移除
          const result = prev.filter(id => id !== nodeId);
          onSelect && onSelect(result, { selected: false, nodeIds: [nodeId], node });
          return result;
        } else {
          // 如果未选中，则添加
          const result = [...prev, nodeId];
          onSelect && onSelect(result, { selected: true, nodeIds: [nodeId], node });
          return result;
        }
      });
    } else {
      // 单选模式
      setSelectedKeys([nodeId]);
      onSelect && onSelect([nodeId], { node, selected: true });
    }
    
    // 记录最后选择的节点
    lastSelectedNodeRef.current = node;
  }, [multiple, onSelect]);

  // 处理节点复选框选中
  const handleCheck = useCallback((nodeId, checked) => {
    if (!checkable) return;
    
    const node = processedDataRef.current?.nodeMap.get(nodeId);
    if (!node) return;
    
    // 更新选中状态
    setCheckedKeys(prev => {
      let newCheckedKeys;
      
      if (checked) {
        // 选中节点
        newCheckedKeys = [...prev, nodeId];
      } else {
        // 取消选中
        newCheckedKeys = prev.filter(id => id !== nodeId);
      }
      
      // 处理级联选择
      if (node.children && node.children.length > 0) {
        // 如果有子节点，递归处理子节点
        const childrenKeys = getChildrenKeys(processedDataRef.current.flattenedData, nodeId);
        
        if (checked) {
          // 选中所有子节点
          childrenKeys.forEach(key => {
            if (!newCheckedKeys.includes(key)) {
              newCheckedKeys.push(key);
            }
          });
        } else {
          // 取消选中所有子节点
          newCheckedKeys = newCheckedKeys.filter(key => !childrenKeys.includes(key));
        }
      }
      
      // 处理父节点选中状态
      if (node.parentId) {
        updateParentCheckedState(
          processedDataRef.current.flattenedData, 
          processedDataRef.current.nodeMap, 
          nodeId, 
          newCheckedKeys
        );
      }
      
      // 触发回调
      if (onCheck) {
        const checkedNodes = newCheckedKeys.map(key => 
          processedDataRef.current?.nodeMap.get(key)
        ).filter(Boolean);
        
        onCheck(newCheckedKeys, {
          checked,
          checkedNodes,
          node,
          event: 'check',
          halfCheckedKeys: []
        });
      }
      
      return newCheckedKeys;
    });
    
    // 更新节点状态
    if (node) {
      node.checked = checked;
      
      // 如果有Worker，通知更新节点
      if (performanceMode && !workerError && workerReady) {
        workerUpdateNodes([node]);
      }
    }
  }, [checkable, performanceMode, workerError, workerReady, workerUpdateNodes, onCheck]);

  // 渲染虚拟节点
  const renderVirtualNode = (node) => {
    if (!node) return null;
    
    return (
      <VirtualTreeNode
        key={node.key}
        node={node}
        checkable={checkable}
        multiple={multiple}
        searchValue={searchValue}
        onExpand={handleToggle}
        onCheck={handleCheck}
        onSelect={handleSelect}
        showIcon={showIcon}
        showLine={showLine}
        blockNode={blockNode}
        selectable={selectable}
      />
    );
  };

  return (
    <div className="virtual-ant-tree-container">
      {showSearch && (
        <div className="virtual-ant-tree-search">
          <Input
            placeholder={searchPlaceholder}
            prefix={<SearchOutlined />}
            value={searchValue}
            onChange={handleSearch}
            onPressEnter={handleSearch}
            allowClear
            onClear={() => {
              // 直接调用handleSearch传入空字符串
              handleSearch('');
            }}
            {...(searchLoading ? { loading: true } : {})}
          />
        </div>
      )}
      
      <Spin spinning={!!isLoading}>
        {treeData && treeData.length > 0 ? (
          <div 
            className="virtual-ant-tree-viewport"
            style={{ height }}
            ref={containerRef}
            onScroll={handleScroll}
          >
            <div 
              className="virtual-ant-tree-content"
              style={{ height: totalHeight }}
            >
              {visibleNodes.map(node => (
                <div
                  key={node.key}
                  className="virtual-ant-tree-node-wrapper"
                  style={{
                    position: 'absolute',
                    top: node.offsetTop,
                    width: '100%',
                    height: NODE_HEIGHT
                  }}
                >
                  {renderVirtualNode(node)}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <Empty description={emptyText} />
        )}
      </Spin>
      
      {/* 底部状态栏 */}
      {checkable && (
        <div className="virtual-ant-tree-footer">
          <span className="virtual-ant-tree-footer-text">
            已选: {checkedKeys.filter(key => {
              const node = processedDataRef.current?.nodeMap.get(key);
              return node && node.type === 'user';
            }).length}
          </span>
        </div>
      )}
    </div>
  );
};

export default VirtualAntTree; 