import { useQuery } from "@tanstack/react-query";
import { Spin, Typography } from "antd";
import api from "../../api/axios";

const { Title, Text } = Typography;

type ActiveSession = {
  id: number;
  is_active: boolean;
  has_nanesenie: boolean;
};

async function fetchActiveSession(): Promise<ActiveSession | null> {
  try {
    const res = await api.get<ActiveSession>("/sessions/active");
    return res.data;
  } catch {
    return null;
  }
}

function PausedScreen() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        gap: 24,
        background: "#0f172a",
        color: "#fff",
      }}
    >
      <div style={{ fontSize: 64 }}>⏸</div>
      <Title level={2} style={{ color: "#fff", margin: 0 }}>
        Смена остановлена
      </Title>
      <Text style={{ color: "#94a3b8", fontSize: 18 }}>
        Ожидайте возобновления работы
      </Text>
    </div>
  );
}

type Props = {
  children: React.ReactNode;
};

export default function SessionGuard({ children }: Props) {
  const { data: session, isLoading } = useQuery({
    queryKey: ["session-guard"],
    queryFn: fetchActiveSession,
    refetchInterval: 10_000,
    staleTime: 5_000,
  });

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!session) {
    return <PausedScreen />;
  }

  return <>{children}</>;
}
