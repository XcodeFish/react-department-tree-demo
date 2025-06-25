/**
 * 性能监控组件
 * 用于监控和展示树组件的性能数据
 */
import React, { useState, useEffect, useRef } from 'react';
import { Card, Statistic, Row, Col, Progress, Button, Tooltip, Switch } from 'antd';
import { ReloadOutlined, PieChartOutlined, LineChartOutlined } from '@ant-design/icons';

const PerformanceMonitor = ({ 
  enabled = true, 
  nodeCount = 0, 
  visibleNodeCount = 0,
  renderTime = 0,
  onTogglePerformanceMode
}) => {
  // 性能统计数据
  const [metrics, setMetrics] = useState({
    fps: 0,
    memory: null,
    averageFps: 0,
    minFps: Infinity,
    maxFps: 0,
    lastFrameTime: 0,
    frames: 0
  });
  
  // 历史数据
  const [history, setHistory] = useState([]);
  const frameTimesRef = useRef([]);
  const fpsCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const rafIdRef = useRef(null);
  
  // 计算FPS和内存使用
  const calculateMetrics = () => {
    const now = performance.now();
    const elapsed = now - lastTimeRef.current;
    
    if (elapsed >= 1000) {
      const fps = Math.round((fpsCountRef.current * 1000) / elapsed);
      
      // 获取内存使用情况（仅Chrome支持）
      const memory = window.performance?.memory ? {
        usedJSHeapSize: Math.round(window.performance.memory.usedJSHeapSize / (1024 * 1024)),
        totalJSHeapSize: Math.round(window.performance.memory.totalJSHeapSize / (1024 * 1024))
      } : null;
      
      // 更新帧时间历史
      frameTimesRef.current.push(fps);
      if (frameTimesRef.current.length > 60) {
        frameTimesRef.current.shift();
      }
      
      // 计算统计数据
      const frameTimes = frameTimesRef.current;
      const averageFps = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
      const minFps = Math.min(...frameTimes);
      const maxFps = Math.max(...frameTimes);
      
      // 更新指标
      const newMetrics = {
        fps,
        memory,
        averageFps: Math.round(averageFps),
        minFps: Math.min(minFps, metrics.minFps === Infinity ? minFps : metrics.minFps),
        maxFps: Math.max(maxFps, metrics.maxFps),
        lastFrameTime: elapsed / fpsCountRef.current,
        frames: fpsCountRef.current
      };
      
      setMetrics(newMetrics);
      
      // 添加到历史记录
      setHistory(prev => {
        const newHistory = [...prev, { 
          timestamp: new Date().toISOString(),
          ...newMetrics,
          nodeCount,
          visibleNodeCount,
          renderTime
        }];
        
        // 保留最近30条记录
        if (newHistory.length > 30) {
          return newHistory.slice(newHistory.length - 30);
        }
        return newHistory;
      });
      
      // 重置计数器
      fpsCountRef.current = 0;
      lastTimeRef.current = now;
    } else {
      fpsCountRef.current++;
    }
    
    if (enabled) {
      rafIdRef.current = requestAnimationFrame(calculateMetrics);
    }
  };
  
  // 启动/停止监控
  useEffect(() => {
    if (enabled) {
      rafIdRef.current = requestAnimationFrame(calculateMetrics);
    }
    
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [enabled]);
  
  // 性能评级
  const getPerformanceRating = (fps) => {
    if (fps >= 55) return { text: '优', color: 'green' };
    if (fps >= 45) return { text: '良', color: 'lime' };
    if (fps >= 30) return { text: '中', color: 'orange' };
    return { text: '差', color: 'red' };
  };
  
  const rating = getPerformanceRating(metrics.averageFps);
  
  // 如果禁用则不显示
  if (!enabled) return null;
  
  return (
    <Card
      title="性能监控"
      size="small"
      className="performance-monitor"
      extra={
        <Tooltip title="切换性能模式">
          <Switch 
            checked={enabled} 
            onChange={onTogglePerformanceMode} 
            checkedChildren="高性能" 
            unCheckedChildren="普通" 
          />
        </Tooltip>
      }
    >
      <Row gutter={[16, 16]}>
        <Col span={12}>
          <Statistic 
            title="当前FPS" 
            value={metrics.fps} 
            suffix="帧/秒" 
            valueStyle={{ color: getPerformanceRating(metrics.fps).color }}
          />
        </Col>
        <Col span={12}>
          <Statistic 
            title="平均FPS" 
            value={metrics.averageFps} 
            suffix="帧/秒" 
            valueStyle={{ color: rating.color }}
          />
        </Col>
      </Row>
      
      <Progress 
        percent={Math.min(100, (metrics.fps / 60) * 100)} 
        strokeColor={rating.color}
        size="small"
        status={metrics.fps < 30 ? "exception" : "active"}
        format={() => rating.text}
        style={{ marginTop: 16, marginBottom: 16 }}
      />
      
      <Row gutter={[16, 16]}>
        <Col span={8}>
          <Statistic 
            title="节点总数" 
            value={nodeCount} 
            valueStyle={{ fontSize: '14px' }}
          />
        </Col>
        <Col span={8}>
          <Statistic 
            title="可见节点" 
            value={visibleNodeCount} 
            valueStyle={{ fontSize: '14px' }}
          />
        </Col>
        <Col span={8}>
          <Statistic 
            title="渲染时间" 
            value={renderTime} 
            suffix="ms" 
            valueStyle={{ fontSize: '14px' }}
          />
        </Col>
      </Row>
      
      {metrics.memory && (
        <Row style={{ marginTop: 16 }}>
          <Col span={24}>
            <Statistic 
              title="内存使用" 
              value={`${metrics.memory.usedJSHeapSize}/${metrics.memory.totalJSHeapSize}`} 
              suffix="MB" 
              valueStyle={{ fontSize: '14px' }}
            />
            <Progress 
              percent={Math.round((metrics.memory.usedJSHeapSize / metrics.memory.totalJSHeapSize) * 100)} 
              size="small" 
              status={metrics.memory.usedJSHeapSize > metrics.memory.totalJSHeapSize * 0.8 ? "exception" : "normal"}
            />
          </Col>
        </Row>
      )}
      
      <div className="performance-tips" style={{ marginTop: 16, fontSize: '12px', color: '#999' }}>
        {metrics.averageFps < 30 ? (
          <div style={{ color: 'orange' }}>
            性能不佳，建议减少节点数量或开启高性能模式
          </div>
        ) : (
          <div style={{ color: 'green' }}>
            性能良好，树组件运行流畅
          </div>
        )}
      </div>
    </Card>
  );
};

export default PerformanceMonitor; 