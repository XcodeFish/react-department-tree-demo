/**
 * React兼容性工具函数
 * 用于检查React版本并提供兼容性处理
 */
import React, { useState, useCallback } from 'react';
import { message } from 'antd';

// 检查React版本
const reactVersion = React.version;
const versionParts = reactVersion.split('.');
const majorVersion = parseInt(versionParts[0], 10);
const isReact18Plus = majorVersion >= 18;

/**
 * 检查React版本兼容性
 * @returns {boolean} 是否兼容
 */
export const checkReactVersion = () => {
  // antd v5 支持 React 16-18
  const isCompatible = majorVersion >= 16 && majorVersion <= 18;
  
  if (!isCompatible) {
    console.warn(`当前React版本(${reactVersion})可能与antd v5不兼容，antd v5支持React 16-18`);
    
    // 仅在开发环境显示警告
    if (import.meta.env && import.meta.env.DEV) {
      message.warning({
        content: `当前React版本(${reactVersion})可能与antd v5不兼容，可能会导致一些UI组件异常`,
        duration: 10,
        key: 'react-version-warning'
      });
    }
  }
  
  return isCompatible;
};

/**
 * 获取安全的React.startTransition函数
 * 在React 18+中使用startTransition，否则使用setTimeout降级
 * @returns {Function} 安全的transition函数
 */
export const getSafeTransition = () => {
  if (typeof React.startTransition === 'function') {
    return React.startTransition;
  }
  
  // 降级为setTimeout
  return (callback) => {
    setTimeout(callback, 0);
  };
};

// 创建一个空的useTransition polyfill
const useTransitionPolyfill = () => {
  const [isPending, setIsPending] = useState(false);
  
  const startTransition = useCallback((callback) => {
    setIsPending(true);
    setTimeout(() => {
      try {
        callback();
      } finally {
        setIsPending(false);
      }
    }, 0);
  }, []);
  
  return [isPending, startTransition];
};

/**
 * 安全使用useTransition hook
 * 根据React版本使用不同的实现
 * @returns {Array} [isPending, startTransition]
 */
export const useSafeTransition = isReact18Plus && typeof React.useTransition === 'function' 
  ? React.useTransition 
  : useTransitionPolyfill;

export default {
  checkReactVersion,
  getSafeTransition,
  useSafeTransition
}; 