import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';
import { Button as GalioButton } from 'galio-framework';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Image,
  type ImageSourcePropType,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  adventureStages,
  breedBaseStats,
  catBreedCatalog,
  chooseEnemyMove,
  combatPower,
  createBattle,
  playRound,
  rollGear,
  rollTraits,
  speciesCatalog,
  totalStats,
  type BattleMove,
  type BattlePet,
  type BattleState,
  type Gear,
  type GearSlot,
  type SpeciesId,
  type Trait,
} from './src/game';

const defaultCat = require('./assets/default-real-cat.png');
const defaultHusky = require('./assets/default-real-husky.png');

type Screen = 'home' | 'create' | 'pet' | 'rewards' | 'adventure' | 'battle' | 'social';
type Element = '烈焰' | '潮汐' | '森林';

type IdentificationCandidate = {
  id: string;
  name: string;
  classification: string;
  confidence: number;
  reason: string;
  summary: string;
};

type IdentificationResult = {
  available: boolean;
  message?: string;
  speciesId?: SpeciesId;
  speciesName?: string;
  speciesConfidence?: number;
  observations?: string;
  needsConfirmation?: boolean;
  candidates: IdentificationCandidate[];
  disclaimer?: string;
};

type Pet = {
  name: string;
  species: string;
  element: Element;
  level: number;
  hp: number;
  attack: number;
  speciesId: SpeciesId;
  breedId?: string;
  breedName?: string;
  traits: Trait[];
  equipment: Partial<Record<GearSlot, Gear>>;
  image?: string;
};

const colors = {
  ink: '#302739',
  muted: '#817787',
  cream: '#FFF9F2',
  white: '#FFFFFF',
  peach: '#FF8F70',
  peachDark: '#EE684D',
  peachSoft: '#FFE8DF',
  lilac: '#8E72E8',
  lilacSoft: '#F0EBFF',
  mint: '#77D8B1',
  mintSoft: '#E5F8F0',
  yellow: '#FFD769',
  blueSoft: '#E7F1FF',
  line: '#EEE5EC',
};

const initialPet: Pet = {
  name: '团子',
  species: '中华田园猫',
  element: '烈焰',
  level: 8,
  hp: 126,
  attack: 38,
  speciesId: 'cat',
  breedId: 'orange',
  breedName: '橘猫',
  traits: [speciesCatalog.cat.traits[0], speciesCatalog.cat.traits[2], speciesCatalog.cat.traits[4]],
  equipment: {},
};

const enemyPet: BattlePet = {
  name: '影爪',
  level: 7,
  base: speciesCatalog.dog.base,
  traits: [speciesCatalog.dog.traits[0], speciesCatalog.dog.traits[2], speciesCatalog.dog.traits[5]],
  equipment: {},
};

function asBattlePet(pet: Pet): BattlePet {
  return { name: pet.name, level: pet.level, base: breedBaseStats(pet.speciesId, pet.breedId), traits: pet.traits, equipment: pet.equipment };
}

