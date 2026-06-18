import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, List, Avatar, message, Card, Space, Tag, Typography } from 'antd';
import { DeleteOutlined, EyeOutlined, ReloadOutlined, CrownOutlined } from '@ant-design/icons';

interface RoomInfo {
  id: string;
  sb: number;
  buyin: number;
  reBuyLimit: number;
  isShortDeck: boolean;
  isOmaha: boolean;
  players: PlayerInfo[];
  isActive: boolean;
}

interface PlayerInfo {
  name: string;
  nickname: string;
  avatar: string;
  stack: number;
  isOwner: boolean;
  isReady: boolean;
}

const GameProcessManagement: React.FC = () => {
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<RoomInfo | null>(null);
  const [playerModalVisible, setPlayerModalVisible] = useState(false);

  // 获取房间列表
  const fetchRooms = async () => {
    setLoading(true);
    try {
      const response = await fetch('/admin/rooms', {
        headers: {
          'Authorization': localStorage.getItem('token') || ''
        }
      });
      if (response.ok) {
        const data = await response.json();
        setRooms(data.data);
      } else {
        message.error('获取房间列表失败');
      }
    } catch (error) {
      message.error('网络错误');
      console.error('Error fetching rooms:', error);
    } finally {
      setLoading(false);
    }
  };

  // 解散房间
  const dissolveRoom = async (roomId: string) => {
    try {
      const response = await fetch('/admin/room/dissolve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': localStorage.getItem('token') || ''
        },
        body: JSON.stringify({ roomId })
      });
      if (response.ok) {
        message.success('房间解散成功');
        fetchRooms();
      } else {
        message.error('解散房间失败');
      }
    } catch (error) {
      message.error('网络错误');
      console.error('Error dissolving room:', error);
    }
  };

  // 查看房间玩家
  const viewPlayers = (room: RoomInfo) => {
    setSelectedRoom(room);
    setPlayerModalVisible(true);
  };

  // 组件加载时获取房间列表
  useEffect(() => {
    fetchRooms();
  }, []);

  // 表格列定义
  const columns = [
    {
      title: '房间ID',
      dataIndex: 'id',
      key: 'id',
    },
    {
      title: '小弟',
      dataIndex: 'sb',
      key: 'sb',
    },
    {
      title: '初始',
      dataIndex: 'buyin',
      key: 'buyin',
    },
    {
      title: '东山再起规则',
      key: 'reBuyRule',
      render: (_: any, record: RoomInfo) => {
        const tableMaxChips = (record.players || []).reduce(
          (max, player) => Math.max(max, Math.max(0, Number(player.stack) || 0)),
          0
        );
        return <span title={`当前最高欢乐豆 ${tableMaxChips}（含旁观者）`}>动态</span>;
      },
    },
    {
      title: '游戏类型',
      key: 'gameType',
      render: (_: any, record: RoomInfo) => {
        let type = '';
        if (record.isShortDeck) type += '短牌 ';
        if (record.isOmaha) type += '2+3';
        return type || '常规';
      },
    },
    {
      title: '玩家数',
      key: 'playerCount',
      render: (_: any, record: RoomInfo) => record.players.length,
    },
    {
      title: '状态',
      key: 'status',
      render: (_: any, record: RoomInfo) =>
        record.isActive ? <Tag color="green">进行中</Tag> : <Tag>未开始</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: RoomInfo) => (
        <div>
          <Button
            className="admin-action-btn"
            type="primary"
            icon={<EyeOutlined />}
            style={{ marginRight: 8 }}
            onClick={() => viewPlayers(record)}
          >
            查看玩家
          </Button>
          <Button
            className="admin-action-btn"
            danger
            icon={<DeleteOutlined />}
            onClick={() => dissolveRoom(record.id)}
          >
            解散房间
          </Button>
        </div>
      ),
    },
  ];

  return (
    <Card
      className="admin-page-card"
      bordered={false}
      style={{ borderRadius: 12 }}
      title={<Typography.Title level={4} style={{ margin: 0 }}>游戏进程管理</Typography.Title>}
      extra={
        <Button className="admin-action-btn" type="primary" icon={<ReloadOutlined />} onClick={fetchRooms} loading={loading}>
          刷新房间列表
        </Button>
      }
    >
      <Space size={12} className="admin-stats">
        <Tag color="blue">房间总数：{rooms.length}</Tag>
        <Tag color="green">进行中：{rooms.filter((r) => r.isActive).length}</Tag>
      </Space>

      <Table
        columns={columns}
        dataSource={rooms}
        rowKey="id"
        className="admin-table"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      {/* 玩家列表模态框 */}
      <Modal
        title={`房间 ${selectedRoom?.id} 的玩家列表`}
        visible={playerModalVisible}
        className="admin-modal"
        onCancel={() => setPlayerModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setPlayerModalVisible(false)}>
            关闭
          </Button>
        ]}
      >
        {selectedRoom && (
          <List
            itemLayout="horizontal"
            dataSource={selectedRoom.players}
            renderItem={(player) => (
              <List.Item>
                <List.Item.Meta
                  avatar={<Avatar src={`/static/media/${player.avatar}`} />}
                  title={
                    <div>
                      {player.nickname || player.name}
                      {player.isOwner && (
                        <Tag color="gold" icon={<CrownOutlined />} style={{ marginLeft: 8 }}>
                          房主
                        </Tag>
                      )}
                    </div>
                  }
                  description={`积分: ${player.stack}`}
                />
                <div>{player.isReady ? '已准备' : '未准备'}</div>
              </List.Item>
            )}
          />
        )}
      </Modal>
    </Card>
  );
};

export default GameProcessManagement;
