import React, { useEffect, useMemo, useState } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Switch,
  message,
  Card,
  Space,
  Tag,
  Typography,
  Avatar,
} from 'antd';
import { EditOutlined, DeleteOutlined, ReloadOutlined, UserOutlined, LockOutlined } from '@ant-design/icons';

interface User {
  username: string;
  nickname: string;
  avatar: string;
  admin: number;
  created_at: string;
}

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [passwordUser, setPasswordUser] = useState<User | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [passwordForm] = Form.useForm();

  // 获取所有用户
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch('/admin/users', {
        headers: {
          Authorization: localStorage.getItem('token') || '',
        },
      });
      const data = await response.json();
      if (data.code === 0) {
        setUsers(data.data);
      } else {
        message.error(data.error);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
      message.error('获取用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // 编辑用户
  const handleEdit = (user: User) => {
    setEditingUser(user);
    form.setFieldsValue({
      username: user.username,
      nickname: user.nickname,
      avatar: user.avatar,
      admin: user.admin === 1,
    });
    setIsModalVisible(true);
  };

  // 删除用户
  const handleDelete = async (username: string) => {
    if (username === 'admin') {
      message.error('不能删除管理员账户');
      return;
    }

    try {
      const response = await fetch('/admin/user/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: localStorage.getItem('token') || '',
        },
        body: JSON.stringify({ username }),
      });
      const data = await response.json();
      if (data.code === 0) {
        message.success('删除成功');
        fetchUsers();
      } else {
        message.error(data.error);
      }
    } catch (error) {
      console.error('Failed to delete user:', error);
      message.error('删除用户失败');
    }
  };

  const handleResetPassword = (user: User) => {
    setPasswordUser(user);
    passwordForm.setFieldsValue({
      username: user.username,
      password: '123456',
    });
    setPasswordModalVisible(true);
  };

  // 保存编辑
  const handleSave = async () => {
    setSaving(true);
    try {
      const values = await form.validateFields();
      const response = await fetch('/admin/user/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: localStorage.getItem('token') || '',
        },
        body: JSON.stringify({
          username: values.username,
          nickname: values.nickname,
          avatar: values.avatar,
          admin: values.admin ? 1 : 0,
        }),
      });
      const data = await response.json();
      if (data.code === 0) {
        message.success('更新成功');
        setIsModalVisible(false);
        fetchUsers();
      } else {
        message.error(data.error);
      }
    } catch (error) {
      console.error('Failed to update user:', error);
      message.error('更新用户失败');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePassword = async () => {
    setPasswordSaving(true);
    try {
      const values = await passwordForm.validateFields();
      const response = await fetch('/admin/user/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: localStorage.getItem('token') || '',
        },
        body: JSON.stringify({
          username: values.username,
          password: values.password,
        }),
      });
      const data = await response.json();
      if (data.code === 0) {
        message.success(`已重置 ${values.username} 的密码`);
        setPasswordModalVisible(false);
        setPasswordUser(null);
      } else {
        message.error(data.error);
      }
    } catch (error) {
      console.error('Failed to reset password:', error);
      message.error('重置密码失败');
    } finally {
      setPasswordSaving(false);
    }
  };

  const stats = useMemo(() => {
    const total = users.length;
    const admins = users.filter((u) => u.admin === 1).length;
    return { total, admins };
  }, [users]);

  const columns = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      render: (_: string, record: User) => (
        <Space>
          <Avatar
            size={38}
            icon={<UserOutlined />}
            src={record.avatar ? `/static/media/${record.avatar}` : undefined}
          />
          <div>
            <div style={{ fontWeight: 600 }}>{record.username}</div>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {record.nickname || '未设置昵称'}
            </Typography.Text>
          </div>
        </Space>
      ),
    },
    {
      title: '管理员',
      dataIndex: 'admin',
      key: 'admin',
      render: (admin: number) =>
        admin === 1 ? <Tag color="gold">管理员</Tag> : <Tag>普通用户</Tag>,
    },
    {
      title: '买入次数',
      key: 'buyin',
      render: () => <Tag color="blue">已取消</Tag>,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: User) => (
        <Space>
          <Button className="admin-action-btn" type="primary" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Button
            className="admin-action-btn"
            size="small"
            icon={<LockOutlined />}
            onClick={() => handleResetPassword(record)}
          >
            重置密码
          </Button>
          <Button
            className="admin-action-btn"
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.username)}
            disabled={record.username === 'admin'}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Card
      className="admin-page-card"
      bordered={false}
      style={{ borderRadius: 12 }}
      title={<Typography.Title level={4} style={{ margin: 0 }}>用户管理</Typography.Title>}
      extra={
        <Button className="admin-action-btn" icon={<ReloadOutlined />} onClick={fetchUsers} loading={loading}>
          刷新
        </Button>
      }
    >
      <Space size={16} className="admin-stats">
        <Tag color="blue">总用户：{stats.total}</Tag>
        <Tag color="gold">管理员：{stats.admins}</Tag>
      </Space>
      <Table
        columns={columns}
        dataSource={users}
        rowKey="username"
        className="admin-table"
        loading={loading}
        pagination={{ pageSize: 15, showSizeChanger: true }}
      />

      <Modal
        title={editingUser ? '编辑用户' : '添加用户'}
        visible={isModalVisible}
        confirmLoading={saving}
        className="admin-modal"
        onOk={handleSave}
        onCancel={() => {
          setIsModalVisible(false);
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="username" label="用户名" rules={[{ required: true }]}>
            <Input disabled={!!editingUser} />
          </Form.Item>
          <Form.Item name="nickname" label="昵称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="avatar" label="头像" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="admin" label="管理员" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={passwordUser ? `重置 ${passwordUser.username} 的密码` : '重置密码'}
        visible={passwordModalVisible}
        confirmLoading={passwordSaving}
        className="admin-modal"
        onOk={handleSavePassword}
        onCancel={() => {
          setPasswordModalVisible(false);
          setPasswordUser(null);
        }}
      >
        <Form form={passwordForm} layout="vertical">
          <Form.Item name="username" label="用户名" rules={[{ required: true }]}>
            <Input disabled />
          </Form.Item>
          <Form.Item
            name="password"
            label="新密码"
            rules={[{ required: true, message: '请输入新密码' }]}
          >
            <Input.Password placeholder="输入新密码" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default UserManagement;
