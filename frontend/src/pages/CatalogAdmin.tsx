import { useMemo, useState } from "react";
import {
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

const { Title, Text } = Typography;

type Product = {
  id: number;
  name: string;
  color: string;
  size: string;
  stock: number;
};

type PrintTemplate = {
  id: number;
  name: string;
  type: "template" | "custom_text";
  stock: number;
};

type ColorItem = { id: number; name: string };
type ModelItem = { id: number; name: string; colorIds: number[] };
type SizeItem = { id: number; name: string };
type ModelSizeLink = { id: number; modelId: number; sizeId: number };

export default function CatalogAdmin() {
  const navigate = useNavigate();
  const [productForm] = Form.useForm();
  const [printForm] = Form.useForm();
  const [colorForm] = Form.useForm();
  const [modelForm] = Form.useForm();
  const [sizeForm] = Form.useForm();
  const [modelSizeForm] = Form.useForm();
  const [products, setProducts] = useState<Product[]>([
    { id: 1, name: "Футболка basic", color: "Белый", size: "M", stock: 12 },
    { id: 2, name: "Худи city", color: "Черный", size: "L", stock: 5 },
  ]);
  const [prints, setPrints] = useState<PrintTemplate[]>([
    { id: 1, name: "Лого Factory", type: "template", stock: 20 },
    { id: 2, name: "Свой текст", type: "custom_text", stock: 999 },
  ]);
  const [colors, setColors] = useState<ColorItem[]>([
    { id: 1, name: "Белый" },
    { id: 2, name: "Черный" },
  ]);
  const [models, setModels] = useState<ModelItem[]>([
    { id: 1, name: "Футболка basic", colorIds: [1, 2] },
    { id: 2, name: "Худи city", colorIds: [2] },
  ]);
  const [sizes, setSizes] = useState<SizeItem[]>([
    { id: 1, name: "S" },
    { id: 2, name: "M" },
    { id: 3, name: "L" },
  ]);
  const [modelSizes, setModelSizes] = useState<ModelSizeLink[]>([
    { id: 1, modelId: 1, sizeId: 1 },
    { id: 2, modelId: 1, sizeId: 2 },
    { id: 3, modelId: 2, sizeId: 3 },
  ]);
  const [productSearch, setProductSearch] = useState("");
  const [printSearch, setPrintSearch] = useState("");

  const filteredProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    if (!query) return products;
    return products.filter((item) =>
      `${item.name} ${item.color} ${item.size}`.toLowerCase().includes(query),
    );
  }, [productSearch, products]);

  const filteredPrints = useMemo(() => {
    const query = printSearch.trim().toLowerCase();
    if (!query) return prints;
    return prints.filter((item) => item.name.toLowerCase().includes(query));
  }, [printSearch, prints]);

  const productColumns: ColumnsType<Product> = [
    { title: "ID", dataIndex: "id", width: 80 },
    { title: "Изделие", dataIndex: "name" },
    { title: "Цвет", dataIndex: "color" },
    { title: "Размер", dataIndex: "size" },
    {
      title: "Остаток",
      dataIndex: "stock",
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
            onClick={() => {
              setProducts((prev) =>
                prev.map((item) => (item.id === record.id ? { ...item, stock: item.stock + 1 } : item)),
              );
            }}
          >
            +1
          </Button>
          <Button
            size="small"
            onClick={() => {
              setProducts((prev) =>
                prev.map((item) =>
                  item.id === record.id ? { ...item, stock: Math.max(0, item.stock - 1) } : item,
                ),
              );
            }}
          >
            -1
          </Button>
          <Popconfirm
            title="Удалить изделие?"
            okText="Удалить"
            cancelText="Отмена"
            onConfirm={() => {
              setProducts((prev) => prev.filter((item) => item.id !== record.id));
              message.success("Изделие удалено");
            }}
          >
            <Button danger size="small">
              Удалить
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const printColumns: ColumnsType<PrintTemplate> = [
    { title: "ID", dataIndex: "id", width: 80 },
    { title: "Принт", dataIndex: "name" },
    {
      title: "Тип",
      dataIndex: "type",
      render: (value: PrintTemplate["type"]) =>
        value === "custom_text" ? <Tag color="purple">Свой текст</Tag> : <Tag>Шаблон</Tag>,
    },
    {
      title: "Остаток",
      dataIndex: "stock",
      render: (value: number) => <Tag color={value > 0 ? "green" : "red"}>{value}</Tag>,
    },
    {
      title: "Действия",
      key: "actions",
      width: 200,
      render: (_, record) => (
        <Space size={8}>
          <Button
            size="small"
            onClick={() => {
              setPrints((prev) =>
                prev.map((item) => (item.id === record.id ? { ...item, stock: item.stock + 1 } : item)),
              );
            }}
          >
            +1
          </Button>
          <Popconfirm
            title="Удалить принт?"
            okText="Удалить"
            cancelText="Отмена"
            onConfirm={() => {
              setPrints((prev) => prev.filter((item) => item.id !== record.id));
              message.success("Принт удален");
            }}
          >
            <Button danger size="small">
              Удалить
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const colorColumns: ColumnsType<ColorItem> = [
    { title: "ID", dataIndex: "id", width: 80 },
    { title: "Цвет", dataIndex: "name" },
    {
      title: "Действия",
      key: "actions",
      width: 140,
      render: (_, record) => (
        <Popconfirm
          title="Удалить цвет?"
          okText="Удалить"
          cancelText="Отмена"
          onConfirm={() => {
            setColors((prev) => prev.filter((item) => item.id !== record.id));
            setModels((prev) =>
              prev.map((item) => ({
                ...item,
                colorIds: item.colorIds.filter((id) => id !== record.id),
              })),
            );
            message.success("Цвет удален");
          }}
        >
          <Button danger size="small">
            Удалить
          </Button>
        </Popconfirm>
      ),
    },
  ];

  const modelColumns: ColumnsType<ModelItem> = [
    { title: "ID", dataIndex: "id", width: 80 },
    { title: "Модель", dataIndex: "name" },
    {
      title: "Доступные цвета",
      dataIndex: "colorIds",
      render: (value: number[]) =>
        value.length ? (
          <Space wrap>
            {value.map((id) => {
              const color = colors.find((item) => item.id === id);
              return <Tag key={id}>{color?.name ?? `#${id}`}</Tag>;
            })}
          </Space>
        ) : (
          <Text type="secondary">Не назначены</Text>
        ),
    },
    {
      title: "Действия",
      key: "actions",
      width: 140,
      render: (_, record) => (
        <Popconfirm
          title="Удалить модель?"
          okText="Удалить"
          cancelText="Отмена"
          onConfirm={() => {
            setModels((prev) => prev.filter((item) => item.id !== record.id));
            setModelSizes((prev) => prev.filter((item) => item.modelId !== record.id));
            message.success("Модель удалена");
          }}
        >
          <Button danger size="small">
            Удалить
          </Button>
        </Popconfirm>
      ),
    },
  ];

  const sizeColumns: ColumnsType<SizeItem> = [
    { title: "ID", dataIndex: "id", width: 80 },
    { title: "Размер", dataIndex: "name" },
    {
      title: "Действия",
      key: "actions",
      width: 140,
      render: (_, record) => (
        <Popconfirm
          title="Удалить размер?"
          okText="Удалить"
          cancelText="Отмена"
          onConfirm={() => {
            setSizes((prev) => prev.filter((item) => item.id !== record.id));
            setModelSizes((prev) => prev.filter((item) => item.sizeId !== record.id));
            message.success("Размер удален");
          }}
        >
          <Button danger size="small">
            Удалить
          </Button>
        </Popconfirm>
      ),
    },
  ];

  const modelSizeColumns: ColumnsType<ModelSizeLink> = [
    { title: "ID", dataIndex: "id", width: 80 },
    {
      title: "Модель",
      dataIndex: "modelId",
      render: (value: number) => models.find((item) => item.id === value)?.name ?? `#${value}`,
    },
    {
      title: "Размер",
      dataIndex: "sizeId",
      render: (value: number) => sizes.find((item) => item.id === value)?.name ?? `#${value}`,
    },
    {
      title: "Действия",
      key: "actions",
      width: 140,
      render: (_, record) => (
        <Popconfirm
          title="Удалить связь модель-размер?"
          okText="Удалить"
          cancelText="Отмена"
          onConfirm={() => {
            setModelSizes((prev) => prev.filter((item) => item.id !== record.id));
            message.success("Связь удалена");
          }}
        >
          <Button danger size="small">
            Удалить
          </Button>
        </Popconfirm>
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
              <Text type="secondary">
                По ТЗ: каталог включает изделия, принты, цвета, модели, размеры и их связи.
              </Text>
            </div>
            <Button onClick={() => navigate("/admin")}>Назад на главный экран</Button>
          </Space>

          <Card size="small" title="Изделия">
            <Space direction="vertical" size={12} style={{ width: "100%" }}>
              <Form
                form={productForm}
                layout="vertical"
                onFinish={(values: { name: string; color: string; size: string; stock: number }) => {
                  setProducts((prev) => [
                    ...prev,
                    {
                      id: prev.length ? Math.max(...prev.map((item) => item.id)) + 1 : 1,
                      name: values.name,
                      color: values.color,
                      size: values.size,
                      stock: values.stock,
                    },
                  ]);
                  productForm.resetFields();
                  message.success("Изделие добавлено");
                }}
              >
                <Row gutter={12}>
                  <Col xs={24} md={8}>
                    <Form.Item name="name" label="Название изделия" rules={[{ required: true }]}>
                      <Input placeholder="Футболка basic" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={6}>
                    <Form.Item name="color" label="Цвет" rules={[{ required: true }]}>
                      <Input placeholder="Белый" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={4}>
                    <Form.Item name="size" label="Размер" rules={[{ required: true }]}>
                      <Input placeholder="M" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={4}>
                    <Form.Item name="stock" label="Остаток" rules={[{ required: true }]}>
                      <InputNumber min={0} style={{ width: "100%" }} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={2} style={{ display: "flex", alignItems: "end" }}>
                    <Button type="primary" htmlType="submit" block>
                      +
                    </Button>
                  </Col>
                </Row>
              </Form>
              <Input.Search
                allowClear
                placeholder="Поиск изделия"
                onChange={(event) => setProductSearch(event.target.value)}
              />
              <Table rowKey="id" columns={productColumns} dataSource={filteredProducts} pagination={{ pageSize: 6 }} />
              <Popconfirm
                title="Удалить все изделия?"
                okText="Удалить"
                cancelText="Отмена"
                onConfirm={() => {
                  setProducts([]);
                  message.success("Все изделия удалены");
                }}
              >
                <Button danger>Удалить все изделия</Button>
              </Popconfirm>
            </Space>
          </Card>

          <Card size="small" title="Цвета">
            <Space direction="vertical" size={12} style={{ width: "100%" }}>
              <Form
                form={colorForm}
                layout="inline"
                onFinish={(values: { name: string }) => {
                  setColors((prev) => [
                    ...prev,
                    {
                      id: prev.length ? Math.max(...prev.map((item) => item.id)) + 1 : 1,
                      name: values.name,
                    },
                  ]);
                  colorForm.resetFields();
                  message.success("Цвет добавлен");
                }}
              >
                <Form.Item name="name" rules={[{ required: true, message: "Укажите цвет" }]}>
                  <Input placeholder="Синий" />
                </Form.Item>
                <Form.Item>
                  <Button type="primary" htmlType="submit">
                    Добавить цвет
                  </Button>
                </Form.Item>
              </Form>
              <Table rowKey="id" columns={colorColumns} dataSource={colors} pagination={{ pageSize: 5 }} />
            </Space>
          </Card>

          <Card size="small" title="Модели и связь с цветами">
            <Space direction="vertical" size={12} style={{ width: "100%" }}>
              <Form
                form={modelForm}
                layout="vertical"
                onFinish={(values: { name: string; colorIds: number[] }) => {
                  setModels((prev) => [
                    ...prev,
                    {
                      id: prev.length ? Math.max(...prev.map((item) => item.id)) + 1 : 1,
                      name: values.name,
                      colorIds: values.colorIds ?? [],
                    },
                  ]);
                  modelForm.resetFields();
                  message.success("Модель добавлена");
                }}
              >
                <Row gutter={12}>
                  <Col xs={24} md={10}>
                    <Form.Item name="name" label="Название модели" rules={[{ required: true }]}>
                      <Input placeholder="Свитшот retro" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={10}>
                    <Form.Item name="colorIds" label="Доступные цвета">
                      <Select
                        mode="multiple"
                        options={colors.map((item) => ({ value: item.id, label: item.name }))}
                        placeholder="Выберите цвета"
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={4} style={{ display: "flex", alignItems: "end" }}>
                    <Button type="primary" htmlType="submit" block>
                      Добавить
                    </Button>
                  </Col>
                </Row>
              </Form>
              <Table rowKey="id" columns={modelColumns} dataSource={models} pagination={{ pageSize: 5 }} />
            </Space>
          </Card>

          <Card size="small" title="Размеры и связь модель-размер">
            <Space direction="vertical" size={12} style={{ width: "100%" }}>
              <Form
                form={sizeForm}
                layout="inline"
                onFinish={(values: { name: string }) => {
                  setSizes((prev) => [
                    ...prev,
                    {
                      id: prev.length ? Math.max(...prev.map((item) => item.id)) + 1 : 1,
                      name: values.name,
                    },
                  ]);
                  sizeForm.resetFields();
                  message.success("Размер добавлен");
                }}
              >
                <Form.Item name="name" rules={[{ required: true, message: "Укажите размер" }]}>
                  <Input placeholder="XL" />
                </Form.Item>
                <Form.Item>
                  <Button type="primary" htmlType="submit">
                    Добавить размер
                  </Button>
                </Form.Item>
              </Form>
              <Table rowKey="id" columns={sizeColumns} dataSource={sizes} pagination={{ pageSize: 5 }} />

              <Form
                form={modelSizeForm}
                layout="vertical"
                onFinish={(values: { modelId: number; sizeId: number }) => {
                  const exists = modelSizes.some(
                    (item) => item.modelId === values.modelId && item.sizeId === values.sizeId,
                  );
                  if (exists) {
                    message.warning("Такая связь уже существует");
                    return;
                  }
                  setModelSizes((prev) => [
                    ...prev,
                    {
                      id: prev.length ? Math.max(...prev.map((item) => item.id)) + 1 : 1,
                      modelId: values.modelId,
                      sizeId: values.sizeId,
                    },
                  ]);
                  modelSizeForm.resetFields();
                  message.success("Связь модель-размер добавлена");
                }}
              >
                <Row gutter={12}>
                  <Col xs={24} md={10}>
                    <Form.Item name="modelId" label="Модель" rules={[{ required: true }]}>
                      <Select options={models.map((item) => ({ value: item.id, label: item.name }))} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={10}>
                    <Form.Item name="sizeId" label="Размер" rules={[{ required: true }]}>
                      <Select options={sizes.map((item) => ({ value: item.id, label: item.name }))} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={4} style={{ display: "flex", alignItems: "end" }}>
                    <Button type="primary" htmlType="submit" block>
                      Связать
                    </Button>
                  </Col>
                </Row>
              </Form>
              <Table rowKey="id" columns={modelSizeColumns} dataSource={modelSizes} pagination={{ pageSize: 5 }} />
            </Space>
          </Card>

          <Card size="small" title="Принты">
            <Space direction="vertical" size={12} style={{ width: "100%" }}>
              <Form
                form={printForm}
                layout="vertical"
                onFinish={(values: { name: string; type: PrintTemplate["type"]; stock: number }) => {
                  setPrints((prev) => [
                    ...prev,
                    {
                      id: prev.length ? Math.max(...prev.map((item) => item.id)) + 1 : 1,
                      name: values.name,
                      type: values.type,
                      stock: values.stock,
                    },
                  ]);
                  printForm.resetFields();
                  message.success("Принт добавлен");
                }}
              >
                <Row gutter={12}>
                  <Col xs={24} md={9}>
                    <Form.Item name="name" label="Название принта" rules={[{ required: true }]}>
                      <Input placeholder="Лого Factory" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={7}>
                    <Form.Item name="type" label="Тип" rules={[{ required: true }]}>
                      <Select
                        options={[
                          { value: "template", label: "Шаблон" },
                          { value: "custom_text", label: "Свой текст" },
                        ]}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={6}>
                    <Form.Item name="stock" label="Остаток" rules={[{ required: true }]}>
                      <InputNumber min={0} style={{ width: "100%" }} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={2} style={{ display: "flex", alignItems: "end" }}>
                    <Button type="primary" htmlType="submit" block>
                      +
                    </Button>
                  </Col>
                </Row>
              </Form>
              <Input.Search
                allowClear
                placeholder="Поиск принта"
                onChange={(event) => setPrintSearch(event.target.value)}
              />
              <Table rowKey="id" columns={printColumns} dataSource={filteredPrints} pagination={{ pageSize: 6 }} />
              <Popconfirm
                title="Удалить все принты?"
                okText="Удалить"
                cancelText="Отмена"
                onConfirm={() => {
                  setPrints([]);
                  message.success("Все принты удалены");
                }}
              >
                <Button danger>Удалить все принты</Button>
              </Popconfirm>
            </Space>
          </Card>
        </Space>
      </Card>
    </div>
  );
}
