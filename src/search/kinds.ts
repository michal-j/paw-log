// The 17 kinds Search can filter by (JCB-138): the 9 event types, Documents (a PDF on an event), the 5 item kinds,
// and the two things that are not on a day (Tracked conditions, Pinned notes).
import type { EventType, ItemKind } from '../data';
import type { MessageKey } from '../i18n';

export type EventFilterKind = EventType | 'doc';
export type Kind = EventFilterKind | ItemKind | 'tracked' | 'pinned';

export type KindGroup = 'events' | 'items' | 'off';

/** Sheet order: three captioned groups, as in the approved design. */
export const KIND_GROUPS: Record<KindGroup, readonly Kind[]> = {
  events: ['vet', 'symptom', 'note', 'photo', 'doc', 'frontline', 'deworming', 'anal_glands', 'nails', 'other'],
  items: ['food', 'medication', 'supplement', 'treat', 'procedure'],
  off: ['tracked', 'pinned'],
};
export const ALL_KINDS: readonly Kind[] = [...KIND_GROUPS.events, ...KIND_GROUPS.items, ...KIND_GROUPS.off];

export const GROUP_CAPTION: Record<KindGroup, MessageKey> = {
  events: 'searchGroupEvents',
  items: 'searchGroupItemsSheet',
  off: 'searchGroupOff',
};

/** The name of a kind on the Filters button, in the summary line and in the sheet (reviewed labels where they exist). */
export const KIND_LABEL: Record<Kind, MessageKey> = {
  vet: 'chips.108',
  symptom: 'kSym',
  note: 'label.177',
  photo: 'chips.109',
  doc: 'kindDocuments',
  frontline: 'typeWord_frontline',
  deworming: 'copy.102',
  anal_glands: 'kindAnalGlands',
  nails: 'kindNails',
  other: 'otherEvent',
  food: 'title.104',
  medication: 'label.176',
  supplement: 'kindSupplements',
  treat: 'copy.58',
  procedure: 'kindProcedures',
  tracked: 'copy.173',
  pinned: 'copy.171',
};

/** Type words are searched as text, in the current language ("vet visit", "wizyta", "pdf"). */
export const TYPE_WORD: Record<Exclude<Kind, 'tracked' | 'pinned'>, MessageKey> = {
  vet: 'typeWord_vet',
  symptom: 'typeWord_symptom',
  note: 'typeWord_note',
  photo: 'typeWord_photo',
  doc: 'typeWord_doc',
  frontline: 'typeWord_frontline',
  deworming: 'typeWord_deworming',
  anal_glands: 'typeWord_anal_glands',
  nails: 'typeWord_nails',
  other: 'typeWord_other',
  food: 'typeWord_food',
  medication: 'typeWord_medication',
  supplement: 'typeWord_supplement',
  treat: 'typeWord_treat',
  procedure: 'typeWord_procedure',
};

/** A second word that also finds a type ("nails" finds Nail trimming). */
export const TYPE_ALIAS: Partial<Record<Kind, MessageKey>> = { nails: 'typeAlias_nails' };

export const isItemKind = (k: Kind): k is ItemKind =>
  k === 'food' || k === 'medication' || k === 'supplement' || k === 'treat' || k === 'procedure';
