import { Button, Card, Space, Table } from "antd";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { fetchBoardStatus } from "./ordersApi";
import BrandedScreen from "../branding/BrandedScreen";

export default function OrdersBoard() {
  const navigate = useNavigate();
  const { data = [], isLoading } = useQuery({
    queryKey: ["orders-board"],
    queryFn: fetchBoardStatus,
    refetchInterval: 5000,
  });

  const columns = [
    { title: "№ заказа", dataIndex: "order_number", key: "order_number" },
    { title: "Статус", dataIndex: "status", key: "status" },
    {
      title: "Клиент",
      key: "client",
      render: (_: any, record: any) => record.client?.name || "-",
    },
    {
      title: "Телефон",
      key: "phone",
      render: (_: any, record: any) => record.client?.phone || "-",
    },
  ];

  return (
    <BrandedScreen backgroundKey="board-bg" showLogo>
      <Card title="Табло статусов" style={{ margin: 16 }}>
        <Space style={{ marginBottom: 12 }}>
          <Button onClick={() => navigate("/admin")}>На главный экран</Button>
        </Space>
        <Table rowKey="id" dataSource={data} columns={columns} loading={isLoading} pagination={{ pageSize: 10 }} />
      </Card>
    </BrandedScreen>
  );
}
