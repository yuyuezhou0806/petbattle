import { describe, expect, it } from 'vitest';
import { chooseEnemyMove, combatPower, createBattle, playRound, rollGear, rollTraits, speciesCatalog, totalStats, type BattlePet } from './game';

const pet = (name = '团子'): BattlePet => ({
  name,
  level: 1,
  base: speciesCatalog.cat.base,
  traits: rollTraits('cat', () => 0),
  equipment: {},
});

describe('pet game rules', () => {
  it('rolls three unique species traits', () => {
    const traits = rollTraits('dog', () => 0);
    expect(traits).toHaveLength(3);
    expect(new Set(traits.map((trait) => trait.id)).size).toBe(3);
    expect(traits.every((trait) => trait.id.startsWith('dog-'))).toBe(true);
  });

  it('applies trait, equipment and level bonuses', () => {
    const unit = pet();
    const basePower = combatPower(unit);
    unit.level = 5;
    unit.equipment.head = { id: 'test', name: '测试装备', slot: 'head', rarity: '普通', icon: '⭐', bonus: { attack: 5 } };
    expect(totalStats(unit).attack).toBeGreaterThan(speciesCatalog.cat.base.attack + 5);
    expect(combatPower(unit)).toBeGreaterThan(basePower);
  });

  it('keeps combat deterministic when a random source is supplied', () => {
    const battle = createBattle(pet('团子'), pet('影爪'));
    const next = playRound(battle, 'quick', 'quick', () => 0.5);
    expect(next.turn).toBe(2);
    expect(next.player.hp).toBeLessThan(next.player.maxHp);
    expect(next.enemy.hp).toBeLessThan(next.enemy.maxHp);
    expect(next.log).toHaveLength(2);
  });

  it('halves incoming damage while guarding', () => {
    const initial = createBattle(pet('团子'), pet('影爪'));
    const normal = playRound(initial, 'quick', 'quick', () => 0.5);
    const guarded = playRound(initial, 'guard', 'quick', () => 0.5);
    expect(initial.player.hp - guarded.player.hp).toBeLessThan(initial.player.hp - normal.player.hp);
  });

  it('respects power energy costs and rarity rolls', () => {
    const battle = createBattle(pet(), pet('影爪'));
    expect(chooseEnemyMove({ ...battle, enemy: { ...battle.enemy, energy: 100 } }, () => 0.2)).toBe('power');
    expect(rollGear(() => 0).rarity).toBe('史诗');
    expect(rollGear(() => 0.9).rarity).toBe('普通');
  });
});
