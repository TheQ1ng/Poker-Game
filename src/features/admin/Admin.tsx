import React, { useState } from 'react';
import { Layout, Menu, Breadcrumb, Typography } from 'antd';
import { TeamOutlined, ReadOutlined, DesktopOutlined } from '@ant-design/icons';
import UserManagement from './UserManagement';
import GameRecordManagement from './GameRecordManagement';
import GameProcessManagement from './GameProcessManagement';
import './admin.css';

const { Header, Content, Sider } = Layout;
const { Title } = Typography;

const Admin: React.FC = () => {
  const [activeTab, setActiveTab] = useState('users');

  return (
    <Layout className="admin-root-layout">
      <Header
        style={{
          background: 'linear-gradient(90deg, #001529 0%, #0f2d5c 100%)',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}
      >
        <Title level={4} style={{ color: 'white', margin: 0 }}>
          后台管理
        </Title>
      </Header>
      <Layout className="admin-body-layout">
        <Sider
          width={220}
          className="admin-sidebar"
          style={{ background: '#fff', borderRight: '1px solid #f0f0f0' }}
        >
          <Menu
            mode="inline"
            selectedKeys={[activeTab]}
            style={{ height: '100%', borderRight: 0, paddingTop: 12 }}
            onSelect={({ key }) => setActiveTab(key)}
          >
            <Menu.Item key="users" icon={<TeamOutlined />}>用户管理</Menu.Item>
            <Menu.Item key="game-records" icon={<ReadOutlined />}>游戏记录</Menu.Item>
            <Menu.Item key="game-processes" icon={<DesktopOutlined />}>游戏进程管理</Menu.Item>
          </Menu>
        </Sider>
        <Layout className="admin-main-layout">
          <Breadcrumb style={{ margin: '16px 0' }}>
            <Breadcrumb.Item>管理后台</Breadcrumb.Item>
            <Breadcrumb.Item>
              {activeTab === 'users' ? '用户管理' : 
               activeTab === 'game-records' ? '游戏记录' : '游戏进程管理'}
            </Breadcrumb.Item>
          </Breadcrumb>
          <Content className="admin-content">
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
