export type SpeciesId = 'cat' | 'dog' | 'bird' | 'rabbit' | 'rodent' | 'reptile';
export type GearSlot = 'head' | 'body' | 'charm';
export type GearRarity = '普通' | '稀有' | '史诗';
export type BattleMove = 'quick' | 'power' | 'guard';

export type Stats = {
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  crit: number;
  dodge: number;
};

export type Trait = {
  id: string;
  name: string;
  description: string;
  bonus: Partial<Stats>;
};

export type Gear = {
  id: string;
  name: string;
  slot: GearSlot;
  rarity: GearRarity;
  icon: string;
  bonus: Partial<Stats>;
};

export type BattlePet = {
  name: string;
  level: number;
  base: Stats;
  traits: Trait[];
  equipment: Partial<Record<GearSlot, Gear>>;
};

export type FighterState = Stats & {
  name: string;
  maxHp: number;
  energy: number;
};

export type BattleState = {
  player: FighterState;
  enemy: FighterState;
  turn: number;
  winner?: 'player' | 'enemy';
  log: string[];
};

export const speciesCatalog: Record<SpeciesId, { name: string; icon: string; base: Stats; traits: Trait[] }> = {
  cat: {
    name: '猫咪', icon: '🐱', base: { hp: 104, attack: 32, defense: 20, speed: 31, crit: 0.08, dodge: 0.05 },
    traits: [
      { id: 'cat-night', name: '夜行猎手', description: '暴击率 +6%', bonus: { crit: 0.06 } },
      { id: 'cat-agile', name: '轻盈步伐', description: '速度 +8', bonus: { speed: 8 } },
      { id: 'cat-nine', name: '九命韧性', description: '生命 +18', bonus: { hp: 18 } },
      { id: 'cat-claw', name: '磨利爪尖', description: '攻击 +6', bonus: { attack: 6 } },
      { id: 'cat-balance', name: '柔软落地', description: '闪避率 +5%', bonus: { dodge: 0.05 } },
      { id: 'cat-watch', name: '胡须感知', description: '防御 +5、速度 +3', bonus: { defense: 5, speed: 3 } },
    ],
  },
  dog: {
    name: '狗狗', icon: '🐶', base: { hp: 118, attack: 29, defense: 24, speed: 25, crit: 0.06, dodge: 0.03 },
    traits: [
      { id: 'dog-loyal', name: '忠诚守护', description: '生命 +14、防御 +4', bonus: { hp: 14, defense: 4 } },
      { id: 'dog-track', name: '敏锐追踪', description: '速度 +7', bonus: { speed: 7 } },
      { id: 'dog-bite', name: '有力咬合', description: '攻击 +7', bonus: { attack: 7 } },
      { id: 'dog-heart', name: '热情伙伴', description: '生命 +22', bonus: { hp: 22 } },
      { id: 'dog-alert', name: '警觉耳朵', description: '暴击率 +4%、闪避率 +3%', bonus: { crit: 0.04, dodge: 0.03 } },
      { id: 'dog-guard', name: '护院本能', description: '防御 +8', bonus: { defense: 8 } },
    ],
  },
  bird: {
    name: '鸟类', icon: '🐦', base: { hp: 92, attack: 30, defense: 17, speed: 36, crit: 0.09, dodge: 0.07 },
    traits: [
      { id: 'bird-flight', name: '凌空飞羽', description: '闪避率 +7%', bonus: { dodge: 0.07 } },
      { id: 'bird-eye', name: '鹰眼锁定', description: '暴击率 +7%', bonus: { crit: 0.07 } },
      { id: 'bird-dive', name: '俯冲突袭', description: '攻击 +7、速度 +3', bonus: { attack: 7, speed: 3 } },
      { id: 'bird-song', name: '清亮鸣唱', description: '生命 +12、防御 +3', bonus: { hp: 12, defense: 3 } },
      { id: 'bird-feather', name: '丰厚羽衣', description: '防御 +7', bonus: { defense: 7 } },
      { id: 'bird-wind', name: '顺风而行', description: '速度 +10', bonus: { speed: 10 } },
    ],
  },
  rabbit: {
    name: '兔兔', icon: '🐰', base: { hp: 101, attack: 26, defense: 21, speed: 34, crit: 0.06, dodge: 0.08 },
    traits: [
      { id: 'rabbit-foot', name: '幸运兔脚', description: '暴击率 +5%、闪避率 +3%', bonus: { crit: 0.05, dodge: 0.03 } },
      { id: 'rabbit-hop', name: '疾速跳跃', description: '速度 +10', bonus: { speed: 10 } },
      { id: 'rabbit-burrow', name: '洞穴专家', description: '防御 +7', bonus: { defense: 7 } },
      { id: 'rabbit-ear', name: '长耳预警', description: '闪避率 +6%', bonus: { dodge: 0.06 } },
      { id: 'rabbit-kick', name: '后腿猛蹬', description: '攻击 +7', bonus: { attack: 7 } },
      { id: 'rabbit-vital', name: '草叶活力', description: '生命 +20', bonus: { hp: 20 } },
    ],
  },
  rodent: {
    name: '鼠类', icon: '🐹', base: { hp: 98, attack: 28, defense: 19, speed: 33, crit: 0.08, dodge: 0.07 },
    traits: [
      { id: 'rodent-stash', name: '囤积本能', description: '生命 +16', bonus: { hp: 16 } },
      { id: 'rodent-teeth', name: '门齿打磨', description: '攻击 +7', bonus: { attack: 7 } },
      { id: 'rodent-tiny', name: '小巧身形', description: '闪避率 +7%', bonus: { dodge: 0.07 } },
      { id: 'rodent-tunnel', name: '地道冲刺', description: '速度 +8', bonus: { speed: 8 } },
      { id: 'rodent-clever', name: '机灵巧手', description: '暴击率 +6%', bonus: { crit: 0.06 } },
      { id: 'rodent-cheek', name: '鼓鼓颊囊', description: '生命 +10、防御 +4', bonus: { hp: 10, defense: 4 } },
    ],
  },
  reptile: {
    name: '爬宠', icon: '🦎', base: { hp: 112, attack: 29, defense: 29, speed: 19, crit: 0.05, dodge: 0.02 },
    traits: [
      { id: 'reptile-scale', name: '坚韧鳞片', description: '防御 +9', bonus: { defense: 9 } },
      { id: 'reptile-cold', name: '冷静伏击', description: '暴击率 +7%', bonus: { crit: 0.07 } },
      { id: 'reptile-tail', name: '摆尾反制', description: '攻击 +5、防御 +3', bonus: { attack: 5, defense: 3 } },
      { id: 'reptile-sun', name: '日光蓄能', description: '生命 +20', bonus: { hp: 20 } },
      { id: 'reptile-camo', name: '环境伪装', description: '闪避率 +5%', bonus: { dodge: 0.05 } },
      { id: 'reptile-patience', name: '耐心猎手', description: '攻击 +7', bonus: { attack: 7 } },
    ],
  },
};

