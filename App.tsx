import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Image,
  ImageBackground,
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
import { CollectiblePetCard } from './src/CollectiblePetCard';
import { cardRating, deriveCardAttributes, type CardElement, type CardRarity, type CardState, type CollectibleCardData } from './src/cardSystem';
import {
  assetUrl,
  authenticate,
  claimCloudCheckIn,
  drawCloudEquipment,
  fetchGameState,
  logout as logoutApi,
  restoreSession,
  runCloudAdventure,
  saveCloudPet,
  type AuthUser,
  type GameState,
} from './src/api';

const defaultCat = require('./assets/default-real-cat.png');
const defaultHusky = require('./assets/default-real-husky.png');
const tuanziCutout = require('./assets/tuanzi-cutout-v1.png');
const guildTable = require('./assets/guild-table-v1.png');

type Screen = 'home' | 'create' | 'pet' | 'rewards' | 'adventure' | 'battle' | 'social' | 'account';
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

function elementId(element: Element): CardElement {
  return element === '烈焰' ? 'flame' : element === '潮汐' ? 'tide' : 'grove';
}

function cardDataFor(pet: Pet, rarity: CardRarity): CollectibleCardData {
  const battlePet = asBattlePet(pet);
  const stats = totalStats(battlePet);
  return {
    id: `${pet.name}-${rarity}`,
    serial: ({ common: 'B-021', rare: 'R-014', epic: 'E-011', legendary: 'L-008', mythic: 'M-001' } as const)[rarity],
    name: pet.name,
    species: pet.breedName ?? pet.species,
    art: pet.image ? { uri: pet.image } : tuanziCutout,
    rarity,
    rating: cardRating(combatPower(battlePet)),
    level: pet.level,
    role: '迅袭先锋',
    element: elementId(pet.element),
    evolution: pet.level >= 12 ? '显化阶段' : pet.level >= 6 ? '共鸣阶段' : '初醒阶段',
    faction: '晨爪旅团',
    archetype: '疾攻流派',
    bond: '陪伴羁绊',
    attributes: deriveCardAttributes(stats, pet.traits.length),
    energy: Math.max(1, Math.min(9, Math.ceil(pet.level / 3))),
    health: stats.hp,
    abilities: [{ name: pet.traits[0]?.name ?? '陪伴本能', description: pet.traits[0]?.description ?? '与主人并肩时获得额外勇气。' }],
  };
}

