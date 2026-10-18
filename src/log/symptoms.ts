// Symptom types and their properties (design proposal JCB-25, "Properties per symptom").
// A known symptom is stored by its English name in `title` (so the Timeline's symptomLabel reads it
// in either language); properties are stored as keys in `props`, intensity in `intensity`.
import type { HealthEvent, Intensity } from '../data';
import { translate, type MessageKey } from '../i18n';

export const SYMPTOMS: readonly MessageKey[] = [
  'sx_poo', 'sx_vomit', 'sx_leak', 'sx_pant', 'sx_rumble', 'sx_heart', 'sx_fear', 'sx_rest', 'sx_reflux',
];

/** The English name a known symptom is stored under. */
export const symptomTitle = (key: MessageKey) => translate('en', key);
/** The known symptom a stored title names, if any. */
export const symptomKey = (title: string): MessageKey | undefined => {
  const needle = title.trim().toLowerCase();
  return SYMPTOMS.find((k) => symptomTitle(k).toLowerCase() === needle);
};

export interface PropDef {
  /** Key in `props`, or `intensity` for the intensity column. */
  name: string;
  label: MessageKey;
  /** Stored value and its label. A null label shows the value as written (1×, 2×, 3×+). */
  options: readonly { value: string; label: MessageKey | null; text?: string }[];
}

const QUANTITY: PropDef = {
  name: 'quantity',
  label: 'quantity',
  options: [
    { value: 'small', label: 'q_small' },
    { value: 'medium', label: 'q_medium' },
    { value: 'lot', label: 'q_lot' },
  ],
};
const INTENSITY: PropDef = {
  name: 'intensity',
  label: 'symptom.142',
  options: [
    { value: 'small', label: 'lvl.74' },
    { value: 'medium', label: 'lvl.75' },
    { value: 'large', label: 'lvl.76' },
  ],
};

const PROPS: Partial<Record<MessageKey, readonly PropDef[]>> = {
  sx_poo: [
    {
      name: 'consistency',
      label: 'consistency',
      options: [
        { value: 'normal', label: 'c_normal' },
        { value: 'soft', label: 'c_soft' },
        { value: 'diarrhea', label: 'c_diarrhea' },
      ],
    },
    {
      name: 'colour',
      label: 'colour',
      options: [
        { value: 'normal', label: 'k_normal' },
        { value: 'dark', label: 'k_dark' },
        { value: 'light', label: 'k_light' },
        { value: 'blood', label: 'k_blood' },
      ],
    },
    QUANTITY,
  ],
  sx_vomit: [
    {
      name: 'times',
      label: 'times',
      options: [
        { value: '1', label: null, text: '1×' },
        { value: '2', label: null, text: '2×' },
        { value: '3+', label: null, text: '3×+' },
      ],
    },
    {
      name: 'when',
      label: 'when',
      options: [
        { value: 'morning', label: 'w_morning' },
        { value: 'midday', label: 'w_midday' },
        { value: 'evening', label: 'w_evening' },
        { value: 'night', label: 'w_night' },
      ],
    },
  ],
  sx_leak: [QUANTITY],
};

/** Property rows for a symptom; every other symptom (including a typed one) has Intensity. */
export const propsFor = (key: MessageKey | undefined): readonly PropDef[] => (key && PROPS[key]) || [INTENSITY];

const optionLabel = (def: PropDef, value: string, t: (k: MessageKey) => string) => {
  const o = def.options.find((x) => x.value === value);
  if (!o) return value;
  return o.label ? t(o.label) : (o.text ?? value);
};

export const propValue = (e: Pick<HealthEvent, 'props' | 'intensity'>, name: string): string =>
  name === 'intensity' ? (e.intensity ?? '') : (e.props?.[name] ?? '');

/** The chosen properties only: "diarrhea · dark · medium amount", "1× in the morning", "a lot". */
export function symptomAttrs(e: HealthEvent, t: (k: MessageKey) => string): string {
  const defs = propsFor(symptomKey(e.title));
  const vals = defs.map((d) => [d, propValue(e, d.name)] as const).filter(([, v]) => v);
  const labels = vals.map(([d, v]) => optionLabel(d, v, t));
  return (symptomKey(e.title) === 'sx_vomit' ? [labels.join(' ')] : labels).filter(Boolean).join(' · ');
}

/** The properties, then the written details: "a lot · thunder". */
export function symptomDetail(e: HealthEvent, t: (k: MessageKey) => string): string {
  return [symptomAttrs(e, t), e.detail].filter(Boolean).join(' · ');
}

export const isIntensity = (v: string): v is Intensity => v === 'small' || v === 'medium' || v === 'large';
