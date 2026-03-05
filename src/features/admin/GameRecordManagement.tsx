import React, { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import { Table, message, Button, Modal, Checkbox } from 'antd';

interface GameRecord {
  id: number;
  room_id: string;
  created_at: string;
  players?: PlayerRecord[];
}

interface PlayerRecord {
  id: number;
  game_record_id: number;
  username: string;
  nickname: string;
  chips: number;
  buy_in: number;
  profit: number;
}

interface RoomInfo {
  id: string;
  created_at: string;
  gameRecords: GameRecord[];
}

interface PlayerStats {
  username: string;
  nicknames: string[];
  totalProfit: number;
  gameCount: number;
}

const GameRecordManagement: React.FC = () => {
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);
  const [showScoreboard, setShowScoreboard] = useState(false);
  const [currentGameRecord, setCurrentGameRecord] = useState<GameRecord | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [summaryStats, setSummaryStats] = useState<PlayerStats[]>([]);
  const [playerRecords, setPlayerRecords] = useState<PlayerRecord[]>([]);
  const summaryScoreboardRef = useRef<HTMLDivElement>(null);

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
        roomMap.forEach((gameRecords, roomId) => {
          // 按创建时间倒序排序
          gameRecords.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          roomList.push({
            id: roomId,
            created_at: gameRecords[0].created_at,
            gameRecords,
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

  // 查看游戏记录的积分榜
  const viewScoreboard = async (gameRecord: GameRecord) => {
    setCurrentGameRecord(gameRecord);
    setLoading(true);
    try {
      const response = await fetch(`/admin/game-record/${gameRecord.id}/players`, {
        headers: {
          Authorization: localStorage.getItem('token') || '',
        },
      });
      const data = await response.json();
      if (data.code === 0) {
        setPlayerRecords(data.data);
        setShowScoreboard(true);
      } else {
        message.error(data.error);
      }
    } catch (error) {
      console.error('Failed to fetch player records:', error);
      message.error('获取玩家记录失败');
    } finally {
      setLoading(false);
    }
  };

  // 查看汇总积分榜
  const viewSummaryScoreboard = async () => {
    if (selectedRooms.length === 0) {
      message.warning('请至少选择一个房间');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/admin/summary-scoreboard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: localStorage.getItem('token') || '',
        },
        body: JSON.stringify({ roomIds: selectedRooms }),
      });
      const data = await response.json();
      if (data.code === 0) {
        setSummaryStats(data.data);
        setShowSummary(true);
      } else {
        message.error(data.error);
      }
    } catch (error) {
      console.error('Failed to fetch summary scoreboard:', error);
      message.error('获取汇总积分榜失败');
    } finally {
      setLoading(false);
    }
  };

  // 处理房间选择
  const handleRoomSelect = (roomId: string, checked: boolean) => {
    if (checked) {
      setSelectedRooms([...selectedRooms, roomId]);
    } else {
      setSelectedRooms(selectedRooms.filter(id => id !== roomId));
    }
  };

  // 下载汇总积分榜为PNG
  const downloadSummaryScoreboard = async () => {
    if (!summaryScoreboardRef.current) {
      message.error('无法找到积分榜元素');
      return;
    }

    try {
      // 使用html2canvas将元素转换为Canvas
      const canvas = await html2canvas(summaryScoreboardRef.current, {
        scale: 2, // 提高清晰度
        useCORS: true, // 允许加载跨域图片
        backgroundColor: '#ffffff' // 设置背景色为白色
      });

      // 将Canvas转换为图片URL
      const imageUrl = canvas.toDataURL('image/png');

      // 创建下载链接并触发下载
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = `汇总积分榜_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`;
      link.click();

      message.success('积分榜下载成功');
    } catch (error) {
      console.error('下载失败:', error);
      message.error('下载失败，请重试');
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
      title: '保存的记录数',
      key: 'recordCount',
      render: (_: any, room: RoomInfo) => room.gameRecords.length,
    },
  ];

  // 游戏记录列定义
  const gameRecordColumns = [
    {
      title: '记录ID',
      dataIndex: 'id',
      key: 'id',
    },
    {
      title: '保存时间',
      dataIndex: 'created_at',
      key: 'created_at',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: GameRecord) => (
        <Button type="primary" onClick={() => viewScoreboard(record)}>
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
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: '昵称',
      dataIndex: 'nickname',
      key: 'nickname',
    },
    {
      title: '最终积分',
      dataIndex: 'chips',
      key: 'chips',
      render: (chips: number) => (
        <span style={{ color: 'blue' }}>
          {chips}
        </span>
      ),
    },
    {
      title: '买入',
      dataIndex: 'buy_in',
      key: 'buy_in',
    },
    {
      title: '积分',
      dataIndex: 'profit',
      key: 'profit',
      render: (profit: number) => (
        <span style={{ color: profit >= 0 ? 'green' : 'red' }}>
          {profit >= 0 ? '+' : ''}{profit}
        </span>
      ),
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
      key: 'nicknames',
      render: (_: any, record: PlayerStats) => {
        // 去重并显示所有昵称
        const uniqueNicknames = [...new Set(record.nicknames)];
        return uniqueNicknames.join(' / ');
      },
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
      title: '参与次数',
      dataIndex: 'gameCount',
      key: 'gameCount',
    },
  ];

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
        expandable={{
          expandedRowRender: (room: RoomInfo) => (
            <Table
              columns={gameRecordColumns}
              dataSource={room.gameRecords}
              rowKey="id"
              pagination={false}
            />
          ),
        }}
      />

      {/* 游戏记录积分榜模态框 */}
      <Modal
        title={`游戏记录 ${currentGameRecord?.id} 的积分榜 (${currentGameRecord?.room_id})`}
        visible={showScoreboard}
        onCancel={() => setShowScoreboard(false)}
        width={800}
      >
        <Table 
          columns={scoreboardColumns} 
          dataSource={playerRecords} 
          rowKey="id"
          loading={loading}
        />
      </Modal>

      {/* 汇总积分榜模态框 */}
      <Modal
        title={`汇总积分榜 (${selectedRooms.length}个房间)`}
        visible={showSummary}
        onCancel={() => setShowSummary(false)}
        width={800}
        footer={[
          <Button key="download" type="primary" onClick={downloadSummaryScoreboard}>
            下载积分榜
          </Button>,
          <Button key="close" onClick={() => setShowSummary(false)}>
            关闭
          </Button>
        ]}
      >
        <div ref={summaryScoreboardRef}>
          <Table 
            columns={summaryColumns} 
            dataSource={summaryStats} 
            rowKey="username"
            loading={loading}
          />
        </div>
      </Modal>
    </div>
  );
};

export default GameRecordManagement;