const navMeta: Record<Exclude<Screen, 'create' | 'account'>, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
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
  const [selectedCardRarity, setSelectedCardRarity] = useState<CardRarity>('legendary');
  const [battleCardRarity, setBattleCardRarity] = useState<CardRarity>('legendary');
  const [cardPreviewState, setCardPreviewState] = useState<CardState>('idle');
  const [battle, setBattle] = useState<BattleState>(() => createBattle(asBattlePet(initialPet), enemyPet));
  const [coins, setCoins] = useState(240);
  const [tickets, setTickets] = useState(3);
  const [energy, setEnergy] = useState(5);
  const [checkedIn, setCheckedIn] = useState(false);
  const [inventory, setInventory] = useState<Gear[]>([]);
  const [rewardMessage, setRewardMessage] = useState('');
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authDisplayName, setAuthDisplayName] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [cloudMessage, setCloudMessage] = useState('');
  const [ownedCards, setOwnedCards] = useState<GameState['cards']>([]);
  const scrollRef = useRef<ScrollView>(null);
  const { width } = useWindowDimensions();
  const wide = width >= 840;

  const applyCloudState = (state: GameState) => {
    setCoins(state.player.coins);
    setTickets(state.player.tickets);
    setEnergy(state.player.energy);
    setCheckedIn(state.player.checkedIn);
    setInventory(state.inventory);
    setOwnedCards(state.cards);
    if (state.pet) {
      const cloudPet: Pet = { ...state.pet, equipment: state.pet.equipment, image: assetUrl(state.pet.image) };
      setPet(cloudPet);
      setBattle(createBattle(asBattlePet(cloudPet), enemyPet));
    }
  };

  useEffect(() => {
    let active = true;
    void (async () => {
      const user = await restoreSession();
      if (!active) return;
      setAuthUser(user);
      if (user) {
        try {
          const state = await fetchGameState();
          if (active) applyCloudState(state);
        } catch (error) {
          if (active) setCloudMessage(error instanceof Error ? error.message : '云存档读取失败');
        }
      }
      if (active) setAuthLoading(false);
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    setRewardMessage('');
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [screen]);

  const submitAuth = async () => {
    if (authSubmitting) return;
    setAuthSubmitting(true);
    setAuthError('');
    try {
      const user = await authenticate(authMode, authUsername.trim(), authPassword, authDisplayName.trim());
      setAuthUser(user);
      const state = await fetchGameState();
      applyCloudState(state);
      setCloudMessage(authMode === 'register' ? '账号创建成功，云存档已开启。' : '登录成功，已读取云存档。');
      setAuthPassword('');
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : '登录失败，请稍后重试');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const signOut = async () => {
    await logoutApi();
    setAuthUser(null);
    setOwnedCards([]);
    setCloudMessage('已安全退出，当前页面会保留本机展示数据。');
  };

  const syncPet = async (next: Pet) => {
    if (!authUser) return;
    try {
      const result = await saveCloudPet(next);
      setOwnedCards(result.cards);
      if (result.pet.image) setPet((current) => ({ ...current, image: assetUrl(result.pet.image) }));
      setCloudMessage('宠物与初始白卡已保存到云端。');
    } catch (error) {
      setCloudMessage(error instanceof Error ? `云存档失败：${error.message}` : '云存档失败');
    }
  };

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
      outlinedImage = result.cutout ?? result.image;
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
    await syncPet(next);
    setScreen('pet');
    setIsProcessing(false);
  };

  const resetBattle = () => {
    setBattle(createBattle(asBattlePet(pet), enemyPet));
  };

  const useBattleMove = (move: BattleMove) => {
    setBattle((current) => playRound(current, move, chooseEnemyMove(current)));
  };

  const claimCheckIn = async () => {
    if (checkedIn) return;
    if (authUser) {
      try {
        const result = await claimCloudCheckIn();
        setCheckedIn(result.player.checkedIn);
        setCoins(result.player.coins);
        setTickets(result.player.tickets);
        setEnergy(result.player.energy);
        setRewardMessage(result.message);
      } catch (error) {
        setRewardMessage(error instanceof Error ? error.message : '签到失败，请重试');
      }
      return;
    }
    setCheckedIn(true);
    setCoins((value) => value + 120);
    setTickets((value) => value + 1);
    setRewardMessage('签到成功：金币 ×120、装备券 ×1');
  };

  const drawEquipment = async () => {
    if (tickets < 1) { setRewardMessage('装备券不足，冒险和签到可以获得。'); return; }
    if (authUser) {
      try {
        const result = await drawCloudEquipment();
        setTickets(result.player.tickets);
        setCoins(result.player.coins);
        setEnergy(result.player.energy);
        setInventory((items) => [result.gear, ...items]);
        setRewardMessage(`获得${result.gear.rarity}装备：${result.gear.icon} ${result.gear.name}`);
      } catch (error) {
        setRewardMessage(error instanceof Error ? error.message : '抽取失败，请重试');
      }
      return;
    }
    const gear = rollGear();
    setTickets((value) => value - 1);
    setInventory((items) => [gear, ...items]);
    setRewardMessage(`获得${gear.rarity}装备：${gear.icon} ${gear.name}`);
  };

  const equip = (gear: Gear) => {
    const next = { ...pet, equipment: { ...pet.equipment, [gear.slot]: gear } };
    setPet(next);
    void syncPet(next);
    setRewardMessage(`${gear.icon} ${gear.name} 已装备`);
  };

  const explore = async (stage: (typeof adventureStages)[number]) => {
    if (energy < stage.energy) { setRewardMessage('冒险体力不足，明日会恢复。'); return; }
    if (authUser) {
      try {
        const result = await runCloudAdventure(stage.id);
        setEnergy(result.player.energy);
        setCoins(result.player.coins);
        if (result.gear) setInventory((items) => [result.gear!, ...items]);
        setRewardMessage(result.won && result.gear ? `冒险成功：金币 ×${result.coins}，获得 ${result.gear.icon} ${result.gear.name}` : '这次探索失败了，但没有损失装备。提升战力后再来吧！');
      } catch (error) {
        setRewardMessage(error instanceof Error ? error.message : '冒险暂时无法开始');
      }
      return;
    }
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
    if (screen === 'account') {
      return (
        <Page eyebrow="PLAYER ID" title={authUser ? `欢迎回来，${authUser.displayName}` : '登录后，宠物会一直在'} subtitle="账号用于保存宠物卡、装备和每日奖励；手机与电脑登录同一账号即可继续。">
          <View style={[styles.accountLayout, wide && styles.row]}>
            <View style={styles.accountIdentity}>
              <View style={styles.accountEmblem}><Ionicons name="paw" size={38} color={colors.white} /></View>
              <Text style={styles.accountKicker}>{authUser ? 'CLOUD ARCHIVE ACTIVE' : 'PET BATTLE PASSPORT'}</Text>
              <Text style={styles.accountTitle}>{authUser ? authUser.displayName : '建立你的战宠档案'}</Text>
              <Text style={styles.accountBody}>{authUser ? `@${authUser.username} · 已收藏 ${ownedCards.length} 张战宠卡` : '无需手机号，设置用户名和密码即可开始。以后可以再增加微信或 Apple 登录。'}</Text>
              <View style={styles.cloudStatus}><Ionicons name={authUser ? 'cloud-done' : 'cloud-offline-outline'} size={19} color={authUser ? '#2F8B68' : colors.muted} /><Text style={styles.cloudStatusText}>{authUser ? '云存档已连接' : '当前为游客模式，只保留本次浏览数据'}</Text></View>
            </View>
            <View style={styles.authPanel}>
              {authLoading ? (
                <View style={styles.authLoading}><Ionicons name="hourglass-outline" size={25} color={colors.peachDark} /><Text style={styles.authLoadingText}>正在检查登录状态…</Text></View>
              ) : authUser ? (
                <>
                  <Text style={styles.panelKicker}>账号与存档</Text>
                  <View style={styles.accountRow}><Text style={styles.accountRowLabel}>玩家名</Text><Text style={styles.accountRowValue}>{authUser.displayName}</Text></View>
                  <View style={styles.accountRow}><Text style={styles.accountRowLabel}>用户名</Text><Text style={styles.accountRowValue}>@{authUser.username}</Text></View>
                  <View style={styles.accountRow}><Text style={styles.accountRowLabel}>云端收藏</Text><Text style={styles.accountRowValue}>{ownedCards.length} 张</Text></View>
                  {!!cloudMessage && <Text style={styles.cloudMessage}>{cloudMessage}</Text>}
                  <ActionButton label="退出当前账号" icon="log-out-outline" onPress={signOut} secondary full />
                </>
              ) : (
                <>
                  <View style={styles.authTabs}>
                    <Pressable onPress={() => { setAuthMode('login'); setAuthError(''); }} style={[styles.authTab, authMode === 'login' && styles.authTabActive]}><Text style={[styles.authTabText, authMode === 'login' && styles.authTabTextActive]}>登录</Text></Pressable>
                    <Pressable onPress={() => { setAuthMode('register'); setAuthError(''); }} style={[styles.authTab, authMode === 'register' && styles.authTabActive]}><Text style={[styles.authTabText, authMode === 'register' && styles.authTabTextActive]}>创建账号</Text></Pressable>
                  </View>
                  {authMode === 'register' && <><Text style={styles.label}>玩家昵称</Text><TextInput value={authDisplayName} onChangeText={setAuthDisplayName} placeholder="例如：团子的家长" placeholderTextColor="#B2A9B5" style={styles.input} /></>}
                  <Text style={[styles.label, authMode === 'register' && styles.labelSpaced]}>用户名</Text>
                  <TextInput autoCapitalize="none" value={authUsername} onChangeText={setAuthUsername} placeholder="3–24 位中文、字母或数字" placeholderTextColor="#B2A9B5" style={styles.input} />
                  <Text style={[styles.label, styles.labelSpaced]}>密码</Text>
                  <TextInput secureTextEntry value={authPassword} onChangeText={setAuthPassword} placeholder="至少 8 位" placeholderTextColor="#B2A9B5" style={styles.input} onSubmitEditing={submitAuth} />
                  {!!authError && <Text style={styles.errorText}>{authError}</Text>}
                  <View style={styles.authAction}><ActionButton label={authSubmitting ? '请稍候…' : authMode === 'login' ? '登录并读取存档' : '创建账号并开启云存档'} icon={authMode === 'login' ? 'log-in-outline' : 'person-add-outline'} onPress={submitAuth} disabled={authSubmitting || !authUsername.trim() || authPassword.length < 8} full /></View>
                  <Text style={styles.authFinePrint}>密码只会以不可逆加密形式保存。附近宠友功能不会公开你的精确位置。</Text>
                </>
              )}
            </View>
          </View>
        </Page>
      );
    }

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
              <Text style={styles.privacy}>照片会发送给 AI 服务完成品种候选识别，并在本服务中完成主体描边；登录后，处理好的透明立绘与宠物资料会加密传输并保存到你的云存档。</Text>
            </View>
          </View>
        </Page>
      );
    }

    if (screen === 'pet') {
      const petStats = totalStats(asBattlePet(pet));
      const power = combatPower(asBattlePet(pet));
      const selectedCard = cardDataFor(pet, selectedCardRarity);
      return (
        <ImageBackground source={guildTable} resizeMode="cover" style={styles.archiveBackdrop}>
        <View style={styles.archiveLedger}>
        <Page eyebrow="WARM PAW BESTIARY" title="暖爪图鉴" subtitle="翻开皮革卡册，查看同一伙伴在不同工艺和稀有度下的收藏样貌。">
          <View style={styles.collectionHeader}>
            <View><Text style={styles.collectionKicker}>旅舍收藏 · 第一卷</Text><Text style={styles.collectionTitle}>{pet.name} · 五种工艺样张</Text><Text style={styles.collectionHint}>伙伴与构图保持一致，差异来自木材、金属、晶石和铭文工艺。</Text></View>
            <View style={styles.collectionCount}><Text style={styles.collectionCountValue}>05</Text><Text style={styles.collectionCountLabel}>已收录</Text></View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.collectionRail}>
            {(['common', 'rare', 'epic', 'legendary', 'mythic'] as CardRarity[]).map((rarity) => (
              <CollectiblePetCard key={rarity} data={cardDataFor(pet, rarity)} width={wide ? 194 : 158} selected={selectedCardRarity === rarity} onPress={() => setSelectedCardRarity(rarity)} testID={`deck-card-${rarity}`} />
            ))}
          </ScrollView>
          <View style={styles.detailDivider}><Text style={styles.detailDividerText}>伙伴档案 · 卡牌详情</Text><Text style={styles.detailDividerMeta}>{({ common: '旅木普通工艺', rare: '月银稀有工艺', epic: '晶歌史诗工艺', legendary: '曦誓传说工艺', mythic: '星兽神话工艺' } as const)[selectedCardRarity]}</Text></View>
          <View style={[styles.twoColumn, wide && styles.row]}>
            <View style={[styles.cardDetailStage, !wide && styles.cardDetailStageMobile]}><CollectiblePetCard data={selectedCard} width={wide ? 320 : Math.min(320, width - 44)} selected state={cardPreviewState} testID="detail-card" /></View>
            <View style={styles.petDashboard}>
              <Text style={styles.collectionKicker}>卡牌状态预览</Text>
              <View style={styles.stateInspector}>{([
                ['idle', '可出战'], ['exhausted', '能量不足'], ['damaged', '受伤'], ['healing', '治疗'], ['shielded', '护盾'], ['poisoned', '中毒'], ['silenced', '沉默'], ['defeated', '阵亡'],
              ] as [CardState, string][]).map(([state, label]) => <Pressable key={state} onPress={() => setCardPreviewState(state)} style={[styles.stateControl, cardPreviewState === state && styles.stateControlActive]}><Text style={[styles.stateControlText, cardPreviewState === state && styles.stateControlTextActive]}>{label}</Text></Pressable>)}</View>
              <View style={styles.levelLine}>
                <View><Text style={styles.panelKicker}>本周成长</Text><Text style={styles.sectionTitle}>距离 Lv.{pet.level + 1} 还差 380 EXP</Text></View>
                <View style={styles.levelBadge}><Text style={styles.levelBadgeText}>Lv.{pet.level}</Text></View>
              </View>
              <Progress value={62} color="#9A642F" />
              <View style={styles.statsGrid}>
                <Stat icon="heart" value={petStats.hp} label="生命" color="#D8C08D" iconColor="#873C2D" />
                <Stat icon="flash" value={petStats.attack} label="攻击" color="#CDA87D" iconColor="#813B26" />
                <Stat icon="shield-half" value={petStats.defense} label="防御" color="#C3C1A4" iconColor="#425C56" />
                <Stat icon="speedometer" value={petStats.speed} label="速度" color="#D1B996" iconColor="#68503A" />
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
        </View>
        </ImageBackground>
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
          <View style={styles.rosterHeader}><View><Text style={styles.collectionKicker}>SELECT LOADOUT</Text><Text style={styles.rosterTitle}>选择出战收藏版本</Text></View><Text style={styles.rosterMeta}>版本不改变本场基础战斗逻辑</Text></View>
          <View style={styles.rosterCards}>
            {(['common', 'legendary'] as CardRarity[]).map((rarity) => <CollectiblePetCard key={rarity} data={cardDataFor(pet, rarity)} width={wide ? 154 : Math.min(146, (width - 54) / 2)} selected={battleCardRarity === rarity} draggable onPress={() => setBattleCardRarity(rarity)} testID={`battle-card-${rarity}`} />)}
          </View>
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
      <ImageBackground source={guildTable} resizeMode="cover" style={styles.guildHome} imageStyle={styles.guildHomeImage}>
        <View style={styles.guildShade} />
        <View style={styles.guildContent}>
          <View style={styles.guildWelcome}>
            <View><Text style={styles.guildEyebrow}>EMBERPAW LODGE · 暖爪旅舍</Text><Text style={styles.guildTitle}>{authUser ? `${authUser.displayName}，炉火正旺` : '欢迎回到暖爪旅舍'}</Text></View>
            <View style={styles.guildResources}><ResourceToken icon="🪙" value={coins} label="金币" /><ResourceToken icon="🎟️" value={tickets} label="装备券" /><ResourceToken icon="🧪" value={`${energy}/5`} label="体力" /></View>
          </View>

          <View style={[styles.tableLayout, wide && styles.tableLayoutWide]}>
            <View style={styles.leftWorkbench}>
              <View style={styles.noticeBoard}>
                <View style={[styles.brassPin, styles.brassPinLeft]} /><View style={[styles.brassPin, styles.brassPinRight]} />
                <Text style={styles.noticeKicker}>今日委托</Text><Text style={styles.noticeTitle}>旅舍小事记</Text>
                <TableTask label="和伙伴打个招呼" reward="🪙 20" done />
                <TableTask label="完成一次冒险" reward="🎟️ 1" />
                <TableTask label="为宠物装备一件物品" reward="🪙 40" />
                <Pressable onPress={() => setScreen('rewards')} style={({ pressed }) => [styles.woodButton, pressed && styles.woodButtonPressed]}><Text style={styles.woodButtonText}>{checkedIn ? '今日补给已领取' : '领取旅舍补给'}</Text></Pressable>
              </View>
              <TableObject variant="book" icon="paw" title="宠物图鉴" subtitle={`${pet.breedName ?? pet.species} · LV.${pet.level}`} onPress={() => setScreen('pet')} />
            </View>

            <View style={styles.petAltar}>
              <View style={styles.candleGlow} />
              <Text style={styles.altarKicker}>当前同行伙伴</Text>
              <CollectiblePetCard data={cardDataFor(pet, 'legendary')} width={wide ? 330 : Math.min(292, width - 54)} />
              <View style={styles.petNamePlaque}><Text style={styles.petNamePlaqueText}>{pet.name}</Text><Text style={styles.petNamePlaqueMeta}>{pet.element} · 战力 {combatPower(asBattlePet(pet))}</Text></View>
              <Pressable onPress={() => setScreen('create')} style={({ pressed }) => [styles.summonButton, pressed && styles.summonButtonPressed]}><Ionicons name="camera" size={16} color="#FFE9B8" /><Text style={styles.summonButtonText}>召唤新伙伴</Text></Pressable>
            </View>

            <View style={styles.objectShelf}>
              <TableObject variant="chest" icon="gift" title="补给宝箱" subtitle={checkedIn ? '明日再来' : '有奖励可领取'} onPress={() => setScreen('rewards')} />
              <TableObject variant="scroll" icon="map" title="远行地图" subtitle={`${energy} 点体力可用`} onPress={() => setScreen('adventure')} />
              <TableObject variant="portal" icon="flash" title="试炼之门" subtitle="进入策略对战" onPress={() => { resetBattle(); setScreen('battle'); }} />
              <TableObject variant="banner" icon="people" title="宠友公会" subtitle="附近有 18 位伙伴" onPress={() => setScreen('social')} />
            </View>
          </View>
        </View>
      </ImageBackground>
    );
  }, [screen, pet, draftName, draftImage, draftSpecies, draftBreed, identification, isIdentifying, isProcessing, processingError, selectedCardRarity, battleCardRarity, cardPreviewState, battle, coins, tickets, energy, checkedIn, inventory, rewardMessage, wide, width, authUser, authLoading, authMode, authUsername, authPassword, authDisplayName, authError, authSubmitting, cloudMessage, ownedCards]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.shell}>
        <Header screen={screen} setScreen={setScreen} wide={wide} user={authUser} />
        <ScrollView ref={scrollRef} contentContainerStyle={[styles.scroll, screen === 'home' && styles.homeScroll]}>{page}</ScrollView>
        {!wide && <MobileNav screen={screen} setScreen={setScreen} />}
      </View>
    </SafeAreaView>
  );
}

