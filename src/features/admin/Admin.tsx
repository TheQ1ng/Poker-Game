import React, { useState } from 'react';
import { Layout, Menu, Breadcrumb, Card, Typography } from 'antd';
import UserManagement from './UserManagement';
import GameRecordManagement from './GameRecordManagement';
import GameProcessManagement from './GameProcessManagement';

const { Header, Content, Sider } = Layout;
const { Title } = Typography;

const Admin: React.FC = () => {
  const [activeTab, setActiveTab] = useState('users');

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#001529', padding: 0, display: 'flex', alignItems: 'center', paddingLeft: 24 }}>
        <Title level={4} style={{ color: 'white', margin: 0 }}>管理后台</Title>
      </Header>
      <Layout>
        <Sider width={200} style={{ background: '#f0f2f5' }}>
          <Menu
            mode="inline"
            selectedKeys={[activeTab]}
            style={{ height: '100%', borderRight: 0 }}
            onSelect={({ key }) => setActiveTab(key)}
          >
            <Menu.Item key="users">用户管理</Menu.Item>
            <Menu.Item key="game-records">游戏记录</Menu.Item>
            <Menu.Item key="game-processes">游戏进程管理</Menu.Item>
          </Menu>
        </Sider>
        <Layout style={{ padding: '0 24px 24px' }}>
          <Breadcrumb style={{ margin: '16px 0' }}>
            <Breadcrumb.Item>管理后台</Breadcrumb.Item>
            <Breadcrumb.Item>
              {activeTab === 'users' ? '用户管理' : 
               activeTab === 'game-records' ? '游戏记录' : '游戏进程管理'}
            </Breadcrumb.Item>
          </Breadcrumb>
          <Content style={{ background: 'white', padding: 24, margin: 0, minHeight: 280 }}>
            {activeTab === 'users' ? <UserManagement /> : 
             activeTab === 'game-records' ? <GameRecordManagement /> : 
             <GameProcessManagement />}
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
};

export default Admin;
