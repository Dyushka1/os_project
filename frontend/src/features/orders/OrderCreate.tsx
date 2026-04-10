import { Button, Card, Form, Input, InputNumber, Select, Space, message } from "antd";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createOrder, type CreateOrderPayload } from "./ordersApi";

type OrderFormValues = {
  client_name?: string;
  client_phone?: string;
  client_email?: string;
  color_id?: number;
  model_id: number;
  size_id: number;
  print_id?: number;
  promo_code?: string;
  notify_method?: string;
  notify_contract?: string;
};

export default function CreateOrder() {
    const [form] = Form.useForm<OrderFormValues>();
    const navigate = useNavigate();

    const mutation = useMutation({
        mutationFn: (payload: CreateOrderPayload) => createOrder(payload),
        onSuccess: (createdOrder) => {
            message.success(`Заказ #${createdOrder.id} успешно создан`);
            navigate(`/orders/${createdOrder.id}`);
        },
        onError: (error: any) => {
            const detail = error?.response?.data?.detail || "Неизвестная ошибка";
                  message.error(typeof detail === "string" ? detail : "Не удалось создать заказ");
        },
    });

    const onFinish = (values: OrderFormValues) => {
        const payload: CreateOrderPayload = {
            client: {
                name: values.client_name,
                phone: values.client_phone,
                email: values.client_email,
            },
            color_id: values.color_id,
            model_id: values.model_id,
            size_id: values.size_id,
            print_id: values.print_id,
            promo_code: values.promo_code,
            notify_method: values.notify_method,
            notify_contract: values.notify_contract,
        };
        mutation.mutate(payload);
    };

    return (
         <Card title="Создание заказа" style={{ margin: 16 }}>
      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Space size={16} style={{ display: "flex" }} align="start">
          <Form.Item
            label="ID модели"
            name="model_id"
            rules={[{ required: true, message: "Укажи model_id" }]}
          >
            <InputNumber min={1} style={{ width: 180 }} />
          </Form.Item>

          <Form.Item
            label="ID размера"
            name="size_id"
            rules={[{ required: true, message: "Укажи size_id" }]}
          >
            <InputNumber min={1} style={{ width: 180 }} />
          </Form.Item>

          <Form.Item label="ID цвета (опционально)" name="color_id">
            <InputNumber min={1} style={{ width: 180 }} />
          </Form.Item>

          <Form.Item label="ID принта (опционально)" name="print_id">
            <InputNumber min={1} style={{ width: 180 }} />
          </Form.Item>
        </Space>

        <Space size={16} style={{ display: "flex" }} align="start">
          <Form.Item label="Имя клиента" name="client_name">
            <Input placeholder="Иван" style={{ width: 220 }} />
          </Form.Item>

          <Form.Item label="Телефон клиента" name="client_phone">
            <Input placeholder="+7..." style={{ width: 220 }} />
          </Form.Item>

          <Form.Item label="Email клиента" name="client_email">
            <Input placeholder="mail@example.com" style={{ width: 240 }} />
          </Form.Item>
        </Space>

        <Space size={16} style={{ display: "flex" }} align="start">
          <Form.Item label="Промокод" name="promo_code">
            <Input placeholder="SPRING10" style={{ width: 180 }} />
          </Form.Item>

          <Form.Item label="Способ уведомления" name="notify_method">
            <Select
              allowClear
              style={{ width: 180 }}
              options={[
                { label: "SMS", value: "sms" },
                { label: "Email", value: "email" },
                { label: "Telegram", value: "telegram" },
                { label: "WhatsApp", value: "whatsapp" },
                { label: "Не уведомлять", value: "none" },
              ]}
            />
          </Form.Item>

          <Form.Item label="Контакт для уведомления" name="notify_contact">
            <Input placeholder="@username / phone / email" style={{ width: 240 }} />
          </Form.Item>
        </Space>

        <Space>
          <Button type="primary" htmlType="submit" loading={mutation.isPending}>
            Создать заказ
          </Button>
          <Button onClick={() => navigate("/orders")}>Назад к заказам</Button>
        </Space>
      </Form>
    </Card>
  );
}
    
