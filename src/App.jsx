import React, { useState, useEffect } from 'react';
import { Card, Button } from 'antd';
import { UserAddOutlined } from '@ant-design/icons';
import './App.css';
import VirtualAntTree from './components/VirtualAntTree';
import { generateTestData } from './utils/treeUtils';

function App() {
  const [treeData, setTreeData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState([]);
  // 添加一个版本号，强制刷新数据
  const dataVersion = 2; // 更新版本号为2，使新的部门名称生成生效

  // 模拟加载数据
  useEffect(() => {
    setLoading(true);
    // 模拟API请求延迟
    setTimeout(() => {
      const data = generateTestData(15, 10); // 15个部门，每个部门10个用户
      console.log('Generated test data sample:', data[0]?.children?.slice(0, 2));
      setTreeData(data);
      setLoading(false);
    }, 500);
  }, [dataVersion]); // 加入dataVersion作为依赖，当版本变化时重新生成数据

  // 处理节点选择
  const handleSelect = (keys) => {
    setSelectedKeys(keys);
  };

  return (
    <div className="app-container">
      <Card
        title="部门人员树Demo"
        extra={
          <Button
            type="primary"
            icon={<UserAddOutlined />}
            disabled={!selectedKeys.length}
          >
            发起会议邀请 ({selectedKeys.length})
          </Button>
        }
      >
        <VirtualAntTree
          treeData={treeData}
          height={500}
          {...(loading ? { loading: true } : {})}
          performanceMode={true}
          showSearch={true}
          searchPlaceholder="搜索部门或人员..."
          multiple={true}
          checkable={true}
          onSelect={handleSelect}
          onCheck={handleSelect}
        />
      </Card>
    </div>
  );
}

export default App;
