import { useEffect, useState } from "react";
import { Button, Card, Descriptions, Modal, Space, Spin, Typography, message } from "antd";
import { useMutation, useQuery } from "@tanstack/react-query";
import api from "../api/axios";
import GarmentPreview from "../components/GarmentPreview.tsx";
import SessionGuard from "../features/session/SessionGuard";

const { Title, Text } = Typography;

const TEXT_PRINT_TYPES = new Set(["text", "custom_text", "own_text", "own-text"]);

type NanesenieMasterTaskRead = {
  id: number;
  order_id: number;
  model_name: string | null;
  size_code: string | null;
  color_name: string | null;
  print_id: number | null;
  print_name: string | null;
  print_type: string | null;
  print_image_url: string | null;
  print_text: string | null;
  print_font: string | null;
  print_side: string | null;
  print_x: number | null;
  print_y: number | null;
  print_angle: number | null;
  print_scale: number | null;
  print_width: number | null;
  print_height: number | null;
  front_image_url?: string | null;
  back_image_url?: string | null;
};

export default function MasterPrintTask() {
  const [task, setTask] = useState<NanesenieMasterTaskRead | null>(null);
  const [previewSide, setPreviewSide] = useState<"front" | "back">("front");

  const taskQuery = useQuery({
    queryKey: ["master-print-task-current"],
    queryFn: async () => {
      const response = await api.get<NanesenieMasterTaskRead>("/orders/my/nanesenie");
      return response.data;
    },
    retry: false,
  });

  useEffect(() => {
    if (taskQuery.data) {
      setTask(taskQuery.data);
      if (taskQuery.data.print_side === "front" || taskQuery.data.print_side === "back") {
        setPreviewSide(taskQuery.data.print_side);
      }
    }
  }, [taskQuery.data]);

  const markDoneMutation = useMutation({
    mutationFn: async (taskId: number) => {
      await api.post(`/orders/${taskId}/finish_nanesenie`);
    },
    onSuccess: () => {
      message.success("Готово! Вкладка закроется.");
      setTimeout(() => window.close(), 1000);
    },
    onError: (error: any) => {
      const detail = error?.response?.data?.detail || "Ошибка завершения задания";
      message.error(String(detail));
    },
  });

  const releaseMutation = useMutation({
    mutationFn: async (taskId: number) => {
      await api.post(`/orders/${taskId}/release_nanesenie`);
    },
    onSuccess: () => {
      message.success("Задание возвращено в очередь. Вкладка закроется.");
      setTimeout(() => window.close(), 1000);
    },
    onError: (error: any) => {
      const detail = error?.response?.data?.detail || "Не удалось снять задание";
      message.error(String(detail));
    },
  });

  const onMarkDone = () => {
    if (!task) return;
    Modal.confirm({
      title: `Завершить задание #${task.order_id}?`,
      content: "Принт изготовлен и готов к передаче на печать.",
      okText: "Готово",
      cancelText: "Отмена",
      onOk: () => markDoneMutation.mutate(task.id),
    });
  };

  const onRelease = () => {
    if (!task) return;
    Modal.confirm({
      title: "Вернуть задание в очередь?",
      content: "Задание станет доступно другим мастерам.",
      okText: "Вернуть",
      cancelText: "Отмена",
      onOk: () => releaseMutation.mutate(task.id),
    });
  };

  const isTextPrint = TEXT_PRINT_TYPES.has(task?.print_type ?? "");

  if (taskQuery.isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <Spin size="large" />
      </div>
    );
  }

  if (taskQuery.isError || !task) {
    return (
      <div style={{ padding: 32 }}>
        <Title level={3}>Нет активного задания</Title>
        <Text type="secondary">Закройте эту вкладку и получите задание на основной странице.</Text>
      </div>
    );
  }

  return (
    <SessionGuard>
    <div style={{ padding: 24, maxWidth: 700, margin: "0 auto" }}>
      <Title level={2}>Задание на изготовление принта</Title>

      {/* Номер заказа */}
      <Card style={{ marginBottom: 16, borderColor: "#1890ff", borderWidth: 2 }}>
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="Номер заказа">
            <Text strong style={{ fontSize: 22, color: "#1890ff" }}>#{task.order_id}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Модель">{task.model_name || "—"}</Descriptions.Item>
          <Descriptions.Item label="Размер">{task.size_code || "—"}</Descriptions.Item>
          <Descriptions.Item label="Цвет">{task.color_name || "—"}</Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Задание на принт */}
      <Card title="Принт" style={{ marginBottom: 16, borderColor: "#52c41a", borderWidth: 2 }}>
        <Descriptions column={1} bordered size="small">
          {!isTextPrint && task.print_id && (
            <Descriptions.Item label="Номер нанесения">
              <Text strong style={{ fontSize: 20, color: "#52c41a" }}>#{task.print_id}</Text>
            </Descriptions.Item>
          )}
          {task.print_name && (
            <Descriptions.Item label="Название">
              <Text strong>{task.print_name}</Text>
            </Descriptions.Item>
          )}
          {(task.print_width != null || task.print_height != null) && (
            <Descriptions.Item label="Размер нанесения">
              <Text code style={{ fontSize: 16 }}>
                {task.print_width ?? "?"} × {task.print_height ?? "?"} мм
              </Text>
            </Descriptions.Item>
          )}
          {isTextPrint && task.print_text && (
            <Descriptions.Item label="Текст надписи">
              <Text strong style={{ fontSize: 20 }}>{task.print_text}</Text>
            </Descriptions.Item>
          )}
          {isTextPrint && task.print_font && (
            <Descriptions.Item label="Шрифт">
              <Text code style={{ fontSize: 16 }}>{task.print_font}</Text>
            </Descriptions.Item>
          )}
          {task.print_side && (
            <Descriptions.Item label="Сторона">
              <Text strong>{task.print_side === "front" ? "Спереди" : task.print_side === "back" ? "Сзади" : task.print_side}</Text>
            </Descriptions.Item>
          )}
          {task.print_scale != null && (
            <Descriptions.Item label="Масштаб">
              <Text code style={{ fontSize: 16 }}>{task.print_scale}%</Text>
            </Descriptions.Item>
          )}
          {task.print_x != null && task.print_y != null && (
            <Descriptions.Item label="Позиция">
              <Text code style={{ fontSize: 16 }}>X: {task.print_x}, Y: {task.print_y}</Text>
            </Descriptions.Item>
          )}
          {task.print_angle != null && task.print_angle !== 0 && (
            <Descriptions.Item label="Угол">
              <Text code style={{ fontSize: 16 }}>{task.print_angle}°</Text>
            </Descriptions.Item>
          )}
        </Descriptions>

        <div style={{ marginTop: 16 }}>
          <Space style={{ marginBottom: 8 }}>
            <Button
              type={previewSide === "front" ? "primary" : "default"}
              size="small"
              onClick={() => setPreviewSide("front")}
            >
              Спереди
            </Button>
            <Button
              type={previewSide === "back" ? "primary" : "default"}
              size="small"
              onClick={() => setPreviewSide("back")}
            >
              Сзади
            </Button>
          </Space>

          <GarmentPreview
            model={{
              name: task.model_name ?? undefined,
              front_image_url: task.front_image_url,
              back_image_url: task.back_image_url,
            }}
            print={{
              name: task.print_name ?? undefined,
              print_type: task.print_type ?? undefined,
              image_url: task.print_image_url,
            }}
            color={{ name: task.color_name ?? undefined }}
            size={{ code: task.size_code ?? undefined }}
            printText={task.print_text ?? undefined}
            printFont={task.print_font ?? undefined}
            previewSide={previewSide}
            onSideChange={setPreviewSide}
            printSide={task.print_side ?? undefined}
            printX={task.print_x ?? undefined}
            printY={task.print_y ?? undefined}
            printAngle={task.print_angle ?? undefined}
            printScale={task.print_scale ?? undefined}
            editable={false}
          />
        </div>
      </Card>

      {/* Кнопки */}
      <Space direction="vertical" style={{ width: "100%" }} size={12}>
        <Button
          type="primary"
          size="large"
          onClick={onMarkDone}
          loading={markDoneMutation.isPending}
          style={{ height: 64, fontSize: 20, width: "100%" }}
        >
          ГОТОВО
        </Button>
        <Button size="large" onClick={onRelease} loading={releaseMutation.isPending} style={{ width: "100%" }}>
          Вернуть задание в очередь
        </Button>
      </Space>
    </div>
    </SessionGuard>
  );
}
