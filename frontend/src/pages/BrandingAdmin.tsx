import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Col, Image, Input, Row, Space, Typography, Upload, message } from "antd";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../api/axios";
import { resolveBrandingFileUrl, useBranding } from "../features/branding/useBranding";

const { Title, Text } = Typography;

type PreviewAsset = {
  key: string;
  title: string;
  hint: string;
};

const assets: PreviewAsset[] = [
  { key: "kiosk-splash", title: "Заставка Оформления", hint: "Полноэкранное изображение при бездействии (нажмите для работы)" },
  { key: "kiosk-bg", title: "Фон Оформления", hint: "Фон за основным контентом терминала оформления" },
  { key: "board-bg", title: "Фон Табло", hint: "Фон экрана статусов" },
  { key: "logo", title: "Логотип", hint: "Верхняя часть терминалов" },
  { key: "palette", title: "Цвета бренда", hint: "Основные цветовые акценты" },
];

export default function BrandingAdmin() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [colorDrafts, setColorDrafts] = useState<Record<string, string>>({});

  const branding = useBranding();
  const assetsByKey = branding.byKey;

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const item of branding.data ?? []) {
      next[item.asset_key] = item.color_value || "";
    }
    setColorDrafts(next);
  }, [branding.data]);

  const uploadMutation = useMutation({
    mutationFn: async (payload: { assetKey: string; file: File }) => {
      const formData = new FormData();
      formData.append("file", payload.file);
      if (colorDrafts[payload.assetKey]) {
        formData.append("color_value", colorDrafts[payload.assetKey]);
      }
      const res = await api.post(`/branding/assets/${payload.assetKey}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["branding-assets"] });
      message.success("Файл сохранен в БД и на сервере");
    },
    onError: (error: any) => {
      const detail = error?.response?.data?.detail || "Не удалось загрузить файл";
      message.error(String(detail));
    },
  });

  const colorMutation = useMutation({
    mutationFn: async (payload: { assetKey: string; color_value: string }) => {
      const res = await api.put(`/branding/assets/${payload.assetKey}/color`, {
        color_value: payload.color_value,
      });
      return res.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["branding-assets"] });
      message.success("Цвет сохранен");
    },
    onError: (error: any) => {
      const detail = error?.response?.data?.detail || "Не удалось сохранить цвет";
      message.error(String(detail));
    },
  });

  const cards = useMemo(
    () =>
      assets.map((asset) => ({
        ...asset,
        currentFile: assetsByKey.get(asset.key)?.file_name || "Пока не загружено",
        currentFileUrl: assetsByKey.get(asset.key)?.file_url || "",
        currentColor: assetsByKey.get(asset.key)?.color_value || "",
      })),
    [assetsByKey],
  );

  const validateUpload = (assetKey: string, file: File) => {
    const allowedImageTypes = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
    const isPalette = assetKey === "palette";
    const isImage = allowedImageTypes.includes(file.type);
    const isJson = file.type === "application/json" || file.name.toLowerCase().endsWith(".json");

    if (isPalette ? !(isImage || isJson) : !isImage) {
      message.error(isPalette ? "Для palette нужен PNG/JPG/WEBP/SVG или JSON" : "Допустимы PNG/JPG/WEBP/SVG");
      return false;
    }

    if (file.size > 5 * 1024 * 1024) {
      message.error("Размер файла не должен превышать 5 МБ");
      return false;
    }

    return true;
  };

  return (
    <div style={{ padding: 16 }}>
      <Card>
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Space style={{ justifyContent: "space-between", width: "100%" }} wrap>
            <div>
              <Title level={3} style={{ margin: 0 }}>Брендирование</Title>
              <Text type="secondary">
                Ассеты терминала Оформления и Табло. Изменения сохраняются в backend и БД.
              </Text>
            </div>
            <Button onClick={() => navigate("/admin")}>На главный экран</Button>
          </Space>

          {branding.isError && (
            <Alert type="error" showIcon message="Не удалось загрузить ассеты брендирования" />
          )}

          <Row gutter={[12, 12]}>
            {cards.map((asset) => (
              <Col xs={24} md={12} key={asset.key}>
                <Card size="small" title={asset.title}>
                  <Space direction="vertical" style={{ width: "100%" }}>
                    <Text type="secondary">{asset.hint}</Text>
                    <Text>Файл: {asset.currentFile}</Text>
                    {asset.currentFileUrl ? (
                      <a href={resolveBrandingFileUrl(asset.currentFileUrl)} target="_blank" rel="noreferrer">
                        Открыть текущий файл
                      </a>
                    ) : null}
                    {asset.currentFileUrl && !asset.currentFileUrl.toLowerCase().endsWith(".json") ? (
                      <Image
                        src={resolveBrandingFileUrl(asset.currentFileUrl)}
                        alt={asset.title}
                        style={{ maxHeight: 160, objectFit: "contain", borderRadius: 8 }}
                      />
                    ) : null}
                    <Space.Compact style={{ width: "100%" }}>
                      <Input
                        placeholder="#RRGGBB"
                        value={colorDrafts[asset.key] ?? asset.currentColor}
                        onChange={(event) =>
                          setColorDrafts((prev) => ({
                            ...prev,
                            [asset.key]: event.target.value,
                          }))
                        }
                      />
                      <Button
                        onClick={() =>
                          colorMutation.mutate({
                            assetKey: asset.key,
                            color_value: colorDrafts[asset.key] ?? "",
                          })
                        }
                        loading={colorMutation.isPending}
                      >
                        Сохранить цвет
                      </Button>
                    </Space.Compact>
                    <Upload
                      maxCount={1}
                      beforeUpload={(file) => {
                        if (!validateUpload(asset.key, file)) {
                          return false;
                        }
                        uploadMutation.mutate({ assetKey: asset.key, file });
                        return false;
                      }}
                      accept={asset.key === "palette" ? ".png,.jpg,.jpeg,.webp,.svg,.json" : ".png,.jpg,.jpeg,.webp,.svg"}
                      showUploadList={false}
                    >
                      <Button loading={uploadMutation.isPending}>Выбрать и загрузить файл</Button>
                    </Upload>
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>
        </Space>
      </Card>
    </div>
  );
}
