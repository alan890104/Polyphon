// A horizontal slider, for seeking and volume: click or drag anywhere along it, or use the arrow keys when it has focus.

import { useRef, type KeyboardEvent, type PointerEvent } from 'react';

interface SliderProps {
  label: string;
  value: number;
  max: number;
  /** How far one arrow key press moves */
  step: number;
  /** Read out by screen readers in place of the number */
  valueText?: string;
  disabled?: boolean;
  /** While dragging, and on every key press */
  onChange: (value: number) => void;
  /** When the drag ends, and on every key press */
  onCommit?: (value: number) => void;
}

const KEY_STEPS: Record<string, number> = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 };

export function Slider({ label, value, max, step, valueText, disabled = false, onChange, onCommit }: SliderProps) {
  const dragged = useRef(0);
  const fraction = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;

  const drag = (e: PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    dragged.current = Math.min(1, Math.max(0, (e.clientX - box.left) / box.width)) * max;
    onChange(dragged.current);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag(e);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const direction = KEY_STEPS[e.key];
    if (disabled || direction === undefined) return;
    e.preventDefault();
    const next = Math.min(max, Math.max(0, value + direction * step));
    onChange(next);
    onCommit?.(next);
  };

  return (
    <div
      className="slider"
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.round(value * 100) / 100}
      aria-valuetext={valueText}
      aria-disabled={disabled}
      style={{ '--fraction': fraction }}
      onPointerDown={onPointerDown}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) drag(e);
      }}
      onLostPointerCapture={() => onCommit?.(dragged.current)}
      onKeyDown={onKeyDown}
    >
      <div className="slider__track">
        <div className="slider__fill" />
      </div>
      <div className="slider__thumb" />
    </div>
  );
}
