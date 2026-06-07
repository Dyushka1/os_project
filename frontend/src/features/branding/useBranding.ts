import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "../../api/axios";

export type BrandingAssetRead = {
  id: number;
  asset_key: string;
  file_url: string | null;
  file_name: string | null;
  color_value: string | null;
  updated_at: string | null;
};

export function resolveBrandingFileUrl(fileUrl: string | null | undefined) {
  if (!fileUrl) {
    return "";
  }
  if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) {
    return fileUrl;
  }
  const baseUrl = String(api.defaults.baseURL || "").replace(/\/$/, "");
  return `${baseUrl}${fileUrl}`;
}

export function useBranding() {
  const query = useQuery({
    queryKey: ["branding-assets"],
    queryFn: async () => (await api.get<BrandingAssetRead[]>("/branding/assets")).data,
    retry: false,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });

  const byKey = useMemo(() => {
    const map = new Map<string, BrandingAssetRead>();
    for (const asset of query.data ?? []) {
      map.set(asset.asset_key, asset);
    }
    return map;
  }, [query.data]);

  return {
    ...query,
    byKey,
    getAsset: (key: string) => byKey.get(key),
  };
}
