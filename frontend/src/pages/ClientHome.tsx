import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Steps,
  Tag,
  Typography,
  message,
} from "antd";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import BrandedScreen from "../features/branding/BrandedScreen";
import { createOrder, type CreateOrderPayload } from "../features/orders/ordersApi";
import api from "../api/axios";
import { resolveApiUrl } from "../utils/resolveApiUrl";
import GarmentPreview, { isTextPrint, type GarmentPreviewUpdate } from "../components/GarmentPreview.tsx";
import { printOrderReceipt } from "../utils/printReceipt";

const { Title, Text } = Typography;

const PRINT_SIDES = [
  { value: "front", label: "Спереди" },
  { value: "back", label: "Сзади" },
];

const CUSTOM_TEXT_FONTS = [
  { value: "Arial", label: "Arial" },
  { value: "Helvetica", label: "Helvetica" },
  { value: "Verdana", label: "Verdana" },
  { value: "Georgia", label: "Georgia" },
  { value: "Times New Roman", label: "Times New Roman" },
  { value: "Courier New", label: "Courier New" },
  { value: "Impact", label: "Impact" },
];

const CUSTOM_TEXT_PRINT_ID = -1;
const CUSTOM_TEXT_PRINT: CatalogPrint = {
  id: CUSTOM_TEXT_PRINT_ID,
  name: "Свой текст",
  print_type: "custom_text",
  image_url: null,
  is_active: true,
};

const stepItems = [
  { title: "Цвет" },
  { title: "Модель" },
  { title: "Размер" },
  { title: "Принт" },
  { title: "Подтверждение" },
];

type CatalogColor = { id: number; name: string; is_active: boolean };
type CatalogModel = { id: number; name: string; color_id: number; front_image_url: string | null; back_image_url: string | null; is_active: boolean };
type CatalogSize = { id: number; code: string; is_active: boolean };
type CatalogModelSize = { id: number; model_id: number; size_id: number; stock_qty: number; is_active: boolean };
type CatalogPrint = { id: number; name: string; print_type: string; image_url: string | null; is_active: boolean };

type ConfirmFormValues = {
  client_name: string;
  client_phone: string;
  promo_code?: string;
  notify_method?: string;
  notify_contact?: string;
};

function normalizePhoneDigits(phone?: string) {
  return (phone || "").replace(/\D/g, "");
}

function ChoiceCard(props: {
  title: string;
  subtitle?: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  badge?: React.ReactNode;
}) {
  return (
    <Button
      type={props.active ? "primary" : "default"}
      onClick={props.onClick}
      disabled={props.disabled}
      style={{
        height: 110,
        width: "100%",
        padding: 16,
        textAlign: "left",
        borderRadius: 16,
        whiteSpace: "normal",
      }}
    >
      <Space direction="vertical" size={4} style={{ width: "100%" }}>
        <Space style={{ justifyContent: "space-between", width: "100%" }} align="start">
          <Text strong style={{ fontSize: 16 }}>
            {props.title}
          </Text>
          {props.badge}
        </Space>
        {props.subtitle ? <Text style={{ color: props.active ? "#fff" : undefined }}>{props.subtitle}</Text> : null}
      </Space>
    </Button>
  );
}


