import { Table } from "antd";
import { ColumnsType } from "antd/lib/table";
import { useAppSelector } from "../../app/hooks";
import { selectChipsRecord } from "./chipsRecordSlice";
import "./ChipsRecord.css";

export interface TableData {
  id: string;
  name: string;
  chips: number;
  overflow: number;
  buyIn: number;
  profit: number;
}

export function ChipsRecord() {
  const roomChipsRecords = useAppSelector(selectChipsRecord);
  
  // 只使用真实数据
  const data: TableData[] = roomChipsRecords.chipsRecords.map((cr) => ({
    id: cr.id,
    name: cr.nickname || cr.name,
    chips: Number(cr.chips) || 0,
    overflow: Number(cr.overflow) || 0,
    buyIn: cr.buyIn,
    profit: (Number(cr.chips) || 0) + (Number(cr.overflow) || 0) - cr.buyIn,
  }));
  
  const columns: ColumnsType<any> = [
    {
      title: "玩家",
      dataIndex: "name",
      key: "name",
    },
    {
      title: "欢乐豆",
      dataIndex: "chips",
      key: "chips",
      sorter: (a: TableData, b: TableData) => (a.chips + a.overflow) - (b.chips + b.overflow),
    },
    {
      title: "溢出",
      dataIndex: "overflow",
      key: "overflow",
      sorter: (a: TableData, b: TableData) => a.overflow - b.overflow,
    },
    {
      title: "初始",
      dataIndex: "buyIn",
      key: "buyIn",
      sorter: (a: TableData, b: TableData) => a.buyIn - b.buyIn,
    },
    {
      title: "积分",
      dataIndex: "profit",
      key: "profit",
      sorter: (a: TableData, b: TableData) => a.profit - b.profit,
    },
  ];
  return (
    <div className="chips-record-table" style={{ height: "100%" }}>
      <Table
        rowKey={"id"}
        columns={columns}
        dataSource={data}
        pagination={false}
        scroll={{ y: '100%', x: '100%' }}
      />
    </div>
  );
}
