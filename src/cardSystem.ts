import type { ImageSourcePropType } from 'react-native';

export type CardRarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';
export type CardElement = 'flame' | 'tide' | 'grove';
export type CardState = 'idle' | 'locked' | 'exhausted' | 'damaged' | 'healing' | 'shielded' | 'poisoned' | 'silenced' | 'defeated' | 'upgrading' | 'revealing';
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
  energy: number;
  health: number;
  abilities: Array<{ name: string; description: string }>;
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
  gem: string;
  shadow: string;
  texture: 'brushed' | 'diagonal' | 'etched' | 'radiant' | 'stellar';
  frameLayers: number;
  sheen: boolean;
  particles: number;
};

export const rarityThemes: Record<CardRarity, CardTheme> = {
  common: {
    label: '普通', code: '旅木', surface: ['#9A7248', '#493021', '#B58A59'], panel: '#5B3825', ink: '#FFF0CF', muted: '#D7BE96', frame: '#C59A60', frameInner: '#5E402C', accent: '#D2B27C', gem: '#9BA18B', shadow: '#160D08', texture: 'brushed', frameLayers: 1, sheen: false, particles: 0,
  },
  rare: {
    label: '稀有', code: '月银', surface: ['#AFB7B4', '#455B5D', '#C7D1CD'], panel: '#34494B', ink: '#F7F2DF', muted: '#CAD6D2', frame: '#E2E8DD', frameInner: '#718B8B', accent: '#A9D5C7', gem: '#4EA8A2', shadow: '#112122', texture: 'diagonal', frameLayers: 2, sheen: false, particles: 0,
  },
  epic: {
    label: '史诗', code: '晶歌', surface: ['#5D4A69', '#261F2D', '#8C6A80'], panel: '#3C2B42', ink: '#FFF0E4', muted: '#DCC7D9', frame: '#CEB5D1', frameInner: '#735477', accent: '#E1A8C0', gem: '#B85D9D', shadow: '#160E1A', texture: 'etched', frameLayers: 3, sheen: true, particles: 2,
  },
  legendary: {
    label: '传说', code: '曦誓', surface: ['#9B6425', '#3C2514', '#D79D42'], panel: '#70451F', ink: '#FFF3D0', muted: '#E7C995', frame: '#FFE4A0', frameInner: '#9B5C1F', accent: '#FFD06A', gem: '#E56F31', shadow: '#2A1408', texture: 'radiant', frameLayers: 4, sheen: true, particles: 8,
  },
  mythic: {
    label: '神话', code: '星兽', surface: ['#295A56', '#171C1B', '#65485F'], panel: '#253E3A', ink: '#F5F1DF', muted: '#BFD8CE', frame: '#D7E4C6', frameInner: '#836979', accent: '#81CDB3', gem: '#62C7AE', shadow: '#081713', texture: 'stellar', frameLayers: 5, sheen: true, particles: 12,
  },
};

export const elementThemes: Record<CardElement, { label: string; glyph: string; color: string; dark: string }> = {
  flame: { label: '烈焰', glyph: '焰', color: '#E58B45', dark: '#4B2118' },
  tide: { label: '潮汐', glyph: '潮', color: '#72B5B8', dark: '#163A3D' },
  grove: { label: '森林', glyph: '森', color: '#87B076', dark: '#213A24' },
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