function Header({ screen, setScreen, wide, user }: { screen: Screen; setScreen: (screen: Screen) => void; wide: boolean; user: AuthUser | null }) {
  const activeScreen = screen === 'create' || screen === 'account' ? 'home' : screen;
  return (
    <View style={styles.header}>
      <Pressable onPress={() => setScreen('home')} style={styles.brandWrap}><View style={styles.brandMark}><Ionicons name="paw" size={17} color={colors.white} /></View><Text style={styles.brand}>PET<Text style={styles.brandBolt}>⚡</Text>BATTLE</Text></Pressable>
      {wide && <View style={styles.desktopNav}>{Object.entries(navMeta).map(([key, item]) => <Pressable key={key} onPress={() => setScreen(key as Screen)} style={({ pressed }) => [styles.navItem, activeScreen === key && styles.navActive, pressed && styles.navPressed]}><Ionicons name={item.icon} size={17} color={activeScreen === key ? '#FFD58A' : '#BDA783'} /><Text style={[styles.navText, activeScreen === key && styles.navTextActive]}>{item.label}</Text></Pressable>)}</View>}
      <Pressable onPress={() => setScreen('account')} style={[styles.profilePill, screen === 'account' && styles.profilePillActive]}><View style={styles.avatar}><Text>{user ? '🐾' : '🐱'}</Text></View>{wide && <Text style={styles.profileText}>{user?.displayName ?? '登录 / 注册'}</Text>}</Pressable>
    </View>
  );
}

