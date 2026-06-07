import { useMemo } from "react";
import { Col, List, Row, Tag, Typography } from "antd";
import { useQuery } from "@tanstack/react-query";
import BrandedScreen from "../features/branding/BrandedScreen";
import { fetchBoardStatus } from "../features/orders/ordersApi";

const { Title, Text } = Typography;

const READY_STATUSES = new Set(["printed", "delivering"]);

const STATUS_LABELS: Record<string, string> = {
  new: "ПОДТВЕРЖДЕНИЕ",
  confirmed: "ПРИНЯТ",
  nanesenie: "НАНЕСЕНИЕ",
  nanesenie_done: "НАНЕСЕНИЕ ГОТОВО",
  printing: "ПЕЧАТЬ",
  printed: "ГОТОВ",
  delivering: "ВЫДАЧА",
};

const STATUS_COLORS: Record<string, string> = {
  new: "gold",
  confirmed: "blue",
  nanesenie: "purple",
  nanesenie_done: "geekblue",
  printing: "orange",
  printed: "green",
  delivering: "cyan",
};

type BoardOrder = {
  id: number;
  order_number?: number | null;
  status: string;
  client?: { name?: string } | null;
};

export default function Tablo() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["tablo-orders"],
    queryFn: fetchBoardStatus,
    refetchInterval: 3000,
    placeholderData: [],
  });

  const { inProgress, ready } = useMemo(() => {
    const inProgress: BoardOrder[] = [];
    const ready: BoardOrder[] = [];
    for (const order of data as BoardOrder[]) {
      if (READY_STATUSES.has(order.status)) {
        ready.push(order);
      } else {
        inProgress.push(order);
      }
    }
    return { inProgress, ready };
  }, [data]);

  return (
    <BrandedScreen backgroundKey="board-bg" showLogo>
      <Row style={{ padding: "24px 32px", minHeight: "calc(100vh - 80px)" }} gutter={32}>
        <Col span={14}>
          <Title level={3} style={{ marginBottom: 16 }}>
            В обработке
            <Text type="secondary" style={{ fontSize: 18, marginLeft: 12 }}>
              ({inProgress.length})
            </Text>
          </Title>
          <List
            loading={isLoading}
            dataSource={inProgress}
            locale={{ emptyText: "Нет заказов в обработке" }}
            renderItem={(order) => (
              <List.Item style={{ padding: "10px 0", borderBottom: "1px solid #f0f0f0" }}>
                <Row style={{ width: "100%" }} align="middle" wrap={false}>
                  <Col flex="110px">
                    <Text strong style={{ fontSize: 26 }}>
                      #{order.order_number ?? order.id}
                    </Text>
                  </Col>
                  <Col flex="auto">
                    <Text style={{ fontSize: 17 }}>{order.client?.name || ""}</Text>
                  </Col>
                  <Col>
                    <Tag
                      color={STATUS_COLORS[order.status] ?? "default"}
                      style={{ fontSize: 13, padding: "3px 10px" }}
                    >
                      {STATUS_LABELS[order.status] ?? order.status}
                    </Tag>
                  </Col>
                </Row>
              </List.Item>
            )}
          />
        </Col>

        <Col
          span={10}
          style={{
            borderLeft: "3px solid #52c41a",
            paddingLeft: 32,
          }}
        >
          <Title level={3} style={{ color: "#52c41a", marginBottom: 16 }}>
            Готово к выдаче
            <Text style={{ fontSize: 18, marginLeft: 12, color: "#52c41a" }}>
              ({ready.length})
            </Text>
          </Title>
          <List
            loading={isLoading}
            dataSource={ready}
            locale={{ emptyText: "Нет готовых заказов" }}
            renderItem={(order) => (
              <List.Item style={{ padding: "10px 0", borderBottom: "1px solid #d9f7be" }}>
                <Text strong style={{ fontSize: 40, color: "#52c41a" }}>
                  #{order.order_number ?? order.id}
                </Text>
              </List.Item>
            )}
          />
        </Col>
      </Row>
    </BrandedScreen>
  );
}
