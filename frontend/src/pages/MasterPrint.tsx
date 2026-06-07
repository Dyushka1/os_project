import { useEffect, useRef } from "react";
import { Button, Card, Empty, Space, Typography, message } from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import BrandedScreen from "../features/branding/BrandedScreen";
import SessionGuard from "../features/session/SessionGuard";
import api from "../api/axios";

const { Title, Text } = Typography;

type NanesenieMasterTaskRead = {
  id: number;
  order_id: number;
};

export default function MasterPrint() {
  const queryClient = useQueryClient();
  const taskTabRef = useRef<Window | null>(null);

  const currentTaskQuery = useQuery({
    queryKey: ["master-print-current-task"],
    queryFn: async () => {
      try {
        const response = await api.get<NanesenieMasterTaskRead>("/orders/my/nanesenie");
        return response.data;
      } catch (error: any) {
        if (error?.response?.status === 404) return null;
        throw error;
      }
    },
    refetchInterval: 5000,
    retry: false,
  });

  const getNextMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post<NanesenieMasterTaskRead>("/orders/next/nanesenie");
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["master-print-current-task"] });
      openTaskTab();
    },
    onError: (error: any) => {
      const detail = error?.response?.data?.detail || "Нет доступных заданий";
      message.error(String(detail));
    },
  });

  const openTaskTab = () => {
    if (taskTabRef.current && !taskTabRef.current.closed) {
      taskTabRef.current.focus();
    } else {
      taskTabRef.current = window.open("/master/print/task", "_blank");
    }
  };

  // когда задание завершается в другой вкладке — текущий запрос вернёт null
  const hasActiveTask = !!currentTaskQuery.data;

  // при фокусе на этой вкладке — перепроверяем статус задания
  useEffect(() => {
    const onFocus = () => {
      queryClient.invalidateQueries({ queryKey: ["master-print-current-task"] });
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [queryClient]);

  return (
    <SessionGuard>
    <BrandedScreen backgroundKey="kiosk-bg" idleSplash splashTitle="Нажмите для работы">
      <Card style={{ margin: 16, maxWidth: 600 }}>
        <Space direction="vertical" size={24} style={{ width: "100%" }}>
          <Title level={2}>Мастер принтов</Title>

          {hasActiveTask ? (
            <>
              <Text>
                У вас есть активное задание <Text strong>#{currentTaskQuery.data!.order_id}</Text>.
                Откройте вкладку задания и нажмите ГОТОВО после завершения.
              </Text>
              <Button
                type="primary"
                size="large"
                onClick={openTaskTab}
                style={{ height: 60, fontSize: 18 }}
              >
                ОТКРЫТЬ ЗАДАНИЕ
              </Button>
            </>
          ) : (
            <>
              <Text>
                Нажмите кнопку ниже, чтобы получить следующее задание на изготовление принта.
              </Text>
              <Button
                type="primary"
                size="large"
                onClick={() => getNextMutation.mutate()}
                loading={getNextMutation.isPending || currentTaskQuery.isLoading}
                style={{ height: 60, fontSize: 18 }}
              >
                ПОЛУЧИТЬ ЗАДАНИЕ
              </Button>

              {getNextMutation.isError && (
                <Empty description="Нет доступных заданий" />
              )}
            </>
          )}
        </Space>
      </Card>
    </BrandedScreen>
    </SessionGuard>
  );
}
