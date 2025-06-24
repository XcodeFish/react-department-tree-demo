/**
 * 虚拟树组件
 * 用于高效渲染大数据量的树形结构
 * @param {Object} props 组件属性
 * @param {Array} props.treeData 树形数据
 * @param {Number} props.height 容器高度
 * @param {Boolean} props.loading 加载状态
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Spin, Input, Empty } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import VirtualTreeNode from './VirtualTreeNode';
import { processTreeData, getNodesInViewport, getVisibleNodes } from '../../utils/treeUtils';
import './styles.scss';

// 节点高度固定为40px
const NODE_HEIGHT = 40; 

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
      
      const isMatch = 
        nodeTitle.includes(valueLower) || 
        nodeEmail.includes(valueLower) || 
        nodePosition.includes(valueLower);
        
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
      case 'INITIALIZE': {
        const { treeData, options } = data;
        const result = flattenTree(treeData, options);
        self.postMessage({
          type: 'INITIALIZED',
          data: {
            flatNodes: result.flatNodes,
            nodeMap: [...result.nodeMap]  // 转换为可序列化的数组形式
          }
        });
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

      case 'UPDATE_NODE': {
        const { nodeId, updates } = data;
        // 节点更新逻辑将在这里实现
        self.postMessage({
          type: 'NODE_UPDATED',
          data: { nodeId }
        });
        break;
      }

      default:
        break;
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
  defaultCheckedKeys = []
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

  // Refs
  const containerRef = useRef(null);
  const workerRef = useRef(null);
  const processedDataRef = useRef(null);

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
      defaultCheckedKeys: checkedKeys
    });
    
    processedDataRef.current = result;
    return result;
  }, [treeData, expandedKeys.length, selectedKeys.length, checkedKeys.length]);
  
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
  
  // 初始化 Web Worker
  useEffect(() => {
    if (performanceMode && window.Worker && !workerError) {
      try {
        // 使用内联Worker方式创建
        workerRef.current = createInlineWorker(workerFunction);
        
        workerRef.current.onmessage = (e) => {
          const { type, data } = e.data || {};
          
          if (!data) return;
          
          switch (type) {
            case 'INITIALIZED':
              // Worker初始化完成后更新DOM
              updateVisibleNodes();
              break;
              
            case 'VISIBLE_NODES_RESULT': {
              // 处理可见节点结果
              const { visibleNodes: vNodes } = data;
              if (vNodes && Array.isArray(vNodes)) {
                updateNodesInViewport(vNodes);
                setTotalHeight(vNodes.length * NODE_HEIGHT);
              }
              break;
            }
              
            case 'VIEWPORT_NODES_RESULT':
              // 处理视口内节点
              if (data.viewportNodes && Array.isArray(data.viewportNodes)) {
                setVisibleNodes(data.viewportNodes);
              }
              break;
              
            case 'SEARCH_RESULT':
              // 处理搜索结果
              updateVisibleNodes();
              break;
          }
        };
        
        workerRef.current.onerror = (error) => {
          console.error('Worker执行出错:', error);
          setWorkerError(true);
          updateVisibleNodesMainThread();
        };
        
        // 初始化Worker
        workerRef.current.postMessage({
          type: 'INITIALIZE',
          data: {
            treeData: treeData || [],
            options: {
              defaultExpandedKeys: expandedKeys,
              defaultSelectedKeys: selectedKeys,
              defaultCheckedKeys: checkedKeys
            }
          }
        });
      } catch (error) {
        console.error('初始化Worker失败:', error);
        // 如果Worker初始化失败，回退到主线程处理
        setWorkerError(true);
        updateVisibleNodesMainThread();
      }
      
      return () => {
        try {
          if (workerRef.current) {
            workerRef.current.terminate();
            workerRef.current = null;
          }
        } catch (e) {
          console.error('终止Worker失败:', e);
        }
      };
    } else {
      // 不使用Worker时的初始化
      updateVisibleNodesMainThread();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treeData, performanceMode]);
  
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
      setSelectedKeys([key]);
    }
    
    // 调用回调
    onSelect && onSelect(key, { 
      selected, 
      node: processedDataRef.current?.nodeMap.get(key),
      selectedKeys: multiple ? 
        (selected ? [...selectedKeys, key] : selectedKeys.filter(k => k !== key)) : 
        [key]
    });
  }, [multiple, onSelect, selectedKeys]);
  
  // 处理节点复选框
  const handleCheck = useCallback((key, checked) => {
    setCheckedKeys(prev => {
      if (checked) {
        return [...prev, key];
      } else {
        return prev.filter(k => k !== key);
      }
    });
    
    // 调用回调
    onCheck && onCheck(key, { 
      checked, 
      node: processedDataRef.current?.nodeMap.get(key),
      checkedKeys: checked ? 
        [...checkedKeys, key] : 
        checkedKeys.filter(k => k !== key)
    });
  }, [checkedKeys, onCheck]);
  
  // 处理搜索
  const handleSearch = useCallback((e) => {
    const value = e.target.value;
    setSearchValue(value);
    
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
          
          if (
            nodeTitle.includes(valueLower) || 
            nodeEmail.includes(valueLower) || 
            nodePosition.includes(valueLower)
          ) {
            matchingKeys.add(node.key);
            
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
          }
        });
      }
      
      // 更新可见节点
      updateVisibleNodesMainThread();
    }
  }, [performanceMode, processedData, updateVisibleNodesMainThread, workerError]);
  
  // 处理清除搜索
  const handleClearSearch = useCallback(() => {
    setSearchValue('');
    
    if (performanceMode && workerRef.current && !workerError) {
      workerRef.current.postMessage({
        type: 'SEARCH_NODES',
        data: {
          nodes: processedDataRef.current?.flattenedData || [],
          searchValue: ''
        }
      });
    } else {
      updateVisibleNodesMainThread();
    }
  }, [performanceMode, updateVisibleNodesMainThread, workerError]);

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
          />
        </div>
      )}
      
      <Spin spinning={loading}>
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
                  <VirtualTreeNode 
                    node={node}
                    checkable={checkable}
                    multiple={multiple}
                    searchValue={searchValue}
                    onExpand={handleExpand}
                    onCheck={handleCheck}
                    onSelect={handleSelect}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <Empty description={emptyText} />
        )}
      </Spin>
      
      {multiple && selectedKeys.length > 0 && (
        <div className="virtual-ant-tree-selected-count">
          已选: {selectedKeys.length}
        </div>
      )}
    </div>
  );
};

export default VirtualAntTree; 