import { useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../api/axios";
import TypedDangerButton from "../components/TypedDangerButton";

const { Title, Text } = Typography;

type StaffRole = "admin" | "reception" | "print" | "issue" | "nanesenie";
type UserRole = StaffRole | "user";
type StaffMember = {
  id: number;
  username: string;
  role: UserRole;
};

const roleOptions: Array<{ value: StaffRole; label: string; color: string }> = [
  { value: "nanesenie", label: "Мастер принтов", color: "blue" },
  { value: "print", label: "Мастер печати", color: "geekblue" },
  { value: "issue", label: "Выдача", color: "green" },
  { value: "reception", label: "Ресепшн", color: "gold" },
  { value: "admin", label: "Администратор", color: "red" },
];

export default function StaffAdmin() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [search, setSearch] = useState("");
  const [editingUser, setEditingUser] = useState<StaffMember | null>(null);

  const staffQuery = useQuery({
    queryKey: ["staff-users"],
    queryFn: async () => {
      const res = await api.get<StaffMember[]>("/users/");
      return res.data;
    },
    retry: false,
  });

  const allUsers = staffQuery.data ?? [];
  const staff = useMemo(() => allUsers.filter((item) => item.role !== "user"), [allUsers]);
  const hasAdmin = useMemo(() => staff.some((item) => item.role === "admin"), [staff]);

  const createMutation = useMutation({
    mutationFn: async (payload: { username: string; password: string; role: StaffRole }) => {
      const res = await api.post("/users/register", payload);
      return res.data;
    },
    onSuccess: () => {
      message.success("Сотрудник добавлен");
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ["staff-users"] });
    },
    onError: (error: any) => {
      const detail = error?.response?.data?.detail || "Не удалось добавить сотрудника";
      message.error(String(detail));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await api.delete(`/users/${userId}`);
      return res.data;
    },
    onSuccess: () => {
      message.success("Сотрудник удален");
      queryClient.invalidateQueries({ queryKey: ["staff-users"] });
    },
    onError: (error: any) => {
      const detail = error?.response?.data?.detail || "Не удалось удалить сотрудника";
      message.error(String(detail));
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: { userId: number; role: StaffRole; password?: string }) => {
      const body: { role: StaffRole; password?: string } = { role: payload.role };
      if (payload.password && payload.password.trim()) {
        body.password = payload.password.trim();
      }
      const res = await api.put(`/users/${payload.userId}`, body);
      return res.data;
    },
    onSuccess: async () => {
      message.success("Сотрудник обновлен");
      setEditingUser(null);
      editForm.resetFields();
      await queryClient.invalidateQueries({ queryKey: ["staff-users"] });
    },
    onError: (error: any) => {
      const detail = error?.response?.data?.detail || "Не удалось обновить сотрудника";
      message.error(String(detail));
    },
  });

  const filteredStaff = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return staff;
    return staff.filter((item) => {
      const text = `${item.username} ${item.role}`.toLowerCase();
      return text.includes(query);
    });
  }, [search, staff]);

  const columns: ColumnsType<StaffMember> = [
    { title: "ID", dataIndex: "id", width: 80 },
    { title: "Логин", dataIndex: "username" },
    {
      title: "Роль",
      dataIndex: "role",
      render: (value: StaffRole) => {
        const role = roleOptions.find((item) => item.value === value);
        return <Tag color={role?.color ?? "default"}>{role?.label ?? value}</Tag>;
      },
    },
    {
      title: "Действия",
      key: "actions",
      width: 250,
      render: (_, record) => {
        return (
          <Space size={8}>
            <Button
              size="small"
              onClick={() => {
                setEditingUser(record);
                editForm.setFieldsValue({ role: record.role, password: "" });
              }}
            >
              Редактировать
            </Button>
            {record.role === "admin" ? (
              <Button size="small" disabled>
                Нельзя удалить
              </Button>
            ) : (
              <Popconfirm
                title="Удалить сотрудника?"
                okText="Удалить"
                cancelText="Отмена"
                onConfirm={() => deleteMutation.mutate(record.id)}
              >
                <Button danger size="small" loading={deleteMutation.isPending}>
                  Удалить
                </Button>
              </Popconfirm>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div style={{ padding: 16 }}>
      <Card>
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Space style={{ justifyContent: "space-between", width: "100%" }} wrap>
            <div>
              <Title level={3} style={{ margin: 0 }}>
                Сотрудники
              </Title>
              <Text type="secondary">
                Сотрудники берутся из backend (`/users`) и изменения сохраняются в систему.
              </Text>
            </div>
            <Button onClick={() => navigate("/admin")}>На главный экран</Button>
          </Space>

          {staffQuery.isError && (
            <Alert type="error" showIcon message="Не удалось загрузить сотрудников из backend" />
          )}

          <Card size="small" title="Добавить сотрудника">
            <Form
              form={form}
              layout="vertical"
              onFinish={(values: { username: string; password: string; role: StaffRole }) => {
                createMutation.mutate(values);
              }}
            >
              <Row gutter={12}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="username"
                    label="Логин (или телефон)"
                    rules={[{ required: true, message: "Укажите логин" }]}
                  >
                    <Input placeholder="admin или +79001234567" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="password"
                    label="Пароль"
                    rules={[{ required: true, message: "Укажите пароль" }, { min: 8, message: "Минимум 8 символов" }]}
                  >
                    <Input.Password placeholder="Минимум 8 символов" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="role" label="Роль" rules={[{ required: true, message: "Выберите роль" }]}>
                    <Select options={roleOptions.map(({ value, label }) => ({ value, label }))} />
                  </Form.Item>
                </Col>
              </Row>

              <Button type="primary" htmlType="submit" loading={createMutation.isPending}>
                Добавить
              </Button>
              {!hasAdmin && <Text type="warning" style={{ marginLeft: 12 }}>В системе нет администратора</Text>}
            </Form>
          </Card>

          <Card size="small" title="Список сотрудников">
            <Space direction="vertical" size={12} style={{ width: "100%" }}>
              <Input.Search
                allowClear
                placeholder="Поиск по имени или телефону"
                onChange={(event) => setSearch(event.target.value)}
              />
              <Table
                rowKey="id"
                columns={columns}
                dataSource={filteredStaff}
                loading={staffQuery.isLoading}
                pagination={{ pageSize: 6, showSizeChanger: false }}
              />
            </Space>
          </Card>

          <TypedDangerButton
            buttonText="Удалить всех сотрудников (кроме админов)"
            title="Массовое удаление сотрудников"
            description="Будут удалены все сотрудники, кроме администраторов. Действие необратимо."
            onConfirm={async () => {
              const nonAdmins = staff.filter((item) => item.role !== "admin");
              if (!nonAdmins.length) {
                message.info("Удалять нечего");
                return;
              }
              await Promise.all(nonAdmins.map((item) => api.delete(`/users/${item.id}`)));
              await queryClient.invalidateQueries({ queryKey: ["staff-users"] });
              message.success("Удалены все сотрудники, кроме администраторов");
            }}
          />

          <Modal
            title={editingUser ? `Редактировать сотрудника #${editingUser.id}` : "Редактировать сотрудника"}
            open={Boolean(editingUser)}
            onCancel={() => {
              setEditingUser(null);
              editForm.resetFields();
            }}
            onOk={() => editForm.submit()}
            okText="Сохранить"
            cancelText="Отмена"
            okButtonProps={{ loading: updateMutation.isPending }}
          >
            <Form
              form={editForm}
              layout="vertical"
              onFinish={(values: { role: StaffRole; password?: string }) => {
                if (!editingUser) {
                  return;
                }
                updateMutation.mutate({
                  userId: editingUser.id,
                  role: values.role,
                  password: values.password,
                });
              }}
            >
              <Form.Item
                name="role"
                label="Роль"
                rules={[{ required: true, message: "Выберите роль" }]}
              >
                <Select options={roleOptions.map(({ value, label }) => ({ value, label }))} />
              </Form.Item>
              <Form.Item
                name="password"
                label="Новый пароль (опционально)"
                rules={[{ min: 8, message: "Минимум 8 символов" }]}
              >
                <Input.Password placeholder="Оставьте пустым, чтобы не менять" />
              </Form.Item>
            </Form>
          </Modal>
        </Space>
      </Card>
    </div>
  );
}
