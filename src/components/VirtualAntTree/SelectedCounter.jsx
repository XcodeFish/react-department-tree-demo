/**
 * 选中计数器组件
 * 显示已选择节点数量，并提供清除选择的功能
 */
import React from 'react';
import { Button } from 'antd';
import { CloseCircleOutlined, UserOutlined } from '@ant-design/icons';
import './styles.scss';

const SelectedCounter = ({ count, onClear, showClearButton = true }) => {
  if (count <= 0) return null;

  return (
    <div className="virtual-ant-tree-selected-counter">
      <span className="virtual-ant-tree-selected-counter-icon">
        <UserOutlined />
      </span>
      <span className="virtual-ant-tree-selected-counter-text">
        已选: {count}
      </span>
      {showClearButton && (
        <Button
          type="text"
          size="small"
          className="virtual-ant-tree-selected-counter-clear"
          onClick={onClear}
          icon={<CloseCircleOutlined />}
        />
      )}
    </div>
  );
};

export default SelectedCounter; 