const navMeta: Record<Exclude<Screen, 'create'>, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  home: { label: '首页', icon: 'home-outline' },
  pet: { label: '宠物', icon: 'paw-outline' },
  rewards: { label: '补给', icon: 'gift-outline' },
  adventure: { label: '冒险', icon: 'map-outline' },
  battle: { label: '对战', icon: 'flash-outline' },
  social: { label: '宠友', icon: 'people-outline' },
};

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [pet, setPet] = useState<Pet>(initialPet);
  const [draftName, setDraftName] = useState('');
  const [draftImage, setDraftImage] = useState<string>();
  const [draftSpecies, setDraftSpecies] = useState<SpeciesId>('cat');
  const [draftBreed, setDraftBreed] = useState('lihua');
  const [identification, setIdentification] = useState<IdentificationResult>();
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingError, setProcessingError] = useState('');
  const [battle, setBattle] = useState<BattleState>(() => createBattle(asBattlePet(initialPet), enemyPet));
  const [coins, setCoins] = useState(240);
  const [tickets, setTickets] = useState(3);
  const [energy, setEnergy] = useState(5);
  const [checkedIn, setCheckedIn] = useState(false);
  const [inventory, setInventory] = useState<Gear[]>([]);
  const [rewardMessage, setRewardMessage] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const { width } = useWindowDimensions();
  const wide = width >= 840;

  useEffect(() => {
    setRewardMessage('');
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [screen]);

  const identifyPet = async (uri: string) => {
    setIsIdentifying(true);
    setIdentification(undefined);
    try {
      const source = await fetch(uri);
      const blob = await source.blob();
      const form = new FormData();
      form.append('file', blob, 'pet-identification.jpg');
      const response = await fetch('/api/pet-identify', { method: 'POST', body: form });
      if (!response.ok) throw new Error('AI 品种识别暂时不可用');
      const result = await response.json() as IdentificationResult;
      setIdentification(result);
      if (result.available && result.speciesId && result.speciesId in speciesCatalog) {
        setDraftSpecies(result.speciesId);
        if (result.speciesId === 'cat' && result.candidates[0]) setDraftBreed(result.candidates[0].id);
      }
    } catch (error) {
      setIdentification({
        available: false,
        message: error instanceof Error ? `${error.message}，请手动选择。` : 'AI 品种识别暂时不可用，请手动选择。',
        candidates: [],
      });
    } finally {
      setIsIdentifying(false);
    }
  };

  const pickImage = async (camera = false) => {
    const result = camera
      ? await ImagePicker.launchCameraAsync({ quality: 0.9, allowsEditing: true, aspect: [4, 5] })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.9, allowsEditing: true, aspect: [4, 5] });
    if (!result.canceled) {
      const uri = result.assets[0].uri;
      setDraftImage(uri);
      setProcessingError('');
      void identifyPet(uri);
    }
  };

  const generatePet = async () => {
    if (!draftImage || isProcessing) return;
    setIsProcessing(true);
    setProcessingError('');
    let outlinedImage = draftImage;
    try {
      const source = await fetch(draftImage);
      const blob = await source.blob();
      const form = new FormData();
      form.append('file', blob, 'pet-photo.jpg');
      const response = await fetch('/api/pet-outline', { method: 'POST', body: form });
      if (!response.ok) throw new Error('宠物主体识别暂时不可用');
      const result = await response.json();
      outlinedImage = result.image;
    } catch (error) {
      setProcessingError(error instanceof Error ? error.message : '照片处理失败，请重试');
      setIsProcessing(false);
      return;
    }
    const seed = (draftName || '新伙伴').length + draftImage.length;
    const elements: Element[] = ['烈焰', '潮汐', '森林'];
    const base = breedBaseStats(draftSpecies, draftBreed);
    const breed = draftSpecies === 'cat' ? catBreedCatalog.find((item) => item.id === draftBreed) : undefined;
    const next: Pet = {
      name: draftName.trim() || '新伙伴',
      species: breed?.name ?? speciesCatalog[draftSpecies].name,
      element: elements[seed % elements.length],
      level: 1,
      hp: base.hp,
      attack: base.attack,
      speciesId: draftSpecies,
      breedId: breed?.id,
      breedName: breed?.name,
      traits: rollTraits(draftSpecies),
      equipment: {},
      image: outlinedImage,
    };
    setPet(next);
    setBattle(createBattle(asBattlePet(next), enemyPet));
    setScreen('pet');
    setIsProcessing(false);
  };

  const resetBattle = () => {
    setBattle(createBattle(asBattlePet(pet), enemyPet));
  };

  const useBattleMove = (move: BattleMove) => {
    setBattle((current) => playRound(current, move, chooseEnemyMove(current)));
  };

  const claimCheckIn = () => {
    if (checkedIn) return;
    setCheckedIn(true);
    setCoins((value) => value + 120);
    setTickets((value) => value + 1);
    setRewardMessage('签到成功：金币 ×120、装备券 ×1');
  };

  const drawEquipment = () => {
    if (tickets < 1) { setRewardMessage('装备券不足，冒险和签到可以获得。'); return; }
    const gear = rollGear();
    setTickets((value) => value - 1);
    setInventory((items) => [gear, ...items]);
    setRewardMessage(`获得${gear.rarity}装备：${gear.icon} ${gear.name}`);
  };

  const equip = (gear: Gear) => {
    setPet((current) => ({ ...current, equipment: { ...current.equipment, [gear.slot]: gear } }));
    setRewardMessage(`${gear.icon} ${gear.name} 已装备`);
  };

  const explore = (stage: (typeof adventureStages)[number]) => {
    if (energy < stage.energy) { setRewardMessage('冒险体力不足，明日会恢复。'); return; }
    const power = combatPower(asBattlePet(pet));
    const winChance = Math.max(0.25, Math.min(0.95, 0.58 + (power - stage.power) / 180));
    setEnergy((value) => value - stage.energy);
    if (Math.random() <= winChance) {
      const rewardCoins = stage.energy * 60 + 20;
      const gear = rollGear(Math.random, stage.id === 'ruins' ? 0.05 : stage.id === 'market' ? 0.02 : 0);
      setCoins((value) => value + rewardCoins);
      setInventory((items) => [gear, ...items]);
      setRewardMessage(`冒险成功：金币 ×${rewardCoins}，获得 ${gear.icon} ${gear.name}`);
    } else {
      setRewardMessage('这次探索失败了，但没有损失装备。提升战力后再来吧！');
    }
  };

  const page = useMemo(() => {
    if (screen === 'create') {
      return (
        <Page eyebrow="CREATE A HERO" title="把真实的它，变成闪耀英雄" subtitle="上传一张清晰照片。系统只抠除背景并增加精细描边，不会把宠物改成卡通。">
          <View style={[styles.twoColumn, wide && styles.row]}>
            <Pressable style={styles.upload} onPress={() => pickImage(false)}>
              {draftImage ? (
                <>
                  <Image source={{ uri: draftImage }} style={styles.uploadImage} />
                  <View style={styles.previewBadge}><Ionicons name="sparkles" size={14} color="#FFE6A1" /><Text style={styles.previewBadgeText}>原片预览 · 等待精细描边</Text></View>
                </>
              ) : (
                <View style={styles.uploadEmpty}>
                  <View style={styles.uploadIcon}><Ionicons name="camera" size={34} color={colors.peachDark} /></View>
                  <Text style={styles.uploadTitle}>添加宠物照片</Text>
                  <Text style={styles.uploadHint}>正面、全身、光线充足效果最好</Text>
                  <View style={styles.filePill}><Text style={styles.filePillText}>JPG · PNG · HEIC</Text></View>
                </View>
              )}
            </Pressable>
            <View style={styles.panel}>
              <Text style={styles.panelKicker}>宠物资料</Text>
              <Text style={styles.label}>它叫什么？</Text>
              <TextInput value={draftName} onChangeText={setDraftName} placeholder="例如：团子" placeholderTextColor="#B2A9B5" style={styles.input} />
              {!!draftImage && (
                <View style={styles.aiPanel}>
                  <View style={styles.aiHeader}>
                    <View style={styles.aiIcon}><Ionicons name="sparkles" size={16} color={colors.lilac} /></View>
                    <View style={styles.aiHeaderCopy}>
                      <Text style={styles.aiTitle}>{isIdentifying ? 'AI 正在查宠物百科…' : identification?.available ? 'AI 识别建议 · 请你确认' : 'AI 识别助手'}</Text>
                      <Text style={styles.aiSubtitle}>
                        {isIdentifying ? '正在判断物种、花色和品种候选' : identification?.message ?? identification?.observations ?? '识别结果会在这里显示'}
                      </Text>
                    </View>
                    {isIdentifying && <View style={styles.aiPulse} />}
                  </View>
                  {!!identification?.available && (
                    <>
                      <View style={styles.aiSpeciesLine}>
                        <Text style={styles.aiSpeciesText}>物种：{identification.speciesName}</Text>
                        <Text style={styles.aiConfidence}>{Math.round((identification.speciesConfidence ?? 0) * 100)}%</Text>
                      </View>
                      {!!identification.candidates.length && <View style={styles.candidateList}>
                        {identification.candidates.map((candidate) => (
                          <Pressable
                            key={candidate.id}
                            onPress={() => { setDraftSpecies('cat'); setDraftBreed(candidate.id); }}
                            style={[styles.candidateCard, draftSpecies === 'cat' && draftBreed === candidate.id && styles.candidateCardActive]}
                          >
                            <View style={styles.candidateTop}>
                              <Text style={styles.candidateName}>{candidate.name}</Text>
                              <Text style={styles.candidatePercent}>{Math.round(candidate.confidence * 100)}%</Text>
                            </View>
                            <Text style={styles.candidateKind}>{candidate.classification}</Text>
                            <Text style={styles.candidateReason} numberOfLines={2}>{candidate.reason}</Text>
                          </Pressable>
                        ))}
                      </View>}
                      <Text style={styles.aiDisclaimer}>{identification.disclaimer}</Text>
                    </>
                  )}
                </View>
              )}
              <Text style={[styles.label, styles.labelSpaced]}>它属于哪个品类？</Text>
              <View style={styles.speciesGrid}>
                {(Object.keys(speciesCatalog) as SpeciesId[]).map((id) => (
                  <Pressable key={id} onPress={() => setDraftSpecies(id)} style={[styles.speciesChip, draftSpecies === id && styles.speciesChipActive]}>
                    <Text style={styles.speciesEmoji}>{speciesCatalog[id].icon}</Text><Text style={[styles.speciesText, draftSpecies === id && styles.speciesTextActive]}>{speciesCatalog[id].name}</Text>
                  </Pressable>
                ))}
              </View>
              {draftSpecies === 'cat' && <>
                <Text style={[styles.label, styles.labelSpaced]}>猫咪细分类（以你的确认为准）</Text>
                <View style={styles.breedGrid}>
                  {catBreedCatalog.map((breed) => (
                    <Pressable key={breed.id} onPress={() => setDraftBreed(breed.id)} style={[styles.breedChip, draftBreed === breed.id && styles.breedChipActive]}>
                      <Text style={[styles.breedName, draftBreed === breed.id && styles.breedNameActive]}>{breed.name}</Text>
                      <Text style={styles.breedDescription}>{breed.description}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.breedNote}>AI 会区分“花色分类”和“品种候选”，但照片不能代替血统证明。细分类只提供轻微属性倾向，不决定稀有度，也不会替代随机种族天赋。</Text>
              </>}
              <View style={styles.inlineButtons}>
                <ActionButton label="打开相机" icon="camera-outline" onPress={() => pickImage(true)} secondary />
                <ActionButton label="选择相册" icon="images-outline" onPress={() => pickImage(false)} secondary />
              </View>
              <View style={styles.processList}>
                <ProcessStep number="01" title="识别真实主体" body="保留五官、毛色和体态" color={colors.peachSoft} />
                <ProcessStep number="02" title="精细毛发描边" body="自动修正手机照片方向" color={colors.lilacSoft} />
                <ProcessStep number="03" title="生成初始白卡" body="不带装备，从冒险开始成长" color={colors.mintSoft} />
              </View>
              <ActionButton label={isProcessing ? '正在识别与描边…' : '生成我的宠物卡'} icon="sparkles" onPress={generatePet} disabled={!draftImage || isProcessing} full />
              {!!processingError && <Text style={styles.errorText}>{processingError}</Text>}
              <Text style={styles.privacy}>照片会发送给 AI 服务完成品种候选识别，并在本服务中完成主体描边；当前不会建立云端宠物相册。正式账号与存档系统后续开放。</Text>
            </View>
          </View>
        </Page>
      );
    }

    if (screen === 'pet') {
      const petStats = totalStats(asBattlePet(pet));
      const power = combatPower(asBattlePet(pet));
      return (
        <Page eyebrow="MY PARTNER" title="我的宠物英雄" subtitle={`初始白卡 · ${pet.breedName ?? speciesCatalog[pet.speciesId].name} · 战力 ${power}`}>
          <View style={[styles.twoColumn, wide && styles.row]}>
            <PetCard pet={pet} />
            <View style={styles.petDashboard}>
              <View style={styles.levelLine}>
                <View><Text style={styles.panelKicker}>本周成长</Text><Text style={styles.sectionTitle}>距离 Lv.{pet.level + 1} 还差 380 EXP</Text></View>
                <View style={styles.levelBadge}><Text style={styles.levelBadgeText}>Lv.{pet.level}</Text></View>
              </View>
              <Progress value={62} color={colors.lilac} />
              <View style={styles.statsGrid}>
                <Stat icon="heart" value={petStats.hp} label="生命" color="#FEE8DC" iconColor="#F06B5A" />
                <Stat icon="flash" value={petStats.attack} label="攻击" color="#FFEFF1" iconColor="#F06C8B" />
                <Stat icon="shield-half" value={petStats.defense} label="防御" color="#E6EDFA" iconColor="#5A86D8" />
                <Stat icon="speedometer" value={petStats.speed} label="速度" color="#F5EEFC" iconColor="#8C69D9" />
              </View>
              <Text style={styles.subsectionTitle}>随机种族天赋 · 3/3</Text>
              <View style={styles.traitList}>{pet.traits.map((trait, index) => <TraitCard key={trait.id} trait={trait} index={index} />)}</View>
              <View style={styles.gearHeader}><Text style={styles.subsectionTitle}>装备栏</Text><Pressable onPress={() => setScreen('rewards')}><Text style={styles.textLink}>获取装备 →</Text></Pressable></View>
              <View style={styles.gearSlots}>{(['head', 'body', 'charm'] as GearSlot[]).map((slot) => <GearSlotCard key={slot} slot={slot} gear={pet.equipment[slot]} />)}</View>
              {!!inventory.length && <><Text style={styles.subsectionTitle}>背包</Text><View style={styles.inventoryList}>{inventory.slice(0, 4).map((gear, index) => <Pressable key={`${gear.id}-${index}`} onPress={() => equip(gear)} style={styles.inventoryItem}><Text style={styles.inventoryIcon}>{gear.icon}</Text><View style={styles.inventoryCopy}><Text style={styles.inventoryName}>{gear.name}</Text><Text style={styles.inventoryMeta}>{gear.rarity} · 点击装备</Text></View></Pressable>)}</View></>}
              <View style={styles.inlineButtons}>
                <ActionButton label="开始对战" icon="flash" onPress={() => { resetBattle(); setScreen('battle'); }} />
                <ActionButton label="去冒险" icon="map" onPress={() => setScreen('adventure')} secondary />
              </View>
            </View>
          </View>
        </Page>
      );
    }

    if (screen === 'rewards') {
      return (
        <Page eyebrow="DAILY SUPPLY" title="今日补给站" subtitle="签到、冒险和扭蛋是装备的主要来源；宠物白卡本身不带付费强度。">
          <Wallet coins={coins} tickets={tickets} energy={energy} />
          {!!rewardMessage && <View style={styles.rewardToast}><Ionicons name="sparkles" size={18} color={colors.peachDark} /><Text style={styles.rewardToastText}>{rewardMessage}</Text></View>}
          <View style={[styles.rewardGrid, wide && styles.row]}>
            <LinearGradient colors={['#FFE8DF', '#FFF7F2']} style={styles.rewardCard}>
              <View style={styles.rewardIcon}><Text style={styles.rewardEmoji}>📅</Text></View>
              <Text style={styles.rewardKicker}>DAILY CHECK-IN</Text><Text style={styles.rewardTitle}>连续签到</Text>
              <View style={styles.signDays}>{[1, 2, 3, 4, 5, 6, 7].map((day) => <View key={day} style={[styles.signDay, day === 1 && styles.signDayActive]}><Text style={styles.signDayText}>{day}</Text><Text style={styles.signGift}>{day === 7 ? '🎁' : '🪙'}</Text></View>)}</View>
              <ActionButton label={checkedIn ? '今天已签到' : '领取今日奖励'} icon="calendar" onPress={claimCheckIn} disabled={checkedIn} full />
            </LinearGradient>
            <LinearGradient colors={['#EEE8FF', '#FBF9FF']} style={styles.rewardCard}>
              <View style={styles.rewardIcon}><Text style={styles.rewardEmoji}>🎰</Text></View>
              <Text style={styles.rewardKicker}>EQUIPMENT DRAW</Text><Text style={styles.rewardTitle}>幸运装备箱</Text>
              <Text style={styles.rewardDescription}>每次消耗 1 张装备券。普通 64% · 稀有 28% · 史诗 8%，不会抽到宠物本体。</Text>
              <View style={styles.rarityPreview}><Text>🌿 普通</Text><Text>🎗️ 稀有</Text><Text>🌙 史诗</Text></View>
              <ActionButton label={`开启一次 · 剩余 ${tickets} 券`} icon="gift" onPress={drawEquipment} disabled={tickets < 1} full />
            </LinearGradient>
          </View>
        </Page>
      );
    }

    if (screen === 'adventure') {
      const power = combatPower(asBattlePet(pet));
      return (
        <Page eyebrow="ADVENTURE MAP" title="和它一起去冒险" subtitle="选择适合当前战力的地点，胜利后可获得金币与装备。失败不会丢失已有物品。">
          <Wallet coins={coins} tickets={tickets} energy={energy} />
          {!!rewardMessage && <View style={styles.rewardToast}><Ionicons name="map" size={18} color={colors.peachDark} /><Text style={styles.rewardToastText}>{rewardMessage}</Text></View>}
          <View style={styles.powerBanner}><View><Text style={styles.rewardKicker}>CURRENT TEAM</Text><Text style={styles.powerTitle}>{pet.name} · 战力 {power}</Text></View><Text style={styles.powerSpecies}>{speciesCatalog[pet.speciesId].icon} {pet.breedName ?? speciesCatalog[pet.speciesId].name}</Text></View>
          <View style={styles.stageList}>{adventureStages.map((stage, index) => {
            const ready = power >= stage.power;
            return <View key={stage.id} style={styles.stageCard}><View style={[styles.stageLine, index === adventureStages.length - 1 && styles.stageLineHidden]} /><View style={[styles.stageIcon, { backgroundColor: index === 0 ? colors.mintSoft : index === 1 ? colors.peachSoft : colors.lilacSoft }]}><Text style={styles.stageEmoji}>{stage.icon}</Text></View><View style={styles.stageCopy}><Text style={styles.stageName}>{stage.name}</Text><Text style={styles.stageMeta}>推荐战力 {stage.power} · 消耗 {stage.energy} 体力</Text><Text style={styles.stageReward}>{stage.reward}</Text></View><Pressable disabled={energy < stage.energy} onPress={() => explore(stage)} style={[styles.stageButton, ready && styles.stageButtonReady, energy < stage.energy && styles.buttonDisabled]}><Text style={[styles.stageButtonText, ready && styles.stageButtonTextReady]}>{ready ? '出发' : '挑战'}</Text></Pressable></View>;
          })}</View>
        </Page>
      );
    }

    if (screen === 'battle') {
      const ended = !!battle.winner;
      return (
        <Page eyebrow="TACTICAL BATTLE" title="训练场" subtitle="速度决定先手，防御负责减伤；管理能量，在攻击、蓄力和格挡之间做选择。">
          <View style={styles.turnPill}><View style={styles.liveDot} /><Text style={styles.turnText}>第 {battle.turn} 回合 · {ended ? (battle.winner === 'player' ? '胜利！' : '需要休息') : '轮到你选择行动'}</Text></View>
          <LinearGradient colors={['#ECE9FF', '#FFECE3']} style={styles.arena}>
            <Fighter name="影爪" defaultImage={defaultHusky} hp={battle.enemy.hp} max={battle.enemy.maxHp} energy={battle.enemy.energy} enemy />
            <View style={styles.vsBadge}><Text style={styles.vsText}>VS</Text></View>
            <Fighter name={pet.name} image={pet.image} defaultImage={defaultCat} hp={battle.player.hp} max={battle.player.maxHp} energy={battle.player.energy} />
          </LinearGradient>
          <View style={styles.battleConsole}>
            <View style={styles.logBubble}><Ionicons name="chatbubble-ellipses" size={18} color={colors.lilac} /><Text style={styles.battleLog}>{battle.log.join('\n')}</Text></View>
            {ended ? (
              <View style={styles.inlineButtons}>
                <ActionButton label="再来一局" icon="refresh" onPress={resetBattle} />
                <ActionButton label="返回宠物" icon="paw" onPress={() => setScreen('pet')} secondary />
              </View>
            ) : (
              <View style={styles.skillRow}>
                <Skill name="快速出击" meta="0 能量 · 获得 25" icon="paw" color="#FFF0E9" onPress={() => useBattleMove('quick')} />
                <Skill name="蓄能猛击" meta={`50 能量 · 当前 ${battle.player.energy}`} icon="flash" color="#F1EBFF" onPress={() => useBattleMove('power')} disabled={battle.player.energy < 50} />
                <Skill name="防守姿态" meta="伤害减半 · 获得 15" icon="shield" color="#E7F6F0" onPress={() => useBattleMove('guard')} />
              </View>
            )}
          </View>
        </Page>
      );
    }

    if (screen === 'social') {
      return (
        <Page eyebrow="NEARBY FRIENDS" title="宠友广场" subtitle="发现同城宠物日常。只显示大致距离，不公开精确位置。">
          <View style={styles.nearbyStrip}>
            <Text style={styles.nearbyTitle}>附近正在冒险</Text>
            <View style={styles.avatarRow}>
              {[defaultCat, defaultHusky, defaultCat, defaultHusky].map((source, index) => <Image key={index} source={source} style={[styles.nearbyAvatar, index > 0 && styles.avatarOverlap]} />)}
              <View style={[styles.nearbyAvatar, styles.moreAvatar]}><Text style={styles.moreAvatarText}>+18</Text></View>
            </View>
          </View>
          <View style={styles.feed}>
            <SocialPost name="哈士奇影爪" distance="1.2 km 内" image={defaultHusky} text="今天第一次赢下训练赛，奖励自己一个大鸡腿！" likes={28} />
            <SocialPost name="橘猫团子" distance="3 km 内" image={defaultCat} text="寻找森林系伙伴周末切磋，有没有宠友一起？" likes={16} />
          </View>
        </Page>
      );
    }

    return (
      <Page eyebrow="REAL PET · REAL HERO" title="今天，也和它一起升级吧" subtitle="拍下真实宠物，生成专属竞技卡；一起成长、对战，也认识附近的宠友。">
        <LinearGradient colors={['#FFF0E7', '#F2ECFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, wide && styles.row]}>
          <View style={styles.heroDecorOne} /><View style={styles.heroDecorTwo} />
          <View style={styles.heroCopy}>
            <View style={styles.helloPill}><Ionicons name="paw" size={15} color={colors.peachDark} /><Text style={styles.helloText}>你好，铲屎官</Text></View>
            <Text style={styles.heroTitle}>它不是角色，{`\n`}它就是主角。</Text>
            <Text style={styles.heroBody}>保留宠物真实长相，用精美描边和竞技卡面，让你熟悉的伙伴成为独一无二的英雄。</Text>
            <View style={styles.inlineButtons}>
              <ActionButton label="创建宠物卡" icon="camera" onPress={() => setScreen('create')} />
              <ActionButton label="看看我的宠物" icon="paw" onPress={() => setScreen('pet')} secondary />
            </View>
            <View style={styles.trustLine}><Ionicons name="checkmark-circle" color={colors.mint} size={17} /><Text style={styles.trustText}>真实照片 · 毛发级描边 · 自动纠正方向</Text></View>
          </View>
          <PetCard pet={pet} compact={!wide} />
        </LinearGradient>
        <View style={styles.sectionHeader}><View><Text style={styles.sectionKicker}>TODAY</Text><Text style={styles.sectionTitle}>今天想做什么？</Text></View><Text style={styles.sectionHint}>和宠物一起完成小目标</Text></View>
        <View style={styles.featureGrid}>
          <Feature icon="camera" title="生成白卡" body="拍下真实宠物，随机获得 3 个种族天赋" color="#FEE8DC" onPress={() => setScreen('create')} />
          <Feature icon="gift" title="签到抽装备" body="每日领取补给，装备不与宠物绑定" color="#F5EEFC" onPress={() => setScreen('rewards')} />
          <Feature icon="map" title="冒险寻宝" body="挑战不同地点，带回金币和装备" color="#E5F8F0" onPress={() => setScreen('adventure')} />
          <Feature icon="flash" title="策略对战" body="速度、能量、格挡与暴击共同决定胜负" color="#E7F1FF" onPress={() => { resetBattle(); setScreen('battle'); }} />
        </View>
      </Page>
    );
  }, [screen, pet, draftName, draftImage, draftSpecies, draftBreed, identification, isIdentifying, isProcessing, processingError, battle, coins, tickets, energy, checkedIn, inventory, rewardMessage, wide]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.shell}>
        <Header screen={screen} setScreen={setScreen} wide={wide} />
        <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll}>{page}</ScrollView>
        {!wide && <MobileNav screen={screen} setScreen={setScreen} />}
      </View>
    </SafeAreaView>
  );
}

function Header({ screen, setScreen, wide }: { screen: Screen; setScreen: (screen: Screen) => void; wide: boolean }) {
  const activeScreen = screen === 'create' ? 'home' : screen;
  return (
    <View style={styles.header}>
      <Pressable onPress={() => setScreen('home')} style={styles.brandWrap}><View style={styles.brandMark}><Ionicons name="paw" size={17} color={colors.white} /></View><Text style={styles.brand}>PET<Text style={styles.brandBolt}>⚡</Text>BATTLE</Text></Pressable>
      {wide && <View style={styles.desktopNav}>{Object.entries(navMeta).map(([key, item]) => <Pressable key={key} onPress={() => setScreen(key as Screen)} style={[styles.navItem, activeScreen === key && styles.navActive]}><Ionicons name={item.icon} size={17} color={activeScreen === key ? colors.peachDark : colors.muted} /><Text style={[styles.navText, activeScreen === key && styles.navTextActive]}>{item.label}</Text></Pressable>)}</View>}
      <Pressable style={styles.profilePill}><View style={styles.avatar}><Text>🐱</Text></View>{wide && <Text style={styles.profileText}>游客体验</Text>}</Pressable>
    </View>
  );
}

function MobileNav({ screen, setScreen }: { screen: Screen; setScreen: (screen: Screen) => void }) {
  const activeScreen = screen === 'create' ? 'home' : screen;
  return <View style={styles.mobileNav}>{Object.entries(navMeta).map(([key, item]) => {
    const active = activeScreen === key;
    return <Pressable key={key} onPress={() => setScreen(key as Screen)} style={[styles.mobileNavItem, active && styles.mobileNavActive]}><Ionicons name={active ? item.icon.replace('-outline', '') as keyof typeof Ionicons.glyphMap : item.icon} size={21} color={active ? colors.peachDark : colors.muted} />{active && <Text style={styles.mobileLabelActive}>{item.label}</Text>}</Pressable>;
  })}</View>;
}

function Page({ eyebrow, title, subtitle, children }: { eyebrow: string; title: string; subtitle: string; children: ReactNode }) {
  return <View style={styles.page}><View style={styles.pageIntro}><Text style={styles.pageEyebrow}>{eyebrow}</Text><Text style={styles.pageTitle}>{title}</Text><Text style={styles.pageSubtitle}>{subtitle}</Text></View>{children}</View>;
}

function PetCard({ pet, compact = false }: { pet: Pet; compact?: boolean }) {
  const stats = totalStats(asBattlePet(pet));
  const equipped = Object.values(pet.equipment).filter(Boolean);
  return (
    <View style={[styles.petCard, compact && styles.petCardCompact]}>
      <LinearGradient colors={['#FFFFFF', '#FBFAF7', '#F5F2ED']} style={styles.cardFrame}>
        <View style={styles.cardTop}><View><Text style={styles.rarity}>WHITE CARD</Text><Text style={styles.cardSeries}>ORIGINAL PARTNER · NO. 001</Text></View><Text style={styles.cardLevel}>{pet.level}</Text></View>
        <View style={styles.petPortrait}><Image source={pet.image ? { uri: pet.image } : defaultCat} style={styles.petImage} /><View style={styles.elementPill}><Text style={styles.elementText}>{speciesCatalog[pet.speciesId].icon} {pet.breedName ?? speciesCatalog[pet.speciesId].name}</Text></View></View>
        <View style={styles.cardInfo}><View><Text style={styles.petName}>{pet.name}</Text><Text style={styles.petSpecies}>{pet.species} · 三种族天赋</Text></View>{!!equipped.length && <View style={styles.cardGear}>{equipped.map((gear) => <Text key={gear!.id}>{gear!.icon}</Text>)}</View>}<View style={styles.cardStats}><Text style={styles.cardStat}>{stats.hp}<Text style={styles.cardStatLabel}> HP</Text></Text><View style={styles.statDivider} /><Text style={styles.cardStat}>{stats.attack}<Text style={styles.cardStatLabel}> ATK</Text></Text><View style={styles.statDivider} /><Text style={styles.cardStat}>{combatPower(asBattlePet(pet))}<Text style={styles.cardStatLabel}> PWR</Text></Text></View></View>
      </LinearGradient>
    </View>
  );
}

function ActionButton({ label, icon, onPress, secondary, disabled, full }: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void; secondary?: boolean; disabled?: boolean; full?: boolean }) {
  return <GalioButton disabled={disabled} onPress={onPress} color={secondary ? colors.white : colors.peach} style={StyleSheet.flatten([styles.button, secondary && styles.buttonSecondary, disabled && styles.buttonDisabled, full && styles.buttonFull])}><View style={styles.buttonContent}><Ionicons name={icon} size={17} color={secondary ? colors.ink : colors.white} /><Text style={[styles.buttonText, secondary && styles.buttonTextSecondary]}>{label}</Text></View></GalioButton>;
}

