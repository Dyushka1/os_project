import { useMemo, useState } from "react";
import { Alert, Badge, Button, Card, Empty, Input, Space, Table, Tag, Typography, message } from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import BrandedScreen from "../features/branding/BrandedScreen";
import SessionGuard from "../features/session/SessionGuard";
import api from "../api/axios";

const { Search } = Input;
const { Title, Text } = Typography;

type IssueOrderRaw = {
  id: number;
  order_number?: number | null;
  status: string;
  notify_method: string | null;
  notify_contact: string | null;
  client: { name?: string; phone?: string } | null;
  model_id: number | null;
  size_id: number | null;
  color_id: number | null;
};

const READY_STATUSES = new Set(["printed"]);

const statusLabel: Record<string, string> = {
  printed: "Готов к выдаче",
  delivering: "Клиент вызван",
};

const statusColor: Record<string, string> = {
  printed: "blue",
  delivering: "orange",
};

export default function IssueDesk() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const queueQuery = useQuery({
    queryKey: ["issue-queue"],
    queryFn: async () => {
      const res = await api.get<IssueOrderRaw[]>("/orders/queue/issue");
      return res.data;
    },
    refetchInterval: 8000,
    retry: false,
  });

  const startDeliveryMutation = useMutation({
    mutationFn: async (orderId: number) => {
      await api.post(`/orders/${orderId}/start_delivery`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issue-queue"] });
      message.success("Клиент вызван — заказ переведён на выдачу");
    },
    onError: (error: any) => {
      message.error(error?.response?.data?.detail || "Не удалось перевести заказ");
    },
  });

  const issueMutation = useMutation({
    mutationFn: async (orderId: number) => {
      await api.post(`/orders/${orderId}/issue`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issue-queue"] });
      message.success("Заказ выдан клиенту");
    },
    onError: (error: any) => {
      message.error(error?.response?.data?.detail || "Не удалось выдать заказ");
    },
  });

  const filtered = useMemo(() => {
    const orders = queueQuery.data ?? [];
    if (!search.trim()) return orders;
    const q = search.trim().toLowerCase();
    return orders.filter(
      (o) =>
        String(o.id).includes(q) ||
        o.client?.name?.toLowerCase().includes(q) ||
        o.client?.phone?.toLowerCase().includes(q) ||
        o.notify_contact?.toLowerCase().includes(q),
    );
  }, [queueQuery.data, search]);

  const readyCount = useMemo(() => filtered.filter((o) => READY_STATUSES.has(o.status)).length, [filtered]);
  const deliveringCount = useMemo(() => filtered.filter((o) => o.status === "delivering").length, [filtered]);

  const columns = [
    {
      title: "№ заказа",
      dataIndex: "order_number",
      key: "order_number",
      width: 100,
      render: (_: number, record: IssueOrderRaw) => <Text strong style={{ fontSize: 18 }}>#{record.order_number ?? record.id}</Text>,
    },
    {
      title: "Клиент",
      key: "client",
      render: (_: unknown, record: IssueOrderRaw) => {
        const name = record.client?.name;
        const contact = record.notify_contact || record.client?.phone;
        return (
          <Space direction="vertical" size={0}>
            {name && <Text strong>{name}</Text>}
            {contact && (
              <Text type="secondary">
                {record.notify_method === "sms" ? "📱 " : record.notify_method === "email" ? "✉ " : ""}
                {contact}
              </Text>
            )}
            {!name && !contact && <Text type="secondary">—</Text>}
          </Space>
        );
      },
    },
    {
      title: "Статус",
      key: "status",
      width: 160,
      render: (_: unknown, record: IssueOrderRaw) => (
        <Tag color={statusColor[record.status] ?? "default"}>
          {statusLabel[record.status] ?? record.status}
        </Tag>
      ),
    },
    {
      title: "Действие",
      key: "action",
      width: 200,
      render: (_: unknown, record: IssueOrderRaw) =>
        record.status === "delivering" ? (
          <Button
            type="primary"
            size="large"
            style={{ height: 48, width: "100%", background: "#52c41a", borderColor: "#52c41a" }}
            loading={issueMutation.isPending}
            onClick={() => issueMutation.mutate(record.id)}
          >
            Выдан клиенту
          </Button>
        ) : (
          <Button
            type="primary"
            size="large"
            style={{ height: 48, width: "100%" }}
            loading={startDeliveryMutation.isPending}
            onClick={() => startDeliveryMutation.mutate(record.id)}
          >
            Вызвать клиента
          </Button>
        ),
    },
  ];

  return (
    <SessionGuard>
    <BrandedScreen backgroundKey="kiosk-bg" idleSplash splashTitle="Нажмите для работы">
      <Card style={{ margin: 16, maxWidth: 900 }}>
        <Space direction="vertical" size={20} style={{ width: "100%" }}>
          <Title level={2} style={{ margin: 0 }}>Мастер выдачи</Title>

          <Space wrap>
            <Badge count={readyCount} color="#1677ff" showZero>
              <Tag color="blue" style={{ fontSize: 14, padding: "4px 12px" }}>Готовы к выдаче</Tag>
            </Badge>
            <Badge count={deliveringCount} color="#fa8c16" showZero>
              <Tag color="orange" style={{ fontSize: 14, padding: "4px 12px" }}>Клиент вызван</Tag>
            </Badge>
          </Space>

          <Search
            placeholder="Поиск по номеру заказа, имени или телефону"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
            size="large"
          />

          {queueQuery.isError && (
            <Alert type="error" showIcon message="Не удалось загрузить очередь выдачи" />
          )}

          {!queueQuery.isLoading && filtered.length === 0 ? (
            <Empty description="Нет заказов для выдачи" />
          ) : (
            <Table
              rowKey="id"
              columns={columns}
              dataSource={filtered}
              pagination={false}
              size="middle"
              loading={queueQuery.isLoading}
            />
          )}
        </Space>
      </Card>
    </BrandedScreen>
    </SessionGuard>
  );
}
