/**
 * 优化版树节点组件
 * 使用对象池和DOM复用技术，减少内存占用
 */
import React, { memo, useRef, useEffect } from 'react';
import { CaretDownOutlined, CaretRightOutlined, LoadingOutlined, FolderOutlined, FolderOpenOutlined, UserOutlined } from '@ant-design/icons';
import { Checkbox } from 'antd';
import classNames from 'classnames';

// 使用WeakMap缓存DOM节点引用，避免重复创建
const nodeCache = new WeakMap();

// 使用位运算优化节点状态
const NODE_SELECTED = 1;       // 0001
const NODE_EXPANDED = 2;       // 0010
const NODE_CHECKED = 4;        // 0100
const NODE_MATCHED = 8;        // 1000
const NODE_INDETERMINATE = 16; // 10000

/**
 * 优化版树节点
 * @param {Object} props 组件属性
 */
const OptimizedTreeNode = memo(function OptimizedTreeNode({
  node,
  onToggle,
  onSelect,
  onCheck,
  checkable,
  style = {}
}) {
  const {
    id,
    key,
    name,
    title,
    level = 0,
    expanded,
    children,
    loading,
    matched,
    selected,
    checked,
    indeterminate,
    isLeaf,
    type,
    avatar
  } = node;
  
  // 使用useRef缓存DOM节点
  const nodeRef = useRef(null);
  
  // 计算节点状态位
  const getNodeState = () => {
    let state = 0;
    if (selected) state |= NODE_SELECTED;
    if (expanded) state |= NODE_EXPANDED;
    if (checked) state |= NODE_CHECKED;
    if (matched) state |= NODE_MATCHED;
    if (indeterminate) state |= NODE_INDETERMINATE;
    return state;
  };
  
  // 节点状态
  const nodeState = getNodeState();
  const isUser = type === 'user';
  const hasChildren = Array.isArray(children) && children.length > 0;
  const showExpander = !isUser && (hasChildren || loading || (!isLeaf && !loading));
  
  // 处理展开/折叠
  const handleExpand = (e) => {
    e.stopPropagation();
    onToggle && onToggle(id || key);
  };
  
  // 处理选择
  const handleSelect = () => {
    onSelect && onSelect(id || key);
  };
  
  // 处理复选框
  const handleCheck = (e) => {
    e.stopPropagation();
    onCheck && onCheck(id || key, e.target.checked);
  };
  
  // 使用DOM复用技术
  useEffect(() => {
    if (nodeRef.current) {
      nodeCache.set(node, nodeRef.current);
    }
    return () => {
      // 清理缓存
      if (node && nodeCache.has(node)) {
        nodeCache.delete(node);
      }
    };
  }, [node]);
  
  // 渲染图标
  const renderIcon = () => {
    if (loading) {
      return <LoadingOutlined className="ant-tree-icon" />;
    }
    
    if (isUser) {
      return <UserOutlined className="ant-tree-icon" />;
    }
    
    return expanded
      ? <FolderOpenOutlined className="ant-tree-icon" />
      : <FolderOutlined className="ant-tree-icon" />;
  };
  
  // 优化类名计算
  const getNodeClassNames = () => {
    // 使用位运算高效检查状态
    const isSelected = (nodeState & NODE_SELECTED) !== 0;
    const isMatched = (nodeState & NODE_MATCHED) !== 0;
    
    return classNames(
      'ant-tree-treenode',
      {
        'ant-tree-treenode-selected': isSelected,
        'ant-tree-treenode-matched': isMatched,
        'ant-tree-treenode-user': isUser,
      }
    );
  };
  
  // 优化展开图标类名
  const getExpanderClassNames = () => {
    const isExpanded = (nodeState & NODE_EXPANDED) !== 0;
    
    return classNames('ant-tree-switcher', {
      'ant-tree-switcher_open': isExpanded && showExpander,
      'ant-tree-switcher_close': !isExpanded && showExpander,
      'ant-tree-switcher-noop': !showExpander
    });
  };
  
  // 使用CSS contain优化渲染性能
  const nodeStyle = {
    ...style,
    paddingLeft: level * 24,
    contain: 'content',
    willChange: 'transform'
  };
  
  return (
    <div
      ref={nodeRef}
      className={getNodeClassNames()}
      style={nodeStyle}
      onClick={handleSelect}
      data-node-id={id || key}
      data-node-level={level}
      data-node-type={type}
    >
      {/* 展开/折叠图标 */}
      <span
        className={getExpanderClassNames()}
        onClick={showExpander ? handleExpand : undefined}
      >
        {showExpander && (loading
          ? <LoadingOutlined />
          : expanded
            ? <CaretDownOutlined />
            : <CaretRightOutlined />
        )}
      </span>

      {/* 复选框 */}
      {checkable && (
        <Checkbox
          checked={checked}
          indeterminate={indeterminate}
          onClick={e => e.stopPropagation()}
          onChange={handleCheck}
          className="ant-tree-checkbox"
        />
      )}

      {/* 节点内容 */}
      <span
        className={classNames('ant-tree-node-content-wrapper', {
          'ant-tree-node-content-wrapper-normal': !selected,
          'ant-tree-node-content-wrapper-selected': selected
        })}
      >
        {renderIcon()}

        <span className="ant-tree-title">
          {matched
            ? <span className="ant-tree-title-matched">{name || title}</span>
            : name || title
          }
        </span>
      </span>
    </div>
  );
});

export default OptimizedTreeNode; 