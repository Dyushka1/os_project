import { useRef, useState } from "react";

export type FrameRect = { x: number; y: number; w: number; h: number }; // % of zone

type Handle = "move" | "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "rotate";

interface Props {
  frame: FrameRect;
  angle?: number;
  minW?: number;
  minH?: number;
  editable?: boolean;
  color?: string;
  onChange: (f: FrameRect) => void;
  onRotate?: (angle: number) => void;
  children?: React.ReactNode;
}

function cl(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

// Rotate delta vector from zone-space into frame-local space.
// Needed so resize handles work correctly when frame is rotated.
// Formula: inverse-rotate (dx,dy) by angle θ:
//   localDx =  dx·cos(θ) + dy·sin(θ)
//   localDy = -dx·sin(θ) + dy·cos(θ)
function toLocal(dx: number, dy: number, angleDeg: number) {
  const r = (angleDeg * Math.PI) / 180;
  return {
    dx:  dx * Math.cos(r) + dy * Math.sin(r),
    dy: -dx * Math.sin(r) + dy * Math.cos(r),
  };
}

export default function DraggableFrame({
  frame, angle = 0, minW = 4, minH = 4, editable,
  color = "#1677ff", onChange, onRotate, children,
}: Props) {
  const outerRef = useRef<HTMLDivElement>(null);
  const dragRef  = useRef<{
    handle: Handle;
    px: number; py: number;
    f0: FrameRect;
    startAngle: number;
    startAngleToPointer: number;
  } | null>(null);
  const [hovered, setHovered] = useState<Handle | null>(null);
  const [active,  setActive]  = useState(false);

  function zoneRect() {
    return outerRef.current?.parentElement?.getBoundingClientRect()
      ?? { width: 1, height: 1, left: 0, top: 0 };
  }

  function startDrag(handle: Handle) {
    return (e: React.PointerEvent) => {
      if (!editable) return;
      e.preventDefault();
      e.stopPropagation();
      const zr = zoneRect();
      const cx = frame.x + frame.w / 2;
      const cy = frame.y + frame.h / 2;
      const cClientX = zr.left + (cx / 100) * zr.width;
      const cClientY = zr.top  + (cy / 100) * zr.height;
      dragRef.current = {
        handle,
        px: e.clientX,
        py: e.clientY,
        f0: { ...frame },
        startAngle: angle,
        startAngleToPointer: Math.atan2(e.clientY - cClientY, e.clientX - cClientX),
      };
      setActive(true);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    };
  }

  function onMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;

    const zr = zoneRect();

    // Delta in zone-% space
    const dxZone = (e.clientX - d.px) / zr.width  * 100;
    const dyZone = (e.clientY - d.py) / zr.height * 100;

    // Delta in frame-local space (accounts for rotation)
    const { dx, dy } = toLocal(dxZone, dyZone, d.startAngle);

    const { x: ox, y: oy, w: ow, h: oh } = d.f0;
    const r0 = ox + ow; // fixed right  edge
    const b0 = oy + oh; // fixed bottom edge

    let x = ox, y = oy, w = ow, h = oh;

    if (d.handle === "move") {
      // Center of frame must stay within zone (0-100%).
      // This lets edges go outside the zone boundary while keeping
      // at least half the frame always visible inside it.
      x = cl(ox + dxZone, -ow * 0.2, 100 - ow * 0.8);
      y = cl(oy + dyZone, -oh * 0.2, 100 - oh * 0.8);
    }

    // Right edge extends — uses local dx
    if (d.handle === "e" || d.handle === "ne" || d.handle === "se")
      w = cl(ow + dx, minW, 100 - ox);

    // Bottom edge extends — uses local dy
    if (d.handle === "s" || d.handle === "se" || d.handle === "sw")
      h = cl(oh + dy, minH, 100 - oy);

    // Left edge moves, right edge (r0) stays fixed
    if (d.handle === "w" || d.handle === "nw" || d.handle === "sw") {
      x = cl(ox + dx, 0, r0 - minW);
      w = r0 - x;
    }

    // Top edge moves, bottom edge (b0) stays fixed
    if (d.handle === "n" || d.handle === "nw" || d.handle === "ne") {
      y = cl(oy + dy, 0, b0 - minH);
      h = b0 - y;
    }

    if (d.handle === "rotate" && onRotate) {
      const cx = d.f0.x + d.f0.w / 2;
      const cy = d.f0.y + d.f0.h / 2;
      const cClientX = zr.left + (cx / 100) * zr.width;
      const cClientY = zr.top  + (cy / 100) * zr.height;
      const cur = Math.atan2(e.clientY - cClientY, e.clientX - cClientX);
      const delta = ((cur - d.startAngleToPointer) * 180) / Math.PI;
      let next = (d.startAngle + delta) % 360;
      if (next >  180) next -= 360;
      if (next < -180) next += 360;
      onRotate(Math.round(next));
      return;
    }

    onChange({ x, y, w, h });
  }

  function onUp() {
    dragRef.current = null;
    setActive(false);
  }

  const S = 10;
  const handles: Array<{ h: Handle; s: React.CSSProperties }> = [
    { h: "nw", s: { top: -S/2, left: -S/2,                              cursor: "nw-resize" } },
    { h: "n",  s: { top: -S/2, left: "50%", transform: "translateX(-50%)", cursor: "n-resize"  } },
    { h: "ne", s: { top: -S/2, right: -S/2,                             cursor: "ne-resize" } },
    { h: "e",  s: { top: "50%", right: -S/2, transform: "translateY(-50%)", cursor: "e-resize"  } },
    { h: "se", s: { bottom: -S/2, right: -S/2,                          cursor: "se-resize" } },
    { h: "s",  s: { bottom: -S/2, left: "50%", transform: "translateX(-50%)", cursor: "s-resize"  } },
    { h: "sw", s: { bottom: -S/2, left: -S/2,                           cursor: "sw-resize" } },
    { h: "w",  s: { top: "50%", left: -S/2, transform: "translateY(-50%)", cursor: "w-resize"  } },
  ];

  const borderColor = active ? color : color + "99";

  return (
    /*
      Outer div — positions the frame, rotates it, handles events.
      overflow: visible so handles and rotation knob extend outside the boundary.
    */
    <div
      ref={outerRef}
      style={{
        position: "absolute",
        left: `${frame.x}%`,
        top:  `${frame.y}%`,
        width:  `${frame.w}%`,
        height: `${frame.h}%`,
        transform: `rotate(${angle}deg)`,
        transformOrigin: "center center",
        overflow: "visible",
        cursor: editable ? (active ? "grabbing" : "grab") : "default",
        touchAction: "none",
        userSelect: "none",
        zIndex: 3,
      }}
      onPointerDown={startDrag("move")}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      {/*
        Inner content box — shows border and clips content at the frame edge.
        Separate from outer so overflow:hidden here doesn't clip the handles.
      */}
      <div style={{
        position: "absolute",
        inset: 0,
        border: editable ? `2px dashed ${borderColor}` : "none",
        borderRadius: 6,
        background: editable ? "rgba(255,255,255,0.05)" : "transparent",
      }}>
        {children}
      </div>

      {/* 8 resize handles — visible outside inner box because outer is overflow:visible */}
      {editable && handles.map(({ h, s }) => (
        <div
          key={h}
          style={{
            position: "absolute",
            width: S, height: S,
            background: hovered === h ? color : "#fff",
            border: `2px solid ${color}`,
            borderRadius: 2,
            zIndex: 10,
            boxSizing: "border-box",
            transition: "background 0.1s",
            ...s,
          }}
          onPointerEnter={() => setHovered(h)}
          onPointerLeave={() => setHovered(null)}
          onPointerDown={startDrag(h)}
        />
      ))}

      {/* Rotation handle — above the center of the top edge */}
      {editable && onRotate && (
        <div
          title="Поворот"
          style={{
            position: "absolute",
            top: -38,
            left: "50%",
            transform: "translateX(-50%)",
            width: 24, height: 24,
            borderRadius: "50%",
            background: color,
            color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14,
            cursor: "grab",
            touchAction: "none",
            userSelect: "none",
            zIndex: 10,
            boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
          }}
          onPointerDown={startDrag("rotate")}
        >
          ↻
        </div>
      )}
    </div>
  );
}
