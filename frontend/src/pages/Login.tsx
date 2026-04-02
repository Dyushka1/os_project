import React from "react";
import { Form, Input, Button, Card, message } from "antd";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

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
      navigate("/orders");
    } catch (err: any) {
      console.error(err);
      message.error(err?.response?.data?.detail || "Ошибка входа");
    }
  }

  return (
    <Card style={{ maxWidth: 420, margin: "40px auto" }}>
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