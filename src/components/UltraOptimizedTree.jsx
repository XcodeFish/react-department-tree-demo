/**
 * 超级优化树组件
 * 整合了所有优化技术，提供极致的内存优化和性能
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Spin, Empty, Button, Space, Tooltip } from 'antd';
import { ReloadOutlined, WarningOutlined } from '@ant-design/icons';
import OptimizedTreeNode from './OptimizedTreeNode';
import SearchBox from './SearchBox';
import MemoryMonitor from './MemoryMonitor';
import { CompactTreeNodeManager } from '../utils/compactTreeNode';
import { createObjectPool, createNodePool } from '../utils/objectPool';
import { useMemoryMonitor, detectDOMLeaks } from '../utils/memoryMonitor';
import './UltraOptimizedTree.scss';

// 节点高度固定为40px
const NODE_HEIGHT = 40;

// 创建节点对象池
const nodePool = createNodePool(500);

/**
 * 超级优化树组件
 * @param {Object} props 组件属性
 */
const UltraOptimizedTree = ({
  treeData = [],
  height = 500,
  loading = false,
  performanceMode = true,
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
  onVisibleNodesChange,
  showMemoryMonitor = false
}) => {
  // 状态和引用
  const [visibleNodes, setVisibleNodes] = useState([]);
  const [scrollTop, setScrollTop] = useState(0);
  const [searchValue, setSearchValue] = useState('');
  const [matchCount, setMatchCount] = useState(0);
  const [totalHeight, setTotalHeight] = useState(0);
  const [memoryUsage, setMemoryUsage] = useState(null);
  
  // DOM引用
  const containerRef = useRef(null);
  const scrollerRef = useRef(null);
  
  // 树节点管理器
  const treeManagerRef = useRef(null);
  
  // 内存监控
  const memoryMonitor = useMemoryMonitor({ 
    enabled: showMemoryMonitor && performanceMode,
    interval: 10000,
    label: 'ultra-tree'
  });
  
  // 初始化树节点管理器
  useEffect(() => {
    if (!treeData || treeData.length === 0) {
      setVisibleNodes([]);
      setTotalHeight(0);
      return;
    }
    
    // 创建树节点管理器
    const manager = new CompactTreeNodeManager(treeData.length * 2);
    
    // 递归处理节点
    const processNode = (node, parentId = 0, level = 0) => {
      const nodeId = node.id || node.key;
      const isExpandedByDefault = defaultExpandAll || level === 0 || defaultExpandedKeys.includes(nodeId);
      
      // 添加节点
      manager.addNode({
        id: nodeId,
        parentId,
        level,
        name: node.name || node.title,
        title: node.title || node.name,
        expanded: isExpandedByDefault,
        selected: defaultSelectedKeys.includes(nodeId),
        checked: defaultCheckedKeys.includes(nodeId),
        isLeaf: !node.children || node.children.length === 0,
        type: node.type || 'department'
      });
      
      // 处理子节点
      if (node.children && node.children.length > 0) {
        node.children.forEach(child => {
          processNode(child, nodeId, level + 1);
        });
      }
    };
    
    // 处理所有根节点
    treeData.forEach(node => {
      processNode(node);
    });
    
    // 保存管理器引用
    treeManagerRef.current = manager;
    
    // 更新可见节点
    updateVisibleNodes(0);
    
    // 记录内存使用情况
    if (showMemoryMonitor) {
      setMemoryUsage(manager.getMemoryUsage());
    }
    
    return () => {
      // 清理
      treeManagerRef.current = null;
    };
  }, [treeData, defaultExpandAll, defaultExpandedKeys, defaultSelectedKeys, defaultCheckedKeys, showMemoryMonitor]);
  
  // 更新可见节点
  const updateVisibleNodes = useCallback((scrollPosition) => {
    if (!treeManagerRef.current) return;
    
    // 获取可视区域内的节点
    const nodes = treeManagerRef.current.getNodesInViewport(
      scrollPosition,
      height,
      NODE_HEIGHT,
      Math.ceil(height / NODE_HEIGHT) * 0.5 // 缓冲区
    );
    
    // 计算总高度
    const visibleCount = treeManagerRef.current.visibleNodeIndices.length;
    const newTotalHeight = visibleCount * NODE_HEIGHT;
    
    // 更新状态
    setVisibleNodes(nodes);
    setTotalHeight(newTotalHeight);
    
    // 通知可见节点变化
    if (onVisibleNodesChange) {
      onVisibleNodesChange(visibleCount);
    }
  }, [height, onVisibleNodesChange]);
  
  // 处理滚动事件
  const handleScroll = useCallback((e) => {
    const newScrollTop = e.target.scrollTop;
    setScrollTop(newScrollTop);
    
    // 使用requestAnimationFrame优化滚动性能
    requestAnimationFrame(() => {
      updateVisibleNodes(newScrollTop);
    });
  }, [updateVisibleNodes]);
  
  // 处理节点展开/折叠
  const handleToggle = useCallback((nodeId) => {
    if (!treeManagerRef.current) return;
    
    // 切换节点展开状态
    treeManagerRef.current.toggleNodeExpanded(nodeId);
    
    // 更新可见节点
    updateVisibleNodes(scrollTop);
    
    // 触发展开/折叠回调
    if (onExpand) {
      const expandedKeys = [];
      for (let i = 0; i < treeManagerRef.current.nodeCount; i++) {
        if (treeManagerRef.current.getNodeState(i, 1)) { // 1是STATE_EXPANDED
          expandedKeys.push(treeManagerRef.current.ids[i]);
        }
      }
      onExpand(expandedKeys, { 
        expanded: treeManagerRef.current.getNode(nodeId).expanded,
        node: treeManagerRef.current.getNode(nodeId)
      });
    }
  }, [scrollTop, updateVisibleNodes, onExpand]);
  
  // 处理节点选择
  const handleSelect = useCallback((nodeId) => {
    if (!treeManagerRef.current || !selectable) return;
    
    // 设置节点选中状态
    treeManagerRef.current.setNodeSelected(nodeId, true);
    
    // 更新可见节点
    updateVisibleNodes(scrollTop);
    
    // 触发选择回调
    if (onSelect) {
      const selectedKeys = [];
      for (let i = 0; i < treeManagerRef.current.nodeCount; i++) {
        if (treeManagerRef.current.getNodeState(i, 2)) { // 2是STATE_SELECTED
          selectedKeys.push(treeManagerRef.current.ids[i]);
        }
      }
      onSelect(selectedKeys, { 
        selected: true,
        node: treeManagerRef.current.getNode(nodeId),
        selectedNodes: selectedKeys.map(id => treeManagerRef.current.getNode(id))
      });
    }
  }, [scrollTop, updateVisibleNodes, onSelect, selectable]);
  
  // 处理节点勾选
  const handleCheck = useCallback((nodeId, checked) => {
    if (!treeManagerRef.current || !checkable) return;
    
    // 设置节点勾选状态
    treeManagerRef.current.setNodeChecked(nodeId, checked);
    
    // 更新可见节点
    updateVisibleNodes(scrollTop);
    
    // 触发勾选回调
    if (onCheck) {
      const checkedKeys = [];
      for (let i = 0; i < treeManagerRef.current.nodeCount; i++) {
        if (treeManagerRef.current.getNodeState(i, 4)) { // 4是STATE_CHECKED
          checkedKeys.push(treeManagerRef.current.ids[i]);
        }
      }
      onCheck(checkedKeys, { 
        checked,
        node: treeManagerRef.current.getNode(nodeId),
        checkedNodes: checkedKeys.map(id => treeManagerRef.current.getNode(id))
      });
    }
  }, [scrollTop, updateVisibleNodes, onCheck, checkable]);
  
  // 处理搜索
  const handleSearch = useCallback((value) => {
    if (!treeManagerRef.current) return;
    
    setSearchValue(value);
    
    // 搜索节点
    const result = treeManagerRef.current.searchNodes(value);
    setMatchCount(result.matchCount);
    
    // 更新可见节点
    updateVisibleNodes(scrollTop);
  }, [scrollTop, updateVisibleNodes]);
  
  // 清除搜索
  const handleClearSearch = useCallback(() => {
    handleSearch('');
  }, [handleSearch]);
  
  // 强制垃圾回收
  const handleForceGC = useCallback(() => {
    // 清理节点对象池
    nodePool.clear();
    
    // 更新内存使用情况
    if (treeManagerRef.current && showMemoryMonitor) {
      setMemoryUsage(treeManagerRef.current.getMemoryUsage());
    }
  }, [showMemoryMonitor]);
  
  // 渲染节点
  const renderNode = useCallback((node) => {
    // 从对象池获取节点对象
    const nodeStyle = {
      position: 'absolute',
      top: `${node.offsetTop}px`,
      left: 0,
      right: 0,
      height: `${NODE_HEIGHT}px`
    };
    
    return (
      <div
        key={node.id}
        className="ultra-tree-node-container"
        data-node-id={node.id}
        style={nodeStyle}
      >
        <OptimizedTreeNode
          node={node}
          onToggle={handleToggle}
          onSelect={handleSelect}
          onCheck={handleCheck}
          checkable={checkable}
          style={{ height: NODE_HEIGHT }}
        />
      </div>
    );
  }, [handleToggle, handleSelect, handleCheck, checkable]);
  
  // 检测DOM泄漏
  useEffect(() => {
    if (showMemoryMonitor && performanceMode) {
      const timer = setInterval(() => {
        const leakResult = detectDOMLeaks('.ultra-tree-node-container', visibleNodes.length);
        if (leakResult && leakResult.hasLeak) {
          console.warn('检测到DOM节点泄漏:', leakResult);
        }
      }, 10000);
      
      return () => clearInterval(timer);
    }
  }, [visibleNodes.length, showMemoryMonitor, performanceMode]);
  
  // 渲染内容
  return (
    <div className="ultra-optimized-tree">
      {/* 搜索框 */}
      {showSearch && (
        <SearchBox
          placeholder={searchPlaceholder}
          onSearch={handleSearch}
          onClear={handleClearSearch}
          matchCount={matchCount}
        />
      )}
      
      {/* 树内容 */}
      {loading ? (
        <div className="ultra-tree-loading">
          <Spin size="large" tip={loadingText} />
        </div>
      ) : treeData.length > 0 ? (
        <div
          ref={scrollerRef}
          className="ultra-tree-scroller"
          style={{ height, overflow: 'auto' }}
          onScroll={handleScroll}
        >
          <div
            ref={containerRef}
            className="ultra-tree-content"
            style={{
              height: `${totalHeight}px`,
              position: 'relative'
            }}
          >
            {visibleNodes.map(renderNode)}
          </div>
        </div>
      ) : (
        <Empty description={emptyText} />
      )}
      
      {/* 性能工具栏 */}
      {performanceMode && (
        <div className="ultra-tree-toolbar">
          <Space>
            <Tooltip title="强制垃圾回收">
              <Button
                icon={<ReloadOutlined />}
                size="small"
                onClick={handleForceGC}
              />
            </Tooltip>
            {memoryUsage && memoryUsage.bytesPerNode > 100 && (
              <Tooltip title="内存占用过高">
                <WarningOutlined style={{ color: 'orange' }} />
              </Tooltip>
            )}
          </Space>
        </div>
      )}
      
      {/* 内存监控 */}
      {showMemoryMonitor && (
        <MemoryMonitor
          enabled={showMemoryMonitor}
          nodeCount={treeManagerRef.current?.nodeCount || 0}
          visibleNodeCount={visibleNodes.length}
          treeMemoryUsage={memoryUsage}
          onGC={handleForceGC}
        />
      )}
    </div>
  );
};

export default UltraOptimizedTree; 