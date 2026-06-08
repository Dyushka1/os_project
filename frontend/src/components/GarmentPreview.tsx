import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Card, Space, Tag, Typography } from "antd";
import { resolveApiUrl } from "../utils/resolveApiUrl";
import DraggableFrame, { type FrameRect } from "./DraggableFrame";

const { Text } = Typography;

const TEXT_PRINT_TYPES = new Set(["text", "custom_text", "own_text", "own-text"]);

const PRINT_ZONE_INSETS = {
  top: 0.24,
  right: 0.26,
  bottom: 0.24,
  left: 0.26,
};

// Base size of the print box as fraction of zone (100%)
const BOX_BASE_RATIOS = {
  image: { width: 0.72, height: 0.34 },
  text:  { width: 0.62, height: 0.22 },
};

// Zone dimensions as fraction of full preview rect
const ZW = 1 - PRINT_ZONE_INSETS.left - PRINT_ZONE_INSETS.right; // 0.48
const ZH = 1 - PRINT_ZONE_INSETS.top  - PRINT_ZONE_INSETS.bottom; // 0.52
const ZL = PRINT_ZONE_INSETS.left; // 0.26
const ZT = PRINT_ZONE_INSETS.top;  // 0.24

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

// ─── Coordinate helpers ───────────────────────────────────────────────────────
//
// GarmentPreview stores print position as:
//   printX/Y  — center of box as % of full preview rect (0-100)
//   printScaleX/Y — scale factor (100 = 100% = base box size)
//
// DraggableFrame needs:
//   x/y  — top-left corner as % of the zone element (0-100)
//   w/h  — dimensions as % of the zone element (0-100)
//
// Zone is inset 26% left/right, 24% top/bottom of the full preview rect.
//
// Math (no pixel measurements needed):
//   boxW_zone% = clamp(100 * baseBox.width  * scaleX/100, 2, 94)
//   cx_zone%   = (printX/100 - ZL) / ZW * 100
//   frame.x    = cx_zone - boxW_zone/2
//
// Inverse:
//   printX = (ZL + (cx_zone/100) * ZW) * 100
//   scaleX = frame.w / baseBox.width

