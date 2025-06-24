import React from 'react';
import { CaretDownOutlined, CaretRightOutlined, TeamOutlined, UserOutlined } from '@ant-design/icons';
import { Checkbox } from 'antd';
import classNames from 'classnames';

const VirtualTreeNode = ({
  node,
  checkable,
  multiple,
  searchValue,
  onExpand,
  onCheck,
  onSelect
}) => {
  const { title, key, expanded, checked, selected, isLeaf, type, level } = node;

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
    if (type === 'user') {
      return <UserOutlined className="virtual-ant-tree-node-icon node-icon-user" />;
    }
    return <TeamOutlined className="virtual-ant-tree-node-icon node-icon-dept" />;
  };

  // 计算内边距，用于表示层级
  const paddingLeft = level * 24;

  // 高亮搜索结果
  const renderTitle = () => {
    if (!searchValue) return title;
    
    const index = title.indexOf(searchValue);
    if (index === -1) return title;
    
    const beforeStr = title.substring(0, index);
    const middleStr = title.substring(index, index + searchValue.length);
    const afterStr = title.substring(index + searchValue.length);
    
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
        { 'virtual-ant-tree-node-department': type !== 'user' }
      )}
      style={{ paddingLeft }}
      onClick={handleSelect}
    >
      {!isLeaf && (
        <span className="virtual-ant-tree-node-switcher" onClick={handleExpand}>
          {expanded ? <CaretDownOutlined /> : <CaretRightOutlined />}
        </span>
      )}
      {isLeaf && <span className="virtual-ant-tree-node-switcher-spacer"></span>}
      
      {checkable && (
        <Checkbox
          checked={checked}
          onChange={handleCheck}
          onClick={(e) => e.stopPropagation()}
        />
      )}
      
      {renderIcon()}
      <span className="virtual-ant-tree-node-title">{renderTitle()}</span>
    </div>
  );
};

export default VirtualTreeNode; 