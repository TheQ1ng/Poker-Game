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
  InputNumber,
  Typography,
  Avatar,
  Progress,
} from 'antd';
import { EditOutlined, DeleteOutlined, ReloadOutlined, UserOutlined } from '@ant-design/icons';

interface User {
  username: string;
  nickname: string;
  avatar: string;
  admin: number;
  created_at: string;
  daily_buyin_used: number;
  daily_buyin_remaining: number;
  daily_buyin_day_key: string;
}

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [modalDailyBuyInUsed, setModalDailyBuyInUsed] = useState(0);
  const [form] = Form.useForm();

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
      dailyBuyInUsed: user.daily_buyin_used ?? 0,
    });
    setModalDailyBuyInUsed(user.daily_buyin_used ?? 0);
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
          dailyBuyInUsed: Number(values.dailyBuyInUsed ?? 0),
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

  const stats = useMemo(() => {
    const total = users.length;
    const admins = users.filter((u) => u.admin === 1).length;
    const exhausted = users.filter((u) => (u.daily_buyin_remaining ?? 0) <= 0).length;
    return { total, admins, exhausted };
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
      render: (_: unknown, record: User) => (
        <div style={{ minWidth: 150 }}>
          <Typography.Text style={{ fontSize: 12 }}>
            已用 {record.daily_buyin_used ?? 0} / 5，剩余 {record.daily_buyin_remaining ?? 0}
          </Typography.Text>
          <Progress
            percent={Math.min(100, Math.round(((record.daily_buyin_used ?? 0) / 5) * 100))}
            size="small"
            showInfo={false}
            status={(record.daily_buyin_remaining ?? 0) <= 0 ? 'exception' : 'active'}
          />
        </div>
      ),
    },
    {
      title: '重置日键',
      dataIndex: 'daily_buyin_day_key',
      key: 'daily_buyin_day_key',
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
        <Tag color={stats.exhausted > 0 ? 'red' : 'green'}>
          买入耗尽：{stats.exhausted}
        </Tag>
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
          setModalDailyBuyInUsed(0);
        }}
      >
        <Form
          form={form}
          layout="vertical"
          onValuesChange={(changedValues) => {
            if (Object.prototype.hasOwnProperty.call(changedValues, 'dailyBuyInUsed')) {
              setModalDailyBuyInUsed(Number(changedValues.dailyBuyInUsed || 0));
            }
          }}
        >
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
          <Form.Item
            name="dailyBuyInUsed"
            label="今日已用买入次数"
            rules={[{ required: true, message: '请输入0~5' }]}
          >
            <InputNumber min={0} max={5} precision={0} style={{ width: '100%' }} />
          </Form.Item>
          <Typography.Text type="secondary">
            剩余买入次数：{Math.max(0, 5 - Number(modalDailyBuyInUsed ?? 0))}
          </Typography.Text>
        </Form>
      </Modal>
    </Card>
  );
};

export default UserManagement;
