import { useState } from "react";
import { Button, Card, Radio, Space, Typography, message } from "antd";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

const { Text } = Typography;

async function startSession(hasNanesenie: boolean) {
  const res = await api.post("/sessions/start", { has_nanesenie: hasNanesenie });
  return res.data;
}

async function stopSession() {
  const res = await api.post("/sessions/stop");
  return res.data;
}

export default function SessionControl() {
  const navigate = useNavigate();
  const [hasNanesenie, setHasNanesenie] = useState(true);

  const startMutation = useMutation({
    mutationFn: startSession,
    onSuccess: (_, hasNanesenieFlag) =>
      message.success(
        hasNanesenieFlag ? "Смена запущена (с нанесением)" : "Смена запущена (без нанесения)",
      ),
    onError: (error: any) => {
      const detail = error?.response?.data?.detail || "Не удалось запустить смену";
      message.error(String(detail));
    },
  });

  const stopMutation = useMutation({
    mutationFn: stopSession,
    onSuccess: () => message.success("Смена остановлена"),
    onError: (error: any) => {
      const detail = error?.response?.data?.detail || "Не удалось остановить смену";
      message.error(String(detail));
    },
  });

  return (
    <Card title="Управление сменой" style={{ margin: 16 }}>
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <div>
          <Text strong>Режим запуска смены:</Text>
          <div style={{ marginTop: 8 }}>
            <Radio.Group
              value={hasNanesenie}
              onChange={(event) => setHasNanesenie(event.target.value)}
              optionType="button"
              buttonStyle="solid"
              options={[
                { label: "С нанесением", value: true },
                { label: "Без нанесения", value: false },
              ]}
            />
          </div>
        </div>

        <Space wrap>
          <Button
            type="primary"
            loading={startMutation.isPending}
            onClick={() => startMutation.mutate(hasNanesenie)}
          >
          Запустить смену
          </Button>
          <Button danger loading={stopMutation.isPending} onClick={() => stopMutation.mutate()}>
            Остановить смену
          </Button>
          <Button onClick={() => navigate("/admin")}>На главный экран</Button>
        </Space>
      </Space>
    </Card>
  );
}