export const gearCatalog: Gear[] = [
  { id: 'leaf-crown', name: '嫩叶头冠', slot: 'head', rarity: '普通', icon: '🌿', bonus: { hp: 8 } },
  { id: 'runner-band', name: '追风发带', slot: 'head', rarity: '稀有', icon: '🎗️', bonus: { speed: 6, crit: 0.02 } },
  { id: 'star-goggles', name: '星光护目镜', slot: 'head', rarity: '史诗', icon: '🥽', bonus: { attack: 5, crit: 0.04 } },
  { id: 'cotton-vest', name: '云朵背心', slot: 'body', rarity: '普通', icon: '☁️', bonus: { defense: 4 } },
  { id: 'trail-cloak', name: '远行披风', slot: 'body', rarity: '稀有', icon: '🧣', bonus: { hp: 12, defense: 4 } },
  { id: 'guardian-coat', name: '守护战衣', slot: 'body', rarity: '史诗', icon: '🦺', bonus: { hp: 18, defense: 7 } },
  { id: 'bell-charm', name: '铃铛挂件', slot: 'charm', rarity: '普通', icon: '🔔', bonus: { speed: 3 } },
  { id: 'lucky-cookie', name: '幸运饼干', slot: 'charm', rarity: '稀有', icon: '🍪', bonus: { crit: 0.03, dodge: 0.02 } },
  { id: 'moon-medal', name: '月光勋章', slot: 'charm', rarity: '史诗', icon: '🌙', bonus: { attack: 6, speed: 4 } },
];

export const adventureStages = [
  { id: 'park', name: '晨光公园', energy: 1, power: 120, reward: '金币 ×80 · 普通装备', icon: '🌳' },
  { id: 'market', name: '夜市寻宝', energy: 2, power: 155, reward: '金币 ×130 · 稀有概率提升', icon: '🏮' },
  { id: 'ruins', name: '月影遗迹', energy: 3, power: 195, reward: '金币 ×200 · 史诗装备概率', icon: '🌙' },
];

export function rollTraits(species: SpeciesId, random: () => number = Math.random): Trait[] {
  const pool = [...speciesCatalog[species].traits];
  const result: Trait[] = [];
  while (result.length < 3) {
    const index = Math.min(pool.length - 1, Math.floor(random() * pool.length));
    result.push(pool.splice(index, 1)[0]);
  }
  return result;
}