function MobileNav({ screen, setScreen }: { screen: Screen; setScreen: (screen: Screen) => void }) {
  const activeScreen = screen === 'create' || screen === 'account' ? 'home' : screen;
  return <View style={styles.mobileNav}>{Object.entries(navMeta).map(([key, item]) => {
    const active = activeScreen === key;
    return <Pressable key={key} onPress={() => setScreen(key as Screen)} style={[styles.mobileNavItem, active && styles.mobileNavActive]}><Ionicons name={active ? item.icon.replace('-outline', '') as keyof typeof Ionicons.glyphMap : item.icon} size={21} color={active ? colors.peachDark : colors.muted} />{active && <Text style={styles.mobileLabelActive}>{item.label}</Text>}</Pressable>;
  })}</View>;
}

function Page({ eyebrow, title, subtitle, children }: { eyebrow: string; title: string; subtitle: string; children: ReactNode }) {
  return <View style={styles.page}><View style={styles.pageIntro}><Text style={styles.pageEyebrow}>{eyebrow}</Text><Text style={styles.pageTitle}>{title}</Text><Text style={styles.pageSubtitle}>{subtitle}</Text></View>{children}</View>;
}

function ActionButton({ label, icon, onPress, secondary, disabled, full }: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void; secondary?: boolean; disabled?: boolean; full?: boolean }) {
  return <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, secondary && styles.buttonSecondary, disabled && styles.buttonDisabled, full && styles.buttonFull, pressed && styles.buttonPressed]}><View style={styles.buttonContent}><Ionicons name={icon} size={17} color={secondary ? '#493421' : '#FFF0C8'} /><Text style={[styles.buttonText, secondary && styles.buttonTextSecondary]}>{label}</Text></View></Pressable>;
}

function Feature({ icon, title, body, color, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string; color: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.feature, { backgroundColor: color }, pressed && styles.pressed]}><View style={styles.featureIcon}><Ionicons name={icon} size={24} color={colors.ink} /></View><Text style={styles.featureTitle}>{title}</Text><Text style={styles.featureBody}>{body}</Text><View style={styles.featureGo}><Text style={styles.featureGoText}>进入</Text><Ionicons name="arrow-forward" size={15} color={colors.ink} /></View></Pressable>;
}

function ResourceToken({ icon, value, label }: { icon: string; value: number | string; label: string }) {
  return <View style={styles.resourceToken}><Text style={styles.resourceTokenIcon}>{icon}</Text><View><Text style={styles.resourceTokenValue}>{value}</Text><Text style={styles.resourceTokenLabel}>{label}</Text></View></View>;
}

function TableTask({ label, reward, done }: { label: string; reward: string; done?: boolean }) {
  return <View style={styles.tableTask}><View style={[styles.tableTaskMark, done && styles.tableTaskMarkDone]}>{done && <Ionicons name="checkmark" size={11} color="#FFF0C8" />}</View><Text style={styles.tableTaskLabel}>{label}</Text><Text style={styles.tableTaskReward}>{reward}</Text></View>;
}

type TableObjectVariant = 'book' | 'chest' | 'scroll' | 'portal' | 'banner';

