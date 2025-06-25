/**
 * 内存监控组件
 * 用于监控和显示内存使用情况
 */
import React, { useState, useEffect } from 'react';
import { Card, Statistic, Row, Col, Progress, Button, Tooltip, Divider, Table } from 'antd';
import { ReloadOutlined, WarningOutlined, CheckCircleOutlined, DeleteOutlined } from '@ant-design/icons';
import { getMemoryInfo, getMemoryStats, recordMemoryUsage, forceGC } from '../utils/memoryMonitor';

const MemoryMonitor = ({ 
  enabled = true, 
  interval = 5000,
  nodeCount = 0,
  visibleNodeCount = 0,
  treeMemoryUsage = null,
  onGC
}) => {
  // 内存监控状态
  const [memoryInfo, setMemoryInfo] = useState(null);
  const [memoryStats, setMemoryStats] = useState(null);
  const [records, setRecords] = useState([]);
  const [timerId, setTimerId] = useState(null);
  
  // 初始化和清理
  useEffect(() => {
    if (!enabled) {
      if (timerId) {
        clearInterval(timerId);
        setTimerId(null);
      }
      return;
    }
    
    // 初始记录
    const initialMemory = recordMemoryUsage('initial', { nodeCount, visibleNodeCount });
    if (initialMemory) {
      setMemoryInfo(initialMemory);
      setRecords([initialMemory]);
    }
    
    // 定时记录
    const id = setInterval(() => {
      const memory = recordMemoryUsage('interval', { nodeCount, visibleNodeCount });
      if (memory) {
        setMemoryInfo(memory);
        setRecords(prev => {
          const newRecords = [...prev, memory];
          // 保留最近10条记录
          if (newRecords.length > 10) {
            return newRecords.slice(-10);
          }
          return newRecords;
        });
        
        // 更新统计信息
        const stats = getMemoryStats();
        if (stats) {
          setMemoryStats(stats);
        }
      }
    }, interval);
    
    setTimerId(id);
    
    return () => {
      if (id) {
        clearInterval(id);
      }
    };
  }, [enabled, interval, nodeCount, visibleNodeCount]);
  
  // 强制垃圾回收
  const handleForceGC = () => {
    const gcResult = forceGC();
    if (gcResult) {
      // 如果GC成功，记录GC后的内存状态
      const postGcMemory = recordMemoryUsage('post-gc', { nodeCount, visibleNodeCount });
      if (postGcMemory) {
        setMemoryInfo(postGcMemory);
        setRecords(prev => [...prev, postGcMemory]);
      }
    }
    
    // 调用外部GC回调
    if (onGC) {
      onGC();
    }
  };
  
  // 如果禁用或没有内存信息，不显示
  if (!enabled || !memoryInfo) {
    return null;
  }
  
  // 计算内存使用率
  const memoryUsageRate = memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit;
  const memoryStatus = 
    memoryUsageRate > 0.9 ? 'exception' :
    memoryUsageRate > 0.7 ? 'warning' : 
    'normal';
  
  // 内存泄漏检测
  const hasLeak = memoryStats?.hasLeak;
  
  // 表格列定义
  const columns = [
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (text) => new Date(text).toLocaleTimeString()
    },
    {
      title: '已用(MB)',
      dataIndex: 'usedJSHeapSize',
      key: 'usedJSHeapSize'
    },
    {
      title: '总量(MB)',
      dataIndex: 'totalJSHeapSize',
      key: 'totalJSHeapSize'
    },
    {
      title: '使用率',
      dataIndex: 'usageRate',
      key: 'usageRate',
      render: (text) => `${Math.round(text * 100)}%`
    }
  ];
  
  return (
    <Card
      title="内存监控"
      size="small"
      className="memory-monitor"
      extra={
        <Tooltip title="强制垃圾回收">
          <Button 
            icon={<DeleteOutlined />} 
            size="small" 
            onClick={handleForceGC}
          />
        </Tooltip>
      }
    >
      <Row gutter={[16, 16]}>
        <Col span={12}>
          <Statistic 
            title="已用内存" 
            value={memoryInfo.usedJSHeapSize} 
            suffix="MB" 
            precision={1}
          />
        </Col>
        <Col span={12}>
          <Statistic 
            title="总内存" 
            value={memoryInfo.totalJSHeapSize} 
            suffix="MB" 
            precision={1}
          />
        </Col>
      </Row>
      
      <Progress 
        percent={Math.round(memoryUsageRate * 100)} 
        status={memoryStatus}
        size="small"
        style={{ marginTop: 16, marginBottom: 16 }}
      />
      
      <Row gutter={[16, 16]}>
        <Col span={12}>
          <Statistic 
            title="节点总数" 
            value={nodeCount} 
            valueStyle={{ fontSize: '14px' }}
          />
        </Col>
        <Col span={12}>
          <Statistic 
            title="可见节点" 
            value={visibleNodeCount} 
            valueStyle={{ fontSize: '14px' }}
          />
        </Col>
      </Row>
      
      {treeMemoryUsage && (
        <div style={{ marginTop: 16 }}>
          <Divider style={{ margin: '8px 0' }}>树内存详情</Divider>
          <Row gutter={[16, 8]}>
            <Col span={12}>
              <Statistic 
                title="TypedArray" 
                value={Math.round(treeMemoryUsage.typedArrayBytes / 1024)} 
                suffix="KB" 
                valueStyle={{ fontSize: '14px' }}
              />
            </Col>
            <Col span={12}>
              <Statistic 
                title="字符串" 
                value={Math.round(treeMemoryUsage.stringBytes / 1024)} 
                suffix="KB" 
                valueStyle={{ fontSize: '14px' }}
              />
            </Col>
            <Col span={12}>
              <Statistic 
                title="每节点字节" 
                value={treeMemoryUsage.bytesPerNode} 
                suffix="B" 
                valueStyle={{ fontSize: '14px' }}
              />
            </Col>
            <Col span={12}>
              <Statistic 
                title="总内存" 
                value={Math.round(treeMemoryUsage.totalBytes / 1024)} 
                suffix="KB" 
                valueStyle={{ fontSize: '14px' }}
              />
            </Col>
          </Row>
        </div>
      )}
      
      {memoryStats && (
        <div className="memory-leak-warning" style={{ marginTop: 16 }}>
          {hasLeak ? (
            <div style={{ color: 'orange', display: 'flex', alignItems: 'center' }}>
              <WarningOutlined style={{ marginRight: 8 }} />
              <span>检测到可能的内存泄漏 (+{memoryStats.leakTrend}MB/次)</span>
            </div>
          ) : (
            <div style={{ color: 'green', display: 'flex', alignItems: 'center' }}>
              <CheckCircleOutlined style={{ marginRight: 8 }} />
              <span>内存使用稳定</span>
            </div>
          )}
        </div>
      )}
      
      <Divider style={{ margin: '8px 0' }}>内存历史记录</Divider>
      <Table 
        dataSource={records} 
        columns={columns} 
        size="small" 
        pagination={false}
        rowKey="timestamp"
        scroll={{ y: 120 }}
      />
    </Card>
  );
};

export default MemoryMonitor; 