/**
 * SearchBox 组件
 * 使用MCP模式实现实时搜索功能
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Input, Badge, Tooltip } from 'antd';
import { SearchOutlined, LoadingOutlined, UserOutlined } from '@ant-design/icons';
import './SearchBox.less';

// Model: 管理搜索状态和数据
const useSearchModel = (initialValue = '', debounceTime = 200) => {
  const [value, setValue] = useState(initialValue);
  const [loading, setLoading] = useState(false);
  const [matchCount, setMatchCount] = useState(0);
  const timerRef = useRef(null);
  
  // 清除搜索
  const clearSearch = useCallback(() => {
    setValue('');
    setLoading(false);
    setMatchCount(0);
  }, []);
  
  // 更新搜索值
  const updateValue = useCallback((newValue) => {
    setValue(newValue);
    if (newValue) {
      setLoading(true);
    } else {
      setLoading(false);
      setMatchCount(0);
    }
  }, []);
  
  // 设置匹配数量
  const updateMatchCount = useCallback((count) => {
    setMatchCount(count);
    setLoading(false);
  }, []);
  
  return {
    value,
    loading,
    matchCount,
    updateValue,
    clearSearch,
    updateMatchCount
  };
};

// Controller: 处理用户交互和搜索逻辑
const useSearchController = (model, onSearch, onClear, debounceTime = 200) => {
  const { value, updateValue, clearSearch } = model;
  const timerRef = useRef(null);
  
  // 处理输入变化
  const handleChange = useCallback((e) => {
    const newValue = e.target.value;
    updateValue(newValue);
    
    // 清除之前的定时器
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    
    // 立即触发一次搜索，提供即时反馈
    onSearch(newValue, 'immediate');
    
    // 设置延迟执行的完整搜索
    timerRef.current = setTimeout(() => {
      onSearch(newValue, 'complete');
    }, debounceTime);
  }, [updateValue, onSearch, debounceTime]);
  
  // 处理回车键
  const handlePressEnter = useCallback(() => {
    // 清除之前的定时器，立即执行搜索
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    onSearch(value, 'complete');
  }, [value, onSearch]);
  
  // 处理清除
  const handleClear = useCallback(() => {
    clearSearch();
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    onClear();
  }, [clearSearch, onClear]);
  
  return {
    handleChange,
    handlePressEnter,
    handleClear
  };
};

// Presenter: 渲染搜索框UI
const SearchBox = ({
  placeholder = '搜索...',
  onSearch,
  onClear,
  debounceTime = 200,
  style
}) => {
  // 初始化Model
  const model = useSearchModel('', debounceTime);
  
  // 初始化Controller
  const controller = useSearchController(model, onSearch, onClear, debounceTime);
  
  return (
    <div className="virtual-ant-search-box" style={style}>
      <Input
        placeholder={placeholder}
        prefix={model.loading ? <LoadingOutlined /> : <SearchOutlined />}
        value={model.value}
        onChange={controller.handleChange}
        onPressEnter={controller.handlePressEnter}
        allowClear
        onClear={controller.handleClear}
        className="virtual-ant-search-input"
      />
      
      {model.matchCount > 0 && (
        <Tooltip title={`找到 ${model.matchCount} 个匹配的员工`}>
          <Badge 
            count={model.matchCount} 
            className="virtual-ant-search-badge"
            offset={[-5, 5]}
          >
            <UserOutlined className="virtual-ant-search-user-icon" />
          </Badge>
        </Tooltip>
      )}
    </div>
  );
};

export default SearchBox; 