import { Alert, Button, Card, Col, Divider, Progress, Row, Space, Statistic, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "../api/axios";

const { Title, Text } = Typography;

type WorkerStatRow = {
  user_id: number;
  username: string;
  role: string;
  count_orders: number;
  items_per_hour: number;
  avg_operation_minutes: number;
};

type SummaryResponse = {
  total_orders: number;
  completed_orders: number;
  avg_cycle_minutes: number;
  statuses: {
    new: number;
    confirmed: number;
    printed: number;
    nanesenie: number;
    nanesenie_done: number;
    printing: number;
    delivering: number;
    issued: number;
  };
  queues: {
    queue_print: number;
    queue_nanesenie: number;
    queue_issue: number;
  };
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Администратор",
  reception: "Ресепшн",
  nanesenie: "Мастер принтов",
  print: "Мастер печати",
  issue: "Выдача",
  user: "Клиент",
};

export default function StatsAdmin() {
  const navigate = useNavigate();

  const summaryQuery = useQuery({
    queryKey: ["stats-summary"],
    queryFn: async () => {
      const res = await api.get<SummaryResponse>("/stats/summary");
      return res.data;
    },
    retry: false,
  });

  const workersQuery = useQuery({
    queryKey: ["stats-workers"],
    queryFn: async () => {
      const res = await api.get<WorkerStatRow[]>("/stats/workers");
      return res.data;
    },
    retry: false,
  });

  const data = summaryQuery.data;

  const queueStats = {
    nanesenie: data?.queues.queue_nanesenie ?? 0,
    print: data?.queues.queue_print ?? 0,
    issue: data?.queues.queue_issue ?? 0,
  };

  const pipelineStats = {
    created: data?.total_orders ?? 0,
    confirmed: data?.statuses.confirmed ?? 0,
    nanesenie: (data?.statuses.nanesenie ?? 0) + (data?.statuses.nanesenie_done ?? 0),
    printing: (data?.statuses.printing ?? 0) + (data?.statuses.printed ?? 0),
    delivering: data?.statuses.delivering ?? 0,
    issued: data?.completed_orders ?? 0,
  };

  const workerColumns: ColumnsType<WorkerStatRow> = [
    {
      title: "Сотрудник",
      dataIndex: "username",
      key: "username",
    },
    {
      title: "Роль",
      dataIndex: "role",
      key: "role",
      render: (value: string) => <Tag>{ROLE_LABELS[value] ?? value}</Tag>,
    },
    {
      title: "Заказов",
      dataIndex: "count_orders",
      key: "count_orders",
      align: "right" as const,
    },
    {
      title: "Изделий / час",
      dataIndex: "items_per_hour",
      key: "items_per_hour",
      align: "right" as const,
      render: (v: number) => (v > 0 ? v.toFixed(1) : "—"),
    },
    {
      title: "Среднее время операции (мин)",
      dataIndex: "avg_operation_minutes",
      key: "avg_operation_minutes",
      align: "right" as const,
      render: (v: number) => (v > 0 ? v.toFixed(1) : "—"),
    },
  ];

  return (
    <div style={{ padding: 16 }}>
      <Card>
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Space style={{ justifyContent: "space-between", width: "100%" }} wrap>
            <div>
              <Title level={3} style={{ margin: 0 }}>Статистика</Title>
              <Text type="secondary">Состояния заказов, очереди и производительность сотрудников.</Text>
            </div>
            <Button onClick={() => navigate("/admin")}>Назад на главный экран</Button>
          </Space>

          <Row gutter={[12, 12]}>
            <Col xs={24} sm={12} md={6}>
              <Statistic title="Оформленных заказов" value={pipelineStats.created} loading={summaryQuery.isLoading} />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Statistic title="Принятых заказов" value={pipelineStats.confirmed} loading={summaryQuery.isLoading} />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Statistic title="Выданных заказов" value={pipelineStats.issued} loading={summaryQuery.isLoading} />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Statistic
                title="Среднее время заказа (мин)"
                value={data?.avg_cycle_minutes ?? 0}
                precision={1}
                suffix={data?.avg_cycle_minutes ? "мин" : ""}
                loading={summaryQuery.isLoading}
              />
            </Col>
          </Row>

          {summaryQuery.isError && (
            <Alert type="info" showIcon message="Статистика недоступна, отображаются нули" />
          )}

          <Divider style={{ margin: "8px 0" }} />

          <Card size="small" title="Статусы заказов (текущее состояние)">
            <Row gutter={[12, 12]}>
              <Col xs={12} sm={8} md={4}>
                <Statistic title="Подтверждение" value={data?.statuses.new ?? 0} loading={summaryQuery.isLoading} />
              </Col>
              <Col xs={12} sm={8} md={4}>
                <Statistic title="Принято" value={pipelineStats.confirmed} loading={summaryQuery.isLoading} />
              </Col>
              <Col xs={12} sm={8} md={4}>
                <Statistic title="Нанесение" value={pipelineStats.nanesenie} loading={summaryQuery.isLoading} />
              </Col>
              <Col xs={12} sm={8} md={4}>
                <Statistic title="Печать" value={pipelineStats.printing} loading={summaryQuery.isLoading} />
              </Col>
              <Col xs={12} sm={8} md={4}>
                <Statistic title="Выдача" value={pipelineStats.delivering} loading={summaryQuery.isLoading} />
              </Col>
              <Col xs={12} sm={8} md={4}>
                <Statistic title="Выдано" value={pipelineStats.issued} loading={summaryQuery.isLoading} />
              </Col>
            </Row>
          </Card>

          <Card size="small" title="Очереди по участкам">
            <Row gutter={[16, 16]}>
              <Col xs={24} md={8}>
                <Text>Нанесение</Text>
                <Progress
                  percent={Math.min(queueStats.nanesenie * 10, 100)}
                  format={() => String(queueStats.nanesenie)}
                />
              </Col>
              <Col xs={24} md={8}>
                <Text>Печать</Text>
                <Progress
                  percent={Math.min(queueStats.print * 10, 100)}
                  format={() => String(queueStats.print)}
                />
              </Col>
              <Col xs={24} md={8}>
                <Text>Выдача</Text>
                <Progress
                  percent={Math.min(queueStats.issue * 10, 100)}
                  format={() => String(queueStats.issue)}
                />
              </Col>
            </Row>
          </Card>

          <Card size="small" title="Производительность сотрудников">
            <Table
              rowKey="user_id"
              columns={workerColumns}
              dataSource={workersQuery.data ?? []}
              pagination={false}
              loading={workersQuery.isLoading}
              locale={{ emptyText: "Нет данных по сотрудникам" }}
            />
          </Card>
        </Space>
      </Card>
    </div>
  );
}
