import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Photo } from '../data';
import { CameraIcon } from '../components/icons';
import { useI18n } from '../i18n';
import { preparePhoto, type PreparedPhoto } from './resize';
import { usePhotoUrl } from './usePhotoUrl';
import './photos.css';

const SIZE_CLASS = { sm: ' photo-thumb--sm', md: '', lg: ' photo-thumb--lg' } as const;

/**
 * PhotoThumb: a stored photo as a square (52, 72 or 104px). With `onOpen` it is a button (opens the
 * viewer); without, a picture inside something else that is the target.
 */
export function PhotoThumb({
  photo,
  size = 'md',
  label,
  onOpen,
}: {
  photo: Pick<Photo, 'id' | 'dogId'>;
  size?: keyof typeof SIZE_CLASS;
  /** Accessible name of the button ("Photo, Sat 10 Oct"). */
  label?: string;
  onOpen?: () => void;
}) {
  const url = usePhotoUrl(photo, 'thumb');
  const img = url ? <img src={url} alt="" draggable={false} /> : null;
  return onOpen ? (
    <button type="button" className={`photo-thumb${SIZE_CLASS[size]}`} aria-label={label} onClick={onOpen}>
      {img}
    </button>
  ) : (
    <span className={`photo-thumb${SIZE_CLASS[size]}`} aria-hidden="true">
      {img}
    </span>
  );
}

/** A photo not saved yet (in a form): shown from the file made on the phone. */
export function LocalThumb({ file }: { file: Blob }) {
  const url = useObjectUrl(file);
  return <span className="photo-thumb photo-thumb--sm" aria-hidden="true">{url && <img src={url} alt="" />}</span>;
}

/** A URL showing a Blob (a data: URL, so nothing has to be released later); null while it is read. */
export function useObjectUrl(blob: Blob | null): string | null {
  const [read, setRead] = useState<{ blob: Blob; url: string } | null>(null);
  useEffect(() => {
    if (!blob) return;
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' && setRead({ blob, url: reader.result });
    reader.readAsDataURL(blob);
    return () => reader.abort();
  }, [blob]);
  return read && read.blob === blob ? read.url : null;
}

/**
 * PhotoPick: the dashed tile that opens the phone's own photo menu. A plain file input with
 * accept="image/*" (no `capture`), so an iPhone offers Photo Library, Take Photo and Choose File.
 * The picked photo is resized here; `onPicked` gets the result, `onError` a photo it cannot read.
 * `variant`: the full-width tile of the photo form, the 104px strip tile, or the 52px field tile.
 */
export function PhotoPick({
  variant,
  label,
  children,
  onPicked,
  onError,
  onBusy,
}: {
  variant: 'full' | 'tile' | 'sm' | 'change';
  /** Accessible name when the tile shows no text (the 52px one). */
  label?: string;
  children?: ReactNode;
  onPicked: (photo: PreparedPhoto) => void;
  onError?: () => void;
  onBusy?: (busy: boolean) => void;
}) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    onBusy?.(true);
    try {
      onPicked(await preparePhoto(file));
    } catch {
      onError?.();
    } finally {
      setBusy(false);
      onBusy?.(false);
      if (input.current) input.current.value = ''; // the same file can be picked again
    }
  };
  const cls = {
    full: 'photo-pick',
    tile: 'photo-pick photo-pick--tile',
    sm: 'photo-pick photo-pick--sm',
    change: 'btn btn--ghost photo-preview__change',
  }[variant];
  return (
    <>
      <button
        type="button"
        className={cls}
        aria-label={label}
        aria-busy={busy || undefined}
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        {variant !== 'change' && (
          <span className="photo-pick__icon" aria-hidden="true">
            <CameraIcon size={variant === 'full' ? 22 : variant === 'tile' ? 16 : 18} />
          </span>
        )}
        {busy && variant !== 'sm' ? t('photoPreparing') : children}
      </button>
      <input
        ref={input}
        className="photo-input"
        type="file"
        accept="image/*"
        tabIndex={-1}
        aria-hidden="true"
        data-testid="photo-input"
        onChange={(e) => void pick(e.target.files?.[0])}
      />
    </>
  );
}
