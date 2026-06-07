
import { Form, Input, Button, Card, message, Typography, Space } from "antd";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { getCurrentRole } from "../auth/token";

const { Title, Text } = Typography;

export default function Login() {
  const navigate = useNavigate();

  async function onFinish(values: any) {
    try {
      const res = await api.post("/login/", values);
      const token = res.data.access_token || res.data.token;
      if (token) {
        localStorage.setItem("token", token);
      }
      message.success("Вход успешен");
      const role = getCurrentRole();
      if (role === "user") {
        navigate("/client");
        return;
      }
      if (role === "admin") {
        navigate("/admin");
        return;
      }
      if (role === "reception") {
        navigate("/reception");
        return;
      }
      if (role === "print") {
        navigate("/master/printing");
        return;
      }
      if (role === "nanesenie") {
        navigate("/master/print");
        return;
      }
      if (role === "issue") {
        navigate("/issue");
        return;
      }
      navigate("/orders");
    } catch (err: any) {
      console.error(err);
      message.error(err?.response?.data?.detail || "Ошибка входа");
    }
  }

  return (
    <Card style={{ maxWidth: 420, margin: "40px auto" }}>
      <Space direction="vertical" style={{ width: "100%", marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>Вход для сотрудников</Title>
        <Text type="secondary">Администратор, ресепшн и другие роли входят здесь.</Text>
      </Space>
      <Form name="login" onFinish={onFinish} layout="vertical">
        <Form.Item name="username" label="Имя пользователя" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="password" label="Пароль" rules={[{ required: true }]}>
          <Input.Password />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit">
            Войти
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
}