function Feature({ icon, title, body, color, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string; color: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.feature, { backgroundColor: color }, pressed && styles.pressed]}><View style={styles.featureIcon}><Ionicons name={icon} size={24} color={colors.ink} /></View><Text style={styles.featureTitle}>{title}</Text><Text style={styles.featureBody}>{body}</Text><View style={styles.featureGo}><Text style={styles.featureGoText}>进入</Text><Ionicons name="arrow-forward" size={15} color={colors.ink} /></View></Pressable>;
}

function Stat({ icon, value, label, color, iconColor }: { icon: keyof typeof Ionicons.glyphMap; value: number; label: string; color: string; iconColor: string }) {
  return <View style={[styles.stat, { backgroundColor: color }]}><Ionicons name={icon} size={20} color={iconColor} /><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

function ProcessStep({ number, title, body, color }: { number: string; title: string; body: string; color: string }) {
  return <View style={styles.processStep}><View style={[styles.processNumber, { backgroundColor: color }]}><Text style={styles.processNumberText}>{number}</Text></View><View style={styles.processCopy}><Text style={styles.processTitle}>{title}</Text><Text style={styles.processBody}>{body}</Text></View><Ionicons name="checkmark-circle" size={20} color={colors.mint} /></View>;
}

function Progress({ value, color }: { value: number; color: string }) {
  return <View style={styles.progress}><View style={[styles.progressFill, { width: `${Math.max(0, Math.min(100, value))}%`, backgroundColor: color }]} /></View>;
}

function Task({ title, reward, done }: { title: string; reward: string; done?: boolean }) {
  return <View style={styles.task}><View style={[styles.taskCheck, done && styles.taskCheckDone]}><Ionicons name={done ? 'checkmark' : 'ellipse-outline'} size={15} color={colors.white} /></View><Text style={styles.taskTitle}>{title}</Text><Text style={styles.taskReward}>{reward}</Text></View>;
}

function Wallet({ coins, tickets, energy }: { coins: number; tickets: number; energy: number }) {
  return <View style={styles.wallet}><View style={styles.walletItem}><Text>🪙</Text><Text style={styles.walletValue}>{coins}</Text><Text style={styles.walletLabel}>金币</Text></View><View style={styles.walletItem}><Text>🎟️</Text><Text style={styles.walletValue}>{tickets}</Text><Text style={styles.walletLabel}>装备券</Text></View><View style={styles.walletItem}><Text>⚡</Text><Text style={styles.walletValue}>{energy}/5</Text><Text style={styles.walletLabel}>体力</Text></View></View>;
}

function TraitCard({ trait, index }: { trait: Trait; index: number }) {
  const shades = [colors.peachSoft, colors.lilacSoft, colors.mintSoft];
  return <View style={[styles.traitCard, { backgroundColor: shades[index % shades.length] }]}><View style={styles.traitNumber}><Text style={styles.traitNumberText}>0{index + 1}</Text></View><View style={styles.traitCopy}><Text style={styles.traitName}>{trait.name}</Text><Text style={styles.traitDescription}>{trait.description}</Text></View></View>;
}

const slotName: Record<GearSlot, string> = { head: '头部', body: '身体', charm: '挂件' };

function GearSlotCard({ slot, gear }: { slot: GearSlot; gear?: Gear }) {
  return <View style={[styles.gearSlot, gear && styles.gearSlotFilled]}><Text style={styles.gearSlotIcon}>{gear?.icon ?? (slot === 'head' ? '🎩' : slot === 'body' ? '👕' : '✨')}</Text><Text style={styles.gearSlotName}>{gear?.name ?? slotName[slot]}</Text><Text style={styles.gearSlotMeta}>{gear ? gear.rarity : '空槽位'}</Text></View>;
}

function Fighter({ name, image, defaultImage, hp, max, energy, enemy }: { name: string; image?: string; defaultImage: ImageSourcePropType; hp: number; max: number; energy: number; enemy?: boolean }) {
  return <View style={styles.fighter}><Text style={[styles.fighterTag, enemy && styles.enemyTag]}>{enemy ? '对手' : '我的宠物'}</Text><View style={[styles.fighterOutline, enemy && styles.fighterOutlineEnemy]}><Image source={image ? { uri: image } : defaultImage} style={styles.fighterImage} /></View><Text style={styles.fighterName}>{name}</Text><Progress value={(hp / max) * 100} color={enemy ? colors.peach : colors.mint} /><Text style={styles.hp}>{hp} / {max} HP · ⚡ {energy}</Text></View>;
}

function Skill({ name, meta, icon, color, onPress, disabled }: { name: string; meta: string; icon: keyof typeof Ionicons.glyphMap; color: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.skill, { backgroundColor: color }, disabled && styles.buttonDisabled, pressed && styles.pressed]}><View style={styles.skillIcon}><Ionicons name={icon} size={26} color={colors.peachDark} /></View><View style={styles.skillCopy}><Text style={styles.skillName}>{name}</Text><Text style={styles.skillMeta}>{meta}</Text></View><Ionicons name="chevron-forward" size={20} color={colors.muted} /></Pressable>;
}

