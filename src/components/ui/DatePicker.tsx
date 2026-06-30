'use client';

import { useEffect, useRef, useState } from 'react';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const pad = (n: number) => String(n).padStart(2, '0');
const toDateStr = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

const dateFmt = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const dateTimeFmt = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/**
 * Editorial calendar field. Drop-in replacement for `<input type="date">` and
 * `<input type="datetime-local">`: `value` is `YYYY-MM-DD` (or
 * `YYYY-MM-DDTHH:mm` when `withTime`), and `onChange` emits the same string.
 */
export function DatePicker({
  value,
  onChange,
  withTime = false,
  id,
  placeholder = 'Select date',
}: {
  value: string;
  onChange: (value: string) => void;
  withTime?: boolean;
  id?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const datePart = value ? value.slice(0, 10) : '';
  const timePart = value.length >= 16 ? value.slice(11, 16) : '00:00';

  const base = datePart ? new Date(`${datePart}T00:00`) : new Date();
  const [view, setView] = useState({ y: base.getFullYear(), m: base.getMonth() });

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function selectDay(d: number) {
    const ds = toDateStr(view.y, view.m, d);
    onChange(withTime ? `${ds}T${timePart}` : ds);
    if (!withTime) setOpen(false);
  }

  function changeTime(t: string) {
    if (datePart) onChange(`${datePart}T${t}`);
  }

  function shiftMonth(delta: number) {
    setView((v) => {
      const m = v.m + delta;
      return { y: v.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 };
    });
  }

  const firstWeekday = new Date(view.y, view.m, 1).getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const monthLabel = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(
    new Date(view.y, view.m, 1),
  );

  const display = datePart
    ? (withTime ? dateTimeFmt : dateFmt).format(new Date(withTime ? value : `${datePart}T00:00`))
    : placeholder;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        id={id}
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 w-full items-center justify-between rounded-none border border-line bg-paper px-3 text-base transition-[border-color] duration-150 ease-out-soft hover:border-ink focus:border-ink focus:outline-none"
      >
        <span className={datePart ? 'text-ink' : 'text-muted'}>{display}</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-4 w-4 shrink-0 text-muted"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <rect x="3" y="4.5" width="18" height="17" rx="0" />
          <path d="M3 9h18M8 3v3M16 3v3" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 z-20 mt-1 w-72 border border-line bg-surface p-3 shadow-[0_8px_30px_rgba(0,0,0,0.08)]">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => shiftMonth(-1)}
              className="px-2 py-1 text-muted hover:text-ink"
            >
              ‹
            </button>
            <span className="font-serif text-sm text-ink">{monthLabel}</span>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => shiftMonth(1)}
              className="px-2 py-1 text-muted hover:text-ink"
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 text-center">
            {WEEKDAYS.map((w) => (
              <span key={w} className="py-1 text-[10px] uppercase tracking-[0.08em] text-muted">
                {w}
              </span>
            ))}
            {Array.from({ length: firstWeekday }, (_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed leading-blank padding cells, never reordered
              <span key={`blank-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const isSelected = datePart === toDateStr(view.y, view.m, day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => selectDay(day)}
                  className={`flex h-8 items-center justify-center text-sm transition-colors duration-100 ${
                    isSelected ? 'bg-ink text-paper' : 'text-ink-soft hover:bg-field'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {withTime && (
            <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
              <span className="text-xs uppercase tracking-[0.1em] text-muted">Time</span>
              <input
                type="time"
                value={timePart}
                onChange={(e) => changeTime(e.target.value)}
                className="h-9 flex-1 rounded-none border border-line bg-paper px-2 text-sm text-ink focus:border-ink focus:outline-none"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
