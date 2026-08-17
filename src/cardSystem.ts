import type { ImageSourcePropType } from 'react-native';

export type CardRarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';
export type CardElement = 'flame' | 'tide' | 'grove';
export type CardState = 'idle' | 'locked' | 'damaged' | 'upgrading' | 'revealing';
export type CardAttributeKey = 'ATK' | 'DEF' | 'SPD' | 'VIT' | 'TEC' | 'LUK';

export type CardAttribute = {
  key: CardAttributeKey;
  name: string;
  value: number;
};

export type CollectibleCardData = {
  id: string;
  serial: string;
  name: string;
  species: string;
  art: ImageSourcePropType | { uri: string };
  rarity: CardRarity;
  rating: number;
  level: number;
  role: string;
  element: CardElement;
  evolution: string;
  faction: string;
  archetype: string;
  bond: string;
  attributes: CardAttribute[];
};

export type CardTheme = {
  label: string;
  code: string;
  surface: [string, string, string];
  panel: string;
  ink: string;
  muted: string;
  frame: string;
  frameInner: string;
  accent: string;
  texture: 'brushed' | 'diagonal' | 'etched' | 'radiant' | 'stellar';
  frameLayers: number;
  sheen: boolean;
  particles: number;
};

export const rarityThemes: Record<CardRarity, CardTheme> = {
  common: {
    label: '普通', code: 'BASE', surface: ['#D7D8D4', '#A8ABA8', '#ECEBE6'], panel: '#E8E7E0E8', ink: '#151918', muted: '#59605D', frame: '#F0F1EC', frameInner: '#717875', accent: '#39423F', texture: 'brushed', frameLayers: 1, sheen: false, particles: 0,
  },
  rare: {
    label: '稀有', code: 'EDGE', surface: ['#93C8CE', '#294F61', '#B5DDE0'], panel: '#173845E8', ink: '#F5FCFC', muted: '#B8D3D5', frame: '#D4F0ED', frameInner: '#5AAAB4', accent: '#80E3D6', texture: 'diagonal', frameLayers: 2, sheen: false, particles: 0,
  },
  epic: {
    label: '史诗', code: 'SIGIL', surface: ['#5D426B', '#171623', '#9A738B'], panel: '#1A1724E8', ink: '#FFF8FC', muted: '#D7BDD0', frame: '#E6B8D3', frameInner: '#805B91', accent: '#F2A8C4', texture: 'etched', frameLayers: 3, sheen: true, particles: 0,
  },
  legendary: {
    label: '传说', code: 'CROWN', surface: ['#8D5C19', '#17130E', '#E2A944'], panel: '#21180DEB', ink: '#FFF7E6', muted: '#D8BF8C', frame: '#FFF0A6', frameInner: '#A96D1D', accent: '#FFD266', texture: 'radiant', frameLayers: 4, sheen: true, particles: 7,
  },
  mythic: {
    label: '神话', code: 'ORBIT', surface: ['#125D5B', '#11141B', '#743F67'], panel: '#11141BEF', ink: '#F4FFFF', muted: '#ACD9D6', frame: '#D7FFF6', frameInner: '#A76B9E', accent: '#83F3D8', texture: 'stellar', frameLayers: 5, sheen: true, particles: 12,
  },
};

export const elementThemes: Record<CardElement, { label: string; glyph: string; color: string; dark: string }> = {
  flame: { label: '烈焰', glyph: '△', color: '#FF765A', dark: '#5A211A' },
  tide: { label: '潮汐', glyph: '≈', color: '#65CFE2', dark: '#123D4B' },
  grove: { label: '森林', glyph: '◇', color: '#7DD39E', dark: '#173E28' },
};

export function deriveCardAttributes(stats: { hp: number; attack: number; defense: number; speed: number; crit: number; dodge: number }, traitCount: number): CardAttribute[] {
  return [
    { key: 'ATK', name: '强袭', value: stats.attack },
    { key: 'DEF', name: '护甲', value: stats.defense },
    { key: 'SPD', name: '迅捷', value: stats.speed },
    { key: 'VIT', name: '体魄', value: Math.round(stats.hp / 3) },
    { key: 'TEC', name: '技巧', value: Math.round(stats.speed * 0.45 + stats.crit * 140) },
    { key: 'LUK', name: '灵运', value: Math.round(stats.dodge * 180 + traitCount * 4) },
  ];
}

export function cardRating(power: number): number {
  return Math.max(40, Math.min(99, Math.round(40 + power / 5)));
}

export function rarityPowerOffset(rarity: CardRarity): number {
  return ({ common: 0, rare: 1, epic: 2, legendary: 3, mythic: 4 } as const)[rarity];
}
