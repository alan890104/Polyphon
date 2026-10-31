// The visualizer's settings drawer: style, background (with the listener's own picture), colour, response and display.
// Native radios, ranges and checkboxes underneath, so it works with a keyboard and a screen reader as it is.

import { useId, useRef, type ChangeEvent, type ReactNode } from 'react';
import { BACKGROUNDS } from './backgrounds/index.ts';
import { CloseIcon } from '../components/Icons.tsx';
import type { VisualSettings } from './settings.ts';
import { STYLES } from './styles/index.ts';
import { THEMES } from './themes.ts';
import type { BackgroundImage } from './useBackgroundImage.ts';

interface SettingsDrawerProps {
  id: string;
  settings: VisualSettings;
  update: (patch: Partial<VisualSettings>) => void;
  reset: () => void;
  picture: BackgroundImage;
  onClose: () => void;
}

const IMAGE_NOTE: Record<BackgroundImage['status'], string> = {
  none: 'No picture yet.',
  loading: 'Opening your picture…',
  kept: 'Kept in this browser.',
  session: 'This browser would not store it: it lasts until you reload.',
  error: '',
};

export function SettingsDrawer({ id, settings, update, reset, picture, onClose }: SettingsDrawerProps) {
  const file = useRef<HTMLInputElement>(null);

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const chosen = e.target.files?.[0];
    e.target.value = '';
    if (chosen && (await picture.choose(chosen))) update({ background: 'image' });
  };

  return (
    <aside className="immersive-drawer" id={id} aria-label="Visualizer settings">
      <header className="immersive-drawer__head">
        <h2 className="immersive-drawer__title">Settings</h2>
        <button type="button" className="immersive-button" aria-label="Close settings" title="Close settings" onClick={onClose}>
          <CloseIcon />
        </button>
      </header>

      <div className="immersive-drawer__body">
        <Section title="Style">
          {STYLES.map((s, i) => (
            <Choice key={s.id} name="style" index={i} label={s.name} hint={s.description} checked={settings.style === s.id} onSelect={() => update({ style: s.id })} />
          ))}
          {settings.style === 'spectrum' && <Toggle label="Mirror the bars" checked={settings.mirror} onChange={(mirror) => update({ mirror })} />}
          {settings.style === 'waveform' && <Toggle label="Echoes and a bass trace" checked={settings.layered} onChange={(layered) => update({ layered })} />}
        </Section>

        <Section title="Background">
          {BACKGROUNDS.map((b, i) => (
            <Choice
              key={b.id}
              name="background"
              index={i}
              label={b.name}
              hint={b.description}
              checked={settings.background === b.id}
              onSelect={() => (b.id === 'image' && !picture.image ? file.current?.click() : update({ background: b.id }))}
            />
          ))}
          <div className="immersive-picture">
            <input ref={file} type="file" accept="image/*" hidden onChange={(e) => void onFile(e)} />
            <button type="button" className="immersive-text-button" onClick={() => file.current?.click()}>
              {picture.image ? 'Replace picture…' : 'Choose a picture…'}
            </button>
            {picture.image && (
              <button type="button" className="immersive-text-button immersive-text-button--quiet" onClick={picture.remove}>
                Remove
              </button>
            )}
            <p className={`immersive-picture__note${picture.error ? ' immersive-picture__note--error' : ''}`} role="status">
              {picture.error ?? IMAGE_NOTE[picture.status]}
            </p>
          </div>
        </Section>

        <Section title="Colour">
          <div className="immersive-swatches">
            {THEMES.map((t) => (
              <label key={t.id} className="immersive-swatch" style={{ '--swatch-ink': t.ink, '--swatch-paper': t.paper, '--swatch-accent': t.accent }}>
                <input type="radio" name="immersive-theme" checked={settings.theme === t.id} onChange={() => update({ theme: t.id })} />
                <span className="immersive-swatch__chip" aria-hidden="true" />
                <span className="immersive-swatch__name">{t.name}</span>
              </label>
            ))}
          </div>
        </Section>

        <Section title="Response">
          <Range label="Sensitivity" min={0.5} max={2} step={0.05} value={settings.sensitivity} text={`${settings.sensitivity.toFixed(2)}×`} onChange={(sensitivity) => update({ sensitivity })} />
          <Range label="Motion" min={0} max={1} step={0.05} value={settings.motion} text={`${Math.round(settings.motion * 100)}%`} onChange={(motion) => update({ motion })} />
        </Section>

        <Section title="Display">
          <Toggle label="Title and position" checked={settings.showTitle} onChange={(showTitle) => update({ showTitle })} />
          <Toggle label="Hide controls when idle" checked={settings.autoHide} onChange={(autoHide) => update({ autoHide })} />
        </Section>

        <button type="button" className="immersive-text-button immersive-text-button--quiet immersive-drawer__reset" onClick={reset}>
          Reset to defaults
        </button>
      </div>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="immersive-section">
      <legend className="immersive-section__title">{title}</legend>
      {children}
    </fieldset>
  );
}

interface ChoiceProps {
  name: string;
  index: number;
  label: string;
  hint: string;
  checked: boolean;
  onSelect: () => void;
}

/** One row of an index: a number, a name and a line of description */
function Choice({ name, index, label, hint, checked, onSelect }: ChoiceProps) {
  const hintId = useId();
  return (
    <label className="immersive-choice">
      <input type="radio" name={`immersive-${name}`} checked={checked} onChange={onSelect} aria-describedby={hintId} />
      <span className="immersive-choice__index" aria-hidden="true">
        {String(index + 1).padStart(2, '0')}
      </span>
      <span className="immersive-choice__text">
        <span className="immersive-choice__label">{label}</span>
        <span className="immersive-choice__hint" id={hintId}>
          {hint}
        </span>
      </span>
      <span className="immersive-choice__mark" aria-hidden="true" />
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="immersive-toggle">
      <span>{label}</span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="immersive-toggle__track" aria-hidden="true" />
    </label>
  );
}

interface RangeProps {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  text: string;
  onChange: (value: number) => void;
}

function Range({ label, min, max, step, value, text, onChange }: RangeProps) {
  const id = useId();
  return (
    <div className="immersive-range">
      <label htmlFor={id}>{label}</label>
      <output htmlFor={id}>{text}</output>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={text}
        style={{ '--fill': (value - min) / (max - min) }}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