export default function ClientHome() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [confirmForm] = Form.useForm<ConfirmFormValues>();

  const [selectedColorId, setSelectedColorId] = useState<number | null>(null);
  const [selectedModelId, setSelectedModelId] = useState<number | null>(null);
  const [selectedSizeId, setSelectedSizeId] = useState<number | null>(null);
  const [selectedPrintId, setSelectedPrintId] = useState<number | undefined>(undefined);
  const [previewSide, setPreviewSide] = useState<"front" | "back">("front");

  // print parameters editable by user
  const [printSide, setPrintSide] = useState<"front" | "back">("front");
  const [printX, setPrintX] = useState<number>(50);
  const [printY, setPrintY] = useState<number>(50);
  const [printAngle, setPrintAngle] = useState<number>(0);
  const [printScale, setPrintScale] = useState<number>(100);
  const [printScaleX, setPrintScaleX] = useState<number>(100);
  const [printScaleY, setPrintScaleY] = useState<number>(100);
  const [printText, setPrintText] = useState<string>("");
  const [printFont, setPrintFont] = useState<string>("Arial");

  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [confirmPayload, setConfirmPayload] = useState<CreateOrderPayload | null>(null);

  const colorsQuery = useQuery({
    queryKey: ["client-catalog-colors"],
    queryFn: async () => (await api.get<CatalogColor[]>("/catalog/colors/")).data,
    retry: false,
  });

  const modelsQuery = useQuery({
    queryKey: ["client-catalog-models"],
    queryFn: async () => (await api.get<CatalogModel[]>("/catalog/models/")).data,
    retry: false,
  });

  const sizesQuery = useQuery({
    queryKey: ["client-catalog-sizes"],
    queryFn: async () => (await api.get<CatalogSize[]>("/catalog/sizes/")).data,
    retry: false,
  });

  const modelSizesQuery = useQuery({
    queryKey: ["client-catalog-model-sizes"],
    queryFn: async () => (await api.get<CatalogModelSize[]>("/catalog/model-sizes/")).data,
    retry: false,
  });

  const printsQuery = useQuery({
    queryKey: ["client-catalog-prints"],
    queryFn: async () => (await api.get<CatalogPrint[]>("/catalog/prints/")).data,
    retry: false,
  });

  const sessionQuery = useQuery({
    queryKey: ["client-active-session"],
    queryFn: async () => {
      try {
        const res = await api.get<{ has_nanesenie: boolean }>("/sessions/active");
        return res.data;
      } catch {
        return null;
      }
    },
    retry: false,
  });

  const hasNanesenie = sessionQuery.data?.has_nanesenie ?? true;

  const colors = useMemo(() => (colorsQuery.data ?? []).filter((item) => item.is_active), [colorsQuery.data]);
  const activeModels = useMemo(() => (modelsQuery.data ?? []).filter((item) => item.is_active), [modelsQuery.data]);
  const activeSizes = useMemo(() => (sizesQuery.data ?? []).filter((item) => item.is_active), [sizesQuery.data]);
  const activeModelSizes = useMemo(
    () => (modelSizesQuery.data ?? []).filter((item) => item.is_active && item.stock_qty > 0),
    [modelSizesQuery.data],
  );
  const activePrints = useMemo(() => (printsQuery.data ?? []).filter((item) => item.is_active), [printsQuery.data]);

  const orderedPrints = useMemo(() => {
    const templatePrints = activePrints.filter((item) => item.print_type !== "custom_text");
    const printable = hasNanesenie
      ? [CUSTOM_TEXT_PRINT, ...templatePrints]
      : templatePrints;
    printable.sort((left, right) => {
      if (left.id === CUSTOM_TEXT_PRINT_ID) return -1;
      if (right.id === CUSTOM_TEXT_PRINT_ID) return 1;
      const leftPriority = isTextPrint(left) ? 0 : 1;
      const rightPriority = isTextPrint(right) ? 0 : 1;
      return leftPriority - rightPriority || left.name.localeCompare(right.name);
    });
    return printable;
  }, [activePrints]);

  const availableModels = useMemo(() => {
    if (!selectedColorId) return [] as CatalogModel[];
    return activeModels.filter((item) => item.color_id === selectedColorId);
  }, [activeModels, selectedColorId]);

  const availableSizeIds = useMemo(() => {
    if (!selectedModelId) return [] as number[];
    return activeModelSizes.filter((item) => item.model_id === selectedModelId).map((item) => item.size_id);
  }, [activeModelSizes, selectedModelId]);

  const availableSizes = useMemo(
    () => activeSizes.filter((size) => availableSizeIds.includes(size.id)),
    [activeSizes, availableSizeIds],
  );

  const selectedColor = colors.find((item) => item.id === selectedColorId);
  const selectedModel = activeModels.find((item) => item.id === selectedModelId);
  const selectedSize = activeSizes.find((item) => item.id === selectedSizeId);
  const selectedPrint = selectedPrintId === CUSTOM_TEXT_PRINT_ID ? CUSTOM_TEXT_PRINT : orderedPrints.find((item) => item.id === selectedPrintId);

  const hasQueryError = colorsQuery.isError || modelsQuery.isError || sizesQuery.isError || modelSizesQuery.isError || printsQuery.isError;
  const isLoadingCatalog = colorsQuery.isLoading || modelsQuery.isLoading || sizesQuery.isLoading || modelSizesQuery.isLoading || printsQuery.isLoading;

  const createOrderMutation = useMutation({
    mutationFn: (payload: CreateOrderPayload) => createOrder(payload),
    onSuccess: (order) => {
      message.success(`Заказ #${order.id} создан`);
      printOrderReceipt({
        orderId: order.id,
        orderNumber: order.order_number ?? order.id,
        clientName: confirmPayload?.client?.name,
        clientPhone: confirmPayload?.client?.phone,
        modelName: selectedModel?.name,
        colorName: selectedColor?.name,
        sizeName: selectedSize?.code,
        printName: selectedPrint?.name,
        printImageUrl: selectedPrint?.image_url,
        printSide: confirmPayload?.print_side,
      });
      resetFlow();
      navigate("/client", { replace: true });
    },
    onError: (error: any) => {
      const detail = error?.response?.data?.detail || "Не удалось создать заказ";
      message.error(String(detail));
    },
  });

  function resetFlow() {
    setStep(0);
    setSelectedColorId(null);
    setSelectedModelId(null);
    setSelectedSizeId(null);
    setSelectedPrintId(undefined);
    setPrintSide("front");
    setPrintX(50);
    setPrintY(50);
    setPrintAngle(0);
    setPrintScale(100);
    setPrintText("");
    setPrintFont("Arial");
    confirmForm.resetFields();
    setConfirmModalVisible(false);
    setConfirmPayload(null);
  }

  useEffect(() => {
    if (step === 0 && !selectedColorId && colors.length === 1) {
      setSelectedColorId(colors[0].id);
      setStep(1);
    }
  }, [colors, selectedColorId, step]);

  useEffect(() => {
    if (step === 1 && selectedColorId && !selectedModelId && availableModels.length === 1) {
      setSelectedModelId(availableModels[0].id);
      setStep(2);
    }
  }, [availableModels, selectedColorId, selectedModelId, step]);

  useEffect(() => {
    if (step === 2 && selectedModelId && !selectedSizeId && availableSizes.length === 1) {
      setSelectedSizeId(availableSizes[0].id);
      setStep(3);
    }
  }, [availableSizes, selectedModelId, selectedSizeId, step]);

  useEffect(() => {
    if (printSide === "front" || printSide === "back") {
      setPreviewSide(printSide);
    }
  }, [printSide]);

  const isStepReady = () => {
    if (step === 0) return !!selectedColorId;
    if (step === 1) return !!selectedModelId;
    if (step === 2) return !!selectedSizeId;
    return true;
  };

  const goNext = () => {
    if (!isStepReady()) {
      message.warning("Сначала завершите текущий шаг");
      return;
    }
    setStep((prev) => Math.min(prev + 1, stepItems.length - 1));
  };

  const goPrev = () => setStep((prev) => Math.max(prev - 1, 0));

  const onSubmitConfirm = (values: ConfirmFormValues) => {
    if (!selectedModelId || !selectedSizeId) {
      message.error("Выберите модель и размер");
      return;
    }

    const payload: CreateOrderPayload = {
      client: {
        name: values.client_name,
        phone: values.client_phone,
      },
      color_id: selectedColorId ?? undefined,
      model_id: selectedModelId,
      size_id: selectedSizeId,
      print_id: selectedPrintId === CUSTOM_TEXT_PRINT_ID ? undefined : selectedPrintId,
      promo_code: values.promo_code || undefined,
      notify_method: values.notify_method,
      notify_contact: values.notify_contact,
      print_text: isTextPrint(selectedPrint) ? (printText || values.client_name) : undefined,
      print_font: isTextPrint(selectedPrint) ? printFont : undefined,
      print_side: printSide,
      print_x: printX,
      print_y: printY,
      print_angle: printAngle,
      print_scale: printScale,
      print_scale_x: printScaleX,
      print_scale_y: printScaleY,
    };

    setConfirmPayload(payload);
    setConfirmModalVisible(true);
  };

  const onConfirmFinal = () => {
    if (!confirmPayload) return;
    setConfirmModalVisible(false);
    createOrderMutation.mutate(confirmPayload);
  };

  const renderCards = <T extends { id: number }>(
    items: T[],
    renderTitle: (item: T) => string,
    renderSubtitle?: (item: T) => string,
    onSelect?: (item: T) => void,
    selectedId?: number | null,
  ) => (
    <Row gutter={[12, 12]}>
      {items.map((item) => {
        const isActive = selectedId === item.id;
        return (
          <Col key={item.id} xs={24} sm={12} md={8} lg={6}>
            <ChoiceCard
              title={renderTitle(item)}
              subtitle={renderSubtitle ? renderSubtitle(item) : undefined}
              active={isActive}
              onClick={onSelect ? () => onSelect(item) : undefined}
              badge={isActive ? <Tag color="green">Выбрано</Tag> : null}
            />
          </Col>
        );
      })}
    </Row>
  );

  return (
    <BrandedScreen backgroundKey="kiosk-bg" idleSplash splashTitle="Нажмите для работы" splashSubtitle="Терминал оформления заказов">
      <Button style={{ position: "fixed", top: 16, right: 16, zIndex: 1100 }} onClick={() => navigate("/login")}>
        Вход для сотрудников
      </Button>

      <Card style={{ margin: 16 }}>
        <Row gutter={[16, 16]} align="top">
          <Col xs={24} lg={9}>
            <div style={{ position: "sticky", top: 24 }}>
              <GarmentPreview
                color={selectedColor}
                model={selectedModel}
                size={selectedSize}
                print={selectedPrint}
                printText={printText}
                printFont={printFont}
                previewSide={previewSide}
                onSideChange={setPreviewSide}
                printSide={printSide}
                printX={printX}
                printY={printY}
                printAngle={printAngle}
                printScale={printScale}
                printScaleX={printScaleX}
                printScaleY={printScaleY}
                onUpdatePrint={(u: GarmentPreviewUpdate) => {
                  if (typeof u.printX === "number") setPrintX(u.printX);
                  if (typeof u.printY === "number") setPrintY(u.printY);
                  if (typeof u.printAngle === "number") setPrintAngle(u.printAngle);
                  if (typeof u.printScale === "number") setPrintScale(u.printScale);
                  if (typeof u.printScaleX === "number") setPrintScaleX(u.printScaleX);
                  if (typeof u.printScaleY === "number") setPrintScaleY(u.printScaleY);
                  if (u.printSide && ["front", "back"].includes(String(u.printSide))) {
                    setPrintSide(u.printSide as "front" | "back");
                  }
                }}
                editable={step === 3 && !!selectedPrintId}
              />
            </div>
          </Col>
          <Col xs={24} lg={15}>
            <Space direction="vertical" size={20} style={{ width: "100%" }}>
              <div>
                <Title level={3} style={{ margin: 0 }}>Оформление заказа</Title>
                <Text type="secondary">Пошаговый сценарий: цвет → модель → размер → принт → подтверждение</Text>
              </div>

              <Steps current={step} items={stepItems} />

              <Space wrap>
                <Button type={previewSide === "front" ? "primary" : "default"} onClick={() => setPreviewSide("front")}>
                  Спереди
                </Button>
                <Button type={previewSide === "back" ? "primary" : "default"} onClick={() => setPreviewSide("back")}>
                  Сзади
                </Button>
              </Space>

              {hasQueryError ? <Alert type="error" showIcon message="Не удалось загрузить каталог" /> : null}
              {isLoadingCatalog ? <Text>Загрузка каталога...</Text> : null}

              {!isLoadingCatalog && step === 0 ? (
                <Space direction="vertical" size={12} style={{ width: "100%" }}>
                  <Text strong>Шаг 1. Выберите цвет</Text>
                  {colors.length ? (
                    renderCards(
                      colors,
                      (item) => item.name || `Цвет #${item.id}`,
                      () => "Нажмите, чтобы выбрать",
                      (item) => {
                        setSelectedColorId(item.id);
                        setSelectedModelId(null);
                        setSelectedSizeId(null);
                        setStep(1);
                      },
                      selectedColorId,
                    )
                  ) : (
                    <Alert type="info" showIcon message="Нет доступных цветов" />
                  )}
                </Space>
              ) : null}

              {!isLoadingCatalog && step === 1 ? (
                <Space direction="vertical" size={12} style={{ width: "100%" }}>
                  <Text strong>Шаг 2. Выберите модель</Text>
                  {selectedColor ? <Text type="secondary">Выбранный цвет: {selectedColor.name}</Text> : null}
                  {availableModels.length ? (
                    renderCards(
                      availableModels,
                      (item) => item.name,
                      (item) => `Цвет #${item.color_id}`,
                      (item) => {
                        setSelectedModelId(item.id);
                        setSelectedSizeId(null);
                        setStep(2);
                      },
                      selectedModelId,
                    )
                  ) : (
                    <Alert type="warning" showIcon message="Для выбранного цвета нет доступных моделей" />
                  )}
                </Space>
              ) : null}

              {!isLoadingCatalog && step === 2 ? (
                <Space direction="vertical" size={12} style={{ width: "100%" }}>
                  <Text strong>Шаг 3. Выберите размер</Text>
                  {selectedModel ? <Text type="secondary">Выбранная модель: {selectedModel.name}</Text> : null}
                  {availableSizes.length ? (
                    renderCards(
                      availableSizes,
                      (item) => item.code,
                      () => "В наличии",
                      (item) => {
                        setSelectedSizeId(item.id);
                        setStep(3);
                      },
                      selectedSizeId,
                    )
                  ) : (
                    <Alert type="warning" showIcon message="Для модели нет доступных размеров в наличии" />
                  )}
                </Space>
              ) : null}

              {!isLoadingCatalog && step === 3 ? (
                <Space direction="vertical" size={12} style={{ width: "100%" }}>
                  <Text strong>Шаг 4. Выберите принт</Text>
                  {selectedSize ? <Text type="secondary">Выбранный размер: {selectedSize.code}</Text> : null}
                  {orderedPrints.length ? (
                    renderCards(
                      orderedPrints,
                      (item) => item.name + (isTextPrint(item) ? " · Свой текст" : ""),
                      (item) => item.print_type,
                      (item) => {
                        setSelectedPrintId(item.id);
                        // reset text/font for text prints or defaults for image prints
                        setPrintText("");
                        setPrintFont("Arial");
                        setPrintSide("front");
                        setPrintX(50);
                        setPrintY(50);
                        setPrintAngle(0);
                        setPrintScale(100);
                      },
                      selectedPrintId,
                    )
                  ) : (
                    <Alert type="info" showIcon message="Нет доступных принтов" />
                  )}

                  <Card size="small" title="Управление принтом" style={{ marginTop: 8 }}>
                    <Space direction="vertical" size={12} style={{ width: "100%" }}>
                      <Select
                        value={printSide}
                        onChange={(v) => setPrintSide(v as "front" | "back")}
                        style={{ width: 220 }}
                        options={PRINT_SIDES}
                      />
                      <Alert
                        type="info"
                        showIcon
                        message="Тяните рамку по области принта"
                        description="Нижний правый маркер меняет размер, верхний маркер крутит принт, сама рамка двигается мышкой."
                      />
                      <Button
                        onClick={() => {
                          setPrintX(50);
                          setPrintY(50);
                          setPrintAngle(0);
                          setPrintScale(100);
                        }}
                      >
                        Сбросить размещение
                      </Button>
                    </Space>
                    {isTextPrint(selectedPrint) ? (
                      <div style={{ marginTop: 12 }}>
                        <Alert
                          type="info"
                          showIcon
                          message="Текстовый принт"
                          description="Введите текст и шрифт для текстового принта."
                        />
                        <Space direction="vertical" style={{ marginTop: 8, width: "100%" }}>
                          <Input placeholder="Текст на принте" value={printText} onChange={(e) => setPrintText(e.target.value)} />
                          <Select
                            value={printFont}
                            onChange={(value) => setPrintFont(value)}
                            options={CUSTOM_TEXT_FONTS}
                            style={{ width: "100%" }}
                          />
                        </Space>
                      </div>
                    ) : null}
                  </Card>
                </Space>
              ) : null}

              {!isLoadingCatalog && step === 4 ? (
                <Space direction="vertical" size={12} style={{ width: "100%" }}>
                  <Text strong>Шаг 5. Подтверждение</Text>
                  <Card size="small">
                    <Descriptions column={1} bordered size="small">
                      <Descriptions.Item label="Цвет">{selectedColor?.name || "—"}</Descriptions.Item>
                      <Descriptions.Item label="Модель">{selectedModel?.name || "—"}</Descriptions.Item>
                      <Descriptions.Item label="Размер">{selectedSize?.code || "—"}</Descriptions.Item>
                      <Descriptions.Item label="Принт">
                        <Space direction="vertical" size={8}>
                          <span>
                            {isTextPrint(selectedPrint) && printText
                              ? `${selectedPrint?.name} · "${printText}"`
                              : selectedPrint?.name || "Без принта"}
                          </span>
                          {resolveApiUrl(selectedPrint?.image_url) ? (
                            <img
                              src={resolveApiUrl(selectedPrint?.image_url) ?? undefined}
                              alt={selectedPrint?.name || "Принт"}
                              style={{ width: 120, height: 120, objectFit: "contain", border: "1px solid #e5e7eb", borderRadius: 8, background: "#fff" }}
                            />
                          ) : null}
                        </Space>
                      </Descriptions.Item>
                    </Descriptions>
                  </Card>

                  <Form form={confirmForm} layout="vertical" onFinish={onSubmitConfirm}>
                    <Row gutter={12}>
                      <Col xs={24} md={8}>
                        <Form.Item
                          name="client_name"
                          label="Как к вам обращаться"
                          rules={[{ required: true, message: "Введите имя" }]}
                        >
                          <Input placeholder="Иван" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={8}>
                        <Form.Item
                          name="client_phone"
                          label="Телефон"
                          rules={[
                            { required: true, message: "Введите телефон" },
                            {
                              validator: (_, value?: string) => {
                                if (!value) return Promise.resolve();
                                if (/[A-Za-zА-Яа-я]/.test(value)) {
                                  return Promise.reject(new Error("Телефон должен содержать только цифры и символы +()-"));
                                }
                                const digits = normalizePhoneDigits(value);
                                if (digits.length < 10) {
                                  return Promise.reject(new Error("Введите минимум 10 цифр"));
                                }
                                if (digits.length > 15) {
                                  return Promise.reject(new Error("Слишком длинный номер телефона"));
                                }
                                return Promise.resolve();
                              },
                            },
                          ]}
                        >
                          <Input placeholder="+79990001122" inputMode="tel" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={8}>
                        <Form.Item name="promo_code" label="Промокод (необязательно)">
                          <Input placeholder="Введите промокод" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={8}>
                        <Form.Item
                          name="notify_method"
                          label="Уведомление"
                          rules={[{ required: true, message: "Выберите способ уведомления" }]}
                        >
                          <Select
                            options={[
                              { value: "sms", label: "SMS" },
                              { value: "email", label: "Email" },
                              { value: "telegram", label: "Telegram" },
                              { value: "whatsapp", label: "WhatsApp" },
                              { value: "viber", label: "Viber" },
                              { value: "none", label: "Не уведомлять" },
                            ]}
                          />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12}>
                        <Form.Item
                          noStyle
                          shouldUpdate={(prev, cur) => prev.notify_method !== cur.notify_method}
                        >
                          {({ getFieldValue }) => {
                            const notifyMethod = getFieldValue("notify_method");
                            const contactRequired = !!notifyMethod && notifyMethod !== "none";
                            return (
                              <Form.Item
                                name="notify_contact"
                                label="Контакт для уведомления"
                                rules={contactRequired ? [{ required: true, message: "Укажите контакт для выбранного способа" }] : undefined}
                              >
                                <Input
                                  disabled={!notifyMethod || notifyMethod === "none"}
                                  placeholder={
                                    notifyMethod === "sms" || notifyMethod === "whatsapp" || notifyMethod === "viber"
                                      ? "+79990001122"
                                      : notifyMethod === "telegram"
                                        ? "@username"
                                        : notifyMethod === "email"
                                          ? "email@example.com"
                                          : "Выберите способ уведомления"
                                  }
                                />
                              </Form.Item>
                            );
                          }}
                        </Form.Item>
                      </Col>
                      <Col xs={24}>
                        <Text type="secondary">
                          Способ уведомления обязателен. Если выбран вариант кроме «Не уведомлять», укажите контакт.
                        </Text>
                      </Col>
                    </Row>

                    <Space>
                      <Button type="primary" htmlType="submit" loading={createOrderMutation.isPending}>
                        Подтвердить и оформить заказ
                      </Button>
                    </Space>
                  </Form>
                </Space>
              ) : null}

              <Space>
                <Button disabled={step === 0} onClick={goPrev}>Назад</Button>
                {step < stepItems.length - 1 ? <Button type="primary" onClick={goNext}>Далее</Button> : null}
                <Button onClick={resetFlow}>Сбросить</Button>
              </Space>

              <Modal
                title="Подтвердите заказ"
                open={confirmModalVisible}
                onCancel={() => setConfirmModalVisible(false)}
                footer={[
                  <Button key="back" onClick={() => setConfirmModalVisible(false)}>Отмена</Button>,
                  <Button key="confirm" type="primary" loading={createOrderMutation.isPending} onClick={onConfirmFinal}>
                    Подтвердить и оформить
                  </Button>,
                ]}
              >
                {confirmPayload ? (
                  <Descriptions column={1} bordered size="small">
                    <Descriptions.Item label="Клиент">{confirmPayload.client?.name || "—"}</Descriptions.Item>
                    <Descriptions.Item label="Телефон">{confirmPayload.client?.phone || "—"}</Descriptions.Item>
                    <Descriptions.Item label="Цвет">{selectedColor?.name || "—"}</Descriptions.Item>
                    <Descriptions.Item label="Модель">{selectedModel?.name || "—"}</Descriptions.Item>
                    <Descriptions.Item label="Размер">{selectedSize?.code || "—"}</Descriptions.Item>
                    <Descriptions.Item label="Принт">
                      <Space direction="vertical" size={8}>
                        <span>
                          {isTextPrint(selectedPrint)
                            ? printText || "Без принта"
                            : selectedPrint?.name || "Без принта"}
                        </span>
                        {resolveApiUrl(selectedPrint?.image_url) ? (
                          <img
                            src={resolveApiUrl(selectedPrint?.image_url) ?? undefined}
                            alt={selectedPrint?.name || "Принт"}
                            style={{ width: 120, height: 120, objectFit: "contain", border: "1px solid #e5e7eb", borderRadius: 8, background: "#fff" }}
                          />
                        ) : null}
                      </Space>
                    </Descriptions.Item>
                    <Descriptions.Item label="Размер принта, %">{printScale}</Descriptions.Item>
                    {confirmPayload.promo_code && (
                      <Descriptions.Item label="Промокод">{confirmPayload.promo_code}</Descriptions.Item>
                    )}
                    <Descriptions.Item label="Уведомление">{confirmPayload.notify_method || "—"}</Descriptions.Item>
                    <Descriptions.Item label="Контакт для уведомления">{confirmPayload.notify_contact || "—"}</Descriptions.Item>
                  </Descriptions>
                ) : null}
              </Modal>
            </Space>
          </Col>
        </Row>
      </Card>
    </BrandedScreen>
  );
}
