import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Input, Badge } from 'antd';
import { SearchOutlined, CloseCircleFilled } from '@ant-design/icons';
import './styles.scss';

/**
 * 搜索框组件
 * 支持实时搜索和防抖处理
 * @param {Object} props 组件属性
 * @param {string} props.placeholder 占位文本
 * @param {Function} props.onSearch 搜索回调
 * @param {Function} props.onClear 清除回调
 * @param {number} props.debounceTime 防抖时间(毫秒)
 * @param {number} props.matchCount 匹配数量
 */
const SearchBox = ({
  placeholder = '搜索...',
  onSearch,
  onClear,
  debounceTime = 300,
  matchCount = 0
}) => {
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const timerRef = useRef(null);

  // 清除定时器
  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  // 处理搜索，支持防抖
  const handleSearch = useCallback((val, immediate = false) => {
    // 清除之前的定时器
    clearTimer();

    // 如果为空值，直接调用清除
    if (!val || val.trim() === '') {
      setValue('');
      onClear && onClear();
      return;
    }

    // 更新输入值
    setValue(val);

    // 即时模式立即执行一次快速搜索
    if (onSearch && val.trim()) {
      // 即时模式搜索
      onSearch(val, 'immediate');

      // 如果不是立即执行模式，设置防抖定时器
      if (!immediate) {
        timerRef.current = setTimeout(() => {
          // 完整模式搜索
          onSearch(val, 'complete');
        }, debounceTime);
      }
    }
  }, [onSearch, onClear, debounceTime]);

  // 处理清除
  const handleClear = () => {
    setValue('');
    onClear && onClear();
  };

  // 处理输入变化
  const handleChange = (e) => {
    const newValue = e.target.value;
    handleSearch(newValue);
  };

  // 处理按键事件
  const handleKeyDown = (e) => {
    // 按下回车键立即执行搜索
    if (e.key === 'Enter' && value.trim()) {
      clearTimer();
      onSearch && onSearch(value, 'complete');
    }
  };

  // 组件卸载时清除定时器
  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, []);

  return (
    <div className={`search-box ${focused ? 'focused' : ''}`}>
      <Input
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        prefix={<SearchOutlined className="search-icon" />}
        suffix={
          value ? (
            <CloseCircleFilled
              className="clear-icon"
              onClick={handleClear}
            />
          ) : null
        }
        allowClear
      />
      {matchCount > 0 && (
        <Badge
          count={matchCount}
          className="match-count"
          size="small"
          title={`找到 ${matchCount} 个匹配项`}
        />
      )}
    </div>
  );
};

export default SearchBox; 