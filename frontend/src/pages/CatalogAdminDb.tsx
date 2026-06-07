import { useMemo, useRef, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../api/axios";
import TypedDangerButton from "../components/TypedDangerButton";
import { resolveApiUrl } from "../utils/resolveApiUrl";

const { Title, Text } = Typography;

type CatalogColor = {
  id: number;
  name: string;
  hex_code: string | null;
  is_active: boolean;
};

type CatalogModel = {
  id: number;
  name: string;
  garment_type: string | null;
  color_id: number;
  front_image_url: string | null;
  back_image_url: string | null;
  is_active: boolean;
  default_print_id?: number | null;
};

type CatalogSize = {
  id: number;
  code: string;
  sort_order: number;
  is_active: boolean;
};

type CatalogModelSize = {
  id: number;
  model_id: number;
  size_id: number;
  stock_qty: number;
  is_active: boolean;
};

type CatalogPrint = {
  id: number;
  name: string;
  print_type: string;
  image_url: string | null;
  width: number | null;
  height: number | null;
  stock_qty: number | null;
  is_active: boolean;
};

function getApiError(error: any, fallback: string) {
  return String(error?.response?.data?.detail || fallback);
}

export default function CatalogAdminDb() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [colorForm] = Form.useForm();
  const [modelForm] = Form.useForm();
  const [editingModel, setEditingModel] = useState<number | null>(null);
  const [sizeForm] = Form.useForm();
  const [modelSizeForm] = Form.useForm();
  const [printForm] = Form.useForm();
  const frontModelImageInputRef = useRef<HTMLInputElement | null>(null);
  const backModelImageInputRef = useRef<HTMLInputElement | null>(null);
  const printImageInputRef = useRef<HTMLInputElement | null>(null);
  const newPrintImageInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedPrintImageId, setSelectedPrintImageId] = useState<number | null>(null);
  const [newPrintImageFile, setNewPrintImageFile] = useState<File | null>(null);

  const [stockSearch, setStockSearch] = useState("");
  const [printSearch, setPrintSearch] = useState("");

  const colorsQuery = useQuery({
    queryKey: ["catalog-colors"],
    queryFn: async () => (await api.get<CatalogColor[]>("/catalog/colors/")).data,
    retry: false,
  });

  const modelsQuery = useQuery({
    queryKey: ["catalog-models"],
    queryFn: async () => (await api.get<CatalogModel[]>("/catalog/models/")).data,
    retry: false,
  });

  const sizesQuery = useQuery({
    queryKey: ["catalog-sizes"],
    queryFn: async () => (await api.get<CatalogSize[]>("/catalog/sizes/")).data,
    retry: false,
  });

  const modelSizesQuery = useQuery({
    queryKey: ["catalog-model-sizes"],
    queryFn: async () => (await api.get<CatalogModelSize[]>("/catalog/model-sizes/")).data,
    retry: false,
  });

  const printsQuery = useQuery({
    queryKey: ["catalog-prints"],
    queryFn: async () => (await api.get<CatalogPrint[]>("/catalog/prints/")).data,
    retry: false,
  });

  const colors = colorsQuery.data ?? [];
  const models = modelsQuery.data ?? [];
  const sizes = sizesQuery.data ?? [];
  const modelSizes = modelSizesQuery.data ?? [];
  const prints = printsQuery.data ?? [];

  const refreshCatalog = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["catalog-colors"] }),
      queryClient.invalidateQueries({ queryKey: ["catalog-models"] }),
      queryClient.invalidateQueries({ queryKey: ["catalog-sizes"] }),
      queryClient.invalidateQueries({ queryKey: ["catalog-model-sizes"] }),
      queryClient.invalidateQueries({ queryKey: ["catalog-prints"] }),
    ]);
  };

  const createColorMutation = useMutation({
    mutationFn: async (payload: { name: string; hex_code?: string }) => {
      const res = await api.post("/catalog/colors/", { name: payload.name, hex_code: payload.hex_code || null });
      return res.data;
    },
    onSuccess: async () => {
      colorForm.resetFields();
      await refreshCatalog();
      message.success("Цвет добавлен в БД");
    },
    onError: (error: any) => message.error(getApiError(error, "Не удалось добавить цвет")),
  });

  const deleteColorMutation = useMutation({
    mutationFn: async (id: number) => (await api.delete(`/catalog/colors/${id}`)).data,
    onSuccess: async () => {
      await refreshCatalog();
      message.success("Цвет удален");
    },
    onError: (error: any) => message.error(getApiError(error, "Не удалось удалить цвет")),
  });

  const createModelMutation = useMutation({
    mutationFn: async (payload: { name: string; color_id: number; garment_type?: string; default_print_id?: number | null }) => {
      const res = await api.post("/catalog/models/", {
        name: payload.name,
        color_id: payload.color_id,
        garment_type: payload.garment_type || null,
        default_print_id: payload.default_print_id ?? null,
      });
      return res.data;
    },
    onSuccess: async (createdModel: CatalogModel) => {
      modelForm.resetFields();
      setEditingModel(createdModel.id);
      await refreshCatalog();
      message.success("Модель добавлена в БД");
    },
    onError: (error: any) => message.error(getApiError(error, "Не удалось добавить модель")),
  });

  const updateModelMutation = useMutation({
    mutationFn: async (payload: { id: number; name?: string; color_id?: number; garment_type?: string | null; default_print_id?: number | null }) => {
      const res = await api.put(`/catalog/models/${payload.id}`, {
        name: payload.name,
        color_id: payload.color_id,
        garment_type: payload.garment_type ?? null,
        default_print_id: payload.default_print_id ?? null,
      });
      return res.data;
    },
    onSuccess: async () => {
      await refreshCatalog();
      message.success("Модель обновлена");
    },
    onError: (error: any) => message.error(getApiError(error, "Не удалось обновить модель")),
  });

  const uploadModelImageMutation = useMutation({
    mutationFn: async (payload: { id: number; side: "front" | "back"; file: File }) => {
      const formData = new FormData();
      formData.append("side", payload.side);
      formData.append("file", payload.file);
      const res = await api.post(`/catalog/models/${payload.id}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data as CatalogModel;
    },
    onSuccess: async () => {
      await refreshCatalog();
      message.success("Изображение модели загружено");
    },
    onError: (error: any) => message.error(getApiError(error, "Не удалось загрузить изображение модели")),
  });

  const deleteModelMutation = useMutation({
    mutationFn: async (id: number) => (await api.delete(`/catalog/models/${id}`)).data,
    onSuccess: async () => {
      await refreshCatalog();
      message.success("Модель удалена");
    },
    onError: (error: any) => message.error(getApiError(error, "Не удалось удалить модель")),
  });

  const createSizeMutation = useMutation({
    mutationFn: async (payload: { code: string; sort_order?: number }) => {
      const res = await api.post("/catalog/sizes/", {
        code: payload.code,
        sort_order: payload.sort_order ?? 0,
      });
      return res.data;
    },
    onSuccess: async () => {
      sizeForm.resetFields();
      await refreshCatalog();
      message.success("Размер добавлен в БД");
    },
    onError: (error: any) => message.error(getApiError(error, "Не удалось добавить размер")),
  });

  const deleteSizeMutation = useMutation({
    mutationFn: async (id: number) => (await api.delete(`/catalog/sizes/${id}`)).data,
    onSuccess: async () => {
      await refreshCatalog();
      message.success("Размер удален");
    },
    onError: (error: any) => message.error(getApiError(error, "Не удалось удалить размер")),
  });

  const createModelSizeMutation = useMutation({
    mutationFn: async (payload: { model_id: number; size_id: number; stock_qty: number }) => {
      const res = await api.post("/catalog/model-sizes/", payload);
      return res.data;
    },
    onSuccess: async () => {
      modelSizeForm.resetFields();
      await refreshCatalog();
      message.success("Связь модель-размер добавлена в БД");
    },
    onError: (error: any) => message.error(getApiError(error, "Не удалось добавить связь")),
  });

  const updateModelSizeMutation = useMutation({
    mutationFn: async (payload: { id: number; stock_qty: number }) => {
      const res = await api.put(`/catalog/model-sizes/${payload.id}`, { stock_qty: payload.stock_qty });
      return res.data;
    },
    onSuccess: async () => {
      await refreshCatalog();
    },
    onError: (error: any) => message.error(getApiError(error, "Не удалось обновить остаток")),
  });

  const deleteModelSizeMutation = useMutation({
    mutationFn: async (id: number) => (await api.delete(`/catalog/model-sizes/${id}`)).data,
    onSuccess: async () => {
      await refreshCatalog();
      message.success("Связь удалена");
    },
    onError: (error: any) => message.error(getApiError(error, "Не удалось удалить связь")),
  });

  const createPrintMutation = useMutation({
    mutationFn: async (payload: { name: string; print_type: string; stock_qty: number }) => {
      const res = await api.post("/catalog/prints/", payload);
      return res.data;
    },
    onSuccess: async () => {
      printForm.resetFields();
      await refreshCatalog();
      message.success("Принт добавлен в БД");
    },
    onError: (error: any) => message.error(getApiError(error, "Не удалось добавить принт")),
  });

  const updatePrintMutation = useMutation({
    mutationFn: async (payload: { id: number; stock_qty?: number; width?: number; height?: number }) => {
      const res = await api.put(`/catalog/prints/${payload.id}`, {
        ...(payload.stock_qty !== undefined && { stock_qty: payload.stock_qty }),
        ...(payload.width !== undefined && { width: payload.width }),
        ...(payload.height !== undefined && { height: payload.height }),
      });
      return res.data;
    },
    onSuccess: async () => {
      await refreshCatalog();
    },
    onError: (error: any) => message.error(getApiError(error, "Не удалось обновить остаток принта")),
  });

  const deletePrintMutation = useMutation({
    mutationFn: async (id: number) => (await api.delete(`/catalog/prints/${id}`)).data,
    onSuccess: async () => {
      await refreshCatalog();
      message.success("Принт удален");
    },
    onError: (error: any) => message.error(getApiError(error, "Не удалось удалить принт")),
  });

  const uploadPrintImageMutation = useMutation({
    mutationFn: async (payload: { id: number; file: File }) => {
      const formData = new FormData();
      formData.append("file", payload.file);
      const res = await api.post(`/catalog/prints/${payload.id}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data as CatalogPrint;
    },
    onSuccess: async () => {
      await refreshCatalog();
      message.success("Изображение принта загружено");
    },
    onError: (error: any) => message.error(getApiError(error, "Не удалось загрузить изображение принта")),
  });

  const deleteAllModelSizesMutation = useMutation({
    mutationFn: async () => (await api.delete("/catalog/model-sizes/all")).data,
    onSuccess: async () => {
      await refreshCatalog();
      message.success("Все позиции склада удалены");
    },
    onError: (error: any) => message.error(getApiError(error, "Не удалось удалить все позиции склада")),
  });

  const deleteAllPrintsMutation = useMutation({
    mutationFn: async () => (await api.delete("/catalog/prints/all")).data,
    onSuccess: async () => {
      await refreshCatalog();
      message.success("Все принты удалены");
    },
    onError: (error: any) => message.error(getApiError(error, "Не удалось удалить все принты")),
  });

  const isAnyQueryError =
    colorsQuery.isError || modelsQuery.isError || sizesQuery.isError || modelSizesQuery.isError || printsQuery.isError;

  const stockRows = useMemo(() => {
    const query = stockSearch.trim().toLowerCase();
    const rows = modelSizes.map((item) => {
      const model = models.find((modelItem) => modelItem.id === item.model_id);
      const size = sizes.find((sizeItem) => sizeItem.id === item.size_id);
      const color = colors.find((colorItem) => colorItem.id === model?.color_id);
      return {
        ...item,
        modelName: model?.name ?? `#${item.model_id}`,
        sizeCode: size?.code ?? `#${item.size_id}`,
        colorName: color?.name ?? "-",
      };
    });
    if (!query) {
      return rows;
    }
    return rows.filter((item) => `${item.modelName} ${item.sizeCode} ${item.colorName}`.toLowerCase().includes(query));
  }, [modelSizes, models, sizes, colors, stockSearch]);

  const filteredPrints = useMemo(() => {
    const query = printSearch.trim().toLowerCase();
    if (!query) {
      return prints;
    }
    return prints.filter((item) => item.name.toLowerCase().includes(query));
  }, [prints, printSearch]);

  const colorColumns: ColumnsType<CatalogColor> = [
    { title: "ID", dataIndex: "id", width: 80 },
    { title: "Цвет", dataIndex: "name" },
    {
      title: "HEX",
      dataIndex: "hex_code",
      render: (value: string | null) => value || "-",
    },
    {
      title: "Действия",
      key: "actions",
      width: 140,
      render: (_, record) => (
        <Popconfirm
          title="Удалить цвет?"
          okText="Удалить"
          cancelText="Отмена"
          onConfirm={() => deleteColorMutation.mutate(record.id)}
        >
          <Button danger size="small" loading={deleteColorMutation.isPending}>
            Удалить
          </Button>
        </Popconfirm>
      ),
    },
  ];

  const modelColumns: ColumnsType<CatalogModel> = [
    { title: "ID", dataIndex: "id", width: 80 },
    { title: "Модель", dataIndex: "name" },
    {
      title: "Цвет",
      dataIndex: "color_id",
      render: (value: number) => colors.find((item) => item.id === value)?.name ?? `#${value}`,
    },
    {
      title: "Изображения",
      key: "images",
      render: (_, record) => (
        <Space size={6} wrap>
          <Tag color={resolveApiUrl(record.front_image_url) ? "green" : "default"}>Front</Tag>
          <Tag color={resolveApiUrl(record.back_image_url) ? "green" : "default"}>Back</Tag>
        </Space>
      ),
    },
    {
      title: "Действия",
      key: "actions",
      width: 140,
      render: (_, record) => (
        <Space size={8}>
          <Button
            size="small"
            onClick={() => {
              setEditingModel(record.id);
              modelForm.setFieldsValue({
                name: record.name,
                color_id: record.color_id,
                garment_type: record.garment_type ?? undefined,
                default_print_id: (record as any).default_print_id ?? undefined,
              });
            }}
          >
            Ред.
          </Button>
          <Popconfirm
            title="Удалить модель?"
            okText="Удалить"
            cancelText="Отмена"
            onConfirm={() => deleteModelMutation.mutate(record.id)}
          >
            <Button danger size="small" loading={deleteModelMutation.isPending}>
              Удалить
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const sizeColumns: ColumnsType<CatalogSize> = [
    { title: "ID", dataIndex: "id", width: 80 },
    { title: "Размер", dataIndex: "code" },
    { title: "Порядок", dataIndex: "sort_order", width: 110 },
    {
      title: "Действия",
      key: "actions",
      width: 140,
      render: (_, record) => (
        <Popconfirm
          title="Удалить размер?"
          okText="Удалить"
          cancelText="Отмена"
          onConfirm={() => deleteSizeMutation.mutate(record.id)}
        >
          <Button danger size="small" loading={deleteSizeMutation.isPending}>
            Удалить
          </Button>
        </Popconfirm>
      ),
    },
  ];

  const stockColumns: ColumnsType<(CatalogModelSize & { modelName: string; sizeCode: string; colorName: string })> = [
    { title: "ID", dataIndex: "id", width: 80 },
    { title: "Модель", dataIndex: "modelName" },
    { title: "Цвет", dataIndex: "colorName" },
    { title: "Размер", dataIndex: "sizeCode" },
    {
      title: "Остаток",
      dataIndex: "stock_qty",
      render: (value: number) => <Tag color={value > 0 ? "green" : "red"}>{value}</Tag>,
    },
    {
      title: "Действия",
      key: "actions",
      width: 220,
      render: (_, record) => (
        <Space size={8}>
          <Button
            size="small"
            onClick={() => updateModelSizeMutation.mutate({ id: record.id, stock_qty: record.stock_qty + 1 })}
          >
            +1
          </Button>
          <Button
            size="small"
            onClick={() => updateModelSizeMutation.mutate({ id: record.id, stock_qty: Math.max(0, record.stock_qty - 1) })}
          >
            -1
          </Button>
          <Popconfirm
            title="Удалить позицию склада?"
            okText="Удалить"
            cancelText="Отмена"
            onConfirm={() => deleteModelSizeMutation.mutate(record.id)}
          >
            <Button danger size="small" loading={deleteModelSizeMutation.isPending}>
              Удалить
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const printColumns: ColumnsType<CatalogPrint> = [
    { title: "ID", dataIndex: "id", width: 80 },
    {
      title: "Принт",
      dataIndex: "name",
      render: (value: string, record: CatalogPrint) => (
        <Space direction="vertical" size={4}>
          <span>{value}</span>
          {record.image_url ? (
            <img
              src={record.image_url}
              alt={record.name}
              style={{ width: 56, height: 56, objectFit: "contain", border: "1px solid #e5e7eb", borderRadius: 6, background: "#fff" }}
            />
          ) : (
            <Tag>нет изображения</Tag>
          )}
        </Space>
      ),
    },
    {
      title: "Тип",
      dataIndex: "print_type",
      render: (value: string) =>
        value === "custom_text" ? <Tag color="purple">Свой текст</Tag> : <Tag>Шаблон</Tag>,
    },
    {
      title: "Размер (мм)",
      key: "dimensions",
      render: (_: any, record: CatalogPrint) => (
        <Space size={4}>
          <InputNumber
            size="small"
            defaultValue={record.width ?? undefined}
            placeholder="Ш"
            min={1}
            style={{ width: 64 }}
            onBlur={(e) => {
              const v = parseInt(e.target.value);
              if (!isNaN(v) && v > 0) updatePrintMutation.mutate({ id: record.id, width: v });
            }}
          />
          <Text type="secondary">×</Text>
          <InputNumber
            size="small"
            defaultValue={record.height ?? undefined}
            placeholder="В"
            min={1}
            style={{ width: 64 }}
            onBlur={(e) => {
              const v = parseInt(e.target.value);
              if (!isNaN(v) && v > 0) updatePrintMutation.mutate({ id: record.id, height: v });
            }}
          />
        </Space>
      ),
    },
    {
      title: "Остаток",
      dataIndex: "stock_qty",
      render: (value: number | null) => {
        if (value === null || value === undefined) {
          return <Tag>—</Tag>;
        }
        return <Tag color={value > 0 ? "green" : "red"}>{value}</Tag>;
      },
    },
    {
      title: "Действия",
      key: "actions",
      width: 220,
      render: (_, record) => (
        <Space size={8}>
          <Button
            size="small"
            onClick={() =>
              updatePrintMutation.mutate({
                id: record.id,
                stock_qty: Math.max(0, (record.stock_qty ?? 0) + 1),
              })
            }
          >
            +1
          </Button>
          <Button
            size="small"
            onClick={() =>
              updatePrintMutation.mutate({
                id: record.id,
                stock_qty: Math.max(0, (record.stock_qty ?? 0) - 1),
              })
            }
          >
            -1
          </Button>
          <Button
            size="small"
            onClick={() => {
              setSelectedPrintImageId(record.id);
              printImageInputRef.current?.click();
            }}
          >
            Изображение
          </Button>
          <Popconfirm
            title="Удалить принт?"
            okText="Удалить"
            cancelText="Отмена"
            onConfirm={() => deletePrintMutation.mutate(record.id)}
          >
            <Button danger size="small" loading={deletePrintMutation.isPending}>
              Удалить
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 16 }}>
      <Card>
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Space style={{ justifyContent: "space-between", width: "100%" }} wrap>
            <div>
              <Title level={3} style={{ margin: 0 }}>
                Каталог
              </Title>
              <Text type="secondary">Все изменения этой страницы сохраняются в БД через backend API.</Text>
            </div>
            <Button onClick={() => navigate("/admin")}>На главный экран</Button>
          </Space>

          {isAnyQueryError && <Alert type="error" showIcon message="Не удалось загрузить часть данных каталога" />}

          <Card size="small" title="Цвета">
            <Space direction="vertical" size={12} style={{ width: "100%" }}>
              <Form
                form={colorForm}
                layout="inline"
                onFinish={(values: { name: string; hex_code?: string }) => createColorMutation.mutate(values)}
              >
                <Form.Item name="name" rules={[{ required: true, message: "Укажите цвет" }]}>
                  <Input placeholder="Белый" />
                </Form.Item>
                <Form.Item name="hex_code">
                  <Input placeholder="#FFFFFF" />
                </Form.Item>
                <Form.Item>
                  <Button type="primary" htmlType="submit" loading={createColorMutation.isPending}>
                    Добавить цвет
                  </Button>
                </Form.Item>
              </Form>
              <Table rowKey="id" columns={colorColumns} dataSource={colors} loading={colorsQuery.isLoading} pagination={{ pageSize: 5 }} />
            </Space>
          </Card>

          <Card size="small" title="Модели">
            <Space direction="vertical" size={12} style={{ width: "100%" }}>
              <Form
                form={modelForm}
                layout="vertical"
                onFinish={(values: { name: string; color_id: number; garment_type?: string; default_print_id?: number }) => {
                  if (editingModel) {
                    updateModelMutation.mutate({ id: editingModel, ...values });
                  } else {
                    createModelMutation.mutate(values);
                  }
                }}
              >
                <Row gutter={12}>
                  <Col xs={24} md={10}>
                    <Form.Item name="name" label="Название модели" rules={[{ required: true }]}>
                      <Input placeholder="Футболка basic" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item name="color_id" label="Цвет" rules={[{ required: true, message: "Выберите цвет" }]}>
                      <Select options={colors.map((item) => ({ value: item.id, label: item.name }))} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={4}>
                    <Form.Item name="garment_type" label="Тип изделия">
                      <Input placeholder="tshirt / hoodie" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={2} style={{ display: "flex", alignItems: "end" }}>
                    <Button type="primary" htmlType="submit" block loading={createModelMutation.isPending || updateModelMutation.isPending}>
                      {editingModel ? "Сохранить" : "+"}
                    </Button>
                  </Col>
                </Row>

                <Row gutter={12} style={{ marginTop: 8 }}>
                  <Col xs={24} md={10}>
                    <Form.Item name="default_print_id" label="Принт по умолчанию">
                      <Select allowClear options={prints.map((p) => ({ value: p.id, label: p.name }))} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={6} style={{ display: "flex", alignItems: "end" }}>
                    {editingModel && (
                      <Button
                        onClick={() => {
                          modelForm.resetFields();
                          setEditingModel(null);
                        }}
                        block
                      >
                        Отмена
                      </Button>
                    )}
                  </Col>
                </Row>
              </Form>

                {editingModel ? (
                  <Card size="small" title="Загрузка изображений модели">
                    <Space direction="vertical" size={12} style={{ width: "100%" }}>
                      <Text type="secondary">
                        Выбрана модель: {models.find((item) => item.id === editingModel)?.name || `#${editingModel}`}
                      </Text>

                      <Space wrap>
                        <Button onClick={() => frontModelImageInputRef.current?.click()} loading={uploadModelImageMutation.isPending}>
                          Загрузить front
                        </Button>
                        <Button onClick={() => backModelImageInputRef.current?.click()} loading={uploadModelImageMutation.isPending}>
                          Загрузить back
                        </Button>
                      </Space>

                      <input
                        ref={frontModelImageInputRef}
                        type="file"
                        accept="image/*,.svg"
                        hidden
                        onChange={async (event) => {
                          const file = event.target.files?.[0];
                          if (!file || !editingModel) return;
                          await uploadModelImageMutation.mutateAsync({ id: editingModel, side: "front", file });
                          event.target.value = "";
                        }}
                      />
                      <input
                        ref={backModelImageInputRef}
                        type="file"
                        accept="image/*,.svg"
                        hidden
                        onChange={async (event) => {
                          const file = event.target.files?.[0];
                          if (!file || !editingModel) return;
                          await uploadModelImageMutation.mutateAsync({ id: editingModel, side: "back", file });
                          event.target.value = "";
                        }}
                      />

                      <Text type="secondary">
                        Текущие файлы: front {models.find((item) => item.id === editingModel)?.front_image_url ? "загружен" : "нет"} · back {models.find((item) => item.id === editingModel)?.back_image_url ? "загружен" : "нет"}
                      </Text>
                    </Space>
                  </Card>
                ) : null}

              <Table rowKey="id" columns={modelColumns} dataSource={models} loading={modelsQuery.isLoading} pagination={{ pageSize: 5 }} />
            </Space>
          </Card>

          <Card size="small" title="Размеры">
            <Space direction="vertical" size={12} style={{ width: "100%" }}>
              <Form
                form={sizeForm}
                layout="inline"
                onFinish={(values: { code: string; sort_order?: number }) => createSizeMutation.mutate(values)}
              >
                <Form.Item name="code" rules={[{ required: true, message: "Укажите размер" }]}>
                  <Input placeholder="M" />
                </Form.Item>
                <Form.Item name="sort_order" initialValue={0}>
                  <InputNumber placeholder="Порядок" min={0} />
                </Form.Item>
                <Form.Item>
                  <Button type="primary" htmlType="submit" loading={createSizeMutation.isPending}>
                    Добавить размер
                  </Button>
                </Form.Item>
              </Form>
              <Table rowKey="id" columns={sizeColumns} dataSource={sizes} loading={sizesQuery.isLoading} pagination={{ pageSize: 5 }} />
            </Space>
          </Card>

          <Card size="small" title="Склад изделий (модель-размер)">
            <Space direction="vertical" size={12} style={{ width: "100%" }}>
              <Form
                form={modelSizeForm}
                layout="vertical"
                onFinish={(values: { model_id: number; size_id: number; stock_qty: number }) =>
                  createModelSizeMutation.mutate(values)
                }
              >
                <Row gutter={12}>
                  <Col xs={24} md={8}>
                    <Form.Item name="model_id" label="Модель" rules={[{ required: true }]}>
                      <Select options={models.map((item) => ({ value: item.id, label: item.name }))} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item name="size_id" label="Размер" rules={[{ required: true }]}>
                      <Select options={sizes.map((item) => ({ value: item.id, label: item.code }))} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={6}>
                    <Form.Item name="stock_qty" label="Остаток" initialValue={0} rules={[{ required: true }]}> 
                      <InputNumber min={0} style={{ width: "100%" }} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={2} style={{ display: "flex", alignItems: "end" }}>
                    <Button type="primary" htmlType="submit" block loading={createModelSizeMutation.isPending}>
                      +
                    </Button>
                  </Col>
                </Row>
              </Form>

              <Input.Search allowClear placeholder="Поиск по модели / размеру / цвету" onChange={(event) => setStockSearch(event.target.value)} />
              <Table rowKey="id" columns={stockColumns} dataSource={stockRows} loading={modelSizesQuery.isLoading} pagination={{ pageSize: 6 }} />
              <TypedDangerButton
                buttonText="Удалить все изделия"
                title="Удалить все позиции склада"
                description="Будут удалены все связи модель-размер и остатки по ним."
                onConfirm={async () => {
                  await deleteAllModelSizesMutation.mutateAsync();
                }}
                disabled={deleteAllModelSizesMutation.isPending}
              />
            </Space>
          </Card>

          <Card size="small" title="Принты">
            <Space direction="vertical" size={12} style={{ width: "100%" }}>
              <Form
                form={printForm}
                layout="vertical"
                onFinish={async (values: { name: string; print_type: string; stock_qty: number }) => {
                  const created = await createPrintMutation.mutateAsync(values);
                  if (newPrintImageFile) {
                    await uploadPrintImageMutation.mutateAsync({ id: created.id, file: newPrintImageFile });
                    setNewPrintImageFile(null);
                  }
                }}
              >
                <Row gutter={12}>
                  <Col xs={24} md={10}>
                    <Form.Item name="name" label="Название принта" rules={[{ required: true }]}>
                      <Input placeholder="Лого Factory" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item name="print_type" label="Тип" initialValue="template" rules={[{ required: true }]}>
                      <Select options={[{ value: "template", label: "Шаблон" }, { value: "custom_text", label: "Свой текст" }]} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={4}>
                    <Form.Item name="stock_qty" label="Остаток" initialValue={0} rules={[{ required: true }]}> 
                      <InputNumber min={0} style={{ width: "100%" }} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={6}>
                    <Form.Item label="Картинка принта">
                      <Space direction="vertical" style={{ width: "100%" }}>
                        <Button onClick={() => newPrintImageInputRef.current?.click()}>Выбрать файл</Button>
                        <Text type="secondary">{newPrintImageFile ? newPrintImageFile.name : "Файл не выбран"}</Text>
                      </Space>
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={2} style={{ display: "flex", alignItems: "end" }}>
                    <Button type="primary" htmlType="submit" block loading={createPrintMutation.isPending}>
                      +
                    </Button>
                  </Col>
                </Row>
              </Form>

              <input
                ref={newPrintImageInputRef}
                type="file"
                accept="image/*,.svg"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setNewPrintImageFile(file);
                  event.target.value = "";
                }}
              />

              <input
                ref={printImageInputRef}
                type="file"
                accept="image/*,.svg"
                hidden
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file || selectedPrintImageId === null) return;
                  await uploadPrintImageMutation.mutateAsync({ id: selectedPrintImageId, file });
                  setSelectedPrintImageId(null);
                  event.target.value = "";
                }}
              />

              <Input.Search allowClear placeholder="Поиск принта" onChange={(event) => setPrintSearch(event.target.value)} />
              <Table rowKey="id" columns={printColumns} dataSource={filteredPrints} loading={printsQuery.isLoading} pagination={{ pageSize: 6 }} />
              <TypedDangerButton
                buttonText="Удалить все принты"
                title="Удалить все принты"
                description="Будут удалены все записи принтов из каталога."
                onConfirm={async () => {
                  await deleteAllPrintsMutation.mutateAsync();
                }}
                disabled={deleteAllPrintsMutation.isPending}
              />
            </Space>
          </Card>
        </Space>
      </Card>
    </div>
  );
}
