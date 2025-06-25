import React, { useState, useEffect, useCallback, useRef, useMemo, useTransition } from 'react';
import { Card, Button, Modal, Form, DatePicker, Input, Select, TimePicker, message, List, Avatar, Tag, Divider, Empty, Spin, Switch, Tooltip, Space } from 'antd';
import { UserAddOutlined, TeamOutlined, UserOutlined, ClockCircleOutlined, EnvironmentOutlined, CloseOutlined, SettingOutlined, ReloadOutlined, DashboardOutlined } from '@ant-design/icons';
import './App.css';
import VirtualAntTree from './components/VirtualAntTree';
import PerformanceMonitor from './components/PerformanceMonitor';
import SelectedCounter from './components/SelectedCounter';
import { generateTreeData } from './utils/mockData';
import ErrorBoundary from './components/ErrorBoundary';
import { checkReactVersion } from './utils/compatUtils';

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
  const [showPerformance, setShowPerformance] = useState(false);
  const [visibleNodeCount, setVisibleNodeCount] = useState(0);
  const [renderTime, setRenderTime] = useState(0);
  const [dataSize, setDataSize] = useState('medium'); // small, medium, large
  const [loadingText, setLoadingText] = useState('正在加载数据...');
  const [allNodes, setAllNodes] = useState([]); // 存储所有节点的扁平化数据
  const [nodeMap, setNodeMap] = useState(new Map());
  const [userMap, setUserMap] = useState(new Map());
  const [relationCache, setRelationCache] = useState({
    parentChildMap: new Map(),
    childParentMap: new Map()
  });
  
  // 使用useRef存储节点关系，避免重新渲染
  const nodeRelationsRef = useRef({
    parentChildMap: new Map(), // 存储父子节点关系
    childParentMap: new Map(), // 存储子父节点关系
    userNodes: new Set(),      // 存储用户节点ID
    deptNodes: new Set()       // 存储部门节点ID
  });

  const [isPending, startTransition] = useTransition(); // 添加React 18的并发模式支持
  const [modalLoading, setModalLoading] = useState(false); // 添加Modal加载状态

  // 预处理数据，建立索引和关系映射
  const preprocessTreeData = useCallback((data) => {
    const nodeMap = new Map();
    const userMap = new Map();
    const parentChildMap = new Map();
    const childParentMap = new Map();
    const userNodes = new Set();
    const deptNodes = new Set();
    
    // 扁平化处理树数据
    const flattenTree = (nodes, parentId = null) => {
      if (!Array.isArray(nodes)) return [];
      
      const result = [];
      
      nodes.forEach(node => {
        const nodeId = node.key || node.id;
        
        // 存储节点
        nodeMap.set(nodeId, node);
        
        // 记录父子关系
        if (parentId) {
          childParentMap.set(nodeId, parentId);
          
          const parentChildren = parentChildMap.get(parentId) || [];
          parentChildren.push(nodeId);
          parentChildMap.set(parentId, parentChildren);
        }
        
        // 区分用户和部门节点
        if (node.type === 'user') {
          userNodes.add(nodeId);
          userMap.set(nodeId, node);
        } else {
          deptNodes.add(nodeId);
        }
        
        // 递归处理子节点
        if (node.children && node.children.length > 0) {
          flattenTree(node.children, nodeId);
        }
        
        result.push(node);
      });
      
      return result;
    };
    
    // 处理数据
    const flattenedData = flattenTree(data);
    
    // 更新状态
    setNodeMap(nodeMap);
    setUserMap(userMap);
    setRelationCache({ parentChildMap, childParentMap });
    
    // 更新ref
    nodeRelationsRef.current = {
      parentChildMap,
      childParentMap,
      userNodes,
      deptNodes
    };
    
    return flattenedData;
  }, []);

  // 加载数据
  const loadData = useCallback(async (size = 5000) => {
    setLoading(true);
    try {
      // 生成测试数据
      const data = await generateTreeData(size);
      
      // 预处理数据
      const processedData = preprocessTreeData(data);
      
      // 更新状态
      setData(data);
      setAllNodes(processedData);
      
      // 计算用户节点数量
      const userCount = nodeRelationsRef.current.userNodes.size;
      console.log(`加载完成: 总节点数 ${processedData.length}, 用户节点数 ${userCount}`);
      
      message.success(`成功加载 ${processedData.length} 个节点，其中包含 ${userCount} 个用户节点`);
    } catch (error) {
      console.error('加载数据失败:', error);
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  }, [preprocessTreeData]);
  
  // 优化handleCheck函数，使用节点映射提高效率
  const handleCheck = useCallback((keys, info) => {
    // 使用批处理模式，避免频繁更新状态
    const batchUpdate = () => {
      setCheckedKeys(keys);
      
      // 使用Map快速查找节点
      const checkedUserNodes = Array.from(keys)
        .filter(key => nodeRelationsRef.current.userNodes.has(key))
        .map(key => nodeMap.get(key))
        .filter(Boolean);
      
      setCheckedNodes(checkedUserNodes);
    };
    
    // 使用requestAnimationFrame确保UI流畅
    requestAnimationFrame(batchUpdate);
  }, [nodeMap]);
  
  // 优化获取子节点函数，使用缓存提高效率
  const getChildrenKeys = useCallback((nodeId) => {
    const result = new Set();
    const { parentChildMap } = nodeRelationsRef.current;
    
    const traverse = (id) => {
      const children = parentChildMap.get(id);
      if (!children) return;
      
      children.forEach(childId => {
        result.add(childId);
        traverse(childId);
      });
    };
    
    traverse(nodeId);
    return Array.from(result);
  }, []);
  
  // 优化获取父节点函数，使用缓存提高效率
  const getParentKeys = useCallback((nodeId) => {
    const result = new Set();
    const { childParentMap } = nodeRelationsRef.current;
    
    let currentId = nodeId;
    while (currentId) {
      const parentId = childParentMap.get(currentId);
      if (parentId) {
        result.add(parentId);
        currentId = parentId;
      } else {
        break;
      }
    }
    
    return Array.from(result);
  }, []);

  // 处理选择
  const handleSelect = (keys, info) => {
    console.log('选中的节点:', keys, info);
    setSelectedKeys(keys);
  };
  
  // 组件挂载时自动加载数据
  useEffect(() => {
    // 根据dataSize选择合适的数据量
    let nodeCount = 2000;
    if (dataSize === 'small') nodeCount = 500;
    if (dataSize === 'large') nodeCount = 8000;
    if (dataSize === 'extreme') nodeCount = 15000;
    
    console.log('自动加载数据，节点数量:', nodeCount);
    loadData(nodeCount);
  }, [dataSize, loadData]);

  // 组件挂载时检查React版本兼容性
  useEffect(() => {
    checkReactVersion();
  }, []);

  // 显示会议邀请模态框 - 优化版本
  const showMeetingModal = useCallback(() => {
    // 先显示Modal，再异步加载数据
    setModalVisible(true);
    setModalLoading(true);
    
    // 使用Worker处理大量数据
    if (window.Worker && checkedNodes.length > 50) {
      try {
        // 创建临时Worker处理批量操作
        const invitationWorker = new Worker('/workers/batchWorker.js');
        
        invitationWorker.onmessage = (e) => {
          const { type, displayNodes, totalCount, hasMore } = e.data;
          
          if (type === 'prepareInvitationCompleted') {
            // 使用startTransition降低状态更新优先级，避免阻塞UI
            startTransition(() => {
              // 初始化表单值
              form.setFieldsValue({
                title: '',
                time: null,
                attendees: checkedNodes.map(node => node.key)
              });
              setModalLoading(false);
            });
            
            // 销毁Worker
            invitationWorker.terminate();
          }
        };
        
        // 发送数据给Worker处理
        invitationWorker.postMessage({ 
          type: 'prepareInvitation', 
          data: { 
            checkedNodes,
            maxDisplayCount: 100 
          } 
        });
      } catch (error) {
        console.error('Worker处理错误:', error);
        // 降级处理
        setTimeout(() => {
          startTransition(() => {
            form.setFieldsValue({
              title: '',
              time: null,
              attendees: checkedNodes.map(node => node.key)
            });
            setModalLoading(false);
          });
        }, 100);
      }
    } else {
      // 节点数量较少，直接处理
      setTimeout(() => {
        startTransition(() => {
          form.setFieldsValue({
            title: '',
            time: null,
            attendees: checkedNodes.map(node => node.key)
          });
          setModalLoading(false);
        });
      }, 100);
    }
  }, [form, checkedNodes]);

  // 处理模态框确认 - 优化版本
  const handleModalOk = useCallback(() => {
    form.validateFields().then(values => {
      // 显示加载状态
      setModalLoading(true);
      
      // 使用setTimeout延迟处理，避免阻塞UI
      setTimeout(() => {
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
        setModalLoading(false);
      }, 100);
    });
  }, [form, checkedNodes]);

  // 处理模态框取消 - 优化版本
  const handleModalCancel = useCallback(() => {
    // 显示加载状态
    setModalLoading(true);
    
    // 使用setTimeout延迟处理，避免阻塞UI
    setTimeout(() => {
      form.resetFields();
      setModalVisible(false);
      setModalLoading(false);
    }, 50);
  }, [form]);
  
  // 删除单个选中人员 - 优化版本
  const handleRemoveAttendee = useCallback((key) => {
    // 使用startTransition降低状态更新优先级，避免阻塞UI
    startTransition(() => {
      // 从checkedKeys中移除
      const newCheckedKeys = checkedKeys.filter(k => k !== key);
      // 从checkedNodes中移除
      const newCheckedNodes = checkedNodes.filter(node => node.key !== key);
      
      // 批量更新状态
      setCheckedKeys(newCheckedKeys);
      setCheckedNodes(newCheckedNodes);
      
      // 更新表单值
      form.setFieldsValue({
        attendees: newCheckedKeys
      });
    });
  }, [checkedKeys, checkedNodes, form]);
  
  // 清除所有选择
  const handleClearAll = useCallback(() => {
    setCheckedKeys([]);
    setCheckedNodes([]);
    setSelectedKeys([]);
  }, []);
  
  // 切换性能模式
  const handleTogglePerformanceMode = useCallback((checked) => {
    setUseWorker(checked);
    message.info(`已切换到${checked ? '高性能' : '普通'}模式`);
  }, []);
  
  // 处理可见节点变化
  const handleVisibleNodesChange = useCallback((count) => {
    setVisibleNodeCount(count);
  }, []);
  
  // 重新加载数据
  const handleReloadData = useCallback(() => {
    loadData(dataSize);
    handleClearAll();
  }, [dataSize, handleClearAll]);
  
  // 切换数据规模
  const handleChangeDataSize = useCallback((value) => {
    setDataSize(value);
  }, []);
  
  // 批量操作 - 全选
  const handleSelectAll = useCallback(() => {
    // 显示加载状态
    message.loading({ content: '正在处理选择...', key: 'selectAll' });
    
    // 使用WebWorker处理大量数据
    if (window.Worker) {
      try {
        // 创建临时Worker处理批量操作
        const batchWorker = new Worker('/workers/batchWorker.js');
        
        batchWorker.onmessage = (e) => {
          const { type, allKeys, userKeys, userNodes, processed, total } = e.data;
          
          if (type === 'selectAllProgress') {
            // 更新进度
            message.loading({ content: `正在处理选择... ${Math.round(processed/total*100)}%`, key: 'selectAll' });
          } else if (type === 'selectAllCompleted') {
            // 使用requestAnimationFrame和分批次更新状态，减少UI阻塞
            requestAnimationFrame(() => {
              // 使用函数式更新，避免闭包问题
              setCheckedKeys(() => allKeys);
              
              // 延迟更新节点数据，先让UI响应
              setTimeout(() => {
                setCheckedNodes(userNodes);
                message.success({ content: `已选择所有节点 (${allKeys.length}个)`, key: 'selectAll' });
                
                // 销毁Worker
                batchWorker.terminate();
              }, 50);
            });
          }
        };
        
        // 发送数据给Worker处理
        batchWorker.postMessage({ type: 'selectAll', data: { allNodes } });
      } catch (error) {
        console.error('Worker处理错误:', error);
        // 降级处理
        fallbackSelectAll();
        message.error('处理过程中出现错误，已切换到兼容模式');
      }
    } else {
      // 降级处理
      fallbackSelectAll();
    }
  }, [allNodes]);
  
  // 降级处理全选功能
  const fallbackSelectAll = () => {
    // 使用requestAnimationFrame和分批处理
    const allKeys = [];
    const userNodes = [];
    
    // 分批处理
    const batchSize = 2000; // 增加批处理大小
    let currentIndex = 0;
    
    function processBatch() {
      if (currentIndex >= allNodes.length) {
        // 完成处理
        requestAnimationFrame(() => {
          setCheckedKeys(allKeys);
          
          // 延迟更新节点数据
          setTimeout(() => {
            setCheckedNodes(userNodes);
            message.success(`已选择所有节点 (${allKeys.length}个)`);
          }, 50);
        });
        return;
      }
      
      // 只在处理开始、结束和每20%进度时更新消息
      const progress = Math.round(currentIndex/allNodes.length*100);
      if (currentIndex === 0 || progress % 20 === 0 || currentIndex + batchSize >= allNodes.length) {
        message.loading({ content: `正在处理选择... ${progress}%`, key: 'selectAll' });
      }
      
      // 处理当前批次
      const endIndex = Math.min(currentIndex + batchSize, allNodes.length);
      for (let i = currentIndex; i < endIndex; i++) {
        const node = allNodes[i];
        allKeys.push(node.key);
        
        if (node.type === 'user') {
          // 只保留必要属性
          userNodes.push({
            key: node.key,
            id: node.id,
            name: node.name,
            realName: node.realName,
            email: node.email,
            position: node.position,
            type: node.type,
            avatar: node.avatar
          });
        }
      }
      
      // 更新索引
      currentIndex = endIndex;
      
      // 处理下一批，使用setTimeout让出主线程
      setTimeout(() => {
        requestAnimationFrame(processBatch);
      }, 0);
    }
    
    // 开始处理
    processBatch();
  };
  
  // 批量操作 - 取消全选
  const handleUnselectAll = useCallback(() => {
    setCheckedKeys([]);
    setCheckedNodes([]);
    message.success('已取消所有选择');
  }, []);
  
  // 批量操作 - 仅选择人员
  const handleSelectOnlyUsers = useCallback(() => {
    // 显示加载状态
    message.loading({ content: '正在处理选择...', key: 'selectUsers' });
    
    // 使用WebWorker处理大量数据
    if (window.Worker) {
      try {
        // 创建临时Worker处理批量操作
        const batchWorker = new Worker('/workers/batchWorker.js');
        
        batchWorker.onmessage = (e) => {
          const { type, userKeys, userNodes, processed, total } = e.data;
          
          if (type === 'selectUsersProgress') {
            // 更新进度
            message.loading({ content: `正在处理选择... ${Math.round(processed/total*100)}%`, key: 'selectUsers' });
          } else if (type === 'selectUsersCompleted') {
            // 使用requestAnimationFrame和分批次更新状态
            requestAnimationFrame(() => {
              // 使用函数式更新
              setCheckedKeys(() => userKeys);
              
              // 延迟更新节点数据
              setTimeout(() => {
                setCheckedNodes(userNodes);
                message.success({ content: `已选择所有人员 (${userKeys.length}人)`, key: 'selectUsers' });
                
                // 销毁Worker
                batchWorker.terminate();
              }, 50);
            });
          }
        };
        
        // 发送数据给Worker处理
        batchWorker.postMessage({ type: 'selectUsers', data: { allNodes } });
      } catch (error) {
        console.error('Worker处理错误:', error);
        // 降级处理
        fallbackSelectOnlyUsers();
        message.error('处理过程中出现错误，已切换到兼容模式');
      }
    } else {
      // 降级处理
      fallbackSelectOnlyUsers();
    }
  }, [allNodes]);
  
  // 降级处理仅选择人员功能
  const fallbackSelectOnlyUsers = () => {
    // 使用requestAnimationFrame和分批处理
    const userNodes = [];
    
    // 分批处理
    const batchSize = 1000;
    let currentIndex = 0;
    
    function processBatch() {
      if (currentIndex >= allNodes.length) {
        // 完成处理
        const userKeys = userNodes.map(node => node.key);
        setCheckedKeys(userKeys);
        setCheckedNodes(userNodes);
        message.success(`已选择所有人员 (${userKeys.length}人)`);
        return;
      }
      
      // 更新进度
      message.loading({ content: `正在处理选择... ${Math.round(currentIndex/allNodes.length*100)}%`, key: 'selectUsers' });
      
      // 处理当前批次
      const endIndex = Math.min(currentIndex + batchSize, allNodes.length);
      for (let i = currentIndex; i < endIndex; i++) {
        const node = allNodes[i];
        if (node.type === 'user') {
          userNodes.push(node);
        }
      }
      
      // 更新索引
      currentIndex = endIndex;
      
      // 处理下一批
      requestAnimationFrame(processBatch);
    }
    
    // 开始处理
    processBatch();
  };

  // 使用useMemo缓存邀请用户列表数据，避免重复计算
  const invitedUsersList = useMemo(() => {
    // 限制最大渲染数量，避免性能问题
    const maxDisplayUsers = 100;
    const hasMoreUsers = checkedNodes.length > maxDisplayUsers;
    const displayNodes = hasMoreUsers 
      ? checkedNodes.slice(0, maxDisplayUsers)
      : checkedNodes;
    
    return (
      <>
        <List
          dataSource={displayNodes}
          // 添加虚拟滚动支持
          virtual
          itemLayout="horizontal"
          height={300}
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
        {hasMoreUsers && (
          <div className="more-users-hint">
            还有 {checkedNodes.length - maxDisplayUsers} 人未显示...
          </div>
        )}
      </>
    );
  }, [checkedNodes, handleRemoveAttendee]);

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>部门人员树Demo</h1>
        <div className="app-header-actions">
          <Space>
            <Select 
              value={dataSize} 
              onChange={handleChangeDataSize}
              style={{ width: 100 }}
              options={[
                { label: '小规模 (500节点)', value: 'small' },
                { label: '中规模 (2000节点)', value: 'medium' },
                { label: '大规模 (8000节点)', value: 'large' },
                { label: '极限 (15000节点)', value: 'extreme' }
              ]}
            />
            
            <Tooltip title="重新加载数据">
              <Button 
                icon={<ReloadOutlined />} 
                onClick={handleReloadData}
              />
            </Tooltip>
            
            <Tooltip title="性能监控">
              <Button 
                icon={<DashboardOutlined />} 
                type={showPerformance ? 'primary' : 'default'}
                onClick={() => setShowPerformance(!showPerformance)}
              />
            </Tooltip>
            
            {checkedNodes.length > 0 && (
              <Button 
                onClick={handleClearAll}
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
          </Space>
        </div>
      </header>
      
      <div className="main-content">
        <div className="tree-container">
          <Spin spinning={loading} tip={loadingText}>
            {data && data.length > 0 ? (
              <div style={{ position: 'relative' }}>
                <ErrorBoundary>
                  <VirtualAntTree
                    treeData={data}
                    height={600}
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
                    onVisibleNodesChange={handleVisibleNodesChange}
                    checkedKeys={checkedKeys}
                  />
                </ErrorBoundary>
                
                <SelectedCounter 
                  checkedNodes={allNodes.filter(node => checkedKeys.includes(node.key))}
                  onClearAll={handleClearAll}
                  onSelectAll={handleSelectAll}
                  onUnselectAll={handleUnselectAll}
                  onSelectOnlyUsers={handleSelectOnlyUsers}
                />
              </div>
            ) : (
              <div className="empty-state">
                <Empty 
                  description="暂无部门数据" 
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
                <Button 
                  type="primary" 
                  onClick={handleReloadData}
                  style={{ marginTop: 16 }}
                >
                  加载数据
                </Button>
              </div>
            )}
          </Spin>
        </div>
        
        {showPerformance && (
          <div className="performance-container">
            <PerformanceMonitor 
              enabled={true}
              nodeCount={data.length}
              visibleNodeCount={visibleNodeCount}
              renderTime={renderTime}
              onTogglePerformanceMode={handleTogglePerformanceMode}
            />
          </div>
        )}
      </div>
      
      {/* 会议邀请表单 - 优化版本 */}
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
          <Button key="back" onClick={handleModalCancel} disabled={modalLoading}>
            取消
          </Button>,
          <Button 
            key="submit" 
            type="primary" 
            onClick={handleModalOk}
            disabled={checkedNodes.length === 0 || modalLoading}
            loading={modalLoading}
          >
            确认邀请
          </Button>,
        ]}
      >
        <Spin spinning={modalLoading}>
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
                invitedUsersList
              ) : (
                <div className="no-users-selected">
                  未选择参会人员，请返回选择人员
                </div>
              )}
            </div>
          </Form>
        </Spin>
      </Modal>
    </div>
  );
}

export default App;
