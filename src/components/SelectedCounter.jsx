/**
 * 选中计数器组件
 * 用于显示已选中的节点数量和提供批量操作
 */
import React, { useMemo } from 'react';
import { Button, Badge, Dropdown, Space, Tooltip } from 'antd';
import { TeamOutlined, UserOutlined, CheckOutlined, CloseOutlined, DownOutlined } from '@ant-design/icons';

const SelectedCounter = ({
  checkedNodes = [],
  onClearAll,
  onSelectOnlyUsers,
  onSelectAll,
  onUnselectAll,
  style = {}
}) => {
  // 统计选中的部门和用户数量
  const counts = useMemo(() => {
    let departmentCount = 0;
    let userCount = 0;
    
    checkedNodes.forEach(node => {
      if (node.type === 'department') {
        departmentCount++;
      } else if (node.type === 'user') {
        userCount++;
      }
    });
    
    return { departmentCount, userCount, total: checkedNodes.length };
  }, [checkedNodes]);
  
  // 批量操作菜单项
  const menuItems = [
    {
      key: 'selectAll',
      label: '全选',
      icon: <CheckOutlined />,
      onClick: onSelectAll
    },
    {
      key: 'unselectAll',
      label: '取消全选',
      icon: <CloseOutlined />,
      onClick: onUnselectAll
    },
    {
      key: 'selectOnlyUsers',
      label: '仅选择人员',
      icon: <UserOutlined />,
      onClick: onSelectOnlyUsers
    }
  ];
  
  if (counts.total === 0) {
    return null;
  }
  
  return (
    <div 
      className="selected-counter"
      style={{
        position: 'absolute',
        bottom: 16,
        right: 16,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        background: '#fff',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
        padding: '8px 12px',
        borderRadius: '24px',
        ...style
      }}
    >
      <Space>
        <Badge count={counts.total} overflowCount={999} size="small">
          <span style={{ marginRight: 8 }}>已选</span>
        </Badge>
        
        <Tooltip title="已选部门">
          <Badge 
            count={counts.departmentCount} 
            overflowCount={999} 
            size="small"
            style={{ backgroundColor: '#52c41a' }}
          >
            <TeamOutlined style={{ fontSize: 16 }} />
          </Badge>
        </Tooltip>
        
        <Tooltip title="已选人员">
          <Badge 
            count={counts.userCount} 
            overflowCount={999} 
            size="small"
            style={{ backgroundColor: '#1890ff' }}
          >
            <UserOutlined style={{ fontSize: 16 }} />
          </Badge>
        </Tooltip>
        
        <Dropdown menu={{ items: menuItems }} placement="topRight">
          <Button size="small" type="text">
            <DownOutlined />
          </Button>
        </Dropdown>
        
        <Button 
          size="small" 
          type="primary" 
          danger 
          icon={<CloseOutlined />}
          onClick={onClearAll}
        >
          清除
        </Button>
      </Space>
    </div>
  );
};

export default SelectedCounter; 