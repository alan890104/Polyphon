// A small notice above the bottom bar (import errors). It goes away when closed, or by itself after a while.

import { useEffect, useEffectEvent } from 'react';
import { IconButton } from './IconButton.tsx';
import { CloseIcon, WarningIcon } from './Icons.tsx';

const LIFETIME_MS = 10_000;

interface ToastProps {
  title: string;
  messages: string[];
  onDismiss: () => void;
}

export function Toast({ title, messages, onDismiss }: ToastProps) {
  const dismiss = useEffectEvent(onDismiss);
  // A new set of messages starts the clock again
  useEffect(() => {
    const timer = setTimeout(() => dismiss(), LIFETIME_MS);
    return () => clearTimeout(timer);
  }, [messages]);

  return (
    <div className="toast" role="alert">
      <WarningIcon />
      <div className="toast__body">
        <p className="toast__title">{title}</p>
        {messages.map((message, i) => (
          <p key={i} className="toast__message">
            {message}
          </p>
        ))}
      </div>
      <IconButton label="Dismiss" onClick={onDismiss}>
        <CloseIcon />
      </IconButton>
    </div>
  );
}