function TableObject({ variant, icon, title, subtitle, onPress }: { variant: TableObjectVariant; icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string; onPress: () => void }) {
  const materialStyle = ({ book: styles.objectBook, chest: styles.objectChest, scroll: styles.objectScroll, portal: styles.objectPortal, banner: styles.objectBanner } as const)[variant];
  const darkSurface = variant !== 'scroll';
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.tableObject, materialStyle, pressed && styles.tableObjectPressed]}>
    <View style={[styles.objectIconWell, variant === 'portal' && styles.portalIconWell]}><Ionicons name={icon} size={25} color={variant === 'portal' ? '#FFD583' : '#3B271A'} /></View>
    <View style={styles.objectCopy}><Text style={[styles.objectTitle, darkSurface && styles.objectTitleLight]}>{title}</Text><Text style={[styles.objectSubtitle, darkSurface && styles.objectSubtitleLight]}>{subtitle}</Text></View>
    <View style={styles.objectRivet} />
  </Pressable>;
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
  const shades = ['#DEC99C', '#D4B98D', '#C7C3A2'];
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
  safe: { flex: 1, backgroundColor: '#20130C' }, shell: { flex: 1, backgroundColor: colors.cream }, scroll: { paddingBottom: 104 }, row: { flexDirection: 'row' },
  header: { height: 70, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#2B190F', borderBottomWidth: 3, borderBottomColor: '#8D6534', shadowColor: '#120906', shadowOpacity: 0.7, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, zIndex: 20 },
  brandWrap: { flexDirection: 'row', alignItems: 'center', gap: 9 }, brandMark: { width: 34, height: 34, borderRadius: 7, backgroundColor: '#8D4E2D', borderWidth: 2, borderColor: '#C99A58', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-4deg' }] }, brand: { fontSize: 19, fontWeight: '900', color: '#F4DCA7', letterSpacing: 0.8, fontFamily: 'serif' }, brandBolt: { color: '#E2A64E' },
  desktopNav: { flexDirection: 'row', gap: 5 }, navItem: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 5, borderWidth: 1, borderColor: '#604329', backgroundColor: '#3B2518', flexDirection: 'row', alignItems: 'center', gap: 6 }, navActive: { backgroundColor: '#6A3E25', borderColor: '#C58A46', transform: [{ translateY: 2 }] }, navPressed: { transform: [{ translateY: 3 }] }, navText: { color: '#C9AF89', fontWeight: '800', fontSize: 12 }, navTextActive: { color: '#FFE5AE' },
  profilePill: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#3C281B', borderRadius: 7, padding: 4, paddingRight: 10, borderWidth: 1, borderColor: '#7D5D39' }, profilePillActive: { borderColor: '#E0A855', backgroundColor: '#604020' }, avatar: { width: 32, height: 32, borderRadius: 5, backgroundColor: '#B47A36', borderWidth: 1, borderColor: '#E5B766', alignItems: 'center', justifyContent: 'center' }, profileText: { color: '#E8CFA4', fontSize: 12, fontWeight: '800' },
  page: { width: '100%', maxWidth: 1100, alignSelf: 'center', paddingHorizontal: 22, paddingTop: 34 }, pageIntro: { maxWidth: 760, marginBottom: 24 }, pageEyebrow: { color: colors.peachDark, fontSize: 11, letterSpacing: 1.7, fontWeight: '900', marginBottom: 8 }, pageTitle: { color: colors.ink, fontSize: 34, lineHeight: 42, fontWeight: '900' }, pageSubtitle: { color: colors.muted, fontSize: 15, lineHeight: 24, marginTop: 7 },
  hero: { borderRadius: 34, padding: 30, gap: 28, alignItems: 'center', marginBottom: 34, overflow: 'hidden' }, heroCopy: { flex: 1, minWidth: 270, zIndex: 2 }, heroDecorOne: { position: 'absolute', width: 190, height: 190, borderRadius: 95, backgroundColor: '#FFD9C8A0', top: -90, left: -35 }, heroDecorTwo: { position: 'absolute', width: 250, height: 250, borderRadius: 125, borderWidth: 35, borderColor: '#FFFFFF52', right: -80, bottom: -100 }, helloPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.white, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16 }, helloText: { color: colors.peachDark, fontSize: 12, fontWeight: '800' }, heroTitle: { fontSize: 44, lineHeight: 53, fontWeight: '900', color: colors.ink, marginTop: 18 }, heroBody: { fontSize: 16, lineHeight: 26, color: colors.muted, marginTop: 11, maxWidth: 520 }, trustLine: { flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 18 }, trustText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  inlineButtons: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginTop: 17 }, button: { minWidth: 148, height: 48, borderRadius: 7, margin: 0, paddingHorizontal: 18, backgroundColor: '#7C4428', borderWidth: 2, borderTopColor: '#C98655', borderLeftColor: '#B96D43', borderRightColor: '#4E281A', borderBottomColor: '#3B1E14', alignItems: 'center', justifyContent: 'center', shadowColor: '#26120A', shadowOpacity: 0.5, shadowRadius: 0, shadowOffset: { width: 0, height: 4 } }, buttonSecondary: { backgroundColor: '#D8C49A', borderTopColor: '#F2E2B9', borderLeftColor: '#E6D5AC', borderRightColor: '#8B734E', borderBottomColor: '#755F42' }, buttonDisabled: { opacity: 0.38 }, buttonFull: { width: '100%', marginTop: 22 }, buttonPressed: { transform: [{ translateY: 3 }], shadowOffset: { width: 0, height: 1 } }, buttonContent: { flexDirection: 'row', alignItems: 'center', gap: 7 }, buttonText: { color: '#FFF0C8', fontSize: 14, fontWeight: '900' }, buttonTextSecondary: { color: '#493421' }, pressed: { opacity: 0.82, transform: [{ translateY: 2 }] },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 15 }, sectionKicker: { color: colors.peachDark, fontWeight: '900', fontSize: 11, letterSpacing: 1.4 }, sectionTitle: { color: colors.ink, fontSize: 20, fontWeight: '900', marginTop: 4 }, sectionHint: { color: colors.muted, fontSize: 12 }, featureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 }, feature: { flexGrow: 1, flexBasis: 220, borderRadius: 25, padding: 20, minHeight: 190 }, featureIcon: { width: 46, height: 46, borderRadius: 16, backgroundColor: '#FFFFFFA8', alignItems: 'center', justifyContent: 'center' }, featureTitle: { color: colors.ink, fontWeight: '900', fontSize: 19, marginTop: 16 }, featureBody: { color: colors.muted, lineHeight: 21, marginTop: 5 }, featureGo: { marginTop: 'auto', flexDirection: 'row', gap: 5, alignItems: 'center' }, featureGoText: { color: colors.ink, fontSize: 12, fontWeight: '900' },
  twoColumn: { gap: 24, alignItems: 'flex-start' }, upload: { flex: 1, width: '100%', minHeight: 490, borderWidth: 2, borderStyle: 'dashed', borderColor: '#E1BDB3', borderRadius: 28, backgroundColor: '#FFF1EA', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, uploadImage: { width: '100%', height: 490, resizeMode: 'cover' }, uploadEmpty: { alignItems: 'center', padding: 30 }, uploadIcon: { width: 70, height: 70, borderRadius: 25, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-5deg' }] }, uploadTitle: { fontSize: 21, fontWeight: '900', color: colors.ink, marginTop: 18 }, uploadHint: { color: colors.muted, marginTop: 7, textAlign: 'center' }, filePill: { backgroundColor: '#FFFFFFA5', borderRadius: 13, paddingHorizontal: 10, paddingVertical: 5, marginTop: 16 }, filePillText: { fontSize: 10, color: colors.muted, fontWeight: '800' }, previewBadge: { position: 'absolute', bottom: 22, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 13, paddingVertical: 8, backgroundColor: '#201B2DDE', borderRadius: 16 }, previewBadgeText: { color: '#FFE6A1', fontSize: 11, fontWeight: '900' }, panel: { flex: 1, width: '100%', backgroundColor: colors.white, borderRadius: 28, padding: 25, borderWidth: 1, borderColor: colors.line }, panelKicker: { color: colors.peachDark, fontSize: 11, fontWeight: '900', letterSpacing: 1.2, marginBottom: 15 }, label: { color: colors.ink, fontWeight: '800', marginBottom: 8 }, labelSpaced: { marginTop: 18 }, input: { height: 52, backgroundColor: '#FCF9FB', borderColor: colors.line, borderWidth: 1, borderRadius: 15, paddingHorizontal: 15, color: colors.ink, fontSize: 16 }, aiPanel: { marginTop: 16, padding: 14, borderRadius: 18, backgroundColor: '#F8F5FF', borderWidth: 1, borderColor: '#E4DCF9' }, aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 }, aiIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' }, aiHeaderCopy: { flex: 1 }, aiTitle: { color: colors.ink, fontSize: 12, fontWeight: '900' }, aiSubtitle: { color: colors.muted, fontSize: 9, lineHeight: 14, marginTop: 2 }, aiPulse: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.lilac }, aiSpeciesLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 11, borderTopWidth: 1, borderTopColor: '#E4DCF9' }, aiSpeciesText: { color: colors.ink, fontSize: 11, fontWeight: '800' }, aiConfidence: { color: colors.lilac, fontSize: 11, fontWeight: '900' }, candidateList: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 9 }, candidateCard: { flexGrow: 1, flexBasis: 105, minHeight: 88, padding: 9, borderRadius: 13, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line }, candidateCardActive: { borderColor: colors.lilac, backgroundColor: '#F0EBFF' }, candidateTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 }, candidateName: { color: colors.ink, fontSize: 11, fontWeight: '900' }, candidatePercent: { color: colors.lilac, fontSize: 10, fontWeight: '900' }, candidateKind: { color: colors.peachDark, fontSize: 8, fontWeight: '800', marginTop: 3 }, candidateReason: { color: colors.muted, fontSize: 8, lineHeight: 12, marginTop: 4 }, aiDisclaimer: { color: colors.muted, fontSize: 8, lineHeight: 12, marginTop: 9 }, speciesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, speciesChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#F8F5F7', borderWidth: 1, borderColor: colors.line }, speciesChipActive: { backgroundColor: colors.peachSoft, borderColor: colors.peach }, speciesEmoji: { fontSize: 15 }, speciesText: { color: colors.muted, fontSize: 11, fontWeight: '700' }, speciesTextActive: { color: colors.peachDark, fontWeight: '900' }, breedGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, breedChip: { flexGrow: 1, flexBasis: 105, minHeight: 50, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#F8F5F7', borderWidth: 1, borderColor: colors.line }, breedChipActive: { backgroundColor: colors.lilacSoft, borderColor: colors.lilac }, breedName: { color: colors.ink, fontSize: 11, fontWeight: '800' }, breedNameActive: { color: colors.lilac, fontWeight: '900' }, breedDescription: { color: colors.muted, fontSize: 8, marginTop: 3 }, breedNote: { color: colors.muted, fontSize: 9, lineHeight: 15, marginTop: 8 }, processList: { marginTop: 24, gap: 9 }, processStep: { flexDirection: 'row', gap: 11, alignItems: 'center', paddingVertical: 8 }, processNumber: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, processNumberText: { color: colors.ink, fontWeight: '900', fontSize: 10 }, processCopy: { flex: 1 }, processTitle: { color: colors.ink, fontWeight: '900', fontSize: 13 }, processBody: { color: colors.muted, fontSize: 11, marginTop: 2 }, errorText: { color: '#C83C3C', fontSize: 12, fontWeight: '700', marginTop: 12 }, privacy: { color: colors.muted, fontSize: 11, lineHeight: 18, marginTop: 15 },
  petDashboard: { flex: 1, width: '100%' }, levelLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 }, levelBadge: { width: 54, height: 54, borderRadius: 19, backgroundColor: colors.lilacSoft, alignItems: 'center', justifyContent: 'center' }, levelBadgeText: { color: colors.lilac, fontWeight: '900' }, progress: { height: 9, borderRadius: 9, backgroundColor: '#EDE8EF', overflow: 'hidden' }, progressFill: { height: '100%', borderRadius: 9 }, statsGrid: { flexDirection: 'row', gap: 10, marginVertical: 20, flexWrap: 'wrap' }, stat: { flexGrow: 1, flexBasis: 95, minHeight: 105, borderRadius: 20, padding: 13, justifyContent: 'center' }, statValue: { fontSize: 21, fontWeight: '900', color: colors.ink, marginTop: 7 }, statLabel: { fontSize: 10, color: colors.muted, marginTop: 1 }, subsectionTitle: { color: colors.ink, fontSize: 14, fontWeight: '900', marginTop: 15, marginBottom: 9 }, traitList: { gap: 7 }, traitCard: { minHeight: 58, borderRadius: 17, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 }, traitNumber: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#FFFFFFA8', alignItems: 'center', justifyContent: 'center' }, traitNumberText: { color: colors.ink, fontSize: 9, fontWeight: '900' }, traitCopy: { flex: 1 }, traitName: { color: colors.ink, fontSize: 12, fontWeight: '900' }, traitDescription: { color: colors.muted, fontSize: 10, marginTop: 2 }, gearHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, textLink: { color: colors.peachDark, fontSize: 11, fontWeight: '900', marginTop: 9 }, gearSlots: { flexDirection: 'row', gap: 8 }, gearSlot: { flex: 1, minHeight: 90, borderRadius: 17, borderWidth: 1, borderStyle: 'dashed', borderColor: '#D8CDD4', backgroundColor: '#FBF9FA', alignItems: 'center', justifyContent: 'center', padding: 8 }, gearSlotFilled: { borderStyle: 'solid', borderColor: '#E5B9AD', backgroundColor: colors.peachSoft }, gearSlotIcon: { fontSize: 22 }, gearSlotName: { color: colors.ink, fontSize: 10, fontWeight: '900', marginTop: 5, textAlign: 'center' }, gearSlotMeta: { color: colors.muted, fontSize: 8, marginTop: 2 }, inventoryList: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, inventoryItem: { flexGrow: 1, flexBasis: 145, minHeight: 57, backgroundColor: colors.white, borderRadius: 15, borderWidth: 1, borderColor: colors.line, padding: 9, flexDirection: 'row', alignItems: 'center', gap: 8 }, inventoryIcon: { fontSize: 22 }, inventoryCopy: { flex: 1 }, inventoryName: { color: colors.ink, fontSize: 11, fontWeight: '900' }, inventoryMeta: { color: colors.muted, fontSize: 9, marginTop: 2 }, todayCard: { borderRadius: 25, padding: 20 }, todayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, todayKicker: { color: '#EAE2FF', fontSize: 10, fontWeight: '900', letterSpacing: 1.4 }, todayDate: { backgroundColor: '#FFFFFF24', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 5 }, todayDateText: { color: colors.white, fontSize: 9, fontWeight: '900' }, todayTitle: { color: colors.white, fontSize: 19, fontWeight: '900', marginTop: 9, marginBottom: 8 }, task: { minHeight: 48, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#FFFFFF24', gap: 10 }, taskCheck: { width: 22, height: 22, borderRadius: 8, borderWidth: 1, borderColor: '#FFFFFF99', alignItems: 'center', justifyContent: 'center' }, taskCheckDone: { backgroundColor: colors.mint, borderColor: colors.mint }, taskTitle: { flex: 1, color: colors.white, fontWeight: '700', fontSize: 12 }, taskReward: { color: '#F4DFFF', fontSize: 10, fontWeight: '800' },
  wallet: { alignSelf: 'flex-end', flexDirection: 'row', backgroundColor: colors.white, borderRadius: 18, padding: 7, marginBottom: 16, borderWidth: 1, borderColor: colors.line }, walletItem: { minWidth: 82, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 4 }, walletValue: { color: colors.ink, fontSize: 12, fontWeight: '900' }, walletLabel: { color: colors.muted, fontSize: 8 }, rewardToast: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: '#FFF4D8', borderRadius: 16, padding: 13, marginBottom: 15 }, rewardToastText: { flex: 1, color: colors.ink, fontSize: 12, fontWeight: '800' }, rewardGrid: { gap: 16 }, rewardCard: { flex: 1, minHeight: 370, borderRadius: 28, padding: 23, overflow: 'hidden' }, rewardIcon: { width: 62, height: 62, borderRadius: 21, backgroundColor: '#FFFFFFA8', alignItems: 'center', justifyContent: 'center' }, rewardEmoji: { fontSize: 31 }, rewardKicker: { color: colors.peachDark, fontSize: 9, fontWeight: '900', letterSpacing: 1.3, marginTop: 18 }, rewardTitle: { color: colors.ink, fontSize: 24, fontWeight: '900', marginTop: 3 }, rewardDescription: { color: colors.muted, fontSize: 12, lineHeight: 20, marginTop: 12 }, signDays: { flexDirection: 'row', gap: 5, marginTop: 23 }, signDay: { flex: 1, minHeight: 65, borderRadius: 13, backgroundColor: '#FFFFFF88', alignItems: 'center', justifyContent: 'center' }, signDayActive: { backgroundColor: colors.peach }, signDayText: { color: colors.ink, fontSize: 9, fontWeight: '900' }, signGift: { fontSize: 16, marginTop: 4 }, rarityPreview: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#FFFFFF80', borderRadius: 15, padding: 14, marginTop: 26 }, powerBanner: { backgroundColor: colors.white, borderRadius: 22, padding: 18, marginBottom: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.line }, powerTitle: { color: colors.ink, fontSize: 20, fontWeight: '900', marginTop: 3 }, powerSpecies: { backgroundColor: colors.peachSoft, color: colors.peachDark, fontSize: 11, fontWeight: '900', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14 }, stageList: { backgroundColor: colors.white, borderRadius: 26, padding: 19, borderWidth: 1, borderColor: colors.line }, stageCard: { minHeight: 112, flexDirection: 'row', alignItems: 'center', gap: 13, position: 'relative' }, stageLine: { position: 'absolute', width: 2, backgroundColor: colors.line, left: 27, top: 78, bottom: -34 }, stageLineHidden: { display: 'none' }, stageIcon: { width: 56, height: 56, borderRadius: 19, alignItems: 'center', justifyContent: 'center', zIndex: 2 }, stageEmoji: { fontSize: 26 }, stageCopy: { flex: 1 }, stageName: { color: colors.ink, fontSize: 16, fontWeight: '900' }, stageMeta: { color: colors.muted, fontSize: 10, marginTop: 4 }, stageReward: { color: colors.peachDark, fontSize: 10, fontWeight: '800', marginTop: 4 }, stageButton: { minWidth: 58, backgroundColor: '#F1EDF0', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, alignItems: 'center' }, stageButtonReady: { backgroundColor: colors.peach }, stageButtonText: { color: colors.muted, fontSize: 11, fontWeight: '900' }, stageButtonTextReady: { color: colors.white },
  turnPill: { alignSelf: 'center', flexDirection: 'row', gap: 7, alignItems: 'center', backgroundColor: colors.white, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, marginBottom: -15, zIndex: 3, borderWidth: 1, borderColor: colors.line }, liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.mint }, turnText: { color: colors.ink, fontSize: 11, fontWeight: '900' }, arena: { minHeight: 390, borderRadius: 30, padding: 28, paddingTop: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', overflow: 'hidden' }, fighter: { width: '38%', maxWidth: 280, alignItems: 'center' }, fighterTag: { color: '#3B8B6C', backgroundColor: colors.mintSoft, borderRadius: 11, paddingHorizontal: 9, paddingVertical: 4, fontSize: 9, fontWeight: '900' }, enemyTag: { color: colors.peachDark, backgroundColor: colors.peachSoft }, fighterOutline: { width: 155, height: 155, borderRadius: 50, padding: 5, marginVertical: 14, backgroundColor: '#F0C959', shadowColor: '#F0B733', shadowOpacity: 0.55, shadowRadius: 16, transform: [{ rotate: '2deg' }] }, fighterOutlineEnemy: { backgroundColor: '#91B8EF', shadowColor: '#568CD7', transform: [{ rotate: '-2deg' }] }, fighterImage: { width: '100%', height: '100%', borderRadius: 45, resizeMode: 'cover', borderWidth: 3, borderColor: colors.white }, fighterName: { fontSize: 20, fontWeight: '900', color: colors.ink, marginBottom: 10 }, hp: { color: colors.muted, fontSize: 10, fontWeight: '800', marginTop: 6 }, vsBadge: { width: 58, height: 58, borderRadius: 22, backgroundColor: colors.peach, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-8deg' }], shadowColor: colors.peachDark, shadowOpacity: 0.25, shadowRadius: 10 }, vsText: { color: colors.white, fontWeight: '900', fontSize: 20 }, battleConsole: { backgroundColor: colors.white, borderRadius: 25, padding: 20, marginTop: 15, borderWidth: 1, borderColor: colors.line }, logBubble: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingBottom: 16 }, battleLog: { flex: 1, color: colors.ink, fontWeight: '800', fontSize: 12, lineHeight: 18, textAlign: 'center' }, skillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 11 }, skill: { flexGrow: 1, flexBasis: 200, minHeight: 80, borderRadius: 19, flexDirection: 'row', alignItems: 'center', padding: 13, gap: 11 }, skillIcon: { width: 46, height: 46, borderRadius: 16, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' }, skillCopy: { flex: 1 }, skillName: { color: colors.ink, fontWeight: '900' }, skillMeta: { color: colors.muted, fontSize: 10, marginTop: 3 },
  nearbyStrip: { maxWidth: 680, width: '100%', alignSelf: 'center', backgroundColor: colors.peachSoft, borderRadius: 23, padding: 18, marginBottom: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, nearbyTitle: { color: colors.ink, fontWeight: '900' }, avatarRow: { flexDirection: 'row', alignItems: 'center' }, nearbyAvatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: colors.white }, avatarOverlap: { marginLeft: -9 }, moreAvatar: { marginLeft: -9, backgroundColor: colors.peach, alignItems: 'center', justifyContent: 'center' }, moreAvatarText: { color: colors.white, fontSize: 9, fontWeight: '900' }, feed: { gap: 18, maxWidth: 680, width: '100%', alignSelf: 'center' }, post: { backgroundColor: colors.white, borderRadius: 25, padding: 16, borderWidth: 1, borderColor: colors.line }, postHeader: { flexDirection: 'row', gap: 10, alignItems: 'center' }, postAvatarImage: { width: 43, height: 43, borderRadius: 16, resizeMode: 'cover' }, postIdentity: { flex: 1 }, postName: { color: colors.ink, fontWeight: '900' }, postDistance: { color: colors.muted, fontSize: 10, marginTop: 2 }, postPhotoImage: { width: '100%', height: 330, borderRadius: 19, resizeMode: 'cover', marginTop: 13, backgroundColor: '#171319' }, postText: { color: colors.ink, lineHeight: 21, marginTop: 13 }, postActions: { flexDirection: 'row', gap: 23, marginTop: 14, paddingTop: 13, borderTopWidth: 1, borderTopColor: colors.line }, postAction: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  archiveBackdrop: { width: '100%', minHeight: 1200, paddingVertical: 28, paddingHorizontal: 20, backgroundColor: '#25150D' }, archiveLedger: { width: '100%', maxWidth: 1220, alignSelf: 'center', backgroundColor: '#DDC99D', borderWidth: 12, borderTopColor: '#805037', borderLeftColor: '#68402E', borderRightColor: '#3A211A', borderBottomColor: '#2F1A14', shadowColor: '#100805', shadowOpacity: 0.75, shadowRadius: 13, shadowOffset: { width: 5, height: 10 } },
  collectionHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', borderTopWidth: 2, borderBottomWidth: 1, borderColor: '#745337', paddingVertical: 14, marginBottom: 18 },
  collectionKicker: { color: '#A46B2A', fontSize: 9, fontWeight: '900', letterSpacing: 1.8 },
  collectionTitle: { color: colors.ink, fontSize: 21, fontWeight: '900', marginTop: 4 },
  collectionHint: { color: colors.muted, fontSize: 10, marginTop: 4 },
  collectionCount: { width: 62, borderLeftWidth: 1, borderColor: '#B7AEA4', paddingLeft: 12 },
  collectionCountValue: { color: colors.ink, fontSize: 25, lineHeight: 27, fontWeight: '900' },
  collectionCountLabel: { color: colors.muted, fontSize: 8, fontWeight: '800', letterSpacing: 0.8 },
  collectionRail: { gap: 18, paddingHorizontal: 4, paddingBottom: 12, alignItems: 'flex-start' },
  detailDivider: { marginTop: 18, marginBottom: 22, borderTopWidth: 2, borderBottomWidth: 1, borderColor: '#80603D', paddingVertical: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  detailDividerText: { color: colors.ink, fontSize: 9, fontWeight: '900', letterSpacing: 1.3 },
  detailDividerMeta: { color: '#8C5B24', fontSize: 9, fontWeight: '800' },
  cardDetailStage: { width: 340, alignItems: 'center', justifyContent: 'flex-start', paddingVertical: 14, paddingHorizontal: 10, backgroundColor: '#63402D', borderWidth: 4, borderTopColor: '#956345', borderLeftColor: '#7C503A', borderRightColor: '#382119', borderBottomColor: '#2D1A14' },
  cardDetailStageMobile: { width: '100%' },
  stateInspector: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 7, marginBottom: 17, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#90704A', paddingVertical: 5 },
  stateControl: { flexGrow: 1, minWidth: 78, paddingHorizontal: 10, paddingVertical: 9, alignItems: 'center', borderWidth: 1, borderColor: '#896846', backgroundColor: '#D3BD8C' },
  stateControlActive: { backgroundColor: '#5A3827', transform: [{ translateY: 2 }] },
  stateControlText: { color: '#6D6664', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  stateControlTextActive: { color: '#F5E5B3' },
  rosterHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', borderTopWidth: 2, borderColor: '#3A343C', paddingTop: 12, marginBottom: 12 },
  rosterTitle: { color: colors.ink, fontSize: 18, fontWeight: '900', marginTop: 3 },
  rosterMeta: { color: colors.muted, fontSize: 9, maxWidth: 180, textAlign: 'right' },
  rosterCards: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start', gap: 16, marginBottom: 18 },
  homeScroll: { paddingBottom: 0, backgroundColor: '#1D0F09' }, guildHome: { width: '100%', minHeight: 1010, backgroundColor: '#28150C' }, guildHomeImage: { opacity: 1 }, guildShade: { position: 'absolute', inset: 0, backgroundColor: '#140A0450' },
  guildContent: { width: '100%', maxWidth: 1450, alignSelf: 'center', paddingHorizontal: 30, paddingTop: 24, paddingBottom: 60 },
  guildWelcome: { minHeight: 76, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 14, paddingHorizontal: 18, paddingVertical: 12, backgroundColor: '#29180EC7', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#A1733E' },
  guildEyebrow: { color: '#D6A85F', fontSize: 9, fontWeight: '900', letterSpacing: 1.8 }, guildTitle: { color: '#FFF0C9', fontSize: 24, fontWeight: '900', fontFamily: 'serif', marginTop: 4 },
  guildResources: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, resourceToken: { minWidth: 88, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#3B2518', borderWidth: 1, borderColor: '#8D6535', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 7, shadowColor: '#120A06', shadowOpacity: 0.6, shadowRadius: 3 }, resourceTokenIcon: { fontSize: 20 }, resourceTokenValue: { color: '#FFE3A4', fontSize: 12, fontWeight: '900' }, resourceTokenLabel: { color: '#BFA67D', fontSize: 7, fontWeight: '800' },
  tableLayout: { width: '100%', alignItems: 'center', gap: 28, paddingTop: 34 }, tableLayoutWide: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  leftWorkbench: { width: '100%', maxWidth: 280, gap: 24 }, noticeBoard: { minHeight: 332, backgroundColor: '#E0C78F', borderWidth: 7, borderTopColor: '#7B4A2B', borderLeftColor: '#6A3C24', borderRightColor: '#3C2117', borderBottomColor: '#321B12', padding: 22, paddingTop: 28, transform: [{ rotate: '-1deg' }], shadowColor: '#130906', shadowOpacity: 0.72, shadowRadius: 10, shadowOffset: { width: 4, height: 9 } },
  brassPin: { position: 'absolute', top: 9, width: 11, height: 11, borderRadius: 6, backgroundColor: '#B88339', borderWidth: 2, borderColor: '#E4BC6A' }, brassPinLeft: { left: 13 }, brassPinRight: { right: 13 }, noticeKicker: { color: '#86542D', fontSize: 8, fontWeight: '900', letterSpacing: 1.7, textAlign: 'center' }, noticeTitle: { color: '#442B1D', fontSize: 22, fontWeight: '900', fontFamily: 'serif', textAlign: 'center', marginTop: 5, marginBottom: 12 },
  tableTask: { minHeight: 43, flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: '#A98755' }, tableTaskMark: { width: 18, height: 18, borderWidth: 2, borderColor: '#80603B', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-2deg' }] }, tableTaskMarkDone: { backgroundColor: '#76502E' }, tableTaskLabel: { flex: 1, color: '#513823', fontSize: 10, fontWeight: '800' }, tableTaskReward: { color: '#7A4D27', fontSize: 9, fontWeight: '900' },
  woodButton: { minHeight: 40, marginTop: 14, backgroundColor: '#734329', borderWidth: 2, borderTopColor: '#B8794C', borderLeftColor: '#9A5A39', borderRightColor: '#412317', borderBottomColor: '#321A12', alignItems: 'center', justifyContent: 'center', shadowColor: '#352016', shadowOpacity: 0.45, shadowOffset: { width: 0, height: 4 } }, woodButtonPressed: { transform: [{ translateY: 3 }], shadowOffset: { width: 0, height: 1 } }, woodButtonText: { color: '#FFE7B5', fontSize: 11, fontWeight: '900' },
  petAltar: { width: '100%', maxWidth: 390, alignItems: 'center', paddingTop: 5 }, candleGlow: { position: 'absolute', top: 48, width: 370, height: 370, borderRadius: 185, backgroundColor: '#E8963929' }, altarKicker: { color: '#E7BD75', backgroundColor: '#2B190EE8', borderWidth: 1, borderColor: '#9C6E36', paddingHorizontal: 17, paddingVertical: 7, fontSize: 9, fontWeight: '900', letterSpacing: 1.6, marginBottom: 15 }, petNamePlaque: { minWidth: 205, marginTop: -5, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#4C2D1C', borderWidth: 2, borderTopColor: '#B77A43', borderLeftColor: '#8B5733', borderRightColor: '#2A1710', borderBottomColor: '#25130D', alignItems: 'center', shadowColor: '#120806', shadowOpacity: 0.7, shadowRadius: 6 }, petNamePlaqueText: { color: '#FFE4AB', fontSize: 17, fontWeight: '900', fontFamily: 'serif', letterSpacing: 1 }, petNamePlaqueMeta: { color: '#C8A674', fontSize: 8, fontWeight: '800', marginTop: 3 }, summonButton: { marginTop: 13, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 17, paddingVertical: 10, backgroundColor: '#693923', borderWidth: 2, borderTopColor: '#AE7047', borderLeftColor: '#965A39', borderRightColor: '#3D2016', borderBottomColor: '#311910', shadowColor: '#180B07', shadowOpacity: 0.6, shadowOffset: { width: 0, height: 4 } }, summonButtonPressed: { transform: [{ translateY: 3 }], shadowOffset: { width: 0, height: 1 } }, summonButtonText: { color: '#FFE7B2', fontSize: 11, fontWeight: '900' },
  objectShelf: { width: '100%', maxWidth: 290, gap: 19 }, tableObject: { minHeight: 112, flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 17, borderWidth: 4, shadowColor: '#130906', shadowOpacity: 0.72, shadowRadius: 7, shadowOffset: { width: 4, height: 7 } }, tableObjectPressed: { transform: [{ translateY: 4 }], shadowOffset: { width: 1, height: 2 } }, objectBook: { backgroundColor: '#70422C', borderTopColor: '#A86C49', borderLeftColor: '#8C5339', borderRightColor: '#3D2119', borderBottomColor: '#321A14', borderRadius: 5 }, objectChest: { backgroundColor: '#845027', borderTopColor: '#C18B4A', borderLeftColor: '#A16834', borderRightColor: '#402310', borderBottomColor: '#311A0C', borderRadius: 11 }, objectScroll: { backgroundColor: '#D8BD80', borderTopColor: '#F0D99E', borderLeftColor: '#B88C4E', borderRightColor: '#765026', borderBottomColor: '#62411F', borderRadius: 18 }, objectPortal: { backgroundColor: '#293934', borderColor: '#A9783B', borderRadius: 40 }, objectBanner: { backgroundColor: '#773D35', borderTopColor: '#A8665C', borderLeftColor: '#914E47', borderRightColor: '#3F1F1C', borderBottomColor: '#321714', borderRadius: 2 },
  objectIconWell: { width: 54, height: 54, borderRadius: 15, backgroundColor: '#D4B579', borderWidth: 3, borderTopColor: '#F0D39A', borderLeftColor: '#DDBF82', borderRightColor: '#76502E', borderBottomColor: '#624025', alignItems: 'center', justifyContent: 'center' }, portalIconWell: { borderRadius: 27, backgroundColor: '#61482B', borderColor: '#D9A84D', shadowColor: '#F2B94D', shadowOpacity: 0.65, shadowRadius: 9 }, objectCopy: { flex: 1 }, objectTitle: { color: '#3E281A', fontSize: 16, fontWeight: '900', fontFamily: 'serif' }, objectTitleLight: { color: '#FFE3A5' }, objectSubtitle: { color: '#624631', fontSize: 9, fontWeight: '800', marginTop: 4 }, objectSubtitleLight: { color: '#C9B889' }, objectRivet: { position: 'absolute', right: 8, top: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: '#B47B35', borderWidth: 1, borderColor: '#E2B561' },
  accountLayout: { gap: 20, alignItems: 'stretch', maxWidth: 900, width: '100%', alignSelf: 'center' },
  accountIdentity: { flex: 1, minHeight: 370, backgroundColor: '#342D35', borderRadius: 28, padding: 28, justifyContent: 'flex-end', borderWidth: 1, borderColor: '#5A5059' },
  accountEmblem: { width: 76, height: 76, borderRadius: 24, backgroundColor: colors.peach, alignItems: 'center', justifyContent: 'center', marginBottom: 'auto', transform: [{ rotate: '-6deg' }] },
  accountKicker: { color: '#E4B78B', fontSize: 9, fontWeight: '900', letterSpacing: 1.7 },
  accountTitle: { color: colors.white, fontSize: 28, lineHeight: 35, fontWeight: '900', marginTop: 8 },
  accountBody: { color: '#D7CBD4', fontSize: 12, lineHeight: 20, marginTop: 8 },
  cloudStatus: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#5B505A' },
  cloudStatusText: { color: '#EEE5EC', fontSize: 11, fontWeight: '800' },
  authPanel: { flex: 1, minHeight: 370, backgroundColor: colors.white, borderRadius: 28, padding: 26, borderWidth: 1, borderColor: colors.line },
  authLoading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  authLoadingText: { color: colors.muted, fontWeight: '800' },
  authTabs: { flexDirection: 'row', borderTopWidth: 2, borderBottomWidth: 1, borderColor: '#C9C0C7', marginBottom: 22 },
  authTab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  authTabActive: { borderBottomWidth: 3, borderBottomColor: colors.peach },
  authTabText: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  authTabTextActive: { color: colors.ink, fontWeight: '900' },
  authAction: { marginTop: 22 },
  authFinePrint: { color: colors.muted, fontSize: 9, lineHeight: 15, marginTop: 13 },
  accountRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.line },
  accountRowLabel: { color: colors.muted, fontSize: 11 },
  accountRowValue: { color: colors.ink, fontSize: 12, fontWeight: '900' },
  cloudMessage: { color: '#2F795D', backgroundColor: colors.mintSoft, fontSize: 10, fontWeight: '800', lineHeight: 16, padding: 11, marginVertical: 14 },
  mobileNav: { position: 'absolute', bottom: 11, left: 16, right: 16, height: 62, backgroundColor: colors.white, borderRadius: 22, flexDirection: 'row', padding: 7, shadowColor: '#5F4C5B', shadowOpacity: 0.16, shadowRadius: 16, shadowOffset: { width: 0, height: 5 }, borderWidth: 1, borderColor: colors.line }, mobileNavItem: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 16 }, mobileNavActive: { backgroundColor: colors.peachSoft, flexDirection: 'row', gap: 6 }, mobileLabelActive: { color: colors.peachDark, fontSize: 11, fontWeight: '900' },
});
