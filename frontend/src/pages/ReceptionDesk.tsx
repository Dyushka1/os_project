import { useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Input,
  Modal,
  Row,
  Segmented,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { fetchOrders, updateOrderStatus } from "../features/orders/ordersApi";
import { getCurrentRole } from "../auth/token";
import { printOrderReceipt } from "../utils/printReceipt";
import SessionGuard from "../features/session/SessionGuard";
import BrandedScreen from "../features/branding/BrandedScreen";

const { Search } = Input;
const { Title, Text } = Typography;

type OrderRow = {
  id: number;
  order_number?: number | null;
  status: string;
  model_id?: number;
  size_id?: number;
  color_id?: number;
  cancel_reason?: string | null;
  client?: {
    name?: string;
    phone?: string;
  };
};

type CatalogModel = { id: number; name: string; color_id: number };
type CatalogSize = { id: number; code: string };
type CatalogColor = { id: number; name: string };

const statusOptions = [
  { value: "new", label: "Подтверждение" },
  { value: "cancel_requested", label: "Запросы отмены" },
  { value: "confirmed", label: "Подтвержденные" },
  { value: "all", label: "Все" },
];

const statusLabels: Record<string, string> = {
  new: "ПОДТВЕРЖДЕНИЕ",
  confirmed: "ПОДТВЕРЖДЕН",
  cancel_requested: "ОТМЕНА ЗАПРОШЕНА",
  canceled: "ОТМЕНЕН",
  printing: "ПЕЧАТЬ",
  printed: "НАПЕЧАТАН",
  nanesenie: "НАНЕСЕНИЕ",
  nanesenie_done: "НАНЕСЕНИЕ ГОТОВО",
  delivering: "ВЫДАЧА",
  issued: "ВЫДАН",
};

const statusColors: Record<string, string> = {
  new: "gold",
  confirmed: "blue",
  cancel_requested: "volcano",
  canceled: "red",
  issued: "green",
};

export default function ReceptionDesk() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const role = getCurrentRole();

  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [cancelModalOrder, setCancelModalOrder] = useState<OrderRow | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const ordersQuery = useQuery({
    queryKey: ["reception-orders", { searchText, statusFilter }],
    queryFn: async () => {
      const data = await fetchOrders({
        q: searchText || undefined,
        status: statusFilter === "all" ? undefined : statusFilter,
        limit: 100,
      });
      return data as OrderRow[];
    },
    placeholderData: (prev) => prev,
    refetchInterval: 7000,
  });

  const modelsQuery = useQuery({
    queryKey: ["reception-catalog-models"],
    queryFn: async () => (await api.get<CatalogModel[]>("/catalog/models/")).data,
    retry: false,
  });

  const sizesQuery = useQuery({
    queryKey: ["reception-catalog-sizes"],
    queryFn: async () => (await api.get<CatalogSize[]>("/catalog/sizes/")).data,
    retry: false,
  });

  const colorsQuery = useQuery({
    queryKey: ["reception-catalog-colors"],
    queryFn: async () => (await api.get<CatalogColor[]>("/catalog/colors/")).data,
    retry: false,
  });

  const refreshOrders = async () => {
    await queryClient.invalidateQueries({ queryKey: ["reception-orders"] });
    await queryClient.invalidateQueries({ queryKey: ["orders"] });
  };

  const confirmMutation = useMutation({
    mutationFn: async (record: OrderRow) => updateOrderStatus(record.id, "confirmed"),
    onSuccess: async (_data, record) => {
      message.success("Заказ подтвержден");
      await refreshOrders();

      const model = record.model_id ? modelsById.get(record.model_id) : undefined;
      const resolvedColorId = record.color_id ?? model?.color_id;
      printOrderReceipt({
        orderId: record.id,
        orderNumber: record.order_number,
        clientName: record.client?.name,
        clientPhone: record.client?.phone,
        modelName: model?.name,
        colorName: resolvedColorId ? colorsById.get(resolvedColorId)?.name : undefined,
        sizeName: record.size_id ? sizesById.get(record.size_id)?.code : undefined,
      });
    },
    onError: (error: any) => {
      const detail = error?.response?.data?.detail || "Не удалось подтвердить заказ";
      message.error(String(detail));
    },
  });

  const requestCancelMutation = useMutation({
    mutationFn: async (payload: { orderId: number; reason: string }) => {
      const res = await api.post(`/orders/${payload.orderId}/cancel_request`, { reason: payload.reason });
      return res.data;
    },
    onSuccess: async () => {
      message.success("Запрос на отмену отправлен");
      setCancelModalOrder(null);
      setCancelReason("");
      await refreshOrders();
    },
    onError: (error: any) => {
      const detail = error?.response?.data?.detail || "Не удалось запросить отмену";
      message.error(String(detail));
    },
  });

  const approveCancelMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const res = await api.post(`/orders/${orderId}/cancel_approve`);
      return res.data;
    },
    onSuccess: async () => {
      message.success("Отмена подтверждена");
      await refreshOrders();
    },
    onError: (error: any) => {
      const detail = error?.response?.data?.detail || "Не удалось подтвердить отмену";
      message.error(String(detail));
    },
  });

  const rejectCancelMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const res = await api.post(`/orders/${orderId}/cancel_reject`);
      return res.data;
    },
    onSuccess: async () => {
      message.success("Отмена отклонена");
      await refreshOrders();
    },
    onError: (error: any) => {
      const detail = error?.response?.data?.detail || "Не удалось отклонить отмену";
      message.error(String(detail));
    },
  });

  const rows = useMemo(() => ordersQuery.data ?? [], [ordersQuery.data]);

  const modelsById = useMemo(() => {
    const map = new Map<number, CatalogModel>();
    for (const item of modelsQuery.data ?? []) {
      map.set(item.id, item);
    }
    return map;
  }, [modelsQuery.data]);

  const sizesById = useMemo(() => {
    const map = new Map<number, CatalogSize>();
    for (const item of sizesQuery.data ?? []) {
      map.set(item.id, item);
    }
    return map;
  }, [sizesQuery.data]);

  const colorsById = useMemo(() => {
    const map = new Map<number, CatalogColor>();
    for (const item of colorsQuery.data ?? []) {
      map.set(item.id, item);
    }
    return map;
  }, [colorsQuery.data]);

  const queueSummary = useMemo(() => {
    const summary = {
      total: rows.length,
      new: 0,
      cancelRequested: 0,
      confirmed: 0,
    };
    for (const row of rows) {
      if (row.status === "new") summary.new += 1;
      if (row.status === "cancel_requested") summary.cancelRequested += 1;
      if (row.status === "confirmed") summary.confirmed += 1;
    }
    return summary;
  }, [rows]);

  if (role !== "reception" && role !== "admin") {
    return (
      <Card style={{ maxWidth: 760, margin: "24px auto" }}>
        <Alert type="warning" showIcon message="Доступно только ресепшену и администратору" />
        <div style={{ marginTop: 16 }}>
          <Button type="primary" onClick={() => navigate("/login")}>Ко входу</Button>
        </div>
      </Card>
    );
  }

  const isBusy =
    confirmMutation.isPending ||
    requestCancelMutation.isPending ||
    approveCancelMutation.isPending ||
    rejectCancelMutation.isPending;

  const columns = [
    {
      title: "№",
      key: "order_number",
      width: 80,
      render: (_: any, record: OrderRow) => record.order_number ?? record.id,
    },
    {
      title: "Статус",
      dataIndex: "status",
      key: "status",
      render: (value: string) => (
        <Tag color={statusColors[value] || "default"}>{statusLabels[value] || value}</Tag>
      ),
    },
    {
      title: "Клиент",
      key: "client",
      render: (_: any, record: OrderRow) => record.client?.name || "-",
    },
    {
      title: "Телефон",
      key: "phone",
      render: (_: any, record: OrderRow) => record.client?.phone || "-",
    },
    {
      title: "Каталог",
      key: "catalog",
      render: (_: any, record: OrderRow) => {
        const model = record.model_id ? modelsById.get(record.model_id) : undefined;
        const size = record.size_id ? sizesById.get(record.size_id) : undefined;

        const resolvedColorId =
          record.color_id ?? model?.color_id;
        const color = resolvedColorId ? colorsById.get(resolvedColorId) : undefined;

        const modelLabel = model?.name ?? (record.model_id ? `#${record.model_id}` : "-");
        const sizeLabel = size?.code ?? (record.size_id ? `#${record.size_id}` : "-");
        const colorLabel = color?.name ?? (resolvedColorId ? `#${resolvedColorId}` : "-");

        return `Модель: ${modelLabel} · Размер: ${sizeLabel} · Цвет: ${colorLabel}`;
      },
    },
    {
      title: "Действия",
      key: "actions",
      width: 360,
      render: (_: any, record: OrderRow) => (
        <Space wrap>
          {record.status === "new" ? (
            <Button type="primary" size="small" loading={confirmMutation.isPending} onClick={() => confirmMutation.mutate(record)}>
              Подтвердить
            </Button>
          ) : null}

          {record.status !== "canceled" && record.status !== "issued" && record.status !== "cancel_requested" ? (
            <Button size="small" danger onClick={() => setCancelModalOrder(record)}>
              Отменить
            </Button>
          ) : null}

          {record.status === "cancel_requested" ? (
            <>
              <Button
                size="small"
                danger
                loading={approveCancelMutation.isPending}
                onClick={() => approveCancelMutation.mutate(record.id)}
              >
                Подтвердить отмену
              </Button>
              <Button
                size="small"
                loading={rejectCancelMutation.isPending}
                onClick={() => rejectCancelMutation.mutate(record.id)}
              >
                Отклонить отмену
              </Button>
            </>
          ) : null}

          <Button size="small" onClick={() => navigate(`/orders/${record.id}`)}>Детали</Button>
        </Space>
      ),
    },
  ];

  return (
    <SessionGuard>
    <BrandedScreen backgroundKey="kiosk-bg" showLogo>
      <Card style={{ margin: 16 }}>
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <Space style={{ justifyContent: "space-between", width: "100%" }} wrap>
            <div>
              <Title level={3} style={{ margin: 0 }}>Ресепшн · Подтверждение заказов</Title>
              <Text type="secondary">Поиск, подтверждение и отмена заказов. Автообновление очереди включено.</Text>
            </div>
            <Button onClick={() => navigate("/admin")}>На главный экран</Button>
          </Space>

          <Row gutter={[12, 12]}>
            <Col xs={24} sm={12} md={6}>
              <Statistic title="В очереди" value={queueSummary.total} />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Statistic title="Подтверждение" value={queueSummary.new} />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Statistic title="Запросы отмены" value={queueSummary.cancelRequested} />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Statistic title="Подтверждено" value={queueSummary.confirmed} />
            </Col>
          </Row>

          <Space wrap>
            <Search
              style={{ width: 360 }}
              placeholder="Поиск по номеру/имени/телефону/промокоду"
              allowClear
              onSearch={(value) => setSearchText(value.trim())}
            />
            <Segmented
              options={statusOptions}
              value={statusFilter}
              onChange={(value) => setStatusFilter(String(value))}
            />
            <Button type="primary" onClick={() => navigate("/orders/new")}>Новый заказ</Button>
            <Button onClick={() => ordersQuery.refetch()}>Обновить</Button>
          </Space>

          {ordersQuery.isError ? (
            <Alert type="error" showIcon message="Не удалось загрузить заказы для ресепшена" />
          ) : null}

          <Table
            rowKey="id"
            columns={columns}
            dataSource={rows}
            loading={ordersQuery.isLoading || isBusy}
            pagination={{ pageSize: 10 }}
            locale={{
              emptyText: (
                <Empty
                  description="Заказов по текущему фильтру нет"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                >
                  <Space>
                    <Button type="primary" onClick={() => navigate("/orders/new")}>Создать заказ</Button>
                    <Button onClick={() => setStatusFilter("all")}>Показать все</Button>
                  </Space>
                </Empty>
              ),
            }}
          />
        </Space>
      </Card>

      <Modal
        title={cancelModalOrder ? `Отмена заказа #${cancelModalOrder.id}` : "Отмена заказа"}
        open={Boolean(cancelModalOrder)}
        okText="Подтвердить"
        cancelText="Отмена"
        okButtonProps={{ danger: true, loading: requestCancelMutation.isPending }}
        onCancel={() => {
          setCancelModalOrder(null);
          setCancelReason("");
        }}
        onOk={() => {
          if (!cancelModalOrder) {
            return;
          }
          if (!cancelReason.trim()) {
            message.error("Укажите причину отмены");
            return;
          }
          requestCancelMutation.mutate({ orderId: cancelModalOrder.id, reason: cancelReason.trim() });
        }}
      >
        <Space direction="vertical" style={{ width: "100%" }}>
          <Text>Укажите причину, почему клиент хочет отменить заказ.</Text>
          <Input.TextArea
            rows={4}
            value={cancelReason}
            onChange={(event) => setCancelReason(event.target.value)}
            placeholder="Причина отмены"
          />
        </Space>
      </Modal>
    </BrandedScreen>
    </SessionGuard>
  );
}
