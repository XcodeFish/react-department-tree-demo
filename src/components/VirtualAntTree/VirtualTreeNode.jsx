/**
 * 虚拟树节点组件
 * 用于渲染单个树节点，支持展开/折叠、选择、复选等功能
 * @param {Object} props 组件属性
 */
import React, { memo } from 'react';
import { CaretDownOutlined, CaretRightOutlined, TeamOutlined, UserOutlined, LoadingOutlined } from '@ant-design/icons';
import { Checkbox } from 'antd';
import classNames from 'classnames';

const VirtualTreeNode = memo(({
  node,
  checkable = false,
  multiple = false,
  searchValue = '',
  onExpand,
  onCheck,
  onSelect
}) => {
  if (!node) return null;

  const { 
    key,
    title, 
    name, 
    expanded, 
    checked, 
    selected, 
    isLeaf, 
    type, 
    level,
    loading,
    matched, // 搜索匹配标志
    children = []
  } = node;

  const nodeTitle = title || name || '';
  const hasChildren = Array.isArray(children) && children.length > 0;
  const showSwitcher = !isLeaf;
  
  // 处理展开/折叠
  const handleExpand = (e) => {
    e.stopPropagation();
    if (onExpand) {
      onExpand(key, !expanded);
    }
  };

  // 处理选择
  const handleSelect = (e) => {
    e.stopPropagation();
    if (onSelect) {
      onSelect(key, !selected);
    }
  };

  // 处理复选框
  const handleCheck = (e) => {
    e.stopPropagation();
    const checked = e.target.checked;
    if (onCheck) {
      onCheck(key, checked);
    }
  };

  // 判断节点类型图标
  const renderIcon = () => {
    if (loading) {
      return <LoadingOutlined className="virtual-ant-tree-node-icon" />;
    }
    
    if (type === 'user') {
      return <UserOutlined className="virtual-ant-tree-node-icon node-icon-user" />;
    }
    
    if (isLeaf) {
      return <TeamOutlined className="virtual-ant-tree-node-icon node-icon-dept" />;
    }
    
    return expanded ? (
      <TeamOutlined className="virtual-ant-tree-node-icon node-icon-dept-open" />
    ) : (
      <TeamOutlined className="virtual-ant-tree-node-icon node-icon-dept" />
    );
  };

  // 计算内边距，用于表示层级
  const paddingLeft = level * 24;

  // 高亮搜索结果
  const renderTitle = () => {
    if (!searchValue) return nodeTitle;
    
    const index = nodeTitle.toLowerCase().indexOf(searchValue.toLowerCase());
    if (index === -1) return nodeTitle;
    
    const beforeStr = nodeTitle.substring(0, index);
    const middleStr = nodeTitle.substring(index, index + searchValue.length);
    const afterStr = nodeTitle.substring(index + searchValue.length);
    
    return (
      <span>
        {beforeStr}
        <span className="virtual-ant-tree-search-highlight">{middleStr}</span>
        {afterStr}
      </span>
    );
  };

  return (
    <div
      className={classNames(
        'virtual-ant-tree-node',
        { 'virtual-ant-tree-node-selected': selected },
        { 'virtual-ant-tree-node-user': type === 'user' },
        { 'virtual-ant-tree-node-department': type !== 'user' },
        { 'virtual-ant-tree-node-matched': matched || (searchValue && nodeTitle.toLowerCase().includes(searchValue.toLowerCase())) }
      )}
      style={{ paddingLeft }}
      onClick={handleSelect}
    >
      {showSwitcher && (
        <span className="virtual-ant-tree-node-switcher" onClick={handleExpand}>
          {loading ? <LoadingOutlined /> : expanded ? <CaretDownOutlined /> : <CaretRightOutlined />}
        </span>
      )}
      {!showSwitcher && <span className="virtual-ant-tree-node-switcher-leaf"></span>}
      
      {checkable && (
        <Checkbox
          checked={checked}
          onChange={handleCheck}
          onClick={(e) => e.stopPropagation()}
          className="virtual-ant-tree-checkbox"
        />
      )}
      
      {renderIcon()}
      <span className="virtual-ant-tree-node-title">{renderTitle()}</span>
    </div>
  );
});

export default VirtualTreeNode; 