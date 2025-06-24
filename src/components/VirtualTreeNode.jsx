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
  onSelect,
  showIcon = true,
  showLine = false,
  blockNode = true,
  selectable = true
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
    loading = false,
    matched, // 搜索匹配标志
    children = [],
    realName, // 真实姓名
    position  // 职位
  } = node;

  // 根据节点类型和可用信息构建显示文本
  // 强制显示方式：用户显示姓名+职位，部门显示名称
  const nodeTitle = type === 'user' ? 
                    (realName ? `${realName}${position ? ` - ${position}` : ''}` : name) : // 用户节点
                    (title || name || ''); // 部门节点
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
    
    // 当点击节点时，如果是可勾选的，同时触发勾选行为
    if (checkable && onCheck) {
      onCheck(key, !checked);
    }
    
    // 正常处理选择事件
    if (onSelect && selectable) {
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
    if (!showIcon) return null;
    
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
  
  // 渲染连接线
  const renderLine = () => {
    if (!showLine) return null;
    
    return (
      <span 
        className="virtual-ant-tree-node-line"
        style={{ 
          left: `${(level - 1) * 24 + 12}px`,
          height: isLeaf ? '50%' : '100%'
        }}
      />
    );
  };

  return (
    <div
      className={classNames(
        'virtual-ant-tree-node',
        { 'virtual-ant-tree-node-selected': selected },
        { 'virtual-ant-tree-node-user': type === 'user' },
        { 'virtual-ant-tree-node-department': type !== 'user' },
        { 'virtual-ant-tree-node-matched': matched || (searchValue && nodeTitle.toLowerCase().includes(searchValue.toLowerCase())) },
        { 'virtual-ant-tree-node-block': blockNode },
        { 'virtual-ant-tree-node-selectable': selectable }
      )}
      style={{ paddingLeft }}
      onClick={handleSelect}
    >
      {showLine && renderLine()}
      
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