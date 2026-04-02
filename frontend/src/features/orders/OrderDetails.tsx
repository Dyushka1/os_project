import { Card, Descriptions, Spin } from "antd";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchOrderById } from "./ordersApi";

export default function OrderDetails() {
  const { id } = useParams();
  const orderId = Number(id);

  const { data, isLoading } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => fetchOrderById(orderId),
    enabled: Number.isFinite(orderId),
  });

  if (isLoading) {
    return <Spin style={{ margin: 24 }} />;
  }

  if (!data) {
    return <Card style={{ margin: 16 }}>Заказ не найден</Card>;
  }

  return (
    <Card style={{ margin: 16 }} title={`Заказ #${data.id}`}>
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
    </Card>
  );
}
