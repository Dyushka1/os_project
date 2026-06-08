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
  Slider,
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

  const [activePrintSlot, setActivePrintSlot] = useState<1 | 2>(1);
  const [selectedPrint2Id, setSelectedPrint2Id] = useState<number | undefined>(undefined);
  const [print2Side, setPrint2Side] = useState<"front" | "back">("back");
  const [print2X, setPrint2X] = useState<number>(50);
  const [print2Y, setPrint2Y] = useState<number>(50);
  const [print2Angle, setPrint2Angle] = useState<number>(0);
  const [print2Scale, setPrint2Scale] = useState<number>(100);
  const [print2ScaleX, setPrint2ScaleX] = useState<number>(100);
  const [print2ScaleY, setPrint2ScaleY] = useState<number>(100);
  const [print2Text, setPrint2Text] = useState<string>("");
  const [print2Font, setPrint2Font] = useState<string>("Arial");

  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [confirmPayload, setConfirmPayload] = useState<CreateOrderPayload | null>(null);
  const [promoStatus, setPromoStatus] = useState<"idle" | "checking" | "valid" | "invalid">("idle");
  const [promoDescription, setPromoDescription] = useState<string | null>(null);
  const [telegramOrderId, setTelegramOrderId] = useState<number | null>(null);

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
  const selectedPrint2 = selectedPrint2Id === CUSTOM_TEXT_PRINT_ID ? CUSTOM_TEXT_PRINT : orderedPrints.find((item) => item.id === selectedPrint2Id);

  const hasQueryError = colorsQuery.isError || modelsQuery.isError || sizesQuery.isError || modelSizesQuery.isError || printsQuery.isError;
  const isLoadingCatalog = colorsQuery.isLoading || modelsQuery.isLoading || sizesQuery.isLoading || modelSizesQuery.isLoading || printsQuery.isLoading;

  const TELEGRAM_BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME as string | undefined;

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
      if (confirmPayload?.notify_method === "telegram" && TELEGRAM_BOT_USERNAME) {
        setTelegramOrderId(order.id);
      } else {
        resetFlow();
        navigate("/client", { replace: true });
      }
    },
    onError: (error: any) => {
      const detail = error?.response?.data?.detail;
      if (Array.isArray(detail)) {
        message.error(detail.map((e: any) => e?.msg || JSON.stringify(e)).join("; "));
      } else {
        message.error(detail || "Не удалось создать заказ");
      }
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
    setPrintScaleX(100);
    setPrintScaleY(100);
    setPrintText("");
    setPrintFont("Arial");
    setActivePrintSlot(1);
    setSelectedPrint2Id(undefined);
    setPrint2Side("back");
    setPrint2X(50);
    setPrint2Y(50);
    setPrint2Angle(0);
    setPrint2Scale(100);
    setPrint2ScaleX(100);
    setPrint2ScaleY(100);
    setPrint2Text("");
    setPrint2Font("Arial");
    confirmForm.resetFields();
    setConfirmModalVisible(false);
    setConfirmPayload(null);
    setPromoStatus("idle");
    setPromoDescription(null);
    setTelegramOrderId(null);
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
      print2_id: selectedPrint2Id === CUSTOM_TEXT_PRINT_ID ? undefined : selectedPrint2Id,
      print2_text: isTextPrint(selectedPrint2) ? (print2Text || undefined) : undefined,
      print2_font: isTextPrint(selectedPrint2) ? print2Font : undefined,
      print2_side: selectedPrint2Id ? print2Side : undefined,
      print2_x: selectedPrint2Id ? print2X : undefined,
      print2_y: selectedPrint2Id ? print2Y : undefined,
      print2_angle: selectedPrint2Id ? print2Angle : undefined,
      print2_scale: selectedPrint2Id ? print2Scale : undefined,
      print2_scale_x: selectedPrint2Id ? print2ScaleX : undefined,
      print2_scale_y: selectedPrint2Id ? print2ScaleY : undefined,
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
                print2={selectedPrint2}
                print2Text={print2Text}
                print2Font={print2Font}
                print2Side={selectedPrint2Id ? print2Side : undefined}
                print2X={print2X}
                print2Y={print2Y}
                print2Angle={print2Angle}
                print2Scale={print2Scale}
                print2ScaleX={print2ScaleX}
                print2ScaleY={print2ScaleY}
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
                onUpdatePrint2={(u) => {
                  if (typeof u.print2X === "number") setPrint2X(u.print2X);
                  if (typeof u.print2Y === "number") setPrint2Y(u.print2Y);
                  if (typeof u.print2Angle === "number") setPrint2Angle(u.print2Angle);
                  if (typeof u.print2ScaleX === "number") setPrint2ScaleX(u.print2ScaleX);
                  if (typeof u.print2ScaleY === "number") setPrint2ScaleY(u.print2ScaleY);
                }}
                editable={step === 3 && (activePrintSlot === 1 ? !!selectedPrintId : !!selectedPrint2Id)}
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

                  <Space>
                    <Button
                      type={activePrintSlot === 1 ? "primary" : "default"}
                      onClick={() => {
                        setActivePrintSlot(1);
                        if (printSide === "front" || printSide === "back") setPreviewSide(printSide);
                      }}
                    >
                      Принт 1 {selectedPrintId ? "✓" : ""}
                    </Button>
                    <Button
                      type={activePrintSlot === 2 ? "primary" : "default"}
                      onClick={() => {
                        setActivePrintSlot(2);
                        if (print2Side === "front" || print2Side === "back") setPreviewSide(print2Side);
                      }}
                    >
                      Принт 2 (необязательно) {selectedPrint2Id ? "✓" : ""}
                    </Button>
                  </Space>

                  {activePrintSlot === 1 ? (<>
                    {orderedPrints.length ? (
                      renderCards(
                        orderedPrints,
                        (item) => item.name + (isTextPrint(item) ? " · Свой текст" : ""),
                        (item) => item.print_type,
                        (item) => {
                          setSelectedPrintId(item.id);
                          setPrintText("");
                          setPrintFont("Arial");
                          setPrintSide("front");
                          setPrintX(50);
                          setPrintY(50);
                          setPrintAngle(0);
                          setPrintScale(100);
                          setPrintScaleX(100);
                          setPrintScaleY(100);
                        },
                        selectedPrintId,
                      )
                    ) : (
                      <Alert type="info" showIcon message="Нет доступных принтов" />
                    )}
                    <Card size="small" title="Управление принтом 1" style={{ marginTop: 8 }}>
                      <Space direction="vertical" size={12} style={{ width: "100%" }}>
                        <Select
                          value={printSide}
                          onChange={(v) => setPrintSide(v as "front" | "back")}
                          style={{ width: 220 }}
                          options={PRINT_SIDES}
                        />
                        <Alert type="info" showIcon message="Тяните рамку по области принта" description="Нижний правый маркер меняет размер, верхний маркер крутит принт, сама рамка двигается мышкой." />
                        <div>
                          <div style={{ marginBottom: 2, fontSize: 13, color: "#555" }}>Размер шрифта: {printScale}%</div>
                          <Slider min={5} max={500} value={printScale} onChange={(v) => setPrintScale(v)} />
                        </div>
                        <div>
                          <div style={{ marginBottom: 2, fontSize: 13, color: "#555" }}>Ширина: {printScaleX}%</div>
                          <Slider min={5} max={500} value={printScaleX} onChange={(v) => setPrintScaleX(v)} />
                        </div>
                        <div>
                          <div style={{ marginBottom: 2, fontSize: 13, color: "#555" }}>Высота: {printScaleY}%</div>
                          <Slider min={5} max={500} value={printScaleY} onChange={(v) => setPrintScaleY(v)} />
                        </div>
                        <Button onClick={() => { setPrintX(50); setPrintY(50); setPrintAngle(0); setPrintScale(100); setPrintScaleX(100); setPrintScaleY(100); }}>
                          Сбросить размещение
                        </Button>
                      </Space>
                      {isTextPrint(selectedPrint) ? (
                        <div style={{ marginTop: 12 }}>
                          <Space direction="vertical" style={{ width: "100%" }}>
                            <Input placeholder="Текст на принте" value={printText} onChange={(e) => setPrintText(e.target.value)} />
                            <Select value={printFont} onChange={(value) => setPrintFont(value)} options={CUSTOM_TEXT_FONTS} style={{ width: "100%" }} />
                          </Space>
                        </div>
                      ) : null}
                    </Card>
                  </>) : (<>
                    {orderedPrints.length ? (
                      renderCards(
                        orderedPrints,
                        (item) => item.name + (isTextPrint(item) ? " · Свой текст" : ""),
                        (item) => item.print_type,
                        (item) => {
                          setSelectedPrint2Id(item.id);
                          setPrint2Text("");
                          setPrint2Font("Arial");
                          setPrint2Side("back");
                          setPrint2X(50);
                          setPrint2Y(50);
                          setPrint2Angle(0);
                          setPrint2Scale(100);
                          setPrint2ScaleX(100);
                          setPrint2ScaleY(100);
                        },
                        selectedPrint2Id,
                      )
                    ) : (
                      <Alert type="info" showIcon message="Нет доступных принтов" />
                    )}
                    <Card size="small" title="Управление принтом 2" style={{ marginTop: 8 }}>
                      <Space direction="vertical" size={12} style={{ width: "100%" }}>
                        <Select
                          value={print2Side}
                          onChange={(v) => { setPrint2Side(v as "front" | "back"); setPreviewSide(v as "front" | "back"); }}
                          style={{ width: 220 }}
                          options={PRINT_SIDES}
                        />
                        <Alert type="info" showIcon message="Тяните оранжевую рамку принта 2" description="Оранжевая рамка — принт 2. Нижний правый маркер меняет размер, верхний крутит." />
                        <div>
                          <div style={{ marginBottom: 2, fontSize: 13, color: "#555" }}>Размер шрифта: {print2Scale}%</div>
                          <Slider min={5} max={500} value={print2Scale} onChange={(v) => setPrint2Scale(v)} />
                        </div>
                        <div>
                          <div style={{ marginBottom: 2, fontSize: 13, color: "#555" }}>Ширина: {print2ScaleX}%</div>
                          <Slider min={5} max={500} value={print2ScaleX} onChange={(v) => setPrint2ScaleX(v)} />
                        </div>
                        <div>
                          <div style={{ marginBottom: 2, fontSize: 13, color: "#555" }}>Высота: {print2ScaleY}%</div>
                          <Slider min={5} max={500} value={print2ScaleY} onChange={(v) => setPrint2ScaleY(v)} />
                        </div>
                        <Button onClick={() => { setPrint2X(50); setPrint2Y(50); setPrint2Angle(0); setPrint2Scale(100); setPrint2ScaleX(100); setPrint2ScaleY(100); }}>
                          Сбросить размещение
                        </Button>
                        {selectedPrint2Id && (
                          <Button danger onClick={() => setSelectedPrint2Id(undefined)}>
                            Убрать принт 2
                          </Button>
                        )}
                      </Space>
                      {isTextPrint(selectedPrint2) ? (
                        <div style={{ marginTop: 12 }}>
                          <Space direction="vertical" style={{ width: "100%" }}>
                            <Input placeholder="Текст на принте 2" value={print2Text} onChange={(e) => setPrint2Text(e.target.value)} />
                            <Select value={print2Font} onChange={(value) => setPrint2Font(value)} options={CUSTOM_TEXT_FONTS} style={{ width: "100%" }} />
                          </Space>
                        </div>
                      ) : null}
                    </Card>
                  </>)}
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
                      <Descriptions.Item label="Принт 1">
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
                      {selectedPrint2 && (
                        <Descriptions.Item label="Принт 2">
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            <span>
                              {isTextPrint(selectedPrint2) && print2Text
                                ? `${selectedPrint2.name} · "${print2Text}"`
                                : selectedPrint2.name}
                            </span>
                            {resolveApiUrl(selectedPrint2.image_url) ? (
                              <img
                                src={resolveApiUrl(selectedPrint2.image_url) ?? undefined}
                                alt={selectedPrint2.name}
                                style={{ width: 120, height: 120, objectFit: "contain", border: "1px solid #e5e7eb", borderRadius: 8, background: "#fff" }}
                              />
                            ) : null}
                          </div>
                        </Descriptions.Item>
                      )}
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
                        <Form.Item
                          name="promo_code"
                          label="Промокод (необязательно)"
                          validateStatus={promoStatus === "valid" ? "success" : promoStatus === "invalid" ? "error" : promoStatus === "checking" ? "validating" : ""}
                          help={
                            promoStatus === "valid"
                              ? `Промокод применён${promoDescription ? ` · ${promoDescription}` : ""}`
                              : promoStatus === "invalid"
                              ? "Промокод не найден или неактивен"
                              : undefined
                          }
                        >
                          <Input
                            placeholder="Введите промокод"
                            onBlur={async (e) => {
                              const code = e.target.value.trim();
                              if (!code) { setPromoStatus("idle"); setPromoDescription(null); return; }
                              setPromoStatus("checking");
                              try {
                                const res = await api.get(`/promo-codes/validate?code=${encodeURIComponent(code.toUpperCase())}`);
                                setPromoStatus("valid");
                                setPromoDescription(res.data.description ?? null);
                              } catch {
                                setPromoStatus("invalid");
                                setPromoDescription(null);
                              }
                            }}
                            onChange={() => { if (promoStatus !== "idle") setPromoStatus("idle"); }}
                          />
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
                              { value: "email", label: "Email" },
                              { value: "telegram", label: "Telegram" },
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
                            const isTelegram = notifyMethod === "telegram";
                            const contactRequired = !!notifyMethod && notifyMethod !== "none";
                            return (
                              <Form.Item
                                name="notify_contact"
                                label="Контакт для уведомления"
                                rules={contactRequired ? [{ required: true, message: "Укажите контакт для выбранного способа" }] : undefined}
                                help={isTelegram ? "Клиент введёт этот номер в боте чтобы получить уведомление" : undefined}
                              >
                                <Input
                                  disabled={!notifyMethod || notifyMethod === "none"}
                                  placeholder={
                                    isTelegram
                                      ? "+79990001122"
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
                    <Descriptions.Item label="Принт 1">
                      <Space direction="vertical" size={8}>
                        <span>
                          {isTextPrint(selectedPrint)
                            ? printText || "Без принта"
                            : selectedPrint?.name || "Без принта"}
                          {confirmPayload.print_side ? ` (${confirmPayload.print_side === "front" ? "перед" : "спина"})` : ""}
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
                    <Descriptions.Item label="Размер принта 1, %">{printScale}</Descriptions.Item>
                    {(confirmPayload.print2_id || confirmPayload.print2_text) && selectedPrint2 && (
                      <>
                        <Descriptions.Item label="Принт 2">
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            <span>
                              {confirmPayload.print2_text
                                ? confirmPayload.print2_text
                                : selectedPrint2.name}
                              {confirmPayload.print2_side ? ` (${confirmPayload.print2_side === "front" ? "перед" : "спина"})` : ""}
                            </span>
                            {resolveApiUrl(selectedPrint2.image_url) ? (
                              <img
                                src={resolveApiUrl(selectedPrint2.image_url) ?? undefined}
                                alt={selectedPrint2.name}
                                style={{ width: 120, height: 120, objectFit: "contain", border: "1px solid #e5e7eb", borderRadius: 8, background: "#fff" }}
                              />
                            ) : null}
                          </div>
                        </Descriptions.Item>
                        <Descriptions.Item label="Размер принта 2, %">{print2Scale}</Descriptions.Item>
                      </>
                    )}
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
      <Modal
        title={`Заказ #${telegramOrderId} оформлен`}
        open={telegramOrderId !== null}
        closable={false}
        footer={[
          <Button key="close" type="primary" onClick={() => { resetFlow(); navigate("/client", { replace: true }); }}>
            Готово
          </Button>,
        ]}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "8px 0" }}>
          {TELEGRAM_BOT_USERNAME && (
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(`https://t.me/${TELEGRAM_BOT_USERNAME}`)}`}
              alt="QR-код для Telegram"
              style={{ width: 220, height: 220, borderRadius: 12, border: "1px solid #e5e7eb" }}
            />
          )}
          <Text style={{ textAlign: "center", fontSize: 15 }}>
            Покажите клиенту этот QR-код
          </Text>
          <Text type="secondary" style={{ textAlign: "center" }}>
            Клиент сканирует код → открывает бота → вводит номер телефона → получает уведомление когда заказ будет готов.
          </Text>
        </div>
      </Modal>
    </BrandedScreen>
  );
}
