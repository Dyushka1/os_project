import { useMemo, useState } from "react";
import { Button, Card, Descriptions, Space, Spin, message } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchOrderById, finishPrint, issueOrder, startDelivery, takePrint, updateOrderStatus } from "./ordersApi";

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

export default function OrderDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const orderId = Number(id);
  const [showAllFields, setShowAllFields] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => fetchOrderById(orderId),
    enabled: Number.isFinite(orderId),
  });

  const actionMutation = useMutation({
    mutationFn: async (action: "confirm" | "take_print" | "finish_print" | "start_delivery" | "issue") => {
      if (action === "confirm") {
        return updateOrderStatus(orderId, "confirmed");
      }
      if (action === "take_print") {
        return takePrint(orderId);
      }
      if (action === "finish_print") {
        return finishPrint(orderId);
      }
      if (action === "start_delivery") {
        return startDelivery(orderId);
      }
      return issueOrder(orderId);
    },
    onSuccess: async () => {
      message.success("Статус обновлён");
      await queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (error: any) => {
      const detail = error?.response?.data?.detail || "Не удалось выполнить действие";
      message.error(String(detail));
    },
  });

  const allFields = useMemo(() => {
    if (!data) {
      return [] as Array<{ key: string; value: unknown }>;
    }
    return Object.entries(data).map(([key, value]) => ({ key, value }));
  }, [data]);

  if (isLoading) {
    return <Spin style={{ margin: 24 }} />;
  }

  if (!data) {
    return <Card style={{ margin: 16 }}>Заказ не найден</Card>;
  }

  return (
    <Card style={{ margin: 16 }} title={`Заказ #${data.order_number ?? data.id}`}>
      <Space style={{ marginBottom: 12 }}>
        <Button
          type={!showAllFields ? "primary" : "default"}
          onClick={() => setShowAllFields(false)}
        >
          Базовая информация
        </Button>
        <Button
          type={showAllFields ? "primary" : "default"}
          onClick={() => setShowAllFields(true)}
        >
          Все поля
        </Button>
      </Space>

      <Space wrap style={{ marginBottom: 12 }}>
        <Button onClick={() => navigate("/admin")}>На главный экран</Button>
        <Button loading={actionMutation.isPending} onClick={() => actionMutation.mutate("confirm")}>
          Подтвердить
        </Button>
        <Button loading={actionMutation.isPending} onClick={() => actionMutation.mutate("take_print")}>
          Взять в печать
        </Button>
        <Button loading={actionMutation.isPending} onClick={() => actionMutation.mutate("finish_print")}>
          Завершить печать
        </Button>
        <Button loading={actionMutation.isPending} onClick={() => actionMutation.mutate("start_delivery")}>
          В доставку
        </Button>
        <Button type="primary" loading={actionMutation.isPending} onClick={() => actionMutation.mutate("issue")}>
          Выдать заказ
        </Button>
      </Space>

      <Descriptions bordered column={1}>
        <Descriptions.Item label="Статус">{data.status}</Descriptions.Item>
        <Descriptions.Item label="Клиент">{data.client?.name || "-"}</Descriptions.Item>
        <Descriptions.Item label="Телефон">{data.client?.phone || "-"}</Descriptions.Item>
        <Descriptions.Item label="Модель">{data.model_id}</Descriptions.Item>
        <Descriptions.Item label="Размер">{data.size_id}</Descriptions.Item>
        <Descriptions.Item label="Цвет">{data.color_id}</Descriptions.Item>
        <Descriptions.Item label="Печать">{data.print_id ?? "-"}</Descriptions.Item>
        <Descriptions.Item label="Промо">{data.promo_code ?? "-"}</Descriptions.Item>
        <Descriptions.Item label="Notify">{data.notify_method ?? "-"}</Descriptions.Item>
      </Descriptions>

      {showAllFields && (
        <Descriptions bordered column={1} style={{ marginTop: 16 }}>
          {allFields.map((field) => (
            <Descriptions.Item key={field.key} label={field.key}>
              <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {formatValue(field.value)}
              </pre>
            </Descriptions.Item>
          ))}
        </Descriptions>
      )}
    </Card>
  );
}
