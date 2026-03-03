import React, { useState, useEffect } from 'react';
import { Table, message, Button, Modal, Checkbox, Space } from 'antd';

interface GameRecord {
  id: number;
  room_id: string;
  username: string;
  profit: number;
  final_hand: string;
  created_at: string;
  nickname?: string;
}

interface RoomInfo {
  id: string;
  created_at: string;
  records: GameRecord[];
}

interface PlayerStats {
  username: string;
  nickname: string;
  totalProfit: number;
  gameCount: number;
}

const GameRecordManagement: React.FC = () => {
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);
  const [showScoreboard, setShowScoreboard] = useState(false);
  const [currentRoomId, setCurrentRoomId] = useState<string>('');
  const [showSummary, setShowSummary] = useState(false);
  const [summaryStats, setSummaryStats] = useState<PlayerStats[]>([]);

  // 获取所有游戏记录并按房间分组
  const fetchGameRecords = async () => {
    setLoading(true);
    try {
      const response = await fetch('/admin/game-records', {
        headers: {
          Authorization: localStorage.getItem('token') || '',
        },
      });
      const data = await response.json();
      if (data.code === 0) {
        // 按房间分组
        const roomMap = new Map<string, GameRecord[]>();
        data.data.forEach((record: GameRecord) => {
          if (!roomMap.has(record.room_id)) {
            roomMap.set(record.room_id, []);
          }
          roomMap.get(record.room_id)?.push(record);
        });

        // 转换为房间信息数组
        const roomList: RoomInfo[] = [];
        roomMap.forEach((records, roomId) => {
          // 按创建时间排序，取最早的时间作为房间创建时间
          records.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          roomList.push({
            id: roomId,
            created_at: records[0].created_at,
            records,
          });
        });

        // 按创建时间倒序排序
        roomList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setRooms(roomList);
      } else {
        message.error(data.error);
      }
    } catch (error) {
      console.error('Failed to fetch game records:', error);
      message.error('获取游戏记录失败');
    } finally {
      setLoading(false);
    }
  };

  // 查看房间积分榜
  const viewScoreboard = (roomId: string) => {
    setCurrentRoomId(roomId);
    setShowScoreboard(true);
  };

  // 查看汇总积分榜
  const viewSummaryScoreboard = () => {
    if (selectedRooms.length === 0) {
      message.warning('请至少选择一个房间');
      return;
    }

    // 汇总所选房间的记录
    const userMap = new Map<string, PlayerStats>();
    rooms.forEach(room => {
      if (selectedRooms.includes(room.id)) {
        room.records.forEach(record => {
          if (!userMap.has(record.username)) {
            userMap.set(record.username, {
              username: record.username,
              nickname: record.nickname || record.username,
              totalProfit: 0,
              gameCount: 0,
            });
          }
          const stats = userMap.get(record.username)!;
          stats.totalProfit += record.profit;
          stats.gameCount += 1;
        });
      }
    });

    // 转换为数组并按总积分排序
    const statsArray = Array.from(userMap.values());
    statsArray.sort((a, b) => b.totalProfit - a.totalProfit);
    setSummaryStats(statsArray);
    setShowSummary(true);
  };

  // 处理房间选择
  const handleRoomSelect = (roomId: string, checked: boolean) => {
    if (checked) {
      setSelectedRooms([...selectedRooms, roomId]);
    } else {
      setSelectedRooms(selectedRooms.filter(id => id !== roomId));
    }
  };

  useEffect(() => {
    fetchGameRecords();
  }, []);

  // 房间列表列定义
  const roomColumns = [
    {
      title: '选择',
      key: 'select',
      render: (_: any, room: RoomInfo) => (
        <Checkbox 
          checked={selectedRooms.includes(room.id)}
          onChange={(e) => handleRoomSelect(room.id, e.target.checked)}
        />
      ),
    },
    {
      title: '房间ID',
      dataIndex: 'id',
      key: 'id',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
    },
    {
      title: '游戏局数',
      key: 'gameCount',
      render: (_: any, room: RoomInfo) => room.records.length,
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, room: RoomInfo) => (
        <Button type="primary" onClick={() => viewScoreboard(room.id)}>
          查看积分榜
        </Button>
      ),
    },
  ];

  // 积分榜列定义
  const scoreboardColumns = [
    {
      title: '排名',
      key: 'rank',
      render: (_: any, __: any, index: number) => index + 1,
    },
    {
      title: '用户名',
      key: 'username',
      render: (_: any, record: GameRecord) => record.username,
    },
    {
      title: '昵称',
      key: 'nickname',
      render: (_: any, record: GameRecord) => record.nickname || record.username,
    },
    {
      title: '积分',
      key: 'profit',
      render: (_: any, record: GameRecord) => (
        <span style={{ color: record.profit >= 0 ? 'green' : 'red' }}>
          {record.profit >= 0 ? '+' : ''}{record.profit}
        </span>
      ),
    },
    {
      title: '最终手牌',
      key: 'final_hand',
      render: (_: any, record: GameRecord) => record.final_hand,
    },
    {
      title: '时间',
      key: 'created_at',
      render: (_: any, record: GameRecord) => record.created_at,
    },
  ];

  // 汇总积分榜列定义
  const summaryColumns = [
    {
      title: '排名',
      key: 'rank',
      render: (_: any, __: any, index: number) => index + 1,
    },
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
      title: '总积分',
      dataIndex: 'totalProfit',
      key: 'totalProfit',
      render: (totalProfit: number) => (
        <span style={{ color: totalProfit >= 0 ? 'green' : 'red' }}>
          {totalProfit >= 0 ? '+' : ''}{totalProfit}
        </span>
      ),
    },
    {
      title: '游戏局数',
      dataIndex: 'gameCount',
      key: 'gameCount',
    },
  ];

  // 获取当前房间的记录
  const currentRoomRecords = rooms.find(room => room.id === currentRoomId)?.records || [];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>游戏记录管理</h2>
        <Button 
          type="primary" 
          onClick={viewSummaryScoreboard}
          disabled={selectedRooms.length === 0}
        >
          查看汇总积分榜
        </Button>
      </div>

      <Table 
        columns={roomColumns} 
        dataSource={rooms} 
        rowKey="id" 
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      {/* 房间积分榜模态框 */}
      <Modal
        title={`房间 ${currentRoomId} 的积分榜`}
        visible={showScoreboard}
        onCancel={() => setShowScoreboard(false)}
        width={800}
      >
        <Table 
          columns={scoreboardColumns} 
          dataSource={currentRoomRecords} 
          rowKey="id"
        />
      </Modal>

      {/* 汇总积分榜模态框 */}
      <Modal
        title={`汇总积分榜 (${selectedRooms.length}个房间)`}
        visible={showSummary}
        onCancel={() => setShowSummary(false)}
        width={800}
      >
        <Table 
          columns={summaryColumns} 
          dataSource={summaryStats} 
          rowKey="username"
        />
      </Modal>
    </div>
  );
};

export default GameRecordManagement;
