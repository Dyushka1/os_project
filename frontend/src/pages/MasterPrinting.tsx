import { useEffect, useState } from "react";
import {
  Button,
  Card,
  Descriptions,
  Empty,
  Modal,
  Space,
  Typography,
  message,
} from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import BrandedScreen from "../features/branding/BrandedScreen";
import SessionGuard from "../features/session/SessionGuard";
import api from "../api/axios";
import { resolveApiUrl } from "../utils/resolveApiUrl";
import GarmentPreview from "../components/GarmentPreview.tsx";

const { Title, Text } = Typography;

type PrintMasterTaskRead = {
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
  print_side: string | null;
  print_x: number | null;
  print_y: number | null;
  print_angle: number | null;
  print_scale: number | null;
  print_text: string | null;
  print_font: string | null;
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
  front_image_url?: string | null;
  back_image_url?: string | null;
};

export default function MasterPrinting() {
  const queryClient = useQueryClient();
  const [activeTask, setActiveTask] = useState<PrintMasterTaskRead | null>(null);
  const [activeSlot, setActiveSlot] = useState<1 | 2>(1);

  // Fetch next available printing task
  const getPrintingTaskQuery = useQuery({
    queryKey: ["master-printing-next-task"],
    queryFn: async () => {
      const response = await api.post<PrintMasterTaskRead>("/orders/next/printing");
      return response.data;
    },
    retry: false,
    enabled: false,
  });

  const currentPrintingTaskQuery = useQuery({
    queryKey: ["master-printing-current-task"],
    queryFn: async () => {
      try {
        const response = await api.get<PrintMasterTaskRead>("/orders/my/printing");
        return response.data;
      } catch (error: any) {
        if (error?.response?.status === 404) {
          return null;
        }
        throw error;
      }
    },
    retry: false,
  });

  // Mutation to mark task as done
  const markDoneMutation = useMutation({
    mutationFn: async (taskId: number) => {
      await api.post(`/orders/${taskId}/finish_printing`);
    },
    onSuccess: () => {
      message.success("Печать завершена");
      setActiveTask(null);
      // Invalidate current task query completely
      queryClient.invalidateQueries({ queryKey: ["master-printing-current-task"] });
      queryClient.removeQueries({ queryKey: ["master-printing-next-task"] });
    },
    onError: (error: any) => {
      const detail = error?.response?.data?.detail || "Ошибка завершения печати";
      message.error(String(detail));
    },
  });

  const onGetTask = async () => {
    const result = await getPrintingTaskQuery.refetch();
    if (!result.isSuccess || !result.data) {
      // Do not keep stale cached task if queue request failed.
      setActiveTask(null);
      return;
    }

    setActiveTask(result.data);
    setActiveSlot(1);
  };

  const onReleaseTask = async () => {
    if (!activeTask) return;
    try {
      await api.post(`/orders/${activeTask.id}/release_printing`);
      message.success("Задание снято и возвращено в очередь");
      setActiveTask(null);
      // Invalidate current task query completely
      queryClient.invalidateQueries({ queryKey: ["master-printing-current-task"] });
      queryClient.removeQueries({ queryKey: ["master-printing-next-task"] });
    } catch (error: any) {
      const detail = error?.response?.data?.detail || "Не удалось снять задание";
      message.error(String(detail));
    }
  };

  const onMarkDone = () => {
    if (!activeTask) return;
    Modal.confirm({
      title: `Завершить печать #${activeTask.order_number ?? activeTask.order_id}?`,
      content: "Изделие напечатано и готово к выдаче",
      okText: "Готово",
      cancelText: "Отмена",
      onOk: () => {
        markDoneMutation.mutate(activeTask.id);
      },
    });
  };

  useEffect(() => {
    if (!activeTask && currentPrintingTaskQuery.data) {
      const task = currentPrintingTaskQuery.data;
      setActiveTask(task);
      setActiveSlot(1);
    }
  }, [currentPrintingTaskQuery.data]);

  return (
    <SessionGuard>
    <BrandedScreen backgroundKey="kiosk-bg" idleSplash splashTitle="Нажмите для работы">
      <Card style={{ margin: 16, maxWidth: 1000 }}>
        <Space direction="vertical" size={24} style={{ width: "100%" }}>
          <Title level={2}>Мастер печати</Title>

          {!activeTask ? (
            <>
              <Text>
                Нажмите кнопку ниже, чтобы получить заказ для печати на оборудовании.
              </Text>
              <Button
                type="primary"
                size="large"
                onClick={onGetTask}
                loading={getPrintingTaskQuery.isLoading}
                style={{ height: 60, fontSize: 18 }}
              >
                ПОЛУЧИТЬ ЗАДАНИЕ
              </Button>

              {getPrintingTaskQuery.isError && (
                <Empty description="Нет доступных заказов для печати" />
              )}
            </>
          ) : (
            <>
              {/* Order info */}
              <Card
                style={{
                  background: "#f5f5f5",
                  borderColor: "#ff7a45",
                  borderWidth: 2,
                }}
              >
                <Descriptions column={1} bordered size="small">
                  <Descriptions.Item label="Номер заказа">
                    <Text strong style={{ fontSize: 18, color: "#ff7a45" }}>
                      #{activeTask.order_number ?? activeTask.order_id}
                    </Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Модель">
                    {activeTask.model_name || "—"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Размер">
                    {activeTask.size_code || "—"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Цвет">
                    {activeTask.color_name || "—"}
                  </Descriptions.Item>
                </Descriptions>
              </Card>

              {/* Slot-based print info + garment preview */}
              {(() => {
                const hasPrint2 = !!(activeTask.print2_name || activeTask.print2_text);
                const slot1Side: "front" | "back" = activeTask.print_side === "back" ? "back" : "front";
                const slot2Side: "front" | "back" = activeTask.print2_side === "back" ? "back" : "front";
                const garmentSide: "front" | "back" = activeSlot === 1 ? slot1Side : slot2Side;

                const slotCard = activeSlot === 1 ? (
                  <Card title="Принт 1" style={{ borderColor: "#722ed1", borderWidth: 2 }}>
                    <Descriptions column={1} size="small" bordered>
                      {activeTask.print_name && (
                        <Descriptions.Item label="Название"><Text strong>{activeTask.print_name}</Text></Descriptions.Item>
                      )}
                      {activeTask.print_type && (
                        <Descriptions.Item label="Тип">
                          {activeTask.print_type === "text" || activeTask.print_type === "custom_text" ? "Свой текст" : "Стандартный"}
                        </Descriptions.Item>
                      )}
                      {activeTask.print_text && (
                        <Descriptions.Item label="Текст надписи">
                          <Text strong style={{ fontSize: 16 }}>{activeTask.print_text}</Text>
                        </Descriptions.Item>
                      )}
                      {activeTask.print_font && (
                        <Descriptions.Item label="Шрифт"><Text code>{activeTask.print_font}</Text></Descriptions.Item>
                      )}
                      {activeTask.print_x !== null && activeTask.print_y !== null && (
                        <Descriptions.Item label="Центр (X / Y)">
                          <Text code>X: {activeTask.print_x}%, Y: {activeTask.print_y}%</Text>
                        </Descriptions.Item>
                      )}
                      {activeTask.print_angle !== null && (
                        <Descriptions.Item label="Угол"><Text code>{activeTask.print_angle}°</Text></Descriptions.Item>
                      )}
                      {activeTask.print_scale !== null && (
                        <Descriptions.Item label="Размер"><Text code>{activeTask.print_scale}%</Text></Descriptions.Item>
                      )}
                      <Descriptions.Item label="Сторона">
                        {slot1Side === "front" ? "Спереди" : "Сзади"}
                      </Descriptions.Item>
                    </Descriptions>
                    {activeTask.print_image_url && (
                      <div style={{ marginTop: 12, textAlign: "center" }}>
                        <img src={resolveApiUrl(activeTask.print_image_url) ?? undefined} alt="Принт" style={{ maxWidth: 200, maxHeight: 200 }} />
                      </div>
                    )}
                  </Card>
                ) : (
                  <Card title="Принт 2" style={{ borderColor: "#fa8c16", borderWidth: 2 }}>
                    <Descriptions column={1} size="small" bordered>
                      {activeTask.print2_name && (
                        <Descriptions.Item label="Название"><Text strong>{activeTask.print2_name}</Text></Descriptions.Item>
                      )}
                      {activeTask.print2_type && (
                        <Descriptions.Item label="Тип">
                          {activeTask.print2_type === "text" || activeTask.print2_type === "custom_text" ? "Свой текст" : "Стандартный"}
                        </Descriptions.Item>
                      )}
                      {activeTask.print2_text && (
                        <Descriptions.Item label="Текст надписи">
                          <Text strong style={{ fontSize: 16 }}>{activeTask.print2_text}</Text>
                        </Descriptions.Item>
                      )}
                      {activeTask.print2_font && (
                        <Descriptions.Item label="Шрифт"><Text code>{activeTask.print2_font}</Text></Descriptions.Item>
                      )}
                      {activeTask.print2_x !== null && activeTask.print2_y !== null && (
                        <Descriptions.Item label="Центр (X / Y)">
                          <Text code>X: {activeTask.print2_x}%, Y: {activeTask.print2_y}%</Text>
                        </Descriptions.Item>
                      )}
                      {activeTask.print2_angle !== null && (
                        <Descriptions.Item label="Угол"><Text code>{activeTask.print2_angle}°</Text></Descriptions.Item>
                      )}
                      {activeTask.print2_scale !== null && (
                        <Descriptions.Item label="Размер"><Text code>{activeTask.print2_scale}%</Text></Descriptions.Item>
                      )}
                      <Descriptions.Item label="Сторона">
                        {slot2Side === "front" ? "Спереди" : "Сзади"}
                      </Descriptions.Item>
                    </Descriptions>
                    {activeTask.print2_image_url && (
                      <div style={{ marginTop: 12, textAlign: "center" }}>
                        <img src={resolveApiUrl(activeTask.print2_image_url) ?? undefined} alt="Принт 2" style={{ maxWidth: 200, maxHeight: 200 }} />
                      </div>
                    )}
                  </Card>
                );

                return (
                  <>
                    {slotCard}
                    <div>
                      {hasPrint2 && (
                        <Space style={{ marginBottom: 8 }}>
                          <Button
                            type={activeSlot === 1 ? "primary" : "default"}
                            onClick={() => setActiveSlot(1)}
                            size="small"
                          >
                            Принт 1
                          </Button>
                          <Button
                            type={activeSlot === 2 ? "primary" : "default"}
                            onClick={() => setActiveSlot(2)}
                            size="small"
                          >
                            Принт 2
                          </Button>
                        </Space>
                      )}
                      <GarmentPreview
                        model={{
                          name: activeTask.model_name ?? undefined,
                          front_image_url: activeTask.front_image_url,
                          back_image_url: activeTask.back_image_url,
                        }}
                        print={{
                          name: activeTask.print_name ?? undefined,
                          print_type: activeTask.print_type ?? undefined,
                          image_url: activeTask.print_image_url,
                        }}
                        color={{ name: activeTask.color_name ?? undefined }}
                        size={{ code: activeTask.size_code ?? undefined }}
                        printText={activeTask.print_text ?? undefined}
                        printFont={activeTask.print_font ?? undefined}
                        previewSide={garmentSide}
                        printSide={activeTask.print_side ?? undefined}
                        printX={activeTask.print_x ?? undefined}
                        printY={activeTask.print_y ?? undefined}
                        printAngle={activeTask.print_angle ?? undefined}
                        printScale={activeTask.print_scale ?? undefined}
                        print2={hasPrint2 ? { name: activeTask.print2_name ?? undefined, print_type: activeTask.print2_type ?? undefined, image_url: activeTask.print2_image_url } : undefined}
                        print2Text={activeTask.print2_text ?? undefined}
                        print2Font={activeTask.print2_font ?? undefined}
                        print2Side={activeTask.print2_side ?? undefined}
                        print2X={activeTask.print2_x ?? undefined}
                        print2Y={activeTask.print2_y ?? undefined}
                        print2Angle={activeTask.print2_angle ?? undefined}
                        print2Scale={activeTask.print2_scale ?? undefined}
                        editable={false}
                      />
                    </div>
                  </>
                );
              })()}


              {/* Printing instructions */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
                <Text type="secondary">
                  1. Возьмите изделие со склада по номеру заказа выше
                  <br />
                  2. Установите параметры печати согласно значениям выше (если указаны)
                  <br />
                  3. Нанесите принт на указанную сторону
                  <br />
                  4. Проверьте качество и нажмите ГОТОВО
                </Text>
                <Button
                  type="primary"
                  size="large"
                  onClick={onMarkDone}
                  loading={markDoneMutation.isPending}
                  style={{ height: 60, fontSize: 18, width: "100%" }}
                >
                  ГОТОВО
                </Button>
                <Button size="large" onClick={onReleaseTask}>
                  Снять задание
                </Button>
              </div>
            </>
          )}
        </Space>
      </Card>
    </BrandedScreen>
    </SessionGuard>
  );
}
