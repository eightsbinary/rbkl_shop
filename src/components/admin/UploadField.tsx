'use client';

import { useEffect, useState } from 'react';

/**
 * Image input with three ways in: the native file picker, drag-and-drop onto
 * the box, and paste (Ctrl+V anywhere on the page). Drag and paste need no OS
 * file dialog — a fallback for browsers where the native picker won't open
 * (e.g. some Chrome setups). All paths hand the same File to `onFile`.
 */
export function UploadField({
  id,
  onFile,
  disabled,
  dropHint,
}: {
  id: string;
  onFile: (file: File) => void;
  disabled?: boolean;
  dropHint: string;
}) {
  const [dragging, setDragging] = useState(false);

  // Paste an image from the clipboard (Ctrl+V) without needing the file dialog.
  // Scoped to image data only, so it never interferes with normal text paste.
  useEffect(() => {
    if (disabled) return;
    const onPaste = (e: ClipboardEvent) => {
      for (const item of e.clipboardData?.items ?? []) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) onFile(file);
          break;
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [disabled, onFile]);

  const pick = (file?: File | null) => {
    if (!disabled && file && file.type.startsWith('image/')) onFile(file);
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: drop zone wrapping a real file input
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        pick(e.dataTransfer.files?.[0]);
      }}
      className={`space-y-2 border border-dashed p-3 transition-colors duration-150 ease-out-soft ${
        dragging ? 'border-ink bg-field' : 'border-line'
      }`}
    >
      <input
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={disabled}
        onChange={(e) => pick(e.target.files?.[0])}
        className="block w-full text-sm text-ink-soft file:mr-4 file:rounded-none file:border-0 file:bg-ink file:px-4 file:py-2 file:text-paper hover:file:bg-ink-soft"
      />
      <p className="text-xs text-muted">{dropHint}</p>
    </div>
  );
}
