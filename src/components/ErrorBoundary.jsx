import React, { Component } from 'react';
import { Alert, Button, Space } from 'antd';

/**
 * 错误边界组件
 * 用于捕获子组件中的JavaScript错误，防止整个应用崩溃
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error) {
    // 更新状态，下次渲染时显示错误UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // 记录错误信息
    console.error('组件错误:', error, errorInfo);
    this.setState({
      errorInfo: errorInfo
    });
  }

  handleReset = () => {
    // 重置错误状态
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    if (this.state.hasError) {
      // 渲染错误UI
      return (
        <div className="error-boundary-container" style={{ padding: '20px' }}>
          <Alert
            message="组件发生错误"
            description={
              <div>
                <p>组件渲染时发生错误，请尝试以下操作：</p>
                <ul>
                  <li>刷新页面</li>
                  <li>清除浏览器缓存</li>
                  <li>检查控制台错误信息</li>
                </ul>
                {this.state.error && (
                  <div className="error-details">
                    <p><strong>错误信息:</strong> {this.state.error.toString()}</p>
                  </div>
                )}
              </div>
            }
            type="error"
            showIcon
          />
          <div style={{ marginTop: '16px' }}>
            <Space>
              <Button type="primary" onClick={this.handleReset}>
                重试
              </Button>
              <Button onClick={() => window.location.reload()}>
                刷新页面
              </Button>
            </Space>
          </div>
        </div>
      );
    }

    // 正常渲染子组件
    return this.props.children;
  }
}

export default ErrorBoundary; 