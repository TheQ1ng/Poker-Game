import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, List, Avatar, message } from 'antd';
import { DeleteOutlined, EyeOutlined } from '@ant-design/icons';

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
      title: '东山再起要求',
      dataIndex: 'reBuyLimit',
      key: 'reBuyLimit',
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
      render: (_: any, record: RoomInfo) => record.isActive ? '进行中' : '未开始',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: RoomInfo) => (
        <div>
          <Button
            type="primary"
            icon={<EyeOutlined />}
            style={{ marginRight: 8 }}
            onClick={() => viewPlayers(record)}
          >
            查看玩家
          </Button>
          <Button
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
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>游戏进程管理</h2>
        <Button type="primary" onClick={fetchRooms} loading={loading}>
          刷新房间列表
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={rooms}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      {/* 玩家列表模态框 */}
      <Modal
        title={`房间 ${selectedRoom?.id} 的玩家列表`}
        visible={playerModalVisible}
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
                      {player.isOwner && <span style={{ marginLeft: 8, color: '#1890ff' }}>(房主)</span>}
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
    </div>
  );
};

export default GameProcessManagement;