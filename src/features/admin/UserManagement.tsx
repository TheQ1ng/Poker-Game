import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Switch, message } from 'antd';

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
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
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

  // 保存编辑
  const handleSave = async () => {
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
    }
  };

  const columns = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: '昵称',
      dataIndex: 'nickname',
      key: 'nickname',
    },
    {
      title: '头像',
      dataIndex: 'avatar',
      key: 'avatar',
      render: (avatar: string) => (
        <img src={`/static/media/${avatar}`} alt="avatar" style={{ width: 40, height: 40, borderRadius: '50%' }} />
      ),
    },
    {
      title: '管理员',
      dataIndex: 'admin',
      key: 'admin',
      render: (admin: number) => (admin === 1 ? '是' : '否'),
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
        <div>
          <Button type="primary" size="small" onClick={() => handleEdit(record)} style={{ marginRight: 8 }}>
            编辑
          </Button>
          <Button danger size="small" onClick={() => handleDelete(record.username)} disabled={record.username === 'admin'}>
            删除
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <h2>用户管理</h2>
      <Table columns={columns} dataSource={users} rowKey="username" loading={loading} />

      <Modal
        title={editingUser ? '编辑用户' : '添加用户'}
        visible={isModalVisible}
        onOk={handleSave}
        onCancel={() => setIsModalVisible(false)}
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
    </div>
  );
};

export default UserManagement;
