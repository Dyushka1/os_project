import { useState } from "react";
import { Button, Card, Form, Input, Popconfirm, Space, Switch, Table, Tag, Typography, message } from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

const { Title } = Typography;

type PromoCode = {
  id: number;
  code: string;
  description: string | null;
  is_active: boolean;
};

export default function AdminPromoCodes() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form] = Form.useForm();
  const [adding, setAdding] = useState(false);

  const { data: promoCodes = [], isLoading } = useQuery<PromoCode[]>({
    queryKey: ["admin-promo-codes"],
    queryFn: async () => (await api.get("/promo-codes/")).data,
  });

  const createMutation = useMutation({
    mutationFn: async (values: { code: string; description?: string }) =>
      (await api.post("/promo-codes/", values)).data,
    onSuccess: () => {
      message.success("Промокод добавлен");
      form.resetFields();
      setAdding(false);
      queryClient.invalidateQueries({ queryKey: ["admin-promo-codes"] });
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || "Ошибка"),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: number; is_active: boolean }) =>
      api.patch(`/promo-codes/${id}`, { is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-promo-codes"] }),
    onError: (e: any) => message.error(e?.response?.data?.detail || "Ошибка"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => api.delete(`/promo-codes/${id}`),
    onSuccess: () => {
      message.success("Промокод удалён");
      queryClient.invalidateQueries({ queryKey: ["admin-promo-codes"] });
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || "Ошибка"),
  });

  const columns = [
    {
      title: "Код",
      dataIndex: "code",
      key: "code",
      render: (code: string) => <Tag color="blue" style={{ fontSize: 14 }}>{code}</Tag>,
    },
    {
      title: "Описание",
      dataIndex: "description",
      key: "description",
      render: (d: string | null) => d || "—",
    },
    {
      title: "Активен",
      dataIndex: "is_active",
      key: "is_active",
      render: (active: boolean, record: PromoCode) => (
        <Switch
          checked={active}
          onChange={(checked) => toggleMutation.mutate({ id: record.id, is_active: checked })}
        />
      ),
    },
    {
      title: "",
      key: "actions",
      render: (_: unknown, record: PromoCode) => (
        <Popconfirm
          title="Удалить промокод?"
          okText="Да"
          cancelText="Нет"
          onConfirm={() => deleteMutation.mutate(record.id)}
        >
          <Button danger size="small">Удалить</Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}>
      <Space style={{ marginBottom: 16 }}>
        <Button onClick={() => navigate("/admin")}>← Назад</Button>
        <Title level={3} style={{ margin: 0 }}>Промокоды</Title>
      </Space>

      <Card style={{ marginBottom: 16 }}>
        {adding ? (
          <Form form={form} layout="inline" onFinish={(v) => createMutation.mutate(v)}>
            <Form.Item name="code" rules={[{ required: true, message: "Введите код" }]}>
              <Input placeholder="Код (напр. SALE2026)" style={{ width: 180 }} />
            </Form.Item>
            <Form.Item name="description">
              <Input placeholder="Описание (необязательно)" style={{ width: 220 }} />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={createMutation.isPending}>
                Добавить
              </Button>
            </Form.Item>
            <Form.Item>
              <Button onClick={() => { setAdding(false); form.resetFields(); }}>Отмена</Button>
            </Form.Item>
          </Form>
        ) : (
          <Button type="primary" onClick={() => setAdding(true)}>
            + Добавить промокод
          </Button>
        )}
      </Card>

      <Table
        dataSource={promoCodes}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        pagination={false}
        locale={{ emptyText: "Промокодов пока нет" }}
      />
    </div>
  );
}
