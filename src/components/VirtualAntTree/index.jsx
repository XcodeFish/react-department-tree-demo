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

      default:
        console.warn('收到未知类型Worker消息:', type);
    }
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
  const [workerError, setWorkerError] = useState(false);
  const [isLoading, setIsLoading] = useState(loading);
  const [searchLoading, setSearchLoading] = useState(false);
  const [matchedKeys, setMatchedKeys] = useState([]);
  const [forceUpdate, setForceUpdate] = useState(0);

  // Refs
  const containerRef = useRef(null);
  const workerRef = useRef(null);
  const processedDataRef = useRef(null);
  const lastSelectedNodeRef = useRef(null);

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
    
    if (performanceMode && workerRef.current && !workerError) {
      workerRef.current.postMessage({
        type: 'GET_VIEWPORT_NODES',
        data: {
          visibleNodes: vNodes,
          scrollOptions: {
            scrollTop: currentScrollTop,
            viewportHeight: height,
            nodeHeight: NODE_HEIGHT,
            overscan: 10
          }
        }
      });
    } else {
      const nodes = getNodesInViewport(vNodes, {
        scrollTop: currentScrollTop,
        viewportHeight: height,
        nodeHeight: NODE_HEIGHT,
        overscan: 10
      });
      
      setVisibleNodes(nodes);
    }
  }, [performanceMode, height, workerError]);
  
  // 更新可见节点
  const updateVisibleNodes = useCallback(() => {
    if (performanceMode && workerRef.current && !workerError) {
      // 使用Worker更新
      if (!processedDataRef.current) {
        // 如果数据还未准备好，不发送消息
        return;
      }
      workerRef.current.postMessage({
        type: 'GET_VISIBLE_NODES',
        data: {
          nodes: processedDataRef.current.flattenedData || [],
          expandedKeys
        }
      });
    } else {
      // 主线程更新
      updateVisibleNodesMainThread();
    }
  }, [performanceMode, expandedKeys, updateVisibleNodesMainThread, workerError]);
  
  // 初始化Worker
  const initWorker = useCallback(() => {
    if (!performanceMode) return;

    try {
      const worker = new Worker(new URL('../../workers/treeWorker.js', import.meta.url), { type: 'module' });
      
      // 设置消息处理
      worker.onmessage = (e) => {
        const { type, data } = e.data;
        
        // 根据消息类型处理
        switch (type) {
          case 'INIT_COMPLETE': {
            // Worker初始化完成
            console.log('Worker初始化完成');
            break;
          }
          
          case 'SEARCH_RESULT': {
            // 搜索结果返回
            console.log(`Worker搜索结果: 关键词"${data.keyword}", 匹配${data.matchedKeys.length}个节点, 展开${data.expandedKeys.length}个节点`);
            
            // 更新匹配结果
            setMatchedKeys(data.matchedKeys);
            
            // 更新展开节点
            setExpandedKeys(prev => [...new Set([...prev, ...data.expandedKeys])]);
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
          
          default:
            console.warn('收到未知类型Worker消息:', type);
        }
      };
      
      // 设置错误处理
      worker.onerror = (err) => {
        console.error('Worker错误:', err);
        setWorkerError(true);
      };
      
      // 保存Worker引用
      workerRef.current = worker;
      
      // 初始化数据
      if (treeData && treeData.length > 0) {
        worker.postMessage({
          type: 'INIT_DATA',
          data: { treeData }
        });
      }
    } catch (err) {
      console.error('初始化Worker失败:', err);
      setWorkerError(true);
    }
  }, [performanceMode, treeData]);
  
  // 处理滚动事件
  const handleScroll = useCallback((e) => {
    setScrollTop(e.target.scrollTop);
    
    // 使用 requestAnimationFrame 优化滚动性能
    requestAnimationFrame(() => {
      if (processedDataRef.current) {
        const { flattenedData, visibilityCache } = processedDataRef.current;
        
        if (performanceMode && workerRef.current && !workerError) {
          // 使用Worker计算可见节点
          const vNodes = getVisibleNodes(flattenedData, { 
            expandedKeys,
            visibilityCache
          });
          
          updateNodesInViewport(vNodes);
        } else {
          // 主线程计算可见节点
          const vNodes = getVisibleNodes(flattenedData, { 
            expandedKeys,
            visibilityCache 
          });
          
          const nodes = getNodesInViewport(vNodes, {
            scrollTop: e.target.scrollTop,
            viewportHeight: height,
            nodeHeight: NODE_HEIGHT,
            overscan: 10
          });
          
          setVisibleNodes(nodes);
        }
      }
    });
  }, [expandedKeys, height, performanceMode, updateNodesInViewport, workerError]);
  
  // 处理节点展开/折叠
  const handleExpand = useCallback((key, expanded) => {
    // 更新展开状态
    setExpandedKeys(prev => {
      if (expanded) {
        return [...prev, key];
      } else {
        return prev.filter(k => k !== key);
      }
    });
    
    // 更新节点数据
    if (processedDataRef.current) {
      const { nodeMap } = processedDataRef.current;
      const node = nodeMap.get(key);
      
      if (node) {
        node.expanded = expanded;
      }
    }
    
    // 调用回调
    onExpand && onExpand(key, { expanded, node: processedDataRef.current?.nodeMap.get(key) });
    
    // 更新可见节点
    updateVisibleNodes();
  }, [onExpand, updateVisibleNodes]);
  
  // 处理节点选择
  const handleSelect = useCallback((key, selected) => {
    if (!selectable) return;
    
    const node = processedDataRef.current?.nodeMap.get(key);
    if (!node) return;
    
    // 更新节点选中状态
    node.selected = selected;
    lastSelectedNodeRef.current = node;
    
    // 如果是用户节点，同时更新复选框状态
    if (node.type === 'user' && checkable) {
      node.checked = selected;
      // 更新复选框状态
      if (selected) {
        setCheckedKeys(prev => prev.includes(key) ? prev : [...prev, key]);
      } else {
        setCheckedKeys(prev => prev.filter(k => k !== key));
      }
    }
    
    if (performanceMode && workerRef.current && !workerError) {
      // 使用Worker处理选择逻辑
      workerRef.current.postMessage({
        type: 'SELECT_NODE',
        data: {
          nodeId: key,
          selected,
          multiple,
          currentSelectedKeys: selectedKeys
        }
      });
    } else {
      // 主线程处理选择逻辑
      if (multiple) {
        // 多选模式
        setSelectedKeys(prev => {
          if (selected) {
            return [...prev, key];
          } else {
            return prev.filter(k => k !== key);
          }
        });
      } else {
        // 单选模式
        setSelectedKeys(selected ? [key] : []);
      }
    }
    
    // 调用回调
    if (onSelect) {
      const newSelectedKeys = multiple 
        ? (selected ? [...selectedKeys, key] : selectedKeys.filter(k => k !== key))
        : (selected ? [key] : []);
        
      onSelect(newSelectedKeys, { 
        selected, 
        node,
        nativeEvent: null, // 兼容Ant Design Tree的回调格式
        selectedNodes: newSelectedKeys.map(k => processedDataRef.current?.nodeMap.get(k)).filter(Boolean)
      });
    }
  }, [multiple, onSelect, selectedKeys, selectable, performanceMode, workerError, checkable]);
  
  // 处理节点复选框
  const handleCheck = useCallback((key, checked) => {
    if (!checkable) return;
    
    console.log(`handleCheck调用: 节点 ${key}, 设置checked=${checked}`);
    
    const node = processedDataRef.current?.nodeMap.get(key);
    if (!node) return;
    
    // 更新节点复选框状态
    node.checked = checked;
    node.indeterminate = false;
    
    if (performanceMode && workerRef.current && !workerError) {
      // 使用Worker处理复选框逻辑
      workerRef.current.postMessage({
        type: 'CHECK_NODE',
        data: {
          nodeId: key,
          checked,
          currentCheckedKeys: checkedKeys,
          nodes: processedDataRef.current?.flattenedData || [] // 发送所有节点数据以支持级联选择
        }
      });
    } else {
      // 主线程处理复选框逻辑
      const { flattenedData, nodeMap } = processedDataRef.current || {};
      let newCheckedKeys = [...checkedKeys];
      
      if (checked) {
        // 添加当前节点
        if (!newCheckedKeys.includes(key)) {
          newCheckedKeys.push(key);
        }
        
        // 如果是部门节点，级联选择所有子节点
        if (node.type === 'department') {
          const childrenKeys = getChildrenKeys(flattenedData, key);
          childrenKeys.forEach(childKey => {
            if (!newCheckedKeys.includes(childKey)) {
              newCheckedKeys.push(childKey);
            }
            // 更新子节点状态
            const childNode = nodeMap.get(childKey);
            if (childNode) {
              childNode.checked = true;
              childNode.indeterminate = false;
            }
          });
        }
      } else {
        // 移除当前节点
        newCheckedKeys = newCheckedKeys.filter(k => k !== key);
        
        // 如果是部门节点，级联取消所有子节点
        if (node.type === 'department') {
          const childrenKeys = getChildrenKeys(flattenedData, key);
          newCheckedKeys = newCheckedKeys.filter(k => !childrenKeys.includes(k));
          
          // 更新子节点状态
          childrenKeys.forEach(childKey => {
            const childNode = nodeMap.get(childKey);
            if (childNode) {
              childNode.checked = false;
              childNode.indeterminate = false;
            }
          });
        }
      }
      
      // 更新父节点状态
      if (node.parentId) {
        updateParentCheckedState(flattenedData, nodeMap, key, newCheckedKeys);
      }
      
      // 更新视图
      setCheckedKeys(newCheckedKeys);
      
      // 为确保视图更新，强制刷新可见节点
      setVisibleNodes(prev => {
        // 创建包含更新后状态的新数组
        return prev.map(vNode => {
          // 如果节点在nodeMap中有更新，则应用新状态
          const updatedNode = nodeMap.get(vNode.key);
          if (updatedNode) {
            return {
              ...vNode,
              checked: updatedNode.checked,
              indeterminate: updatedNode.indeterminate
            };
          }
          return vNode;
        });
      });
      
      // 触发回调
      if (onCheck) {
        onCheck(newCheckedKeys, {
          checkedNodes: newCheckedKeys.map(k => nodeMap.get(k)).filter(Boolean),
          node,
          checked
        });
      }
    }
  }, [checkable, checkedKeys, onCheck, performanceMode, workerError]);
  
  // 处理搜索
  const handleSearch = useCallback((e) => {
    const value = e.target.value;
    setSearchValue(value);
    
    if (value) {
      setSearchLoading(true);
    }
    
    if (performanceMode && workerRef.current && !workerError) {
      // 使用Worker搜索
      workerRef.current.postMessage({
        type: 'SEARCH_NODES',
        data: {
          nodes: processedDataRef.current?.flattenedData || [],
          searchValue: value
        }
      });
    } else {
      // 主线程搜索
      const { flattenedData, nodeMap } = processedDataRef.current || processedData;
      
      if (value) {
        // 匹配节点
        const valueLower = value.toLowerCase();
        const matchingKeys = new Set();
        
        flattenedData.forEach(node => {
          const nodeTitle = (node.title || node.name || '').toLowerCase();
          const nodeEmail = (node.email || '').toLowerCase();
          const nodePosition = (node.position || '').toLowerCase();
          const nodeRealName = (node.realName || '').toLowerCase();
          const nodePhone = (node.phone || '').toLowerCase();
          const nodeUserId = (node.userId || '').toLowerCase();
          
          if (
            nodeTitle.includes(valueLower) || 
            nodeEmail.includes(valueLower) || 
            nodePosition.includes(valueLower) ||
            nodeRealName.includes(valueLower) ||
            nodePhone.includes(valueLower) ||
            nodeUserId.includes(valueLower)
          ) {
            matchingKeys.add(node.key);
            node.matched = true;
            
            // 展开匹配节点的所有父节点
            let parentId = node.parentId;
            while (parentId) {
              const parentNode = nodeMap.get(parentId);
              if (parentNode) {
                parentNode.expanded = true;
                setExpandedKeys(prev => 
                  prev.includes(parentId) ? prev : [...prev, parentId]
                );
                parentId = parentNode.parentId;
              } else {
                break;
              }
            }
          } else {
            node.matched = false;
          }
        });
      } else {
        // 清除搜索标记
        flattenedData.forEach(node => {
          node.matched = false;
        });
      }
      
      // 更新可见节点
      setSearchLoading(false);
      updateVisibleNodesMainThread();
    }
  }, [performanceMode, processedData, updateVisibleNodesMainThread, workerError]);
  
  // 处理清除搜索
  const handleClearSearch = useCallback(() => {
    setSearchValue('');
    setSearchLoading(false);
    
    if (performanceMode && workerRef.current && !workerError) {
      workerRef.current.postMessage({
        type: 'SEARCH_NODES',
        data: {
          nodes: processedDataRef.current?.flattenedData || [],
          searchValue: ''
        }
      });
    } else {
      // 清除搜索标记
      if (processedDataRef.current) {
        processedDataRef.current.flattenedData.forEach(node => {
          node.matched = false;
        });
      }
      updateVisibleNodesMainThread();
    }
  }, [performanceMode, updateVisibleNodesMainThread, workerError]);

  // 监听props变化
  useEffect(() => {
    setIsLoading(loading);
  }, [loading]);

  // 监听选中状态变化
  useEffect(() => {
    if (processedDataRef.current) {
      const { nodeMap } = processedDataRef.current;
      
      // 更新节点选中状态
      selectedKeys.forEach(key => {
        const node = nodeMap.get(key);
        if (node) {
          node.selected = true;
        }
      });
      
      // 清除未选中节点的选中状态
      nodeMap.forEach(node => {
        if (!selectedKeys.includes(node.id || node.key)) {
          node.selected = false;
        }
      });
    }
  }, [selectedKeys]);

  // 监听复选框状态变化
  useEffect(() => {
    if (processedDataRef.current) {
      const { nodeMap } = processedDataRef.current;
      
      // 更新节点复选框状态
      checkedKeys.forEach(key => {
        const node = nodeMap.get(key);
        if (node) {
          node.checked = true;
        }
      });
      
      // 清除未选中节点的复选框状态
      nodeMap.forEach(node => {
        if (!checkedKeys.includes(node.id || node.key)) {
          node.checked = false;
        }
      });
    }
  }, [checkedKeys]);

  // 监听展开状态变化
  useEffect(() => {
    if (processedDataRef.current) {
      const { nodeMap } = processedDataRef.current;
      
      // 更新节点展开状态
      expandedKeys.forEach(key => {
        const node = nodeMap.get(key);
        if (node) {
          node.expanded = true;
        }
      });
      
      // 清除未展开节点的展开状态
      nodeMap.forEach(node => {
        if (!expandedKeys.includes(node.id || node.key)) {
          // 保留默认展开的根节点
          if (!(node.level === 0 && defaultExpandAll)) {
            node.expanded = false;
          }
        }
      });
      
      // 更新可见节点
      updateVisibleNodes();
    }
  }, [expandedKeys]);

  // 初始化Worker
  useEffect(() => {
    if (performanceMode && !workerError) {
      initWorker();
      
      return () => {
        // 清理Worker
        if (workerRef.current) {
          workerRef.current.terminate();
          workerRef.current = null;
        }
      };
    } else {
      // 主线程处理
      processTreeData();
    }
  }, [performanceMode, workerError, initWorker]);

  // 初始化加载数据后更新可见节点
  useEffect(() => {
    if (treeData && treeData.length > 0 && !loading) {
      // 如果使用Worker模式，需要初始化数据
      if (performanceMode && workerRef.current && !workerError) {
        workerRef.current.postMessage({
          type: 'INIT_DATA',
          data: { treeData }
        });
      }
      
      // 主线程处理可见节点
      updateVisibleNodesMainThread();
    }
  }, [treeData, loading, performanceMode, workerError, updateVisibleNodesMainThread]);

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
        onExpand={handleExpand}
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
            onClear={handleClearSearch}
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