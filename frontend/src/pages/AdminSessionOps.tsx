import { useState } from "react";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Divider,
  Form,
  Radio,
  Space,
  Tag,
  Typography,
  message,
} from "antd";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import api from "../api/axios";
import TypedDangerButton from "../components/TypedDangerButton";

const { Title, Text } = Typography;

type SessionRead = {
  id: number;
  is_active: boolean;
  has_nanesenie: boolean;
  started_at: string;
};

export default function AdminSessionOps() {
  const navigate = useNavigate();
  const [hasNanesenie, setHasNanesenie] = useState(true);
  const [restoreStock, setRestoreStock] = useState(true);

  const activeSessionQuery = useQuery({
    queryKey: ["active-session"],
    queryFn: async () => {
      const res = await api.get<SessionRead>("/sessions/active");
      return res.data;
    },
    retry: false,
  });

  const startMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/sessions/start", { has_nanesenie: hasNanesenie });
      return res.data;
    },
    onSuccess: () => {
      message.success("Смена запущена");
      activeSessionQuery.refetch();
    },
    onError: (error: any) => message.error(String(error?.response?.data?.detail || "Не удалось запустить смену")),
  });

  const stopMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/sessions/stop");
      return res.data;
    },
    onSuccess: () => {
      message.success("Смена остановлена");
      activeSessionQuery.refetch();
    },
    onError: (error: any) => message.error(String(error?.response?.data?.detail || "Не удалось остановить смену")),
  });

  const continueMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/sessions/continue");
      return res.data;
    },
    onSuccess: () => {
      message.success("Смена продолжена");
      activeSessionQuery.refetch();
    },
    onError: (error: any) => message.error(String(error?.response?.data?.detail || "Не удалось продолжить смену")),
  });

  const restartMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/sessions/restart", {
        has_nanesenie: hasNanesenie,
        restore_stock: restoreStock,
      });
      return res.data;
    },
    onSuccess: (data: any) => {
      message.success(`Смена перезапущена. Удалено заказов: ${data?.deleted_orders ?? 0}`);
      activeSessionQuery.refetch();
    },
    onError: (error: any) => message.error(String(error?.response?.data?.detail || "Не удалось перезапустить смену")),
  });

  const deleteAllOrdersMutation = useMutation({
    mutationFn: async () => {
      const res = await api.delete("/orders/all", { params: { restore_stock: restoreStock } });
      return res.data;
    },
    onSuccess: (data: any) => {
      message.success(
        `Удалено заказов: ${data?.deleted_orders ?? 0}, возвращено на склад: ${data?.restocked_items ?? 0}`,
      );
    },
    onError: (error: any) => message.error(String(error?.response?.data?.detail || "Не удалось удалить заказы")),
  });

  return (
    <div style={{ padding: 16 }}>
      <Card>
        <Space direction="vertical" size={14} style={{ width: "100%" }}>
          <Space style={{ justifyContent: "space-between", width: "100%" }} wrap>
            <div>
              <Title level={3} style={{ margin: 0 }}>Смена и служебные действия</Title>
              <Text type="secondary">Управление сменой, перезапуск и массовые операции по заказам.</Text>
            </div>
            <Button onClick={() => navigate("/admin")}>Назад на главный экран</Button>
          </Space>

          {activeSessionQuery.data ? (
            <Tag color={activeSessionQuery.data.has_nanesenie ? "blue" : "orange"}>
              Активная смена #{activeSessionQuery.data.id} · {activeSessionQuery.data.has_nanesenie ? "с нанесением" : "без нанесения"}
            </Tag>
          ) : (
            <Alert showIcon type="info" message="Активной смены нет (или нет доступа к /sessions/active)" />
          )}

          <Form layout="vertical">
            <Form.Item label="Режим новой/перезапущенной смены">
              <Radio.Group
                value={hasNanesenie ? "with" : "without"}
                onChange={(event) => setHasNanesenie(event.target.value === "with")}
              >
                <Radio.Button value="with">С нанесением</Radio.Button>
                <Radio.Button value="without">Без нанесения</Radio.Button>
              </Radio.Group>
            </Form.Item>
            <Form.Item>
              <Checkbox checked={restoreStock} onChange={(event) => setRestoreStock(event.target.checked)}>
                Возвращать остатки на склад при массовых операциях
              </Checkbox>
            </Form.Item>
          </Form>

          <Space wrap>
            <Button type="primary" loading={startMutation.isPending} onClick={() => startMutation.mutate()}>
              Запустить смену
            </Button>
            <Button danger loading={stopMutation.isPending} onClick={() => stopMutation.mutate()}>
              Остановить смену
            </Button>
            <Button loading={continueMutation.isPending} onClick={() => continueMutation.mutate()}>
              Продолжить смену
            </Button>
            <TypedDangerButton
              buttonText="Перезапустить смену"
              title="Перезапуск смены"
              description="Текущая смена и связанные заказы будут сброшены согласно настройкам."
              onConfirm={async () => {
                await restartMutation.mutateAsync();
              }}
              disabled={restartMutation.isPending}
            />
          </Space>

          <Divider />

          <Space direction="vertical" size={8}>
            <Text strong>Опасные операции</Text>
            <TypedDangerButton
              buttonText="Удалить все заказы"
              title="Удалить все заказы"
              description="Будут удалены все заказы и связанные события. Действие необратимо."
              onConfirm={async () => {
                await deleteAllOrdersMutation.mutateAsync();
              }}
              disabled={deleteAllOrdersMutation.isPending}
            />
          </Space>
        </Space>
      </Card>
    </div>
  );
}
