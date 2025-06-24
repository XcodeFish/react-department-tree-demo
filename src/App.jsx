import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Modal, Form, DatePicker, Input, Select, TimePicker, message, List, Avatar, Tag, Divider } from 'antd';
import { UserAddOutlined, TeamOutlined, UserOutlined, ClockCircleOutlined, EnvironmentOutlined, CloseOutlined } from '@ant-design/icons';
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
    
    // 立即更新选中的keys
    setCheckedKeys(uniqueKeys);
    
    // 保存选中的节点信息 - 仅用户节点
    if (info && info.checkedNodes) {
      // 收集所有用户节点
      let userNodes = [];
      
      // 从info.checkedNodes中直接提取用户节点
      if (Array.isArray(info.checkedNodes)) {
        // 只收集类型为'user'的节点
        userNodes = info.checkedNodes.filter(node => 
          node && node.type === 'user'
        );
      }
      
      // 去重
      const uniqueUserMap = new Map();
      userNodes.forEach(node => {
        if (node && node.key) {
          uniqueUserMap.set(node.key, node);
        }
      });
      
      const finalUserNodes = Array.from(uniqueUserMap.values());
      console.log(`处理后的选中用户节点数量: ${finalUserNodes.length}`);
      setCheckedNodes(finalUserNodes);
    }
  }, []);

  // 显示会议邀请模态框
  const showMeetingModal = () => {
    setModalVisible(true);
    
    // 初始化表单值
    form.setFieldsValue({
      title: '',
      time: null,
      attendees: checkedNodes.map(node => node.key)
    });
  };

  // 处理模态框确认
  const handleModalOk = () => {
    form.validateFields().then(values => {
      // 格式化数据
      const formattedValues = {
        ...values,
        time: values.time ? values.time.format('YYYY-MM-DD HH:mm:ss') : null,
        attendees: checkedNodes.map(node => ({
          key: node.key,
          name: node.realName || node.name,
          position: node.position || '',
          type: node.type
        }))
      };
      
      console.log('表单提交值:', formattedValues);
      
      // 显示成功消息
      message.success(`已成功邀请${checkedNodes.length}人参加会议`, 2);
      
      // 重置表单
      form.resetFields();
      setModalVisible(false);
    });
  };

  // 处理模态框取消
  const handleModalCancel = () => {
    form.resetFields();
    setModalVisible(false);
  };
  
  // 删除单个选中人员
  const handleRemoveAttendee = (key) => {
    // 从checkedKeys中移除
    const newCheckedKeys = checkedKeys.filter(k => k !== key);
    setCheckedKeys(newCheckedKeys);
    
    // 从checkedNodes中移除
    const newCheckedNodes = checkedNodes.filter(node => node.key !== key);
    setCheckedNodes(newCheckedNodes);
    
    // 更新表单值
    form.setFieldsValue({
      attendees: newCheckedKeys
    });
  };

  // 清除所有选择
  const handleClearAll = useCallback(() => {
    setCheckedKeys([]);
    setCheckedNodes([]);
    setSelectedKeys([]);
  }, []);

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>部门人员树Demo</h1>
        <div className="app-header-actions">
          {checkedNodes.length > 0 && (
            <Button 
              onClick={handleClearAll}
              style={{ marginRight: 8 }}
            >
              清除选择
            </Button>
          )}
          <Button 
            type="primary" 
            icon={<UserAddOutlined />}
            disabled={checkedNodes.length === 0}
            onClick={showMeetingModal}
          >
            发起会议邀请 ({checkedNodes.length}人)
          </Button>
        </div>
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
        width={600}
        styles={{
          body: { maxHeight: '70vh', overflowY: 'auto' }
        }}
        footer={[
          <Button key="back" onClick={handleModalCancel}>
            取消
          </Button>,
          <Button 
            key="submit" 
            type="primary" 
            onClick={handleModalOk}
            disabled={checkedNodes.length === 0}
          >
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
          
          <Form.Item 
            name="location"
            label="会议地点"
          >
            <Input placeholder="请输入会议地点" />
          </Form.Item>
          
          <Divider orientation="left">邀请对象 ({checkedNodes.length}人)</Divider>
          
          <div className="invited-users-container">
            {checkedNodes.length > 0 ? (
              <List
                dataSource={checkedNodes}
                renderItem={node => (
                  <List.Item
                    key={node.key}
                    className="invited-user-item"
                    actions={[
                      <Button 
                        type="text" 
                        icon={<CloseOutlined />} 
                        size="small"
                        onClick={() => handleRemoveAttendee(node.key)}
                      />
                    ]}
                  >
                    <List.Item.Meta
                      avatar={
                        <Avatar icon={<UserOutlined />} size="small" />
                      }
                      title={node.realName || node.name}
                      description={node.position || ''}
                    />
                  </List.Item>
                )}
              />
            ) : (
              <div className="no-users-selected">
                未选择参会人员，请返回选择人员
              </div>
            )}
          </div>
        </Form>
      </Modal>
    </div>
  );
}

export default App;