function clampF(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function propsToFrame(
  printX: number, printY: number,
  scaleX: number, scaleY: number,
  base: { width: number; height: number },
): FrameRect {
  const w = clampF(100 * base.width  * (scaleX / 100), 2, 94);
  const h = clampF(100 * base.height * (scaleY / 100), 2, 94);
  const cx = (printX / 100 - ZL) / ZW * 100;
  const cy = (printY / 100 - ZT) / ZH * 100;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

function frameToProps(
  frame: FrameRect,
  base: { width: number; height: number },
): { printX: number; printY: number; printScaleX: number; printScaleY: number } {
  const cx = frame.x + frame.w / 2; // center % of zone
  const cy = frame.y + frame.h / 2;
  return {
    printX:      Math.round((ZL + (cx / 100) * ZW) * 100),
    printY:      Math.round((ZT + (cy / 100) * ZH) * 100),
    printScaleX: Math.round(frame.w / base.width),
    printScaleY: Math.round(frame.h / base.height),
  };
}

// ─────────────────────────────────────────────────────────────────────────────

export default function GarmentPreview(props: Props) {
  const previewRef = useRef<HTMLDivElement | null>(null);

  // Swipe to flip side
  const swipeRef = useRef<{ startX: number; pointerId: number } | null>(null);
  const swipeOffsetRef = useRef(0);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [swipeAnimating, setSwipeAnimating] = useState(false);

  const hasCustomText  = !!props.printText?.trim();
  const textPrint      = isTextPrint(props.print) || hasCustomText;
  const printImageUrl  = resolveApiUrl(props.print?.image_url);
  const modelImageUrl  = resolveApiUrl(
    props.previewSide === "back"
      ? props.model?.back_image_url || props.model?.front_image_url
      : props.model?.front_image_url || props.model?.back_image_url,
  );

  const hasPrintContent  = !!printImageUrl || textPrint || !!props.print?.name;
  const showPrintLayer   = hasPrintContent && (!props.printSide || props.previewSide === props.printSide);

  const hasCustomText2 = !!props.print2Text?.trim();
  const textPrint2     = isTextPrint(props.print2) || hasCustomText2;
  const print2ImageUrl = resolveApiUrl(props.print2?.image_url);
  const hasPrint2Content = !!print2ImageUrl || textPrint2 || !!props.print2?.name;
  const showPrint2Layer  = hasPrint2Content && (!props.print2Side || props.previewSide === props.print2Side);

  // Font size for text prints — controlled independently by printScale slider
  const scaleFactor  = clampF(props.printScale  ?? 100, 5, 600) / 100;
  const scale2Factor = clampF(props.print2Scale ?? 100, 5, 600) / 100;

  // Compute DraggableFrame rects from props
  const base1 = textPrint  ? BOX_BASE_RATIOS.text : BOX_BASE_RATIOS.image;
  const base2 = textPrint2 ? BOX_BASE_RATIOS.text : BOX_BASE_RATIOS.image;

  const frame1 = propsToFrame(
    props.printX  ?? 50, props.printY  ?? 32,
    clampF(props.printScaleX  ?? 100, 5, 600),
    clampF(props.printScaleY  ?? 100, 5, 600),
    base1,
  );
  const frame2 = propsToFrame(
    props.print2X ?? 50, props.print2Y ?? 65,
    clampF(props.print2ScaleX ?? 100, 5, 600),
    clampF(props.print2ScaleY ?? 100, 5, 600),
    base2,
  );

  // Swipe handlers
  const handleSwipeStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!props.onSideChange) return;
    swipeRef.current = { startX: event.clientX, pointerId: event.pointerId };
    swipeOffsetRef.current = 0;
    setSwipeAnimating(false);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleSwipeMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!swipeRef.current) return;
    if (event.pointerId !== swipeRef.current.pointerId) return;
    event.preventDefault();
    const dx = event.clientX - swipeRef.current.startX;
    swipeOffsetRef.current = dx;
    setSwipeOffset(dx);
  };

  const handleSwipeEnd = (event?: ReactPointerEvent<HTMLDivElement>) => {
    if (!swipeRef.current) return;
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
  };

  const swipeProgress = previewRef.current
    ? Math.min(Math.abs(swipeOffset) / (previewRef.current.getBoundingClientRect().width * SWIPE_THRESHOLD_RATIO), 1)
    : 0;

  // Print content renderers
  function renderPrintContent(
    imageUrl: string | null | undefined,
    isText: boolean,
    angle: number,
    text: string | undefined,
    font: string | undefined,
    placeholderName: string | undefined,
    fontSizeFactor: number,
  ) {
    return (
      <div style={{
        position: "absolute", inset: 0, padding: 12,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: imageUrl && isText ? 10 : 0,
        overflow: "hidden",
        pointerEvents: "none",
      }}>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={placeholderName || "Принт"}
            style={{
              maxWidth: "100%", maxHeight: isText ? "58%" : "100%",
              objectFit: "contain",
              transform: `rotate(${angle}deg)`,
              transformOrigin: "center center",
              pointerEvents: "none", userSelect: "none",
            }}
          />
        ) : null}
        {isText ? (
          <Text strong style={{
            color: "#111827", fontFamily: font || "Arial",
            fontSize: Math.round(20 * fontSizeFactor),
            lineHeight: 1.05,
            textAlign: "center", wordBreak: "break-all",
            pointerEvents: "none", userSelect: "none",
            padding: 4, maxWidth: "100%",
          }}>
            {text || "Текст принта"}
          </Text>
        ) : !imageUrl ? (
          <Text style={{
            color: "#6b7280",
            fontSize: Math.round(12 * fontSizeFactor),
            textAlign: "center", wordBreak: "break-all",
            pointerEvents: "none", userSelect: "none", padding: 4,
          }}>
            {placeholderName || "Принт"}
          </Text>
        ) : null}
      </div>
    );
  }

  return (
    <Card size="small" title="Превью изделия" style={{ height: "100%" }}>
      <Space direction="vertical" size={14} style={{ width: "100%" }}>
        <div style={{
          borderRadius: 24, padding: 16,
          background: "linear-gradient(180deg, #f8fbff 0%, #eef3f9 100%)",
          border: "1px solid #d9e2ec",
        }}>
          {/* Outer drag container (swipe) */}
          <div
            ref={previewRef}
            style={{
              position: "relative", minHeight: 520,
              display: "flex", alignItems: "center", justifyContent: "center",
              overflow: "hidden", touchAction: "none",
              cursor: props.onSideChange ? "grab" : undefined,
            }}
            onPointerDown={handleSwipeStart}
            onPointerMove={handleSwipeMove}
            onPointerUp={handleSwipeEnd}
            onPointerCancel={handleSwipeEnd}
            onPointerLeave={handleSwipeEnd}
          >
            {/* Garment card */}
            <div style={{
              position: "relative", width: "100%", maxWidth: 440,
              aspectRatio: "3 / 4", borderRadius: 28,
              background: "rgba(255, 255, 255, 0.94)",
              border: "2px dashed #cbd5e1",
              boxShadow: "inset 0 0 0 1px rgba(255, 255, 255, 0.5)",
              transform: `translateX(${swipeOffset}px) rotate(${swipeOffset * 0.015}deg)`,
              transition: swipeAnimating ? "transform 0.22s ease" : undefined,
              opacity: 1 - swipeProgress * 0.12,
            }} onTransitionEnd={() => setSwipeAnimating(false)}>

              {/* Model image */}
              {modelImageUrl ? (
                <img src={modelImageUrl} alt={props.model?.name || "Модель"} style={{
                  position: "absolute", inset: 0, width: "100%", height: "100%",
                  objectFit: "contain", zIndex: 1, pointerEvents: "none",
                }} />
              ) : null}

              {/*
                Print zone container.
                ─ position: absolute with inset% puts it in the correct area.
                ─ It's a CSS containing block (position:absolute) so DraggableFrame
                  children are positioned relative to it.
                ─ pointer-events: none on the zone itself, but children (DraggableFrames)
                  have their own event handlers — CSS allows this.
                ─ overflow: visible so rotation handles can extend above/below the zone.
              */}
              <div style={{
                position: "absolute",
                inset: `${PRINT_ZONE_INSETS.top * 100}% ${PRINT_ZONE_INSETS.right * 100}% ${PRINT_ZONE_INSETS.bottom * 100}% ${PRINT_ZONE_INSETS.left * 100}%`,
                borderRadius: 24,
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(59,130,246,0.28)",
                zIndex: 2,
                overflow: "hidden",
              }}>

                {/* Print 1 */}
                {showPrintLayer && (
                  <DraggableFrame
                    frame={frame1}
                    angle={props.printAngle ?? 0}
                    editable={props.editable}
                    color="#1677ff"
                    onChange={(f) => {
                      const p = frameToProps(f, base1);
                      props.onUpdatePrint?.({
                        printX: p.printX, printY: p.printY,
                        printScaleX: p.printScaleX, printScaleY: p.printScaleY,
                      });
                    }}
                    onRotate={(a) => props.onUpdatePrint?.({ printAngle: a })}
                  >
                    {renderPrintContent(
                      printImageUrl, textPrint, 0,
                      props.printText, props.printFont,
                      props.print?.name, scaleFactor,
                    )}
                  </DraggableFrame>
                )}

                {/* Print 2 */}
                {showPrint2Layer && (
                  <DraggableFrame
                    frame={frame2}
                    angle={props.print2Angle ?? 0}
                    editable={props.editable}
                    color="#ea580c"
                    onChange={(f) => {
                      const p = frameToProps(f, base2);
                      props.onUpdatePrint2?.({
                        print2X: p.printX, print2Y: p.printY,
                        print2ScaleX: p.printScaleX, print2ScaleY: p.printScaleY,
                      });
                    }}
                    onRotate={(a) => props.onUpdatePrint2?.({ print2Angle: a })}
                  >
                    {renderPrintContent(
                      print2ImageUrl, textPrint2, 0,
                      props.print2Text, props.print2Font,
                      props.print2?.name, scale2Factor,
                    )}
                  </DraggableFrame>
                )}

              </div>
            </div>

            {/* Swipe arrow hint */}
            {props.onSideChange && swipeOffset !== 0 ? (
              <div style={{
                position: "absolute", top: "50%", transform: "translateY(-50%)",
                [swipeOffset > 0 ? "left" : "right"]: 8,
                fontSize: 28, opacity: swipeProgress, pointerEvents: "none",
                transition: swipeAnimating ? "opacity 0.22s ease" : undefined,
                userSelect: "none",
              }}>
                {swipeOffset > 0 ? "←" : "→"}
              </div>
            ) : null}
          </div>
        </div>

        <Space wrap>
          <Tag color={props.color  ? "blue"    : "default"}>Цвет: {props.color?.name   || "не выбран"}</Tag>
          <Tag color={props.model  ? "purple"  : "default"}>Модель: {props.model?.name || "не выбрана"}</Tag>
          <Tag color={props.size   ? "green"   : "default"}>Размер: {props.size?.code  || "не выбран"}</Tag>
          <Tag color={props.print  ? "gold"    : "default"}>Принт: {props.print?.name  || "без принта"}</Tag>
        </Space>
      </Space>
    </Card>
  );
}
