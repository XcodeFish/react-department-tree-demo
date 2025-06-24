/**
 * 虚拟树节点组件
 * 用于渲染单个树节点，支持展开/折叠、选择、复选等功能
 * @param {Object} props 组件属性
 */
import React, { memo } from 'react';
import { CaretDownOutlined, CaretRightOutlined, TeamOutlined, UserOutlined, LoadingOutlined, CheckOutlined } from '@ant-design/icons';
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
    indeterminate, 
    isLeaf, 
    type, 
    level,
    loading = false,
    matched,
    children = [],
    realName,
    position
  } = node;
  
  // 构建显示文本
  const nodeTitle = type === 'user' ? 
    (realName ? `${realName}${position ? ` - ${position}` : ''}` : name) : 
    (title || name || '');
  
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
    
    // 同时触发勾选
    if (checkable && onCheck) {
      onCheck(key, !checked);
    }
    
    // 处理选择
    if (onSelect && selectable) {
      onSelect(key, !selected);
    }
  };

  // 处理复选框
  const handleCheck = (e) => {
    e.stopPropagation();
    if (onCheck) {
      onCheck(key, !checked);
    }
  };

  // 渲染图标
  const renderIcon = () => {
    if (!showIcon) return null;
    
    if (loading) {
      return <LoadingOutlined className="virtual-ant-tree-node-icon" />;
    }
    
    if (type === 'user') {
      return <UserOutlined className="virtual-ant-tree-node-icon" />;
    }
    
    return <TeamOutlined className="virtual-ant-tree-node-icon" />;
  };

  // 计算内边距
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
  
  // 确保值是布尔类型
  const isChecked = !!checked;
  const isIndeterminate = !!indeterminate;
  
  // 注释掉调试日志，避免大量输出导致性能问题
  // if (type === 'department') {
  //   console.log(`渲染部门节点: ${nodeTitle} (${key}), checked=${isChecked}, indeterminate=${isIndeterminate}`);
  // }

  return (
    <div
      className={classNames(
        'virtual-ant-tree-node',
        { 'virtual-ant-tree-node-selected': selected },
        { 'virtual-ant-tree-node-checked': isChecked }, 
        { 'virtual-ant-tree-node-indeterminate': isIndeterminate }, 
        { 'virtual-ant-tree-node-user': type === 'user' },
        { 'virtual-ant-tree-node-department': type !== 'user' }
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
        <div 
          onClick={handleCheck}
          className={classNames({
            'virtual-ant-tree-checkbox': true,
            'virtual-ant-tree-checkbox-checked': isChecked,
            'virtual-ant-tree-checkbox-indeterminate': isIndeterminate && !isChecked
          })}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '16px',
            height: '16px',
            marginRight: '8px',
            border: '1px solid #d9d9d9',
            borderRadius: '2px',
            backgroundColor: isChecked ? '#1890ff' : '#fff',
            cursor: 'pointer',
            position: 'relative',
          }}
        >
          {isChecked && <CheckOutlined style={{ color: '#fff', fontSize: '12px' }} />}
          {isIndeterminate && !isChecked && (
            <div 
              style={{
                position: 'absolute',
                top: '50%',
                left: '20%',
                width: '10px',
                height: '2px',
                backgroundColor: '#1890ff',
                transform: 'translateY(-50%)'
              }}
            />
          )}
        </div>
      )}
      
      {renderIcon()}
      <span className="virtual-ant-tree-node-title">{renderTitle()}</span>
    </div>
  );
});

export default VirtualTreeNode; 