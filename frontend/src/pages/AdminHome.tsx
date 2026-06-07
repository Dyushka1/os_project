import { useMemo } from "react";
import { Alert, Button, Card, Col, Divider, Row, Space, Statistic, Tag, Typography, message } from "antd";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "../api/axios";
import { getCurrentRole } from "../auth/token";
import { resolveBrandingFileUrl, useBranding } from "../features/branding/useBranding";

const { Title, Text } = Typography;

type SummaryResponse = {
  total_orders: number;
  completed_orders: number;
  statuses: {
    confirmed: number;
    printed: number;
    nanesenie_done: number;
  };
  queues: {
    queue_print: number;
    queue_nanesenie: number;
    queue_issue: number;
  };
  active_session: {
    id: number;
    has_nanesenie: boolean;
    started_at: string;
  } | null;
};

type AdminAction = {
  key: string;
  label: string;
  path?: string;
  ready: boolean;
};

const adminActions: AdminAction[] = [
  { key: "reception", label: "Ресепшн", path: "/reception", ready: true },
  { key: "session", label: "Смена", path: "/session", ready: true },
  { key: "orders", label: "Заказы", path: "/orders", ready: true },
  { key: "catalog", label: "Каталог", path: "/admin/catalog", ready: true },
  { key: "staff", label: "Сотрудники", path: "/admin/staff", ready: true },
  { key: "stats", label: "Статистика", path: "/admin/stats", ready: true },
  { key: "board", label: "Табло", path: "/board", ready: true },
  { key: "restart", label: "Перезапуск смены", path: "/admin/session-ops", ready: true },
  { key: "continue", label: "Продолжить смену", path: "/admin/session-ops", ready: true },
  { key: "delete-all-orders", label: "Удалить все заказы", path: "/admin/session-ops", ready: true },
  { key: "branding", label: "Брендирование", path: "/admin/branding", ready: true },
];

export default function AdminHome() {
  const navigate = useNavigate();
  const role = getCurrentRole();
  const branding = useBranding();
  const logoUrl = resolveBrandingFileUrl(branding.getAsset("logo")?.file_url);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-summary"],
    queryFn: async () => {
      const res = await api.get<SummaryResponse>("/stats/summary");
      return res.data;
    },
    retry: false,
  });

  const summary = useMemo(() => {
    if (!data) {
      return {
        total_orders: 0,
        completed_orders: 0,
        queue_print: 0,
        queue_nanesenie: 0,
        queue_issue: 0,
      };
    }

    return {
      total_orders: data.total_orders,
      completed_orders: data.completed_orders,
      queue_print: data.queues.queue_print,
      queue_nanesenie: data.queues.queue_nanesenie,
      queue_issue: data.queues.queue_issue,
    };
  }, [data]);

  if (role !== "admin") {
    return (
      <Card style={{ maxWidth: 760, margin: "24px auto" }}>
        <Alert type="warning" showIcon message="Доступно только администратору" />
        <div style={{ marginTop: 16 }}>
          <Button type="primary" onClick={() => navigate("/login")}>Ко входу</Button>
        </div>
      </Card>
    );
  }

  return (
    <div style={{ padding: 16 }}>
      <Card>
        <Space direction="vertical" size={6} style={{ width: "100%" }}>
          {logoUrl ? (
            <img src={logoUrl} alt="Логотип" style={{ maxHeight: 52, objectFit: "contain", width: "fit-content" }} />
          ) : null}
          <Title level={3} style={{ margin: 0 }}>Администратор · Главный экран</Title>
          <Text type="secondary">Стартовая панель по ТЗ: смена, заказы, каталог, сотрудники, статистика, табло.</Text>

          {data?.active_session ? (
            <Tag color={data.active_session.has_nanesenie ? "blue" : "orange"}>
              Смена активна · #{data.active_session.id} ·
              {data.active_session.has_nanesenie ? " с нанесением" : " без нанесения"}
            </Tag>
          ) : (
            <Tag color="red">Нет активной смены</Tag>
          )}
        </Space>

        <Divider />

        <Row gutter={[12, 12]}>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Statistic title="Всего заказов" value={summary.total_orders} loading={isLoading} />
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Statistic title="Выдано" value={summary.completed_orders} loading={isLoading} />
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Statistic title="Очередь печати" value={summary.queue_print} loading={isLoading} />
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Statistic title="Очередь нанесения" value={summary.queue_nanesenie} loading={isLoading} />
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Statistic title="Очередь выдачи" value={summary.queue_issue} loading={isLoading} />
          </Col>
        </Row>

        {isError && (
          <Alert
            type="info"
            showIcon
            style={{ marginTop: 12 }}
            message="Статистика недоступна — кнопки всё равно работают"
          />
        )}

        <Divider />

        <Row gutter={[12, 12]}>
          {adminActions.map((action) => (
            <Col xs={24} sm={12} md={8} lg={6} key={action.key}>
              <Button
                block
                type={action.ready ? "primary" : "default"}
                onClick={() => {
                  if (!action.ready || !action.path) {
                    message.info("Функция временно недоступна");
                    return;
                  }
                  navigate(action.path);
                }}
              >
                {action.label}
              </Button>
            </Col>
          ))}
        </Row>
      </Card>
    </div>
  );
}
