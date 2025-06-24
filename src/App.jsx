import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Modal, Form, DatePicker, Input, Select, TimePicker, message, List, Avatar, Tag } from 'antd';
import { UserAddOutlined, TeamOutlined, UserOutlined, ClockCircleOutlined, EnvironmentOutlined } from '@ant-design/icons';
import './App.css';
import VirtualAntTree from './components/VirtualAntTree';
import { generateTreeData } from './utils/mockData';

/**
 * 主应用组件
 * 包含部门树和会议邀请功能
 */
function App() {
  // 状态
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkedKeys, setCheckedKeys] = useState([]);
  const [checkedNodes, setCheckedNodes] = useState([]);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [useWorker, setUseWorker] = useState(true);

  // 初始化加载数据
  useEffect(() => {
    setLoading(true);
    
    // 模拟异步加载
    setTimeout(() => {
      const mockData = generateTreeData();
      setData(mockData);
      setLoading(false);
    }, 1000);
  }, []);

  // 处理选择
  const handleSelect = (keys, info) => {
    console.log('选中的节点:', keys, info);
    setSelectedKeys(keys);
  };

  // 处理复选框选择
  const handleCheck = useCallback((keys, info) => {
    console.log('handleCheck 被调用，选中的keys:', keys, '节点信息:', info);
    
    // 使用Set避免重复key
    const uniqueKeys = Array.from(new Set(keys));
    
    // 使用setTimeout避免在渲染期间更新状态
    setTimeout(() => {
      // 设置选中的keys
      setCheckedKeys(uniqueKeys);
      
      // 保存选中的节点信息
      if (info && info.checkedNodes) {
        // 收集所有用户节点，包括部门中的用户
        let allUserNodes = [];
        
        // 直接从完整的flattenedData中查找所有被选中的用户节点
        if (info.checkedNodes[0]?.flattenedData) {
          const flattenedData = info.checkedNodes[0].flattenedData;
          const userNodes = flattenedData.filter(
            node => node.type === 'user' && uniqueKeys.includes(node.key)
          );
          allUserNodes = [...userNodes];
        } else {
          // 处理直接选中的节点
          const directUserNodes = info.checkedNodes.filter(node => node && node.type === 'user');
          allUserNodes = [...directUserNodes];
          
          // 处理部门节点
          const departmentNodes = info.checkedNodes.filter(node => node && node.type === 'department');
          departmentNodes.forEach(dept => {
            // 找出该部门下所有选中的用户节点
            if (dept && dept.children) {
              const deptUserNodes = dept.children.filter(node => node && node.type === 'user');
              allUserNodes = [...allUserNodes, ...deptUserNodes];
            }
          });
        }
        
        // 使用Map进行去重，保证节点按key唯一
        const uniqueNodesMap = new Map();
        allUserNodes.forEach(node => {
          if (node && node.key && !uniqueNodesMap.has(node.key)) {
            uniqueNodesMap.set(node.key, node);
          }
        });
        
        // 转换回数组
        const uniqueUserNodes = Array.from(uniqueNodesMap.values());
        console.log(`处理后的选中用户节点数量: ${uniqueUserNodes.length}`);
        setCheckedNodes(uniqueUserNodes);
      }
    }, 0);
  }, []);

  // 显示会议邀请模态框
  const showMeetingModal = () => {
    setModalVisible(true);
  };

  // 处理模态框确认
  const handleModalOk = () => {
    form.validateFields().then(values => {
      console.log('表单提交值:', values, '选中人员:', checkedNodes);
      form.resetFields();
      setModalVisible(false);
    });
  };

  // 处理模态框取消
  const handleModalCancel = () => {
    form.resetFields();
    setModalVisible(false);
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>部门人员树Demo</h1>
        <Button 
          type="primary" 
          icon={<UserAddOutlined />}
          disabled={checkedNodes.length === 0}
          onClick={showMeetingModal}
        >
          发起会议邀请 ({checkedNodes.length})
        </Button>
      </header>
      
      <VirtualAntTree
        treeData={data}
        height={500}
        loading={loading}
        checkable={true}
        multiple={true}
        onCheck={handleCheck}
        onSelect={handleSelect}
        performanceMode={useWorker}
        showSearch={true}
        searchPlaceholder="搜索部门或人员..."
        emptyText="暂无数据"
        loadingText="加载中..."
        showIcon={true}
        showLine={false}
        blockNode={true}
        defaultExpandAll={false}
      />
      
      {/* 会议邀请表单 */}
      <Modal
        title="发起会议邀请"
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
        footer={[
          <Button key="back" onClick={handleModalCancel}>
            取消
          </Button>,
          <Button key="submit" type="primary" onClick={handleModalOk}>
            确认邀请
          </Button>,
        ]}
      >
        <Form form={form} layout="vertical">
          <Form.Item 
            name="title"
            label="会议主题"
            rules={[{ required: true, message: '请输入会议主题' }]}
          >
            <Input placeholder="请输入会议主题" />
          </Form.Item>
          
          <Form.Item 
            name="time"
            label="会议时间"
            rules={[{ required: true, message: '请选择会议时间' }]}
          >
            <DatePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          
          <Form.Item label="邀请对象">
            <div className="invited-users">
              {checkedNodes.map(node => (
                <div key={node.key} className="invited-user">
                  {node.realName || node.name}
                  {node.position && <span className="position"> - {node.position}</span>}
                </div>
              ))}
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default App;
