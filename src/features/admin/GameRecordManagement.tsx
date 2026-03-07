import React, { useEffect, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import {
  Table,
  message,
  Button,
  Modal,
  Checkbox,
  Card,
  Space,
  Typography,
  Tag,
  Form,
  Input,
  InputNumber,
  Popconfirm,
} from 'antd';
import {
  ReloadOutlined,
  DownloadOutlined,
  TrophyOutlined,
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
} from '@ant-design/icons';

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
  uuid?: string;
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
  const [playerEditorVisible, setPlayerEditorVisible] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<PlayerRecord | null>(null);
  const [playerSaving, setPlayerSaving] = useState(false);
  const [playerForm] = Form.useForm();
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
        const roomMap = new Map<string, GameRecord[]>();
        data.data.forEach((record: GameRecord) => {
          if (!roomMap.has(record.room_id)) {
            roomMap.set(record.room_id, []);
          }
          roomMap.get(record.room_id)?.push(record);
        });

        const roomList: RoomInfo[] = [];
        roomMap.forEach((gameRecords, roomId) => {
          gameRecords.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          roomList.push({
            id: roomId,
            created_at: gameRecords[0].created_at,
            gameRecords,
          });
        });

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

  const loadPlayerRecords = async (gameRecordId: number) => {
    const response = await fetch(`/admin/game-record/${gameRecordId}/players`, {
      headers: {
        Authorization: localStorage.getItem('token') || '',
      },
    });
    const data = await response.json();
    if (data.code !== 0) {
      throw new Error(data.error || '获取玩家记录失败');
    }
    setPlayerRecords(data.data || []);
  };

  // 查看游戏记录的积分榜
  const viewScoreboard = async (gameRecord: GameRecord) => {
    setCurrentGameRecord(gameRecord);
    setLoading(true);
    try {
      await loadPlayerRecords(gameRecord.id);
      setShowScoreboard(true);
    } catch (error) {
      console.error('Failed to fetch player records:', error);
      message.error('获取玩家记录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGameRecord = async (record: GameRecord) => {
    setLoading(true);
    try {
      const response = await fetch('/admin/game-record/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: localStorage.getItem('token') || '',
        },
        body: JSON.stringify({ id: record.id }),
      });
      const data = await response.json();
      if (data.code !== 0) {
        message.error(data.error || '删除游戏记录失败');
        return;
      }
      message.success('删除游戏记录成功');
      if (currentGameRecord?.id === record.id) {
        setShowScoreboard(false);
        setCurrentGameRecord(null);
        setPlayerRecords([]);
      }
      await fetchGameRecords();
    } catch (error) {
      console.error('Failed to delete game record:', error);
      message.error('删除游戏记录失败');
    } finally {
      setLoading(false);
    }
  };

  const openCreatePlayer = () => {
    if (!currentGameRecord) return;
    setEditingPlayer(null);
    playerForm.setFieldsValue({
      username: '',
      nickname: '',
      uuid: '',
      chips: 0,
      buy_in: 0,
      profit: 0,
    });
    setPlayerEditorVisible(true);
  };

  const openEditPlayer = (record: PlayerRecord) => {
    setEditingPlayer(record);
    playerForm.setFieldsValue({
      username: record.username,
      nickname: record.nickname,
      uuid: record.uuid || '',
      chips: record.chips,
      buy_in: record.buy_in,
      profit: record.profit,
    });
    setPlayerEditorVisible(true);
  };

  const handleSavePlayer = async () => {
    if (!currentGameRecord) return;
    setPlayerSaving(true);
    try {
      const values = await playerForm.validateFields();
      const response = await fetch('/admin/game-record/player/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: localStorage.getItem('token') || '',
        },
        body: JSON.stringify({
          id: editingPlayer?.id,
          gameRecordId: currentGameRecord.id,
          username: values.username,
          nickname: values.nickname,
          uuid: values.uuid || '',
          chips: Number(values.chips || 0),
          buyIn: Number(values.buy_in || 0),
          profit: Number(values.profit || 0),
        }),
      });
      const data = await response.json();
      if (data.code !== 0) {
        message.error(data.error || '保存失败');
        return;
      }
      message.success(editingPlayer ? '更新成功' : '新增成功');
      setPlayerEditorVisible(false);
      await loadPlayerRecords(currentGameRecord.id);
      await fetchGameRecords();
    } catch (error) {
      console.error('Failed to save player record:', error);
      message.error('保存玩家记录失败');
    } finally {
      setPlayerSaving(false);
    }
  };

  const handleDeletePlayer = async (record: PlayerRecord) => {
    if (!currentGameRecord) return;
    setLoading(true);
    try {
      const response = await fetch('/admin/game-record/player/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: localStorage.getItem('token') || '',
        },
        body: JSON.stringify({
          id: record.id,
        }),
      });
      const data = await response.json();
      if (data.code !== 0) {
        message.error(data.error || '删除失败');
        return;
      }
      message.success('删除成功');
      await loadPlayerRecords(currentGameRecord.id);
      await fetchGameRecords();
    } catch (error) {
      console.error('Failed to delete player record:', error);
      message.error('删除玩家记录失败');
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
      setSelectedRooms(selectedRooms.filter((id) => id !== roomId));
    }
  };

  // 下载汇总积分榜为PNG
  const downloadSummaryScoreboard = async () => {
    if (!summaryScoreboardRef.current) {
      message.error('无法找到积分榜元素');
      return;
    }

    try {
      const canvas = await html2canvas(summaryScoreboardRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });
      const imageUrl = canvas.toDataURL('image/png');
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
      render: (_: unknown, room: RoomInfo) => (
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
      render: (_: unknown, room: RoomInfo) => room.gameRecords.length,
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
      render: (_: unknown, record: GameRecord) => (
        <Space>
          <Button className="admin-action-btn" type="primary" size="small" onClick={() => viewScoreboard(record)}>
            查看积分榜
          </Button>
          <Popconfirm
            title="确认删除该局记录及其所有玩家行吗？"
            onConfirm={() => handleDeleteGameRecord(record)}
            okText="删除"
            cancelText="取消"
          >
            <Button className="admin-action-btn" danger size="small" icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 积分榜列定义
  const scoreboardColumns = [
    {
      title: '排名',
      key: 'rank',
      render: (_: unknown, __: unknown, index: number) => index + 1,
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
      render: (chips: number) => <span style={{ color: '#1f66ff' }}>{chips}</span>,
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
        <span style={{ color: profit >= 0 ? '#2f9e44' : '#e03131' }}>
          {profit >= 0 ? '+' : ''}
          {profit}
        </span>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: PlayerRecord) => (
        <Space>
          <Button className="admin-action-btn" size="small" icon={<EditOutlined />} onClick={() => openEditPlayer(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确认删除该玩家行吗？"
            onConfirm={() => handleDeletePlayer(record)}
            okText="删除"
            cancelText="取消"
          >
            <Button className="admin-action-btn" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 汇总积分榜列定义
  const summaryColumns = [
    {
      title: '排名',
      key: 'rank',
      render: (_: unknown, __: unknown, index: number) => index + 1,
    },
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: '昵称',
      key: 'nicknames',
      render: (_: unknown, record: PlayerStats) => {
        const uniqueNicknames = [...new Set(record.nicknames)];
        return uniqueNicknames.join(' / ');
      },
    },
    {
      title: '总积分',
      dataIndex: 'totalProfit',
      key: 'totalProfit',
      render: (totalProfit: number) => (
        <span style={{ color: totalProfit >= 0 ? '#2f9e44' : '#e03131' }}>
          {totalProfit >= 0 ? '+' : ''}
          {totalProfit}
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
    <Card
      className="admin-page-card"
      bordered={false}
      style={{ borderRadius: 12 }}
      title={<Typography.Title level={4} style={{ margin: 0 }}>游戏记录管理</Typography.Title>}
      extra={
        <Space>
          <Button className="admin-action-btn" icon={<ReloadOutlined />} onClick={fetchGameRecords} loading={loading}>
            刷新
          </Button>
          <Button
            className="admin-action-btn"
            type="primary"
            icon={<TrophyOutlined />}
            onClick={viewSummaryScoreboard}
            disabled={selectedRooms.length === 0}
          >
            查看汇总积分榜
          </Button>
        </Space>
      }
    >
      <Space size={12} className="admin-stats">
        <Tag color="blue">房间数：{rooms.length}</Tag>
        <Tag color="purple">已选房间：{selectedRooms.length}</Tag>
      </Space>

      <Table
        className="admin-table"
        columns={roomColumns}
        dataSource={rooms}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
        expandable={{
          expandedRowRender: (room: RoomInfo) => (
            <Table
              className="admin-table"
              columns={gameRecordColumns}
              dataSource={room.gameRecords}
              rowKey="id"
              pagination={false}
            />
          ),
        }}
      />

      <Modal
        className="admin-modal"
        title={`游戏记录 ${currentGameRecord?.id} 的积分榜 (${currentGameRecord?.room_id})`}
        visible={showScoreboard}
        onCancel={() => setShowScoreboard(false)}
        width={980}
        footer={[
          <Button key="add" type="primary" icon={<PlusOutlined />} onClick={openCreatePlayer}>
            新增行
          </Button>,
          <Button key="close" onClick={() => setShowScoreboard(false)}>
            关闭
          </Button>,
        ]}
      >
        <Table
          className="admin-table"
          columns={scoreboardColumns}
          dataSource={playerRecords}
          rowKey="id"
          loading={loading}
          pagination={false}
        />
      </Modal>

      <Modal
        className="admin-modal"
        title={editingPlayer ? '编辑玩家记录' : '新增玩家记录'}
        visible={playerEditorVisible}
        onCancel={() => setPlayerEditorVisible(false)}
        onOk={handleSavePlayer}
        confirmLoading={playerSaving}
      >
        <Form form={playerForm} layout="vertical">
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="nickname" label="昵称" rules={[{ required: true, message: '请输入昵称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="uuid" label="UUID (可选)">
            <Input />
          </Form.Item>
          <Form.Item name="chips" label="最终积分" rules={[{ required: true, message: '请输入最终积分' }]}>
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="buy_in" label="买入" rules={[{ required: true, message: '请输入买入' }]}>
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="profit" label="积分" rules={[{ required: true, message: '请输入积分' }]}>
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        className="admin-modal"
        title={`汇总积分榜 (${selectedRooms.length}个房间)`}
        visible={showSummary}
        onCancel={() => setShowSummary(false)}
        width={960}
        footer={[
          <Button key="download" type="primary" icon={<DownloadOutlined />} onClick={downloadSummaryScoreboard}>
            下载积分榜
          </Button>,
          <Button key="close" onClick={() => setShowSummary(false)}>
            关闭
          </Button>,
        ]}
      >
        <div ref={summaryScoreboardRef}>
          <Table
            className="admin-table"
            columns={summaryColumns}
            dataSource={summaryStats}
            rowKey="username"
            loading={loading}
            pagination={false}
          />
        </div>
      </Modal>
    </Card>
  );
};

export default GameRecordManagement;
