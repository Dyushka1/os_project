import { useEffect, useState } from "react";
import { Button, Card, Descriptions, Modal, Space, Spin, Typography, message } from "antd";
import { useMutation, useQuery } from "@tanstack/react-query";
import api from "../api/axios";
import GarmentPreview from "../components/GarmentPreview.tsx";
import SessionGuard from "../features/session/SessionGuard";
import { resolveApiUrl } from "../utils/resolveApiUrl";

const { Title, Text } = Typography;

const TEXT_PRINT_TYPES = new Set(["text", "custom_text", "own_text", "own-text"]);

type NanesenieMasterTaskRead = {
  id: number;
  order_id: number;
  order_number?: number | null;
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
  print2_id: number | null;
  print2_name: string | null;
  print2_type: string | null;
  print2_image_url: string | null;
  print2_text: string | null;
  print2_font: string | null;
  print2_side: string | null;
  print2_x: number | null;
  print2_y: number | null;
  print2_angle: number | null;
  print2_scale: number | null;
  print2_scale_x: number | null;
  print2_scale_y: number | null;
  print2_width: number | null;
  print2_height: number | null;
  front_image_url?: string | null;
  back_image_url?: string | null;
};

export default function MasterPrintTask() {
  const [task, setTask] = useState<NanesenieMasterTaskRead | null>(null);
  const [activeSlot, setActiveSlot] = useState<1 | 2>(1);

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
      setActiveSlot(1);
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
      title: `Завершить задание #${task.order_number ?? task.order_id}?`,
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
  const isTextPrint2 = TEXT_PRINT_TYPES.has(task?.print2_type ?? "");

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
            <Text strong style={{ fontSize: 22, color: "#1890ff" }}>#{task.order_number ?? task.order_id}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Модель">{task.model_name || "—"}</Descriptions.Item>
          <Descriptions.Item label="Размер">{task.size_code || "—"}</Descriptions.Item>
          <Descriptions.Item label="Цвет">{task.color_name || "—"}</Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Print info card — slot-based: slot 1 = print 1, slot 2 = print 2 */}
      {(() => {
        const hasPrint2 = !!(task.print2_name || task.print2_text);
        const slot1Side: "front" | "back" = task.print_side === "back" ? "back" : "front";
        const slot2Side: "front" | "back" = task.print2_side === "back" ? "back" : "front";
        const garmentSide: "front" | "back" = activeSlot === 1 ? slot1Side : slot2Side;

        const activeIsText = activeSlot === 1 ? isTextPrint : isTextPrint2;
        const activePrintId = activeSlot === 1 ? task.print_id : task.print2_id;
        const activePrintName = activeSlot === 1 ? task.print_name : task.print2_name;
        const activeWidth = activeSlot === 1 ? task.print_width : task.print2_width;
        const activeHeight = activeSlot === 1 ? task.print_height : task.print2_height;
        const activePrintText = activeSlot === 1 ? task.print_text : task.print2_text;
        const activePrintFont = activeSlot === 1 ? task.print_font : task.print2_font;
        const activeScale = activeSlot === 1 ? task.print_scale : task.print2_scale;
        const activeX = activeSlot === 1 ? task.print_x : task.print2_x;
        const activeY = activeSlot === 1 ? task.print_y : task.print2_y;
        const activeAngle = activeSlot === 1 ? task.print_angle : task.print2_angle;
        const activeImageUrl = activeSlot === 1 ? task.print_image_url : task.print2_image_url;
        const borderColor = activeSlot === 2 && hasPrint2 ? "#fa8c16" : "#52c41a";
        const idColor = activeSlot === 1 ? "#52c41a" : "#fa8c16";

        return (
          <Card title={`Принт ${hasPrint2 ? activeSlot : 1}`} style={{ marginBottom: 16, borderColor, borderWidth: 2 }}>
            <div style={{ marginBottom: 16 }}>
              <Descriptions column={1} bordered size="small">
                {!activeIsText && activePrintId && (
                  <Descriptions.Item label="Номер нанесения">
                    <Text strong style={{ fontSize: 20, color: idColor }}>#{activePrintId}</Text>
                  </Descriptions.Item>
                )}
                {activePrintName && (
                  <Descriptions.Item label="Название"><Text strong>{activePrintName}</Text></Descriptions.Item>
                )}
                {(activeWidth != null || activeHeight != null) && (
                  <Descriptions.Item label="Размер нанесения">
                    <Text code style={{ fontSize: 16 }}>{activeWidth ?? "?"} × {activeHeight ?? "?"} мм</Text>
                  </Descriptions.Item>
                )}
                {activeIsText && activePrintText && (
                  <Descriptions.Item label="Текст надписи">
                    <Text strong style={{ fontSize: 20 }}>{activePrintText}</Text>
                  </Descriptions.Item>
                )}
                {activeIsText && activePrintFont && (
                  <Descriptions.Item label="Шрифт"><Text code style={{ fontSize: 16 }}>{activePrintFont}</Text></Descriptions.Item>
                )}
                {activeScale != null && (
                  <Descriptions.Item label="Масштаб"><Text code style={{ fontSize: 16 }}>{activeScale}%</Text></Descriptions.Item>
                )}
                {activeX != null && activeY != null && (
                  <Descriptions.Item label="Позиция">
                    <Text code style={{ fontSize: 16 }}>X: {activeX}, Y: {activeY}</Text>
                  </Descriptions.Item>
                )}
                {activeAngle != null && activeAngle !== 0 && (
                  <Descriptions.Item label="Угол"><Text code style={{ fontSize: 16 }}>{activeAngle}°</Text></Descriptions.Item>
                )}
              </Descriptions>
            </div>

            {hasPrint2 && (
              <Space style={{ marginBottom: 8 }}>
                <Button type={activeSlot === 1 ? "primary" : "default"} size="small" onClick={() => setActiveSlot(1)}>Принт 1</Button>
                <Button type={activeSlot === 2 ? "primary" : "default"} size="small" onClick={() => setActiveSlot(2)}>Принт 2</Button>
              </Space>
            )}

            <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
              <GarmentPreview
                model={{ name: task.model_name ?? undefined, front_image_url: task.front_image_url, back_image_url: task.back_image_url }}
                print={{ name: task.print_name ?? undefined, print_type: task.print_type ?? undefined, image_url: task.print_image_url }}
                color={{ name: task.color_name ?? undefined }}
                size={{ code: task.size_code ?? undefined }}
                printText={task.print_text ?? undefined}
                printFont={task.print_font ?? undefined}
                previewSide={garmentSide}
                printSide={task.print_side ?? undefined}
                printX={task.print_x ?? undefined}
                printY={task.print_y ?? undefined}
                printAngle={task.print_angle ?? undefined}
                printScale={task.print_scale ?? undefined}
                print2={task.print2_id ? { name: task.print2_name ?? undefined, print_type: task.print2_type ?? undefined, image_url: task.print2_image_url } : undefined}
                print2Text={task.print2_text ?? undefined}
                print2Font={task.print2_font ?? undefined}
                print2Side={task.print2_side ?? undefined}
                print2X={task.print2_x ?? undefined}
                print2Y={task.print2_y ?? undefined}
                print2Angle={task.print2_angle ?? undefined}
                print2Scale={task.print2_scale ?? undefined}
                editable={false}
              />
              {(activeImageUrl || (activeIsText && activePrintText)) && (
                <div style={{ textAlign: "center", flexShrink: 0 }}>
                  <Text type="secondary" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>Принт {activeSlot}</Text>
                  {activeImageUrl ? (
                    <img
                      src={resolveApiUrl(activeImageUrl) ?? undefined}
                      alt={`Принт ${activeSlot}`}
                      style={{ maxWidth: 180, maxHeight: 240, objectFit: "contain", border: "1px solid #d9d9d9", borderRadius: 8, background: "#fafafa", padding: 8 }}
                    />
                  ) : (
                    <div style={{
                      width: 180,
                      minHeight: 120,
                      border: "1px solid #d9d9d9",
                      borderRadius: 8,
                      background: "#fafafa",
                      padding: 16,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: activePrintFont || "inherit",
                      fontSize: 22,
                      fontWeight: "bold",
                      wordBreak: "break-word",
                      textAlign: "center",
                      lineHeight: 1.3,
                    }}>
                      {activePrintText}
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>
        );
      })()}

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
