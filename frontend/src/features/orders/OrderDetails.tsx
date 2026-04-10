import { useMemo, useState } from "react";
import { Button, Card, Descriptions, Space, Spin } from "antd";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchOrderById } from "./ordersApi";

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
  const orderId = Number(id);
  const [showAllFields, setShowAllFields] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => fetchOrderById(orderId),
    enabled: Number.isFinite(orderId),
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
    <Card style={{ margin: 16 }} title={`Заказ #${data.id}`}>
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
