import { describe, expect, it } from 'vitest';
import { cardRating, deriveCardAttributes, rarityThemes } from './cardSystem';

describe('collectible card system', () => {
  it('derives six readable display attributes without mutating battle stats', () => {
    const source = { hp: 126, attack: 38, defense: 24, speed: 34, crit: 0.12, dodge: 0.08 };
    const attributes = deriveCardAttributes(source, 3);
    expect(attributes.map((item) => item.key)).toEqual(['ATK', 'DEF', 'SPD', 'VIT', 'TEC', 'LUK']);
    expect(source.hp).toBe(126);
  });

  it('keeps collectible ratings within a two-digit scale', () => {
    expect(cardRating(0)).toBe(40);
    expect(cardRating(260)).toBe(92);
    expect(cardRating(9999)).toBe(99);
  });

  it('uses materially different theme structures across all five rarities', () => {
    expect(Object.keys(rarityThemes)).toEqual(['common', 'rare', 'epic', 'legendary', 'mythic']);
    expect(rarityThemes.common.texture).not.toBe(rarityThemes.legendary.texture);
    expect(rarityThemes.common.frameLayers).toBeLessThan(rarityThemes.legendary.frameLayers);
    expect(rarityThemes.common.particles).toBe(0);
    expect(rarityThemes.mythic.particles).toBeGreaterThan(rarityThemes.legendary.particles);
  });
});