function SocialPost({ name, distance, image, text, likes }: { name: string; distance: string; image: ImageSourcePropType; text: string; likes: number }) {
  return <View style={styles.post}><View style={styles.postHeader}><Image source={image} style={styles.postAvatarImage} /><View style={styles.postIdentity}><Text style={styles.postName}>{name}</Text><Text style={styles.postDistance}><Ionicons name="location" size={11} /> {distance}</Text></View><Pressable><Ionicons name="ellipsis-horizontal" size={22} color={colors.muted} /></Pressable></View><Image source={image} style={styles.postPhotoImage} /><Text style={styles.postText}>{text}</Text><View style={styles.postActions}><Text style={styles.postAction}>♡ {likes}</Text><Text style={styles.postAction}>💬 6</Text><Text style={styles.postAction}>⚡ 切磋</Text></View></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream }, shell: { flex: 1 }, scroll: { paddingBottom: 104 }, row: { flexDirection: 'row' },
  header: { height: 70, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(255,249,242,0.98)', borderBottomWidth: 1, borderBottomColor: colors.line },
  brandWrap: { flexDirection: 'row', alignItems: 'center', gap: 9 }, brandMark: { width: 32, height: 32, borderRadius: 12, backgroundColor: colors.peach, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-7deg' }] }, brand: { fontSize: 19, fontWeight: '900', color: colors.ink, letterSpacing: 0.3 }, brandBolt: { color: colors.peachDark },
  desktopNav: { flexDirection: 'row', gap: 5 }, navItem: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 6 }, navActive: { backgroundColor: colors.peachSoft }, navText: { color: colors.muted, fontWeight: '700', fontSize: 13 }, navTextActive: { color: colors.peachDark },
  profilePill: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: colors.white, borderRadius: 22, padding: 4, paddingRight: 10, borderWidth: 1, borderColor: colors.line }, avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.yellow, alignItems: 'center', justifyContent: 'center' }, profileText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  page: { width: '100%', maxWidth: 1100, alignSelf: 'center', paddingHorizontal: 22, paddingTop: 34 }, pageIntro: { maxWidth: 760, marginBottom: 24 }, pageEyebrow: { color: colors.peachDark, fontSize: 11, letterSpacing: 1.7, fontWeight: '900', marginBottom: 8 }, pageTitle: { color: colors.ink, fontSize: 34, lineHeight: 42, fontWeight: '900' }, pageSubtitle: { color: colors.muted, fontSize: 15, lineHeight: 24, marginTop: 7 },
  hero: { borderRadius: 34, padding: 30, gap: 28, alignItems: 'center', marginBottom: 34, overflow: 'hidden' }, heroCopy: { flex: 1, minWidth: 270, zIndex: 2 }, heroDecorOne: { position: 'absolute', width: 190, height: 190, borderRadius: 95, backgroundColor: '#FFD9C8A0', top: -90, left: -35 }, heroDecorTwo: { position: 'absolute', width: 250, height: 250, borderRadius: 125, borderWidth: 35, borderColor: '#FFFFFF52', right: -80, bottom: -100 }, helloPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.white, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16 }, helloText: { color: colors.peachDark, fontSize: 12, fontWeight: '800' }, heroTitle: { fontSize: 44, lineHeight: 53, fontWeight: '900', color: colors.ink, marginTop: 18 }, heroBody: { fontSize: 16, lineHeight: 26, color: colors.muted, marginTop: 11, maxWidth: 520 }, trustLine: { flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 18 }, trustText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  inlineButtons: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginTop: 17 }, button: { minWidth: 148, height: 48, borderRadius: 16, margin: 0 }, buttonSecondary: { borderWidth: 1, borderColor: colors.line }, buttonDisabled: { opacity: 0.38 }, buttonFull: { width: '100%', marginTop: 22 }, buttonContent: { flexDirection: 'row', alignItems: 'center', gap: 7 }, buttonText: { color: colors.white, fontSize: 14, fontWeight: '900' }, buttonTextSecondary: { color: colors.ink }, pressed: { opacity: 0.76, transform: [{ scale: 0.98 }] },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 15 }, sectionKicker: { color: colors.peachDark, fontWeight: '900', fontSize: 11, letterSpacing: 1.4 }, sectionTitle: { color: colors.ink, fontSize: 20, fontWeight: '900', marginTop: 4 }, sectionHint: { color: colors.muted, fontSize: 12 }, featureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 }, feature: { flexGrow: 1, flexBasis: 220, borderRadius: 25, padding: 20, minHeight: 190 }, featureIcon: { width: 46, height: 46, borderRadius: 16, backgroundColor: '#FFFFFFA8', alignItems: 'center', justifyContent: 'center' }, featureTitle: { color: colors.ink, fontWeight: '900', fontSize: 19, marginTop: 16 }, featureBody: { color: colors.muted, lineHeight: 21, marginTop: 5 }, featureGo: { marginTop: 'auto', flexDirection: 'row', gap: 5, alignItems: 'center' }, featureGoText: { color: colors.ink, fontSize: 12, fontWeight: '900' },
  petCard: { width: 310, borderRadius: 30, padding: 5, backgroundColor: '#E7E1D8', shadowColor: '#6D6064', shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, alignSelf: 'center', zIndex: 3 }, petCardCompact: { width: 284 }, cardFrame: { borderRadius: 25, padding: 15, overflow: 'hidden', borderWidth: 1, borderColor: '#FFFFFF' }, cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 3, marginBottom: 10 }, rarity: { color: '#9B8D82', fontSize: 12, fontWeight: '900', letterSpacing: 1.3 }, cardSeries: { color: '#AAA0A4', fontSize: 7, fontWeight: '800', letterSpacing: 1.2, marginTop: 2 }, cardLevel: { color: colors.ink, fontSize: 26, fontWeight: '900' }, petPortrait: { height: 250, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: '#E6DED7', backgroundColor: '#F4F1ED' }, petImage: { width: '100%', height: '100%', resizeMode: 'cover' }, elementPill: { position: 'absolute', right: 9, bottom: 9, backgroundColor: '#FFFFFFE8', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 13, borderWidth: 1, borderColor: '#E3D8CE', flexDirection: 'row', gap: 4, alignItems: 'center' }, elementText: { color: colors.ink, fontSize: 11, fontWeight: '900' }, cardInfo: { marginTop: 13 }, petName: { fontSize: 25, color: colors.ink, fontWeight: '900' }, petSpecies: { color: colors.muted, fontSize: 10, marginTop: 2 }, cardGear: { position: 'absolute', right: 0, top: 4, flexDirection: 'row', gap: 3 }, cardStats: { flexDirection: 'row', alignItems: 'center', marginTop: 13, paddingTop: 11, borderTopWidth: 1, borderTopColor: colors.line }, cardStat: { color: colors.ink, fontWeight: '900', fontSize: 15, marginRight: 10 }, cardStatLabel: { color: colors.muted, fontSize: 7 }, statDivider: { width: 1, height: 17, backgroundColor: colors.line, marginRight: 10 },
  twoColumn: { gap: 24, alignItems: 'flex-start' }, upload: { flex: 1, width: '100%', minHeight: 490, borderWidth: 2, borderStyle: 'dashed', borderColor: '#E1BDB3', borderRadius: 28, backgroundColor: '#FFF1EA', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, uploadImage: { width: '100%', height: 490, resizeMode: 'cover' }, uploadEmpty: { alignItems: 'center', padding: 30 }, uploadIcon: { width: 70, height: 70, borderRadius: 25, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-5deg' }] }, uploadTitle: { fontSize: 21, fontWeight: '900', color: colors.ink, marginTop: 18 }, uploadHint: { color: colors.muted, marginTop: 7, textAlign: 'center' }, filePill: { backgroundColor: '#FFFFFFA5', borderRadius: 13, paddingHorizontal: 10, paddingVertical: 5, marginTop: 16 }, filePillText: { fontSize: 10, color: colors.muted, fontWeight: '800' }, previewBadge: { position: 'absolute', bottom: 22, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 13, paddingVertical: 8, backgroundColor: '#201B2DDE', borderRadius: 16 }, previewBadgeText: { color: '#FFE6A1', fontSize: 11, fontWeight: '900' }, panel: { flex: 1, width: '100%', backgroundColor: colors.white, borderRadius: 28, padding: 25, borderWidth: 1, borderColor: colors.line }, panelKicker: { color: colors.peachDark, fontSize: 11, fontWeight: '900', letterSpacing: 1.2, marginBottom: 15 }, label: { color: colors.ink, fontWeight: '800', marginBottom: 8 }, labelSpaced: { marginTop: 18 }, input: { height: 52, backgroundColor: '#FCF9FB', borderColor: colors.line, borderWidth: 1, borderRadius: 15, paddingHorizontal: 15, color: colors.ink, fontSize: 16 }, aiPanel: { marginTop: 16, padding: 14, borderRadius: 18, backgroundColor: '#F8F5FF', borderWidth: 1, borderColor: '#E4DCF9' }, aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 }, aiIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' }, aiHeaderCopy: { flex: 1 }, aiTitle: { color: colors.ink, fontSize: 12, fontWeight: '900' }, aiSubtitle: { color: colors.muted, fontSize: 9, lineHeight: 14, marginTop: 2 }, aiPulse: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.lilac }, aiSpeciesLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 11, borderTopWidth: 1, borderTopColor: '#E4DCF9' }, aiSpeciesText: { color: colors.ink, fontSize: 11, fontWeight: '800' }, aiConfidence: { color: colors.lilac, fontSize: 11, fontWeight: '900' }, candidateList: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 9 }, candidateCard: { flexGrow: 1, flexBasis: 105, minHeight: 88, padding: 9, borderRadius: 13, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line }, candidateCardActive: { borderColor: colors.lilac, backgroundColor: '#F0EBFF' }, candidateTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 }, candidateName: { color: colors.ink, fontSize: 11, fontWeight: '900' }, candidatePercent: { color: colors.lilac, fontSize: 10, fontWeight: '900' }, candidateKind: { color: colors.peachDark, fontSize: 8, fontWeight: '800', marginTop: 3 }, candidateReason: { color: colors.muted, fontSize: 8, lineHeight: 12, marginTop: 4 }, aiDisclaimer: { color: colors.muted, fontSize: 8, lineHeight: 12, marginTop: 9 }, speciesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, speciesChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#F8F5F7', borderWidth: 1, borderColor: colors.line }, speciesChipActive: { backgroundColor: colors.peachSoft, borderColor: colors.peach }, speciesEmoji: { fontSize: 15 }, speciesText: { color: colors.muted, fontSize: 11, fontWeight: '700' }, speciesTextActive: { color: colors.peachDark, fontWeight: '900' }, breedGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, breedChip: { flexGrow: 1, flexBasis: 105, minHeight: 50, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#F8F5F7', borderWidth: 1, borderColor: colors.line }, breedChipActive: { backgroundColor: colors.lilacSoft, borderColor: colors.lilac }, breedName: { color: colors.ink, fontSize: 11, fontWeight: '800' }, breedNameActive: { color: colors.lilac, fontWeight: '900' }, breedDescription: { color: colors.muted, fontSize: 8, marginTop: 3 }, breedNote: { color: colors.muted, fontSize: 9, lineHeight: 15, marginTop: 8 }, processList: { marginTop: 24, gap: 9 }, processStep: { flexDirection: 'row', gap: 11, alignItems: 'center', paddingVertical: 8 }, processNumber: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, processNumberText: { color: colors.ink, fontWeight: '900', fontSize: 10 }, processCopy: { flex: 1 }, processTitle: { color: colors.ink, fontWeight: '900', fontSize: 13 }, processBody: { color: colors.muted, fontSize: 11, marginTop: 2 }, errorText: { color: '#C83C3C', fontSize: 12, fontWeight: '700', marginTop: 12 }, privacy: { color: colors.muted, fontSize: 11, lineHeight: 18, marginTop: 15 },
  petDashboard: { flex: 1, width: '100%' }, levelLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 }, levelBadge: { width: 54, height: 54, borderRadius: 19, backgroundColor: colors.lilacSoft, alignItems: 'center', justifyContent: 'center' }, levelBadgeText: { color: colors.lilac, fontWeight: '900' }, progress: { height: 9, borderRadius: 9, backgroundColor: '#EDE8EF', overflow: 'hidden' }, progressFill: { height: '100%', borderRadius: 9 }, statsGrid: { flexDirection: 'row', gap: 10, marginVertical: 20, flexWrap: 'wrap' }, stat: { flexGrow: 1, flexBasis: 95, minHeight: 105, borderRadius: 20, padding: 13, justifyContent: 'center' }, statValue: { fontSize: 21, fontWeight: '900', color: colors.ink, marginTop: 7 }, statLabel: { fontSize: 10, color: colors.muted, marginTop: 1 }, subsectionTitle: { color: colors.ink, fontSize: 14, fontWeight: '900', marginTop: 15, marginBottom: 9 }, traitList: { gap: 7 }, traitCard: { minHeight: 58, borderRadius: 17, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 }, traitNumber: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#FFFFFFA8', alignItems: 'center', justifyContent: 'center' }, traitNumberText: { color: colors.ink, fontSize: 9, fontWeight: '900' }, traitCopy: { flex: 1 }, traitName: { color: colors.ink, fontSize: 12, fontWeight: '900' }, traitDescription: { color: colors.muted, fontSize: 10, marginTop: 2 }, gearHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, textLink: { color: colors.peachDark, fontSize: 11, fontWeight: '900', marginTop: 9 }, gearSlots: { flexDirection: 'row', gap: 8 }, gearSlot: { flex: 1, minHeight: 90, borderRadius: 17, borderWidth: 1, borderStyle: 'dashed', borderColor: '#D8CDD4', backgroundColor: '#FBF9FA', alignItems: 'center', justifyContent: 'center', padding: 8 }, gearSlotFilled: { borderStyle: 'solid', borderColor: '#E5B9AD', backgroundColor: colors.peachSoft }, gearSlotIcon: { fontSize: 22 }, gearSlotName: { color: colors.ink, fontSize: 10, fontWeight: '900', marginTop: 5, textAlign: 'center' }, gearSlotMeta: { color: colors.muted, fontSize: 8, marginTop: 2 }, inventoryList: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, inventoryItem: { flexGrow: 1, flexBasis: 145, minHeight: 57, backgroundColor: colors.white, borderRadius: 15, borderWidth: 1, borderColor: colors.line, padding: 9, flexDirection: 'row', alignItems: 'center', gap: 8 }, inventoryIcon: { fontSize: 22 }, inventoryCopy: { flex: 1 }, inventoryName: { color: colors.ink, fontSize: 11, fontWeight: '900' }, inventoryMeta: { color: colors.muted, fontSize: 9, marginTop: 2 }, todayCard: { borderRadius: 25, padding: 20 }, todayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, todayKicker: { color: '#EAE2FF', fontSize: 10, fontWeight: '900', letterSpacing: 1.4 }, todayDate: { backgroundColor: '#FFFFFF24', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 5 }, todayDateText: { color: colors.white, fontSize: 9, fontWeight: '900' }, todayTitle: { color: colors.white, fontSize: 19, fontWeight: '900', marginTop: 9, marginBottom: 8 }, task: { minHeight: 48, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#FFFFFF24', gap: 10 }, taskCheck: { width: 22, height: 22, borderRadius: 8, borderWidth: 1, borderColor: '#FFFFFF99', alignItems: 'center', justifyContent: 'center' }, taskCheckDone: { backgroundColor: colors.mint, borderColor: colors.mint }, taskTitle: { flex: 1, color: colors.white, fontWeight: '700', fontSize: 12 }, taskReward: { color: '#F4DFFF', fontSize: 10, fontWeight: '800' },
  wallet: { alignSelf: 'flex-end', flexDirection: 'row', backgroundColor: colors.white, borderRadius: 18, padding: 7, marginBottom: 16, borderWidth: 1, borderColor: colors.line }, walletItem: { minWidth: 82, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 4 }, walletValue: { color: colors.ink, fontSize: 12, fontWeight: '900' }, walletLabel: { color: colors.muted, fontSize: 8 }, rewardToast: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: '#FFF4D8', borderRadius: 16, padding: 13, marginBottom: 15 }, rewardToastText: { flex: 1, color: colors.ink, fontSize: 12, fontWeight: '800' }, rewardGrid: { gap: 16 }, rewardCard: { flex: 1, minHeight: 370, borderRadius: 28, padding: 23, overflow: 'hidden' }, rewardIcon: { width: 62, height: 62, borderRadius: 21, backgroundColor: '#FFFFFFA8', alignItems: 'center', justifyContent: 'center' }, rewardEmoji: { fontSize: 31 }, rewardKicker: { color: colors.peachDark, fontSize: 9, fontWeight: '900', letterSpacing: 1.3, marginTop: 18 }, rewardTitle: { color: colors.ink, fontSize: 24, fontWeight: '900', marginTop: 3 }, rewardDescription: { color: colors.muted, fontSize: 12, lineHeight: 20, marginTop: 12 }, signDays: { flexDirection: 'row', gap: 5, marginTop: 23 }, signDay: { flex: 1, minHeight: 65, borderRadius: 13, backgroundColor: '#FFFFFF88', alignItems: 'center', justifyContent: 'center' }, signDayActive: { backgroundColor: colors.peach }, signDayText: { color: colors.ink, fontSize: 9, fontWeight: '900' }, signGift: { fontSize: 16, marginTop: 4 }, rarityPreview: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#FFFFFF80', borderRadius: 15, padding: 14, marginTop: 26 }, powerBanner: { backgroundColor: colors.white, borderRadius: 22, padding: 18, marginBottom: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.line }, powerTitle: { color: colors.ink, fontSize: 20, fontWeight: '900', marginTop: 3 }, powerSpecies: { backgroundColor: colors.peachSoft, color: colors.peachDark, fontSize: 11, fontWeight: '900', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14 }, stageList: { backgroundColor: colors.white, borderRadius: 26, padding: 19, borderWidth: 1, borderColor: colors.line }, stageCard: { minHeight: 112, flexDirection: 'row', alignItems: 'center', gap: 13, position: 'relative' }, stageLine: { position: 'absolute', width: 2, backgroundColor: colors.line, left: 27, top: 78, bottom: -34 }, stageLineHidden: { display: 'none' }, stageIcon: { width: 56, height: 56, borderRadius: 19, alignItems: 'center', justifyContent: 'center', zIndex: 2 }, stageEmoji: { fontSize: 26 }, stageCopy: { flex: 1 }, stageName: { color: colors.ink, fontSize: 16, fontWeight: '900' }, stageMeta: { color: colors.muted, fontSize: 10, marginTop: 4 }, stageReward: { color: colors.peachDark, fontSize: 10, fontWeight: '800', marginTop: 4 }, stageButton: { minWidth: 58, backgroundColor: '#F1EDF0', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, alignItems: 'center' }, stageButtonReady: { backgroundColor: colors.peach }, stageButtonText: { color: colors.muted, fontSize: 11, fontWeight: '900' }, stageButtonTextReady: { color: colors.white },
  turnPill: { alignSelf: 'center', flexDirection: 'row', gap: 7, alignItems: 'center', backgroundColor: colors.white, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, marginBottom: -15, zIndex: 3, borderWidth: 1, borderColor: colors.line }, liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.mint }, turnText: { color: colors.ink, fontSize: 11, fontWeight: '900' }, arena: { minHeight: 390, borderRadius: 30, padding: 28, paddingTop: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', overflow: 'hidden' }, fighter: { width: '38%', maxWidth: 280, alignItems: 'center' }, fighterTag: { color: '#3B8B6C', backgroundColor: colors.mintSoft, borderRadius: 11, paddingHorizontal: 9, paddingVertical: 4, fontSize: 9, fontWeight: '900' }, enemyTag: { color: colors.peachDark, backgroundColor: colors.peachSoft }, fighterOutline: { width: 155, height: 155, borderRadius: 50, padding: 5, marginVertical: 14, backgroundColor: '#F0C959', shadowColor: '#F0B733', shadowOpacity: 0.55, shadowRadius: 16, transform: [{ rotate: '2deg' }] }, fighterOutlineEnemy: { backgroundColor: '#91B8EF', shadowColor: '#568CD7', transform: [{ rotate: '-2deg' }] }, fighterImage: { width: '100%', height: '100%', borderRadius: 45, resizeMode: 'cover', borderWidth: 3, borderColor: colors.white }, fighterName: { fontSize: 20, fontWeight: '900', color: colors.ink, marginBottom: 10 }, hp: { color: colors.muted, fontSize: 10, fontWeight: '800', marginTop: 6 }, vsBadge: { width: 58, height: 58, borderRadius: 22, backgroundColor: colors.peach, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-8deg' }], shadowColor: colors.peachDark, shadowOpacity: 0.25, shadowRadius: 10 }, vsText: { color: colors.white, fontWeight: '900', fontSize: 20 }, battleConsole: { backgroundColor: colors.white, borderRadius: 25, padding: 20, marginTop: 15, borderWidth: 1, borderColor: colors.line }, logBubble: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingBottom: 16 }, battleLog: { flex: 1, color: colors.ink, fontWeight: '800', fontSize: 12, lineHeight: 18, textAlign: 'center' }, skillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 11 }, skill: { flexGrow: 1, flexBasis: 200, minHeight: 80, borderRadius: 19, flexDirection: 'row', alignItems: 'center', padding: 13, gap: 11 }, skillIcon: { width: 46, height: 46, borderRadius: 16, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' }, skillCopy: { flex: 1 }, skillName: { color: colors.ink, fontWeight: '900' }, skillMeta: { color: colors.muted, fontSize: 10, marginTop: 3 },
  nearbyStrip: { maxWidth: 680, width: '100%', alignSelf: 'center', backgroundColor: colors.peachSoft, borderRadius: 23, padding: 18, marginBottom: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, nearbyTitle: { color: colors.ink, fontWeight: '900' }, avatarRow: { flexDirection: 'row', alignItems: 'center' }, nearbyAvatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: colors.white }, avatarOverlap: { marginLeft: -9 }, moreAvatar: { marginLeft: -9, backgroundColor: colors.peach, alignItems: 'center', justifyContent: 'center' }, moreAvatarText: { color: colors.white, fontSize: 9, fontWeight: '900' }, feed: { gap: 18, maxWidth: 680, width: '100%', alignSelf: 'center' }, post: { backgroundColor: colors.white, borderRadius: 25, padding: 16, borderWidth: 1, borderColor: colors.line }, postHeader: { flexDirection: 'row', gap: 10, alignItems: 'center' }, postAvatarImage: { width: 43, height: 43, borderRadius: 16, resizeMode: 'cover' }, postIdentity: { flex: 1 }, postName: { color: colors.ink, fontWeight: '900' }, postDistance: { color: colors.muted, fontSize: 10, marginTop: 2 }, postPhotoImage: { width: '100%', height: 330, borderRadius: 19, resizeMode: 'cover', marginTop: 13, backgroundColor: '#171319' }, postText: { color: colors.ink, lineHeight: 21, marginTop: 13 }, postActions: { flexDirection: 'row', gap: 23, marginTop: 14, paddingTop: 13, borderTopWidth: 1, borderTopColor: colors.line }, postAction: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  mobileNav: { position: 'absolute', bottom: 11, left: 16, right: 16, height: 62, backgroundColor: colors.white, borderRadius: 22, flexDirection: 'row', padding: 7, shadowColor: '#5F4C5B', shadowOpacity: 0.16, shadowRadius: 16, shadowOffset: { width: 0, height: 5 }, borderWidth: 1, borderColor: colors.line }, mobileNavItem: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 16 }, mobileNavActive: { backgroundColor: colors.peachSoft, flexDirection: 'row', gap: 6 }, mobileLabelActive: { color: colors.peachDark, fontSize: 11, fontWeight: '900' },
});
