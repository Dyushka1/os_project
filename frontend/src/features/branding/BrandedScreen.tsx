import { useEffect, useMemo, useRef, useState } from "react";
import { Typography } from "antd";
import { resolveBrandingFileUrl, useBranding } from "./useBranding";

const { Title, Text } = Typography;

type BrandedScreenProps = {
  children: React.ReactNode;
  backgroundKey?: "kiosk-bg" | "board-bg";
  showLogo?: boolean;
  ignoreBackground?: boolean;
  idleSplash?: boolean;
  splashTitle?: string;
  splashSubtitle?: string;
  inactivityMs?: number;
  splashBgKey?: string;
};

const DEFAULT_INACTIVITY_MS = 10 * 60 * 1000;

export default function BrandedScreen({
  children,
  backgroundKey = "kiosk-bg",
  showLogo = true,
  ignoreBackground = false,
  idleSplash = false,
  splashTitle = "Нажмите для работы",
  splashSubtitle = "Экран был переведен в режим заставки из-за бездействия",
  inactivityMs = DEFAULT_INACTIVITY_MS,
  splashBgKey = "kiosk-splash",
}: BrandedScreenProps) {
  const branding = useBranding();
  const backgroundUrl = resolveBrandingFileUrl(branding.getAsset(backgroundKey)?.file_url);
  const splashBgUrl = resolveBrandingFileUrl(branding.getAsset(splashBgKey)?.file_url) || backgroundUrl;
  const logoUrl = resolveBrandingFileUrl(branding.getAsset("logo")?.file_url);
  const timerRef = useRef<number | null>(null);
  const [isSplashVisible, setIsSplashVisible] = useState(idleSplash);

  const scheduleSplash = useMemo(
    () => () => {
      if (!idleSplash) {
        return;
      }
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(() => {
        setIsSplashVisible(true);
      }, inactivityMs);
    },
    [idleSplash, inactivityMs],
  );

  useEffect(() => {
    if (!idleSplash) {
      return;
    }

    const onActivity = () => {
      if (isSplashVisible) {
        return;
      }
      scheduleSplash();
    };

    const events: Array<keyof WindowEventMap> = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
    ];

    events.forEach((eventName) => window.addEventListener(eventName, onActivity, { passive: true }));
    scheduleSplash();

    return () => {
      events.forEach((eventName) => window.removeEventListener(eventName, onActivity));
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [idleSplash, isSplashVisible, scheduleSplash]);

  const hideSplash = () => {
    setIsSplashVisible(false);
    scheduleSplash();
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: ignoreBackground ? "#fff" : undefined,
        backgroundImage: ignoreBackground || !backgroundUrl ? undefined : `url(${backgroundUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        position: "relative",
      }}
    >
      <div style={{ padding: 16 }}>
        {showLogo && logoUrl ? (
          <div style={{ marginBottom: 8 }}>
            <img src={logoUrl} alt="Логотип" style={{ maxHeight: 48, objectFit: "contain" }} />
          </div>
        ) : null}
        {children}
      </div>

      {idleSplash && isSplashVisible ? (
        <button
          type="button"
          onClick={hideSplash}
          style={{
            position: "fixed",
            inset: 0,
            border: "none",
            margin: 0,
            padding: 0,
            zIndex: 2000,
            backgroundImage: splashBgUrl ? `url(${splashBgUrl})` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          <div style={{ maxWidth: 720, margin: "0 auto", paddingTop: "18vh", textAlign: "center" }}>
            <Title level={1} style={{ color: "#fff", marginBottom: 8 }}>
              {splashTitle}
            </Title>
            <Text style={{ color: "rgba(255,255,255,0.92)", fontSize: 18 }}>{splashSubtitle}</Text>
          </div>
        </button>
      ) : null}
    </div>
  );
}