export function rollGear(random: () => number = Math.random, rarityBoost = 0): Gear {
  const value = random();
  const rarity: GearRarity = value < 0.08 + rarityBoost ? '史诗' : value < 0.36 + rarityBoost ? '稀有' : '普通';
  const pool = gearCatalog.filter((gear) => gear.rarity === rarity);
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
}

export function totalStats(pet: BattlePet): Stats {
  const stats = { ...pet.base };
  const bonuses = [...pet.traits.map((trait) => trait.bonus), ...Object.values(pet.equipment).filter(Boolean).map((gear) => gear!.bonus)];
  for (const bonus of bonuses) {
    for (const key of Object.keys(bonus) as (keyof Stats)[]) stats[key] += bonus[key] ?? 0;
  }
  const levelScale = 1 + Math.max(0, pet.level - 1) * 0.035;
  stats.hp = Math.round(stats.hp * levelScale);
  stats.attack = Math.round(stats.attack * levelScale);
  stats.defense = Math.round(stats.defense * levelScale);
  stats.speed = Math.round(stats.speed * levelScale);
  stats.crit = Math.min(0.35, stats.crit);
  stats.dodge = Math.min(0.25, stats.dodge);
  return stats;
}

function fighter(pet: BattlePet): FighterState {
  const stats = totalStats(pet);
  return { name: pet.name, ...stats, maxHp: stats.hp, energy: 25 };
}

export function createBattle(player: BattlePet, enemy: BattlePet): BattleState {
  return { player: fighter(player), enemy: fighter(enemy), turn: 1, log: ['战斗开始，速度更快的一方先行动。'] };
}

type ActorKey = 'player' | 'enemy';

function strike(state: BattleState, actorKey: ActorKey, targetKey: ActorKey, move: BattleMove, guarded: boolean, random: () => number) {
  const actor = state[actorKey];
  const target = state[targetKey];
  if (actor.hp <= 0 || move === 'guard') return;
  const actualMove = move === 'power' && actor.energy < 50 ? 'quick' : move;
  const power = actualMove === 'power' ? 1.45 : 0.92;
  if (random() < target.dodge) {
    state.log.push(`${target.name}灵巧闪开了${actor.name}的攻击！`);
  } else {
    const variance = 0.9 + random() * 0.2;
    const critical = random() < actor.crit;
    const raw = actor.attack * power * variance - target.defense * 0.48;
    const damage = Math.max(1, Math.round(raw * (critical ? 1.5 : 1) * (guarded ? 0.5 : 1)));
    target.hp = Math.max(0, target.hp - damage);
    state.log.push(`${actor.name}${actualMove === 'power' ? '发动蓄能猛击' : '快速出击'}，造成 ${damage} 点伤害${critical ? '（暴击）' : ''}${guarded ? '（已格挡）' : ''}。`);
  }
  actor.energy = actualMove === 'power' ? Math.max(0, actor.energy - 50) : Math.min(100, actor.energy + 25);
  if (target.hp === 0) state.winner = actorKey;
}

export function playRound(current: BattleState, playerMove: BattleMove, enemyMove: BattleMove, random: () => number = Math.random): BattleState {
  if (current.winner) return current;
  const state: BattleState = { ...current, player: { ...current.player }, enemy: { ...current.enemy }, log: [] };
  const playerGuard = playerMove === 'guard';
  const enemyGuard = enemyMove === 'guard';
  if (playerGuard) { state.player.energy = Math.min(100, state.player.energy + 15); state.log.push(`${state.player.name}摆出防守姿态。`); }
  if (enemyGuard) { state.enemy.energy = Math.min(100, state.enemy.energy + 15); state.log.push(`${state.enemy.name}摆出防守姿态。`); }
  const order: ActorKey[] = state.player.speed >= state.enemy.speed ? ['player', 'enemy'] : ['enemy', 'player'];
  for (const actor of order) {
    if (state.winner) break;
    if (actor === 'player') strike(state, 'player', 'enemy', playerMove, enemyGuard, random);
    else strike(state, 'enemy', 'player', enemyMove, playerGuard, random);
  }
  state.turn += 1;
  return state;
}

export function chooseEnemyMove(state: BattleState, random: () => number = Math.random): BattleMove {
  const hpRate = state.enemy.hp / state.enemy.maxHp;
  if (hpRate < 0.32 && random() < 0.38) return 'guard';
  if (state.enemy.energy >= 50 && random() < 0.48) return 'power';
  return 'quick';
}

export function combatPower(pet: BattlePet): number {
  const stats = totalStats(pet);
  return Math.round(stats.hp * 0.42 + stats.attack * 2.1 + stats.defense * 1.6 + stats.speed * 1.1 + (stats.crit + stats.dodge) * 100);
}
