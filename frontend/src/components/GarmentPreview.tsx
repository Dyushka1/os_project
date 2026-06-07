import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Card, Space, Tag, Typography } from "antd";
import { resolveApiUrl } from "../utils/resolveApiUrl";

const { Text } = Typography;

const TEXT_PRINT_TYPES = new Set(["text", "custom_text", "own_text", "own-text"]);

const PRINT_ZONE_INSETS = {
  top: 0.24,
  right: 0.26,
  bottom: 0.24,
  left: 0.26,
};

const BOX_BASE_RATIOS = {
  image: { width: 0.72, height: 0.34 },
  text: { width: 0.62, height: 0.22 },
};

const SWIPE_THRESHOLD_RATIO = 0.3;

export type GarmentPreviewModel = { name?: string; front_image_url?: string | null; back_image_url?: string | null };
export type GarmentPreviewPrint = { name?: string; print_type?: string; image_url?: string | null };
export type GarmentPreviewColor = { name?: string };
export type GarmentPreviewSize = { code?: string };
export type GarmentPreviewUpdate = { printX?: number; printY?: number; printSide?: string; printAngle?: number; printScale?: number; printScaleX?: number; printScaleY?: number };
export type GarmentPreviewUpdate2 = { print2X?: number; print2Y?: number; print2Angle?: number; print2ScaleX?: number; print2ScaleY?: number };

export function isTextPrint(print?: GarmentPreviewPrint | null) {
  return !!print && !!print.print_type && TEXT_PRINT_TYPES.has(print.print_type);
}

type Props = {
  color?: GarmentPreviewColor | null;
  model?: GarmentPreviewModel | null;
  size?: GarmentPreviewSize | null;
  print?: GarmentPreviewPrint | null;
  printText?: string;
  printFont?: string;
  previewSide?: "front" | "back";
  printSide?: string;
  printX?: number;
  printY?: number;
  printAngle?: number;
  printScale?: number;
  printScaleX?: number;
  printScaleY?: number;
  print2?: GarmentPreviewPrint | null;
  print2Text?: string;
  print2Font?: string;
  print2Side?: string;
  print2X?: number;
  print2Y?: number;
  print2Angle?: number;
  print2Scale?: number;
  print2ScaleX?: number;
  print2ScaleY?: number;
  onUpdatePrint?: (update: GarmentPreviewUpdate) => void;
  onUpdatePrint2?: (update: GarmentPreviewUpdate2) => void;
  onSideChange?: (side: "front" | "back") => void;
  editable?: boolean;
};

type InteractionMode = "move" | "resize" | "rotate";

