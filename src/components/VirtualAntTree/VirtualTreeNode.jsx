/**
 * 虚拟树节点组件
 * 使用React.memo和useMemo优化渲染性能
 */
import React, { memo, useMemo, useCallback } from 'react';
import { CaretDownOutlined, CaretRightOutlined, LoadingOutlined, FileOutlined, FolderOutlined, FolderOpenOutlined, UserOutlined, TeamOutlined } from '@ant-design/icons';
import { Avatar, Checkbox } from 'antd';
import classNames from 'classnames';

/**
 * 虚拟树节点组件
 * 使用React.memo和useMemo优化渲染性能
 */
const VirtualTreeNode = memo(function VirtualTreeNode(props) {
  // 提取所有props
  const {
    node = null,
    onToggle = () => {},
    onSelect = () => {},
    onCheck = () => {},
    checkable = false,
    selectable = true,
    showIcon = true,
    showLine = false,
    blockNode = true,
    style = {}
  } = props;

  // 从节点中提取属性，使用默认值确保安全
  const nodeId = node?.id || '';
  const nodeKey = node?.key || nodeId;
  const name = node?.name || '';
  const title = node?.title || name;
  const level = node?.level || 0;
  const expanded = node?.expanded || false;
  const children = node?.children || [];
  const loading = node?.loading || false;
  const matched = node?.matched || false;
  const selected = node?.selected || false;
  const checked = node?.checked || false;
  const indeterminate = node?.indeterminate || false;
  const isLeaf = node?.isLeaf || false;
  const type = node?.type || 'department';
  const avatar = node?.avatar || '';
  const position = node?.position || '';

  // 派生状态
  const isUser = type === 'user';
  const hasChildren = Array.isArray(children) && children.length > 0;
  const showSwitcher = !isLeaf;
  const isChecked = !!checked;
  const isIndeterminate = !!indeterminate;
  
  // 所有Hooks在顶层调用
  // 处理展开/折叠
  const handleExpand = useCallback((e) => {
    e.stopPropagation();
    if (onToggle && nodeKey) {
      onToggle(nodeKey);
    }
  }, [nodeKey, onToggle]);

  // 处理选择
  const handleSelect = useCallback((e) => {
    e.stopPropagation();
    if (selectable && onSelect && nodeKey) {
      onSelect(nodeKey);
    }
  }, [nodeKey, selectable, onSelect]);

  // 处理复选框
  const handleCheck = useCallback((e) => {
    e.stopPropagation();
    if (checkable && onCheck && nodeKey) {
      onCheck(nodeKey, e.target.checked);
    }
  }, [nodeKey, checkable, onCheck]);

  // 节点图标
  const nodeIcon = useMemo(() => {
    if (!showIcon) return null;
    
    if (loading) {
      return <LoadingOutlined className="virtual-ant-tree-node-icon" />;
    }

    if (isUser) {
      return avatar ? 
        <Avatar size="small" src={avatar} className="virtual-ant-tree-node-icon" /> : 
        <UserOutlined className="virtual-ant-tree-node-icon" />;
    }

    if (expanded) {
      return <FolderOpenOutlined className="virtual-ant-tree-node-icon" />;
    }
    
    return <FolderOutlined className="virtual-ant-tree-node-icon" />;
  }, [showIcon, loading, isUser, avatar, expanded]);

  // 节点类名
  const nodeClassNames = useMemo(() => classNames(
    'virtual-ant-tree-node',
    { 'virtual-ant-tree-node-selected': selected },
    { 'virtual-ant-tree-node-checked': isChecked }, 
    { 'virtual-ant-tree-node-indeterminate': isIndeterminate }, 
    { 'virtual-ant-tree-node-user': isUser },
    { 'virtual-ant-tree-node-department': !isUser }
  ), [selected, isChecked, isIndeterminate, isUser]);

  // 展开图标类名
  const switcherClassNames = useMemo(() => classNames('virtual-ant-tree-node-switcher', {
    'virtual-ant-tree-node-switcher_open': expanded && showSwitcher,
    'virtual-ant-tree-node-switcher_close': !expanded && showSwitcher,
    'virtual-ant-tree-node-switcher-noop': !showSwitcher
  }), [expanded, showSwitcher]);

  // 标题类名
  const titleClassNames = useMemo(() => classNames('virtual-ant-tree-node-title', {
    'virtual-ant-tree-node-title-matched': matched
  }), [matched]);

  // 容器样式
  const containerStyle = useMemo(() => ({
    paddingLeft: level * 24,
    contain: 'content',
    ...style
  }), [level, style]);

  // 显示名称
  const displayName = useMemo(() => {
    const text = title || name || '';
    
    if (matched) {
      return <span className="virtual-ant-tree-node-title-highlight">{text}</span>;
    }
    
    return text;
  }, [title, name, matched]);
  
  // 如果没有节点，返回空div以保持结构完整
  if (!node) {
    return <div className="virtual-ant-tree-node-empty" style={style}></div>;
  }

  // 渲染节点
  return (
    <div
      className={nodeClassNames}
      style={containerStyle}
      onClick={handleSelect}
      data-node-id={nodeKey}
    >
      {/* 展开/折叠图标 */}
      {showSwitcher && (
        <span className={switcherClassNames} onClick={handleExpand}>
          {loading ? <LoadingOutlined /> : expanded ? <CaretDownOutlined /> : <CaretRightOutlined />}
        </span>
      )}
      
      {/* 复选框 */}
      {checkable && (
        <Checkbox
          checked={isChecked}
          indeterminate={isIndeterminate}
          onChange={handleCheck}
          onClick={e => e.stopPropagation()}
          className="virtual-ant-tree-node-checkbox"
        />
      )}
      
      {/* 节点图标 */}
      {nodeIcon}
      
      {/* 节点标题 */}
      <span className={titleClassNames}>{displayName}</span>
      
      {/* 附加信息 */}
      {isUser && position && (
        <span className="virtual-ant-tree-node-position">{position}</span>
      )}
    </div>
  );
});

export default VirtualTreeNode; 