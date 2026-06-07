import { useState } from "react";
import { Table, Input, Card, Button } from "antd";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { fetchOrders } from "./ordersApi";

const { Search } = Input;

export default function OrdersList() {
  const [q, setQ] = useState<string>("");
  const navigate = useNavigate();

  const { data = [], isLoading, refetch } = useQuery({
    queryKey: ["orders", { q }],
    queryFn: () => fetchOrders({ q }),
    placeholderData: (prev) => prev,
  });

  const columns = [
    { title: "№ заказа", dataIndex: "order_number", key: "order_number" },
    { title: "Status", dataIndex: "status", key: "status" },
    {
      title: "Client",
      key: "client",
      render: (_: any, record: any) => record.client?.name || "",
    },
    { title: "Promo", dataIndex: "promo_code", key: "promo_code" },
  ];

  return (
    <Card style={{ margin: 16 }}>
      <div style={{ marginBottom: 12 }}>
        <Search
          placeholder="Поиск по id, имени, телефону или промо"
          enterButton
          onSearch={(val) => {
            setQ(val);
            refetch();
          }}
          allowClear
        />
      </div>

      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={data}
        columns={columns}
        onRow={(record) => ({
          onClick: () => navigate(`/orders/${record.id}`),
        })}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <Button type="primary" onClick={() => navigate("/orders/new")}>
          Новый заказ
        </Button>  
        <Button onClick={() => navigate("/board")}>Табло</Button>
        <Button onClick={() => navigate("/admin")}>На главный экран</Button>
      </div>
    </Card>
  );
}