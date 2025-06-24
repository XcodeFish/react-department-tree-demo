/**
 * 虚拟树组件
 * 用于高效渲染大数据量的树形结构
 * @param {Object} props 组件属性
 * @param {Array} props.treeData 树形数据
 * @param {Number} props.height 容器高度
 * @param {Boolean} props.loading 加载状态
 */
import React, { useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect } from 'react';
import { Spin, Input, Empty, Checkbox, Button, Dropdown, Space, Tooltip } from 'antd';
import { 
  SearchOutlined, 
  CheckOutlined, 
  CheckSquareOutlined, 
  BorderOutlined, 
  DownOutlined, 
  TeamOutlined,
  UserOutlined
} from '@ant-design/icons';
import VirtualTreeNode from './VirtualTreeNode';
import { processTreeData, getNodesInViewport, getVisibleNodes } from '../../utils/treeUtils';
import SelectedCounter from './SelectedCounter';
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

  // 使用Worker更新可见节点
  const workerUpdateVisibleNodes = useCallback((scrollTop, priority = 'normal') => {
    if (!workerRef.current || !workerReady) return;
    
    workerRef.current.postMessage({
      type: 'updateVisibleNodes',
      scrollTop,
      viewportHeight: height,
      buffer: Math.ceil(height / NODE_HEIGHT) + 10,
      priority
    });
  }, [height, workerReady]);

  // 使用Worker切换节点展开状态
  const workerToggleNode = useCallback((nodeId, expanded) => {
    if (!workerRef.current || !workerReady) return;
    
    workerRef.current.postMessage({
      type: 'toggleNode',
      nodeId,
      expanded
    });
  }, [workerReady]);

  // 使用Worker执行搜索
  const workerSearch = useCallback((searchTerm) => {
    if (!workerRef.current || !workerReady) return;
    
    workerRef.current.postMessage({
      type: 'search',
      searchTerm
    });
  }, [workerReady]);

  // 监听loading属性变化
  useEffect(() => {
    setIsLoading(loading);
    
    // 当loading结束时，立即高优先级请求可见节点
    if (!loading && workerReady && processedData) {
      workerUpdateVisibleNodes(0, 'high');
    }
  }, [loading, workerReady, processedData, workerUpdateVisibleNodes]);

  // 优化初始数据加载和处理
  useEffect(() => {
    if (!loading && treeData && treeData.length > 0 && processedData) {
      // 数据已加载，立即进行初始处理
      if (performanceMode && workerReady) {
        // Worker已就绪，立即高优先级更新可见节点
        workerUpdateVisibleNodes(scrollTop, 'high');
      } else {
        // 主线程处理，立即更新可见节点
        updateVisibleNodesMainThread();
      }
    }
  }, [loading, treeData, processedData, performanceMode, workerReady, scrollTop, updateVisibleNodesMainThread, workerUpdateVisibleNodes]);

  // 处理Worker消息
  const handleWorkerMessage = useCallback((event) => {
    const { type, ...data } = event.data;
    
    switch (type) {
      case 'initialized':
        setWorkerReady(true);
        setTotalHeight(data.totalHeight || 0);
        // 初始化后更新可见节点
        if (containerRef.current) {
          workerUpdateVisibleNodes(containerRef.current.scrollTop || 0, 'high');
        }
        break;
        
      case 'visibleNodesUpdated':
        setVisibleNodes(data.visibleNodes || []);
        setTotalHeight(data.totalHeight || 0);
        
        // 通知可见节点数量变化
        if (typeof onVisibleNodesChange === 'function') {
          onVisibleNodesChange(data.visibleNodes?.length || 0);
        }
        break;
        
      case 'nodeToggled':
        setTotalHeight(data.totalHeight || 0);
        // 更新节点展开状态
        if (data.nodeId && processedDataRef.current?.nodeMap.has(data.nodeId)) {
          const node = processedDataRef.current.nodeMap.get(data.nodeId);
          node.expanded = data.expanded;
        }
        
        // 更新expandedKeys
        if (data.expanded) {
          setExpandedKeys(prev => prev.includes(data.nodeId) ? prev : [...prev, data.nodeId]);
        } else {
          setExpandedKeys(prev => prev.filter(key => key !== data.nodeId));
        }
        break;
        
      case 'searchComplete':
        setSearchLoading(false);
        // 搜索完成后更新展开键
        if (data.expandedKeys && data.expandedKeys.length > 0) {
          setExpandedKeys(prev => {
            const merged = [...prev, ...data.expandedKeys];
            return [...new Set(merged)]; // 去重
          });
        }
        // 更新匹配的键
        if (data.matchResult) {
          setMatchedKeys(data.matchResult.matches || []);
        }
        break;
        
      default:
        console.log('未处理的Worker消息类型:', type);
    }
  }, [onVisibleNodesChange, workerUpdateVisibleNodes]);

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
    workerUpdateVisibleNodes
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
  loadingText = '加载中...',
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
  const [isLoading, setIsLoading] = useState(loading);
  const [visibleNodes, setVisibleNodes] = useState([]);
  const [expandedKeys, setExpandedKeys] = useState(defaultExpandedKeys || []);
  const [checkedKeys, setCheckedKeys] = useState(defaultCheckedKeys || []);
  const [selectedKeys, setSelectedKeys] = useState(defaultSelectedKeys || []);
  const [matchedKeys, setMatchedKeys] = useState([]);
  const [searchValue, setSearchValue] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);
  const [totalHeight, setTotalHeight] = useState(0);
  const [forceUpdate, setForceUpdate] = useState(0);
  
  // Worker相关状态
  const [workerReady, setWorkerReady] = useState(false);
  const [workerError, setWorkerError] = useState(null);
  
  // ref定义
  const containerRef = useRef(null);
  const processedDataRef = useRef(null);
  const searchTimerRef = useRef(null);
  const workerRef = useRef(null);
  const lastSelectedNodeRef = useRef(null);
  
  // 处理TreeData
  const processedData = useMemo(() => {
    // 使用工具函数扁平化处理树数据
    const result = processTreeData(treeData, {
      defaultExpandAll,
      defaultExpandedKeys: expandedKeys,
      defaultSelectedKeys: selectedKeys,
      defaultCheckedKeys: checkedKeys
    });
    
    // 保存处理结果到ref，以便在回调中访问
    processedDataRef.current = result;
    return result;
  }, [treeData, defaultExpandAll, expandedKeys, selectedKeys, checkedKeys]);
  
  // Worker相关函数
  // 使用Worker更新可见节点
  const workerUpdateVisibleNodes = useCallback((scrollTop, priority = 'normal') => {
    if (!workerRef.current || !workerReady) return;
    
    workerRef.current.postMessage({
      type: 'updateVisibleNodes',
      scrollTop,
      viewportHeight: height,
      buffer: Math.ceil(height / NODE_HEIGHT) + 10,
      priority
    });
  }, [height, workerReady]);
  
  // 使用Worker切换节点展开状态
  const workerToggleNode = useCallback((nodeId, expanded) => {
    if (!workerRef.current || !workerReady) return;
    
    workerRef.current.postMessage({
      type: 'toggleNode',
      nodeId,
      expanded
    });
  }, [workerReady]);
  
  // 使用Worker执行搜索
  const workerSearch = useCallback((searchTerm) => {
    if (!workerRef.current || !workerReady) return;
    
    workerRef.current.postMessage({
      type: 'search',
      searchTerm
    });
  }, [workerReady]);
  
  // 更新Worker中的节点数据
  const workerUpdateNodes = useCallback((nodes) => {
    if (!workerRef.current || !workerReady) return;
    
    workerRef.current.postMessage({
      type: 'updateNodes',
      nodes: Array.isArray(nodes) ? nodes : [nodes]
    });
  }, [workerReady]);
  
  // 处理Worker消息
  const handleWorkerMessage = useCallback((event) => {
    const { type, ...data } = event.data;
    
    switch (type) {
      case 'initialized':
        setWorkerReady(true);
        setTotalHeight(data.totalHeight || 0);
        // 初始化后更新可见节点
        if (containerRef.current) {
          workerUpdateVisibleNodes(containerRef.current.scrollTop || 0, 'high');
        }
        break;
        
      case 'visibleNodesUpdated':
        setVisibleNodes(data.visibleNodes || []);
        setTotalHeight(data.totalHeight || 0);
        
        // 通知可见节点数量变化
        if (typeof onVisibleNodesChange === 'function') {
          onVisibleNodesChange(data.visibleNodes?.length || 0);
        }
        break;
        
      case 'nodeToggled':
        setTotalHeight(data.totalHeight || 0);
        // 更新节点展开状态
        if (data.nodeId && processedDataRef.current?.nodeMap.has(data.nodeId)) {
          const node = processedDataRef.current.nodeMap.get(data.nodeId);
          node.expanded = data.expanded;
        }
        
        // 更新expandedKeys
        if (data.expanded) {
          setExpandedKeys(prev => prev.includes(data.nodeId) ? prev : [...prev, data.nodeId]);
        } else {
          setExpandedKeys(prev => prev.filter(key => key !== data.nodeId));
        }
        break;
        
      case 'searchComplete':
        setSearchLoading(false);
        // 搜索完成后更新展开键
        if (data.expandedKeys && data.expandedKeys.length > 0) {
          setExpandedKeys(prev => {
            const merged = [...prev, ...data.expandedKeys];
            return [...new Set(merged)]; // 去重
          });
        }
        // 更新匹配的键
        if (data.matchResult) {
          setMatchedKeys(data.matchResult.matches || []);
        }
        break;
        
      default:
        console.log('未处理的Worker消息类型:', type);
    }
  }, [onVisibleNodesChange, workerUpdateVisibleNodes]);
  
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
    }
    
    // 组件销毁时终止Worker
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [performanceMode, processedData, handleWorkerMessage]);
  
  // 监听loading属性变化
  useEffect(() => {
    setIsLoading(loading);
    
    // 当loading结束时，立即高优先级请求可见节点
    if (!loading && workerReady && processedData) {
      workerUpdateVisibleNodes(0, 'high');
    }
  }, [loading, workerReady, processedData, workerUpdateVisibleNodes]);
  
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
      // 使用Worker处理展开/折叠
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
    
    // 获取需要处理的节点集合
    const nodesToProcess = new Set([nodeId]);
    
    // 如果有子节点，添加所有子节点
    if (node.children && node.children.length > 0 && processedDataRef.current) {
      const childrenKeys = getChildrenKeys(processedDataRef.current.flattenedData, nodeId);
      childrenKeys.forEach(key => nodesToProcess.add(key));
    }
    
    // 更新选中状态
    setCheckedKeys(prev => {
      let newCheckedKeys = [...prev];
      
      if (checked) {
        // 添加所有需要选中的节点
        nodesToProcess.forEach(id => {
          if (!newCheckedKeys.includes(id)) {
            newCheckedKeys.push(id);
          }
        });
      } else {
        // 移除所有需要取消选中的节点
        newCheckedKeys = newCheckedKeys.filter(id => !nodesToProcess.has(id));
      }
      
      // 触发回调，但不在这里直接修改父节点状态
      if (onCheck && processedDataRef.current) {
        const checkedNodes = newCheckedKeys
          .map(key => processedDataRef.current.nodeMap.get(key))
          .filter(Boolean);
        
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
    
    // 标记当前节点状态变更，后续通过Effect处理级联效果
    if (node) {
      node.checked = checked;
      
      // 延迟处理Worker更新，避免在渲染期间调用
      requestAnimationFrame(() => {
        if (performanceMode && !workerError && workerReady && processedDataRef.current) {
          const nodesToUpdate = [node];
          workerUpdateNodes(nodesToUpdate);
        }
      });
    }
  }, [checkable, getChildrenKeys, onCheck, performanceMode, workerError, workerReady, workerUpdateNodes]);

  // 使用Effect处理复选框级联状态更新
  useEffect(() => {
    // 仅当复选框状态变更时处理
    if (!checkable || !processedDataRef.current) return;
    
    const { flattenedData, nodeMap } = processedDataRef.current;
    
    // 1. 计算所有节点的indeterminate状态
    flattenedData.forEach(node => {
      if (!node.children || node.children.length === 0) return;
      
      const allChildren = node.children;
      const checkedChildren = allChildren.filter(childId => checkedKeys.includes(childId));
      
      // 更新部分选中状态
      if (checkedChildren.length > 0 && checkedChildren.length < allChildren.length) {
        node.indeterminate = true;
      } else {
        node.indeterminate = false;
      }
    });
    
    // 2. 更新Worker
    if (performanceMode && !workerError && workerReady) {
      // 收集所有需要更新的节点
      const indeterminateNodes = flattenedData.filter(node => node.indeterminate);
      if (indeterminateNodes.length > 0) {
        requestAnimationFrame(() => {
          workerUpdateNodes(indeterminateNodes);
        });
      }
    }
    
    // 3. 强制更新视图
    setForceUpdate(prev => prev + 1);
    
  }, [checkable, checkedKeys, performanceMode, workerError, workerReady, workerUpdateNodes]);

  // 新增全选状态
  const [allSelected, setAllSelected] = useState(false);
  
  // 添加清除选择功能
  const handleClearSelection = useCallback(() => {
    setSelectedKeys([]);
    setCheckedKeys([]);
    
    if (onSelect) {
      onSelect([], { selected: false, nodeIds: [] });
    }
    
    if (onCheck) {
      onCheck([], { checked: false, checkedNodes: [] });
    }
  }, [onSelect, onCheck]);
  
  // 全选功能
  const handleSelectAll = useCallback(() => {
    if (!processedDataRef.current) return;
    
    const { flattenedData } = processedDataRef.current;
    
    // 如果当前是搜索状态，只选中匹配的节点
    const nodesToSelect = searchValue 
      ? flattenedData.filter(node => node.matched || node.type === 'user')
      : flattenedData.filter(node => node.type === 'user');
    
    const newKeys = nodesToSelect.map(node => node.key);
    
    setAllSelected(true);
    setCheckedKeys(newKeys);
    
    if (onCheck && newKeys.length > 0) {
      onCheck(newKeys, { 
        checked: true, 
        checkedNodes: nodesToSelect
      });
    }
  }, [searchValue, onCheck]);
  
  // 全不选功能
  const handleDeselectAll = useCallback(() => {
    setAllSelected(false);
    handleClearSelection();
  }, [handleClearSelection]);
  
  // 仅选择部门功能
  const handleSelectOnlyDepartments = useCallback(() => {
    if (!processedDataRef.current) return;
    
    const { flattenedData } = processedDataRef.current;
    const departmentNodes = flattenedData.filter(node => node.type !== 'user');
    const departmentKeys = departmentNodes.map(node => node.key);
    
    setCheckedKeys(departmentKeys);
    
    if (onCheck) {
      onCheck(departmentKeys, { 
        checked: true, 
        checkedNodes: departmentNodes
      });
    }
  }, [onCheck]);
  
  // 仅选择人员功能
  const handleSelectOnlyUsers = useCallback(() => {
    if (!processedDataRef.current) return;
    
    const { flattenedData } = processedDataRef.current;
    const userNodes = flattenedData.filter(node => node.type === 'user');
    const userKeys = userNodes.map(node => node.key);
    
    setCheckedKeys(userKeys);
    
    if (onCheck) {
      onCheck(userKeys, { 
        checked: true, 
        checkedNodes: userNodes
      });
    }
  }, [onCheck]);
  
  // 选中当前可见节点
  const handleSelectVisible = useCallback(() => {
    if (!visibleNodes || visibleNodes.length === 0) return;
    
    const visibleKeys = visibleNodes.map(node => node.key);
    setCheckedKeys(visibleKeys);
    
    if (onCheck) {
      onCheck(visibleKeys, { 
        checked: true, 
        checkedNodes: visibleNodes
      });
    }
  }, [visibleNodes, onCheck]);

  // 批量选择下拉菜单
  const batchSelectionMenu = useMemo(() => {
    return {
      items: [
        {
          key: 'selectAll',
          label: '全选',
          icon: <CheckSquareOutlined />,
        },
        {
          key: 'deselectAll',
          label: '取消全选',
          icon: <BorderOutlined />,
        },
        {
          key: 'selectUsers',
          label: '仅选择人员',
          icon: <UserOutlined />,
        },
        {
          key: 'selectDepartments',
          label: '仅选择部门',
          icon: <TeamOutlined />,
        },
        {
          key: 'selectVisible',
          label: '选择可见节点',
          icon: <CheckOutlined />,
        },
      ],
      onClick: ({ key }) => {
        switch (key) {
          case 'selectAll':
            handleSelectAll();
            break;
          case 'deselectAll':
            handleDeselectAll();
            break;
          case 'selectUsers':
            handleSelectOnlyUsers();
            break;
          case 'selectDepartments':
            handleSelectOnlyDepartments();
            break;
          case 'selectVisible':
            handleSelectVisible();
            break;
          default:
            break;
        }
      },
    };
  }, [handleDeselectAll, handleSelectAll, handleSelectOnlyDepartments, handleSelectOnlyUsers, handleSelectVisible]);

  // 渲染顶部操作栏
  const renderOperations = () => {
    if (!checkable && !multiple) return null;
    
    return (
      <div className="virtual-ant-tree-operations">
        <Space size="small">
          <Dropdown menu={batchSelectionMenu} trigger={['click']}>
            <Button size="small" type="text">
              <Space>
                批量选择
                <DownOutlined />
              </Space>
            </Button>
          </Dropdown>
          
          {(checkedKeys.length > 0 || selectedKeys.length > 0) && (
            <Tooltip title="清除选择">
              <Button 
                size="small" 
                type="text" 
                icon={<BorderOutlined />}
                onClick={handleClearSelection}
              >
                清除
              </Button>
            </Tooltip>
          )}
        </Space>
      </div>
    );
  };

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
              handleSearch({ target: { value: '' } });
            }}
          />
        </div>
      )}
      
      {/* 添加操作栏 */}
      {renderOperations()}
      
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
            
            {/* 添加选中计数器 */}
            {(checkedKeys.length > 0 || selectedKeys.length > 0) && (
              <SelectedCounter 
                count={checkedKeys
                  .filter(key => {
                    // 只统计用户节点
                    const node = processedDataRef.current?.nodeMap.get(key);
                    return node && node.type === 'user';
                  })
                  .length || selectedKeys.length} 
                onClear={handleClearSelection}
                showClearButton={true}
              />
            )}
          </div>
        ) : (
          <Empty description={emptyText} />
        )}
      </Spin>
    </div>
  );
};

export default VirtualAntTree; 