type InteractionState = {
  mode: InteractionMode;
  printSlot: 1 | 2;
  pointerId: number;
  startPointerX: number;
  startPointerY: number;
  startCenterX: number;
  startCenterY: number;
  startScale: number;
  startScaleX: number;
  startScaleY: number;
  startAngle: number;
  startAngleToPointer: number;
  startDistanceX: number;
  startDistanceY: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeAngle(angle: number) {
  let next = angle % 360;
  if (next > 180) next -= 360;
  if (next < -180) next += 360;
  return next;
}

function getPreviewMetrics(rect: DOMRect, scaleX: number, scaleY: number, isText: boolean) {
  const zone = {
    left: rect.width * PRINT_ZONE_INSETS.left,
    top: rect.height * PRINT_ZONE_INSETS.top,
    width: rect.width * (1 - PRINT_ZONE_INSETS.left - PRINT_ZONE_INSETS.right),
    height: rect.height * (1 - PRINT_ZONE_INSETS.top - PRINT_ZONE_INSETS.bottom),
  };

  const ratios = isText ? BOX_BASE_RATIOS.text : BOX_BASE_RATIOS.image;
  const boxWidth = Math.min(zone.width * 0.94, zone.width * ratios.width * scaleX);
  const boxHeight = Math.min(zone.height * 0.94, zone.height * ratios.height * scaleY);
  const centerX = rect.width * 0.5;
  const centerY = rect.height * 0.5;

  return { zone, boxWidth, boxHeight, centerX, centerY };
}

export default function GarmentPreview(props: Props) {
  const previewRef = useRef<HTMLDivElement | null>(null);
  const interactionRef = useRef<InteractionState | null>(null);
  const [interactionMode, setInteractionMode] = useState<InteractionMode | null>(null);

  const swipeRef = useRef<{ startX: number; pointerId: number } | null>(null);
  const swipeOffsetRef = useRef(0);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [swipeAnimating, setSwipeAnimating] = useState(false);

  const normalizedPrintScale = clamp(props.printScale ?? 100, 20, 250);
  const scaleFactor = normalizedPrintScale / 100;
  const normalizedPrintScaleX = clamp(props.printScaleX ?? normalizedPrintScale, 20, 250);
  const normalizedPrintScaleY = clamp(props.printScaleY ?? normalizedPrintScale, 20, 250);
  const scaleFactorX = normalizedPrintScaleX / 100;
  const scaleFactorY = normalizedPrintScaleY / 100;

  const normalizedPrint2Scale = clamp(props.print2Scale ?? 100, 20, 250);
  const normalizedPrint2ScaleX = clamp(props.print2ScaleX ?? normalizedPrint2Scale, 20, 250);
  const normalizedPrint2ScaleY = clamp(props.print2ScaleY ?? normalizedPrint2Scale, 20, 250);
  const scale2FactorX = normalizedPrint2ScaleX / 100;
  const scale2FactorY = normalizedPrint2ScaleY / 100;

  const hasCustomText = !!props.printText?.trim();
  const textPrint = isTextPrint(props.print) || hasCustomText;
  const printImageUrl = resolveApiUrl(props.print?.image_url);
  const modelImageUrl = resolveApiUrl(
    props.previewSide === "back"
      ? props.model?.back_image_url || props.model?.front_image_url
      : props.model?.front_image_url || props.model?.back_image_url,
  );
  const hasPrintContent = !!printImageUrl || textPrint || !!props.print?.name;
  const showPrintLayer = hasPrintContent && (!props.printSide || props.previewSide === props.printSide);

  const print2ImageUrl = resolveApiUrl(props.print2?.image_url);
  const hasCustomText2 = !!props.print2Text?.trim();
  const textPrint2 = isTextPrint(props.print2) || hasCustomText2;
  const hasPrint2Content = !!print2ImageUrl || textPrint2 || !!props.print2?.name;
  const showPrint2Layer = hasPrint2Content && (!props.print2Side || props.previewSide === props.print2Side);

  const handleSwipeStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (interactionRef.current || !props.onSideChange) return;
    swipeRef.current = { startX: event.clientX, pointerId: event.pointerId };
    swipeOffsetRef.current = 0;
    setSwipeAnimating(false);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleInteractionStart = (mode: InteractionMode, printSlot: 1 | 2 = 1) => (event: ReactPointerEvent<HTMLButtonElement | HTMLDivElement>) => {
    if (!props.editable || !previewRef.current) return;
    event.preventDefault();
    event.stopPropagation();

    const rect = previewRef.current.getBoundingClientRect();
    const isSlot2 = printSlot === 2;
    const sx = isSlot2 ? scale2FactorX : scaleFactorX;
    const sy = isSlot2 ? scale2FactorY : scaleFactorY;
    const isTextSlot = isSlot2 ? textPrint2 : textPrint;
    const metrics = getPreviewMetrics(rect, sx, sy, isTextSlot);
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    const cx = isSlot2 ? (props.print2X ?? 50) : (props.printX ?? 50);
    const cy = isSlot2 ? (props.print2Y ?? 27) : (props.printY ?? 27);
    const centerX = rect.width * (cx / 100);
    const centerY = rect.height * (cy / 100);

    interactionRef.current = {
      mode,
      printSlot,
      pointerId: event.pointerId,
      startPointerX: pointerX,
      startPointerY: pointerY,
      startCenterX: centerX,
      startCenterY: centerY,
      startScale: isSlot2 ? normalizedPrint2Scale : normalizedPrintScale,
      startScaleX: isSlot2 ? normalizedPrint2ScaleX : normalizedPrintScaleX,
      startScaleY: isSlot2 ? normalizedPrint2ScaleY : normalizedPrintScaleY,
      startAngle: isSlot2 ? (props.print2Angle ?? 0) : (props.printAngle ?? 0),
      startAngleToPointer: Math.atan2(pointerY - centerY, pointerX - centerX),
      startDistanceX: metrics.boxWidth / 2,
      startDistanceY: metrics.boxHeight / 2,
    };

    setInteractionMode(mode);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!interactionRef.current && swipeRef.current) {
      if (event.pointerId !== swipeRef.current.pointerId) return;
      event.preventDefault();
      const dx = event.clientX - swipeRef.current.startX;
      swipeOffsetRef.current = dx;
      setSwipeOffset(dx);
      return;
    }

    const current = interactionRef.current;
    if (!current || !previewRef.current || !props.editable) return;

    event.preventDefault();
    const rect = previewRef.current.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    const metrics = getPreviewMetrics(rect, scaleFactorX, scaleFactorY, textPrint);
    const zoneLeft = metrics.zone.left;
    const zoneTop = metrics.zone.top;
    const zoneRight = metrics.zone.left + metrics.zone.width;
    const zoneBottom = metrics.zone.top + metrics.zone.height;

    const isSlot2 = current.printSlot === 2;

    if (current.mode === "move") {
      const nextCenterX = pointerX - (current.startPointerX - current.startCenterX);
      const nextCenterY = pointerY - (current.startPointerY - current.startCenterY);
      const halfWidth = metrics.boxWidth / 2;
      const halfHeight = metrics.boxHeight / 2;
      const clampedCenterX = zoneRight - halfWidth < zoneLeft + halfWidth
        ? zoneLeft + metrics.zone.width / 2
        : clamp(nextCenterX, zoneLeft + halfWidth, zoneRight - halfWidth);
      const clampedCenterY = zoneBottom - halfHeight < zoneTop + halfHeight
        ? zoneTop + metrics.zone.height / 2
        : clamp(nextCenterY, zoneTop + halfHeight, zoneBottom - halfHeight);

      const x = Math.round((clampedCenterX / rect.width) * 100);
      const y = Math.round((clampedCenterY / rect.height) * 100);
      if (isSlot2) props.onUpdatePrint2?.({ print2X: x, print2Y: y });
      else props.onUpdatePrint?.({ printX: x, printY: y });
      return;
    }

    if (current.mode === "resize") {
      const distanceX = Math.max(Math.abs(pointerX - current.startCenterX), 1);
      const distanceY = Math.max(Math.abs(pointerY - current.startCenterY), 1);
      const ratioX = distanceX / Math.max(current.startDistanceX, 1);
      const ratioY = distanceY / Math.max(current.startDistanceY, 1);
      const nextScaleX = clamp(current.startScaleX * ratioX, 20, 250);
      const nextScaleY = clamp(current.startScaleY * ratioY, 20, 250);
      if (isSlot2) props.onUpdatePrint2?.({ print2ScaleX: Math.round(nextScaleX), print2ScaleY: Math.round(nextScaleY) });
      else props.onUpdatePrint?.({ printScaleX: Math.round(nextScaleX), printScaleY: Math.round(nextScaleY) });
      return;
    }

    if (current.mode === "rotate") {
      const angleToPointer = Math.atan2(pointerY - current.startCenterY, pointerX - current.startCenterX);
      const delta = ((angleToPointer - current.startAngleToPointer) * 180) / Math.PI;
      const nextAngle = normalizeAngle(current.startAngle + delta);
      if (isSlot2) props.onUpdatePrint2?.({ print2Angle: Math.round(nextAngle) });
      else props.onUpdatePrint?.({ printAngle: Math.round(nextAngle) });
    }
  };

  const endInteraction = (event?: ReactPointerEvent<HTMLDivElement>) => {
    if (swipeRef.current) {
      if (event && event.pointerId !== swipeRef.current.pointerId) return;
      if (props.onSideChange && previewRef.current) {
        const threshold = previewRef.current.getBoundingClientRect().width * SWIPE_THRESHOLD_RATIO;
        if (Math.abs(swipeOffsetRef.current) > threshold) {
          props.onSideChange(props.previewSide === "front" ? "back" : "front");
        }
      }
      swipeRef.current = null;
      swipeOffsetRef.current = 0;
      setSwipeAnimating(true);
      setSwipeOffset(0);
      return;
    }

    if (event && interactionRef.current && event.pointerId !== interactionRef.current.pointerId) return;
    interactionRef.current = null;
    setInteractionMode(null);
  };

  const baseBox = textPrint ? BOX_BASE_RATIOS.text : BOX_BASE_RATIOS.image;
  const zoneWidthPercent = (1 - PRINT_ZONE_INSETS.left - PRINT_ZONE_INSETS.right) * 100;
  const zoneHeightPercent = (1 - PRINT_ZONE_INSETS.top - PRINT_ZONE_INSETS.bottom) * 100;
  const boxWidthPercent = Math.min(zoneWidthPercent * 0.94, Math.max(zoneWidthPercent * 0.2, zoneWidthPercent * baseBox.width * scaleFactorX));
  const boxHeightPercent = Math.min(zoneHeightPercent * 0.94, Math.max(zoneHeightPercent * 0.2, zoneHeightPercent * baseBox.height * scaleFactorY));
  const printImageRotate = props.printAngle ?? 0;

  const baseBox2 = textPrint2 ? BOX_BASE_RATIOS.text : BOX_BASE_RATIOS.image;
  const box2WidthPercent = Math.min(zoneWidthPercent * 0.94, Math.max(zoneWidthPercent * 0.2, zoneWidthPercent * baseBox2.width * scale2FactorX));
  const box2HeightPercent = Math.min(zoneHeightPercent * 0.94, Math.max(zoneHeightPercent * 0.2, zoneHeightPercent * baseBox2.height * scale2FactorY));
  const print2ImageRotate = props.print2Angle ?? 0;

  const swipeProgress = previewRef.current
    ? Math.min(Math.abs(swipeOffset) / (previewRef.current.getBoundingClientRect().width * SWIPE_THRESHOLD_RATIO), 1)
    : 0;

  return (
    <Card size="small" title="Превью изделия" style={{ height: "100%" }}>
      <Space direction="vertical" size={14} style={{ width: "100%" }}>
        <div
          style={{
            borderRadius: 24,
            padding: 16,
            background: "linear-gradient(180deg, #f8fbff 0%, #eef3f9 100%)",
            border: "1px solid #d9e2ec",
          }}
        >
          <div
            ref={previewRef}
            style={{
              position: "relative",
              minHeight: 520,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              userSelect: interactionMode ? "none" : undefined,
              touchAction: "none",
              cursor: props.onSideChange && !interactionMode ? "grab" : undefined,
            }}
            onPointerDown={handleSwipeStart}
            onPointerMove={handlePointerMove}
            onPointerUp={endInteraction}
            onPointerCancel={endInteraction}
            onPointerLeave={endInteraction}
          >
            <div
              style={{
                position: "relative",
                width: "100%",
                maxWidth: 440,
                aspectRatio: "3 / 4",
                borderRadius: 28,
                background: "rgba(255, 255, 255, 0.94)",
                border: "2px dashed #cbd5e1",
                boxShadow: "inset 0 0 0 1px rgba(255, 255, 255, 0.5)",
                transform: `translateX(${swipeOffset}px) rotate(${swipeOffset * 0.015}deg)`,
                transition: swipeAnimating ? "transform 0.22s ease" : undefined,
                opacity: 1 - swipeProgress * 0.12,
              }}
              onTransitionEnd={() => setSwipeAnimating(false)}
            >
              {modelImageUrl ? (
                <img
                  src={modelImageUrl}
                  alt={props.model?.name || "Модель"}
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    zIndex: 1,
                    pointerEvents: "none",
                  }}
                />
              ) : null}

              <div
                style={{
                  position: "absolute",
                  inset: `${PRINT_ZONE_INSETS.top * 100}% ${PRINT_ZONE_INSETS.right * 100}% ${PRINT_ZONE_INSETS.bottom * 100}% ${PRINT_ZONE_INSETS.left * 100}%`,
                  borderRadius: 24,
                  background: "rgba(255, 255, 255, 0.08)",
                  border: "1px solid rgba(59, 130, 246, 0.28)",
                  zIndex: 2,
                  pointerEvents: "none",
                }}
              />

              {showPrintLayer ? (
                <div
                  onPointerDown={handleInteractionStart("move")}
                  style={{
                    position: "absolute",
                    left: `${props.printX ?? 50}%`,
                    top: `${props.printY ?? 27}%`,
                    transform: "translate(-50%, -50%)",
                    width: `${boxWidthPercent}%`,
                    height: `${boxHeightPercent}%`,
                    borderRadius: 22,
                    border: `2px dashed rgba(22, 119, 255, ${interactionMode ? 0.95 : 0.55})`,
                    background: "rgba(255, 255, 255, 0.12)",
                    boxShadow: interactionMode ? "0 0 0 2px rgba(59, 130, 246, 0.15)" : undefined,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    zIndex: 3,
                    cursor: props.editable ? "move" : "default",
                    touchAction: "none",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      padding: 12,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: printImageUrl && textPrint ? 10 : 0,
                    }}
                  >
                    {printImageUrl ? (
                      <img
                        src={printImageUrl}
                        alt={props.print?.name || "Принт"}
                        style={{
                          maxWidth: "100%",
                          maxHeight: textPrint ? "58%" : "100%",
                          objectFit: "contain",
                          transform: `rotate(${printImageRotate}deg)`,
                          transformOrigin: "center center",
                          pointerEvents: "none",
                          userSelect: "none",
                        }}
                      />
                    ) : null}
                    {textPrint ? (
                      <Text
                        strong
                        style={{
                          color: "#111827",
                          fontFamily: props.printFont || "Arial",
                          fontSize: Math.round((textPrint ? 20 : 18) * scaleFactor),
                          lineHeight: 1.05,
                          transform: `rotate(${printImageRotate}deg)`,
                          transformOrigin: "center center",
                          textAlign: "center",
                          wordBreak: "break-word",
                          pointerEvents: "none",
                          userSelect: "none",
                          padding: 4,
                          maxWidth: "100%",
                        }}
                      >
                        {props.printText || "Текст принта"}
                      </Text>
                    ) : !printImageUrl ? (
                      <Text
                        style={{
                          color: "#6b7280",
                          fontSize: Math.round(12 * scaleFactor),
                          textAlign: "center",
                          wordBreak: "break-word",
                          pointerEvents: "none",
                          userSelect: "none",
                          padding: 4,
                        }}
                      >
                        {props.print?.name || "Принт"}
                      </Text>
                    ) : null}
                  </div>

                  {props.editable ? (
                    <div
                      onPointerDown={handleInteractionStart("rotate")}
                      title="Поворот"
                      style={{
                        position: "absolute",
                        top: -32,
                        left: "50%",
                        transform: "translateX(-50%)",
                        width: 28,
                        height: 28,
                        borderRadius: 999,
                        background: "#0f172a",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 16,
                        boxShadow: "0 8px 24px rgba(15, 23, 42, 0.28)",
                        cursor: "grab",
                        userSelect: "none",
                        touchAction: "none",
                      }}
                    >
                      ↻
                    </div>
                  ) : null}

                  {props.editable ? (
                    <div
                      onPointerDown={handleInteractionStart("resize")}
                      title="Изменить размер"
                      style={{
                        position: "absolute",
                        right: -12,
                        bottom: -12,
                        width: 26,
                        height: 26,
                        borderRadius: 999,
                        background: "#fff",
                        color: "#0f172a",
                        border: "2px solid #1677ff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 15,
                        boxShadow: "0 8px 24px rgba(15, 23, 42, 0.18)",
                        cursor: "nwse-resize",
                        userSelect: "none",
                        touchAction: "none",
                      }}
                    >
                      ⤡
                    </div>
                  ) : null}
                </div>
              ) : null}

              {showPrint2Layer ? (
                <div
                  onPointerDown={handleInteractionStart("move", 2)}
                  style={{
                    position: "absolute",
                    left: `${props.print2X ?? 50}%`,
                    top: `${props.print2Y ?? 27}%`,
                    transform: "translate(-50%, -50%)",
                    width: `${box2WidthPercent}%`,
                    height: `${box2HeightPercent}%`,
                    borderRadius: 22,
                    border: `2px dashed rgba(234, 88, 12, ${interactionMode ? 0.95 : 0.55})`,
                    background: "rgba(255, 255, 255, 0.12)",
                    boxShadow: interactionMode ? "0 0 0 2px rgba(234, 88, 12, 0.15)" : undefined,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    zIndex: 4,
                    cursor: props.editable ? "move" : "default",
                    touchAction: "none",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      padding: 12,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: print2ImageUrl && textPrint2 ? 10 : 0,
                    }}
                  >
                    {print2ImageUrl ? (
                      <img
                        src={print2ImageUrl}
                        alt={props.print2?.name || "Принт 2"}
                        style={{
                          maxWidth: "100%",
                          maxHeight: textPrint2 ? "58%" : "100%",
                          objectFit: "contain",
                          transform: `rotate(${print2ImageRotate}deg)`,
                          transformOrigin: "center center",
                          pointerEvents: "none",
                          userSelect: "none",
                        }}
                      />
                    ) : null}
                    {textPrint2 ? (
                      <Text
                        strong
                        style={{
                          color: "#111827",
                          fontFamily: props.print2Font || "Arial",
                          fontSize: Math.round(20 * scale2FactorX),
                          lineHeight: 1.05,
                          transform: `rotate(${print2ImageRotate}deg)`,
                          transformOrigin: "center center",
                          textAlign: "center",
                          wordBreak: "break-word",
                          pointerEvents: "none",
                          userSelect: "none",
                          padding: 4,
                          maxWidth: "100%",
                        }}
                      >
                        {props.print2Text || "Текст принта 2"}
                      </Text>
                    ) : !print2ImageUrl ? (
                      <Text
                        style={{
                          color: "#6b7280",
                          fontSize: Math.round(12 * scale2FactorX),
                          textAlign: "center",
                          wordBreak: "break-word",
                          pointerEvents: "none",
                          userSelect: "none",
                          padding: 4,
                        }}
                      >
                        {props.print2?.name || "Принт 2"}
                      </Text>
                    ) : null}
                  </div>

                  {props.editable ? (
                    <div
                      onPointerDown={handleInteractionStart("rotate", 2)}
                      title="Поворот принта 2"
                      style={{
                        position: "absolute",
                        top: -32,
                        left: "50%",
                        transform: "translateX(-50%)",
                        width: 28,
                        height: 28,
                        borderRadius: 999,
                        background: "#ea580c",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 16,
                        boxShadow: "0 8px 24px rgba(234, 88, 12, 0.28)",
                        cursor: "grab",
                        userSelect: "none",
                        touchAction: "none",
                      }}
                    >
                      ↻
                    </div>
                  ) : null}

                  {props.editable ? (
                    <div
                      onPointerDown={handleInteractionStart("resize", 2)}
                      title="Изменить размер принта 2"
                      style={{
                        position: "absolute",
                        right: -12,
                        bottom: -12,
                        width: 26,
                        height: 26,
                        borderRadius: 999,
                        background: "#fff",
                        color: "#ea580c",
                        border: "2px solid #ea580c",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 15,
                        boxShadow: "0 8px 24px rgba(234, 88, 12, 0.18)",
                        cursor: "nwse-resize",
                        userSelect: "none",
                        touchAction: "none",
                      }}
                    >
                      ⤡
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            {props.onSideChange && swipeOffset !== 0 ? (
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  transform: "translateY(-50%)",
                  [swipeOffset > 0 ? "left" : "right"]: 8,
                  fontSize: 28,
                  opacity: swipeProgress,
                  pointerEvents: "none",
                  transition: swipeAnimating ? "opacity 0.22s ease" : undefined,
                  userSelect: "none",
                }}
              >
                {swipeOffset > 0 ? "←" : "→"}
              </div>
            ) : null}
          </div>
        </div>

        <Space wrap>
          <Tag color={props.color ? "blue" : "default"}>Цвет: {props.color?.name || "не выбран"}</Tag>
          <Tag color={props.model ? "purple" : "default"}>Модель: {props.model?.name || "не выбрана"}</Tag>
          <Tag color={props.size ? "green" : "default"}>Размер: {props.size?.code || "не выбран"}</Tag>
          <Tag color={props.print ? "gold" : "default"}>Принт: {props.print?.name || "без принта"}</Tag>
        </Space>
      </Space>
    </Card>
  );
}
