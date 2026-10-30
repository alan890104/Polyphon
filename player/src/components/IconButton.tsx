// A button that shows an icon (or a letter), with its name for screen readers and as a tooltip.

import type { ButtonHTMLAttributes } from 'react';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** What the button does: read out by screen readers and shown on hover */
  label: string;
  /** For toggles: whether it is on */
  pressed?: boolean;
}

export function IconButton({ label, pressed, className = 'icon-button', ...props }: IconButtonProps) {
  return <button type="button" className={className} aria-label={label} title={label} aria-pressed={pressed} {...props} />;
}
