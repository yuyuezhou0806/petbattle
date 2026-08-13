import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';
import { Button as GalioButton } from 'galio-framework';
import { useMemo, useState, type ReactNode } from 'react';
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

const defaultCat = require('./assets/default-real-cat.png');
const defaultHusky = require('./assets/default-real-husky.png');

type Screen = 'home' | 'create' | 'pet' | 'battle' | 'social';
type Element = '烈焰' | '潮汐' | '森林';

type Pet = {
  name: string;
  species: string;
  element: Element;
  level: number;
  hp: number;
  attack: number;
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
};

const navMeta: Record<Exclude<Screen, 'create'>, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  home: { label: '首页', icon: 'home-outline' },
  pet: { label: '宠物', icon: 'paw-outline' },
  battle: { label: '对战', icon: 'flash-outline' },
  social: { label: '宠友', icon: 'people-outline' },
};

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [pet, setPet] = useState<Pet>(initialPet);
  const [draftName, setDraftName] = useState('');
  const [draftImage, setDraftImage] = useState<string>();
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingError, setProcessingError] = useState('');
  const [playerHp, setPlayerHp] = useState(initialPet.hp);
  const [enemyHp, setEnemyHp] = useState(112);
  const [battleLog, setBattleLog] = useState('轮到你了，选择团子的技能！');
  const [turn, setTurn] = useState(1);
  const { width } = useWindowDimensions();
  const wide = width >= 840;

  const pickImage = async (camera = false) => {
    const result = camera
      ? await ImagePicker.launchCameraAsync({ quality: 0.9, allowsEditing: true, aspect: [4, 5] })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.9, allowsEditing: true, aspect: [4, 5] });
    if (!result.canceled) setDraftImage(result.assets[0].uri);
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
    const next: Pet = {
      name: draftName.trim() || '新伙伴',
      species: 'AI 待识别宠物',
      element: elements[seed % elements.length],
      level: 1,
      hp: 98 + (seed % 18),
      attack: 25 + (seed % 12),
      image: outlinedImage,
    };
    setPet(next);
    setPlayerHp(next.hp);
    setScreen('pet');
    setIsProcessing(false);
  };

  const resetBattle = () => {
    setPlayerHp(pet.hp);
    setEnemyHp(112);
    setTurn(1);
    setBattleLog('轮到你了，选择宠物技能！');
  };

  const attack = (skill: '爪击' | '火球') => {
    if (playerHp <= 0 || enemyHp <= 0) return;
    const damage = skill === '火球' ? 25 + Math.floor(Math.random() * 12) : 17 + Math.floor(Math.random() * 8);
    const nextEnemy = Math.max(0, enemyHp - damage);
    if (nextEnemy === 0) {
      setEnemyHp(0);
      setBattleLog(`${pet.name}使用${skill}造成 ${damage} 点伤害，胜利！`);
      return;
    }
    const counter = 13 + Math.floor(Math.random() * 10);
    const nextPlayer = Math.max(0, playerHp - counter);
    setEnemyHp(nextEnemy);
    setPlayerHp(nextPlayer);
    setTurn((value) => value + 1);
    setBattleLog(nextPlayer === 0
      ? `对手反击造成 ${counter} 点伤害，${pet.name}需要休息。`
      : `${pet.name}的${skill}造成 ${damage} 点伤害，对手反击 ${counter} 点。`);
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
              <View style={styles.inlineButtons}>
                <ActionButton label="打开相机" icon="camera-outline" onPress={() => pickImage(true)} secondary />
                <ActionButton label="选择相册" icon="images-outline" onPress={() => pickImage(false)} secondary />
              </View>
              <View style={styles.processList}>
                <ProcessStep number="01" title="识别真实主体" body="保留五官、毛色和体态" color={colors.peachSoft} />
                <ProcessStep number="02" title="精细毛发描边" body="自动修正手机照片方向" color={colors.lilacSoft} />
                <ProcessStep number="03" title="合成竞技卡面" body="真实宠物 + 高级球星卡氛围" color={colors.mintSoft} />
              </View>
              <ActionButton label={isProcessing ? '正在识别与描边…' : '生成我的宠物卡'} icon="sparkles" onPress={generatePet} disabled={!draftImage || isProcessing} full />
              {!!processingError && <Text style={styles.errorText}>{processingError}</Text>}
              <Text style={styles.privacy}>照片仅用于本次卡牌生成；正式账号与云端相册会在登录系统上线后再开放。</Text>
            </View>
          </View>
        </Page>
      );
    }

    if (screen === 'pet') {
      return (
        <Page eyebrow="MY PARTNER" title="我的宠物英雄" subtitle="陪伴、训练和对战都会积累成长值。">
          <View style={[styles.twoColumn, wide && styles.row]}>
            <PetCard pet={pet} />
            <View style={styles.petDashboard}>
              <View style={styles.levelLine}>
                <View><Text style={styles.panelKicker}>本周成长</Text><Text style={styles.sectionTitle}>距离 Lv.{pet.level + 1} 还差 380 EXP</Text></View>
                <View style={styles.levelBadge}><Text style={styles.levelBadgeText}>Lv.{pet.level}</Text></View>
              </View>
              <Progress value={62} color={colors.lilac} />
              <View style={styles.statsGrid}>
                <Stat icon="heart" value={pet.hp} label="生命" color="#FEE8DC" iconColor="#F06B5A" />
                <Stat icon="flash" value={pet.attack} label="攻击" color="#FFEFF1" iconColor="#F06C8B" />
                <Stat icon="shield-half" value={21} label="防御" color="#E6EDFA" iconColor="#5A86D8" />
                <Stat icon="happy" value={92} label="心情" color="#F5EEFC" iconColor="#8C69D9" />
              </View>
              <LinearGradient colors={['#A17DF1', '#7D64DF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.todayCard}>
                <View style={styles.todayHeader}><Text style={styles.todayKicker}>TODAY</Text><View style={styles.todayDate}><Text style={styles.todayDateText}>13 AUG</Text></View></View>
                <Text style={styles.todayTitle}>今天和 {pet.name} 一起做什么？</Text>
                <Task title="一起玩耍 10 分钟" reward="+20 EXP" done />
                <Task title="完成一次训练对战" reward="+30 EXP" />
              </LinearGradient>
              <View style={styles.inlineButtons}>
                <ActionButton label="开始对战" icon="flash" onPress={() => { resetBattle(); setScreen('battle'); }} />
                <ActionButton label="重新建卡" icon="refresh" onPress={() => setScreen('create')} secondary />
              </View>
            </View>
          </View>
        </Page>
      );
    }

    if (screen === 'battle') {
      const ended = playerHp <= 0 || enemyHp <= 0;
      return (
        <Page eyebrow="QUICK BATTLE" title="训练场" subtitle="轻量回合制原型：点技能、看反馈、三分钟完成一局。">
          <View style={styles.turnPill}><View style={styles.liveDot} /><Text style={styles.turnText}>第 {turn} 回合 · 轮到你行动</Text></View>
          <LinearGradient colors={['#ECE9FF', '#FFECE3']} style={styles.arena}>
            <Fighter name="影爪" defaultImage={defaultHusky} hp={enemyHp} max={112} enemy />
            <View style={styles.vsBadge}><Text style={styles.vsText}>VS</Text></View>
            <Fighter name={pet.name} image={pet.image} defaultImage={defaultCat} hp={playerHp} max={pet.hp} />
          </LinearGradient>
          <View style={styles.battleConsole}>
            <View style={styles.logBubble}><Ionicons name="chatbubble-ellipses" size={18} color={colors.lilac} /><Text style={styles.battleLog}>{battleLog}</Text></View>
            {ended ? (
              <View style={styles.inlineButtons}>
                <ActionButton label="再来一局" icon="refresh" onPress={resetBattle} />
                <ActionButton label="返回宠物" icon="paw" onPress={() => setScreen('pet')} secondary />
              </View>
            ) : (
              <View style={styles.skillRow}>
                <Skill name="迅捷爪击" meta="稳定 · 17—24" icon="paw" color="#FFF0E9" onPress={() => attack('爪击')} />
                <Skill name="烈焰毛球" meta="爆发 · 25—36" icon="flame" color="#F1EBFF" onPress={() => attack('火球')} />
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
          <Feature icon="sparkles" title="生成卡牌" body="用真实照片创造专属英雄" color="#FEE8DC" onPress={() => setScreen('create')} />
          <Feature icon="flash" title="快速对战" body="三分钟一局的轻策略较量" color="#F5EEFC" onPress={() => { resetBattle(); setScreen('battle'); }} />
          <Feature icon="people" title="附近宠友" body="分享日常，认识同城伙伴" color="#E5F8F0" onPress={() => setScreen('social')} />
        </View>
      </Page>
    );
  }, [screen, pet, draftName, draftImage, isProcessing, processingError, playerHp, enemyHp, battleLog, turn, wide]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.shell}>
        <Header screen={screen} setScreen={setScreen} wide={wide} />
        <ScrollView contentContainerStyle={styles.scroll}>{page}</ScrollView>
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
  return (
    <View style={[styles.petCard, compact && styles.petCardCompact]}>
      <LinearGradient colors={['#151A2D', '#222744', '#111523']} style={styles.cardFrame}>
        <View style={styles.cardTop}><View><Text style={styles.rarity}>EPIC</Text><Text style={styles.cardSeries}>ORIGINAL PARTNER</Text></View><Text style={styles.cardLevel}>{pet.level}</Text></View>
        <View style={styles.petPortrait}><Image source={pet.image ? { uri: pet.image } : defaultCat} style={styles.petImage} /><View style={styles.elementPill}><Ionicons name="flame" size={12} color="#FFD66F" /><Text style={styles.elementText}>{pet.element}</Text></View></View>
        <View style={styles.cardInfo}><View><Text style={styles.petName}>{pet.name}</Text><Text style={styles.petSpecies}>{pet.species}</Text></View><View style={styles.cardStats}><Text style={styles.cardStat}>{pet.hp}<Text style={styles.cardStatLabel}> HP</Text></Text><View style={styles.statDivider} /><Text style={styles.cardStat}>{pet.attack}<Text style={styles.cardStatLabel}> ATK</Text></Text></View></View>
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

function Fighter({ name, image, defaultImage, hp, max, enemy }: { name: string; image?: string; defaultImage: ImageSourcePropType; hp: number; max: number; enemy?: boolean }) {
  return <View style={styles.fighter}><Text style={[styles.fighterTag, enemy && styles.enemyTag]}>{enemy ? '对手' : '我的宠物'}</Text><View style={[styles.fighterOutline, enemy && styles.fighterOutlineEnemy]}><Image source={image ? { uri: image } : defaultImage} style={styles.fighterImage} /></View><Text style={styles.fighterName}>{name}</Text><Progress value={(hp / max) * 100} color={enemy ? colors.peach : colors.mint} /><Text style={styles.hp}>{hp} / {max} HP</Text></View>;
}

function Skill({ name, meta, icon, color, onPress }: { name: string; meta: string; icon: keyof typeof Ionicons.glyphMap; color: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.skill, { backgroundColor: color }, pressed && styles.pressed]}><View style={styles.skillIcon}><Ionicons name={icon} size={26} color={colors.peachDark} /></View><View style={styles.skillCopy}><Text style={styles.skillName}>{name}</Text><Text style={styles.skillMeta}>{meta}</Text></View><Ionicons name="chevron-forward" size={20} color={colors.muted} /></Pressable>;
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
  petCard: { width: 310, borderRadius: 30, padding: 5, backgroundColor: '#D8B75B', shadowColor: '#72552A', shadowOpacity: 0.24, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, alignSelf: 'center', zIndex: 3 }, petCardCompact: { width: 284 }, cardFrame: { borderRadius: 25, padding: 15, overflow: 'hidden', borderWidth: 1, borderColor: '#FFE798' }, cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 3, marginBottom: 10 }, rarity: { color: '#FFD873', fontSize: 12, fontWeight: '900', letterSpacing: 1.3 }, cardSeries: { color: '#969DB5', fontSize: 7, fontWeight: '800', letterSpacing: 1.2, marginTop: 2 }, cardLevel: { color: colors.white, fontSize: 26, fontWeight: '900' }, petPortrait: { height: 250, borderRadius: 18, overflow: 'hidden', borderWidth: 2, borderColor: '#EACB72', backgroundColor: '#15192A' }, petImage: { width: '100%', height: '100%', resizeMode: 'cover' }, elementPill: { position: 'absolute', right: 9, bottom: 9, backgroundColor: '#121522E8', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 13, borderWidth: 1, borderColor: '#D7B861', flexDirection: 'row', gap: 4, alignItems: 'center' }, elementText: { color: '#FFD873', fontSize: 11, fontWeight: '900' }, cardInfo: { marginTop: 13 }, petName: { fontSize: 25, color: colors.white, fontWeight: '900' }, petSpecies: { color: '#9FA5B8', fontSize: 10, marginTop: 2 }, cardStats: { flexDirection: 'row', alignItems: 'center', marginTop: 13, paddingTop: 11, borderTopWidth: 1, borderTopColor: '#FFFFFF1C' }, cardStat: { color: colors.white, fontWeight: '900', fontSize: 16, marginRight: 13 }, cardStatLabel: { color: '#AAB0C2', fontSize: 8 }, statDivider: { width: 1, height: 17, backgroundColor: '#FFFFFF22', marginRight: 13 },
  twoColumn: { gap: 24, alignItems: 'flex-start' }, upload: { flex: 1, width: '100%', minHeight: 490, borderWidth: 2, borderStyle: 'dashed', borderColor: '#E1BDB3', borderRadius: 28, backgroundColor: '#FFF1EA', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, uploadImage: { width: '100%', height: 490, resizeMode: 'cover' }, uploadEmpty: { alignItems: 'center', padding: 30 }, uploadIcon: { width: 70, height: 70, borderRadius: 25, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-5deg' }] }, uploadTitle: { fontSize: 21, fontWeight: '900', color: colors.ink, marginTop: 18 }, uploadHint: { color: colors.muted, marginTop: 7, textAlign: 'center' }, filePill: { backgroundColor: '#FFFFFFA5', borderRadius: 13, paddingHorizontal: 10, paddingVertical: 5, marginTop: 16 }, filePillText: { fontSize: 10, color: colors.muted, fontWeight: '800' }, previewBadge: { position: 'absolute', bottom: 22, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 13, paddingVertical: 8, backgroundColor: '#201B2DDE', borderRadius: 16 }, previewBadgeText: { color: '#FFE6A1', fontSize: 11, fontWeight: '900' }, panel: { flex: 1, width: '100%', backgroundColor: colors.white, borderRadius: 28, padding: 25, borderWidth: 1, borderColor: colors.line }, panelKicker: { color: colors.peachDark, fontSize: 11, fontWeight: '900', letterSpacing: 1.2, marginBottom: 15 }, label: { color: colors.ink, fontWeight: '800', marginBottom: 8 }, input: { height: 52, backgroundColor: '#FCF9FB', borderColor: colors.line, borderWidth: 1, borderRadius: 15, paddingHorizontal: 15, color: colors.ink, fontSize: 16 }, processList: { marginTop: 24, gap: 9 }, processStep: { flexDirection: 'row', gap: 11, alignItems: 'center', paddingVertical: 8 }, processNumber: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, processNumberText: { color: colors.ink, fontWeight: '900', fontSize: 10 }, processCopy: { flex: 1 }, processTitle: { color: colors.ink, fontWeight: '900', fontSize: 13 }, processBody: { color: colors.muted, fontSize: 11, marginTop: 2 }, errorText: { color: '#C83C3C', fontSize: 12, fontWeight: '700', marginTop: 12 }, privacy: { color: colors.muted, fontSize: 11, lineHeight: 18, marginTop: 15 },
  petDashboard: { flex: 1, width: '100%' }, levelLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 }, levelBadge: { width: 54, height: 54, borderRadius: 19, backgroundColor: colors.lilacSoft, alignItems: 'center', justifyContent: 'center' }, levelBadgeText: { color: colors.lilac, fontWeight: '900' }, progress: { height: 9, borderRadius: 9, backgroundColor: '#EDE8EF', overflow: 'hidden' }, progressFill: { height: '100%', borderRadius: 9 }, statsGrid: { flexDirection: 'row', gap: 10, marginVertical: 20, flexWrap: 'wrap' }, stat: { flexGrow: 1, flexBasis: 95, minHeight: 105, borderRadius: 20, padding: 13, justifyContent: 'center' }, statValue: { fontSize: 21, fontWeight: '900', color: colors.ink, marginTop: 7 }, statLabel: { fontSize: 10, color: colors.muted, marginTop: 1 }, todayCard: { borderRadius: 25, padding: 20 }, todayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, todayKicker: { color: '#EAE2FF', fontSize: 10, fontWeight: '900', letterSpacing: 1.4 }, todayDate: { backgroundColor: '#FFFFFF24', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 5 }, todayDateText: { color: colors.white, fontSize: 9, fontWeight: '900' }, todayTitle: { color: colors.white, fontSize: 19, fontWeight: '900', marginTop: 9, marginBottom: 8 }, task: { minHeight: 48, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#FFFFFF24', gap: 10 }, taskCheck: { width: 22, height: 22, borderRadius: 8, borderWidth: 1, borderColor: '#FFFFFF99', alignItems: 'center', justifyContent: 'center' }, taskCheckDone: { backgroundColor: colors.mint, borderColor: colors.mint }, taskTitle: { flex: 1, color: colors.white, fontWeight: '700', fontSize: 12 }, taskReward: { color: '#F4DFFF', fontSize: 10, fontWeight: '800' },
  turnPill: { alignSelf: 'center', flexDirection: 'row', gap: 7, alignItems: 'center', backgroundColor: colors.white, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, marginBottom: -15, zIndex: 3, borderWidth: 1, borderColor: colors.line }, liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.mint }, turnText: { color: colors.ink, fontSize: 11, fontWeight: '900' }, arena: { minHeight: 390, borderRadius: 30, padding: 28, paddingTop: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', overflow: 'hidden' }, fighter: { width: '38%', maxWidth: 280, alignItems: 'center' }, fighterTag: { color: '#3B8B6C', backgroundColor: colors.mintSoft, borderRadius: 11, paddingHorizontal: 9, paddingVertical: 4, fontSize: 9, fontWeight: '900' }, enemyTag: { color: colors.peachDark, backgroundColor: colors.peachSoft }, fighterOutline: { width: 155, height: 155, borderRadius: 50, padding: 5, marginVertical: 14, backgroundColor: '#F0C959', shadowColor: '#F0B733', shadowOpacity: 0.55, shadowRadius: 16, transform: [{ rotate: '2deg' }] }, fighterOutlineEnemy: { backgroundColor: '#91B8EF', shadowColor: '#568CD7', transform: [{ rotate: '-2deg' }] }, fighterImage: { width: '100%', height: '100%', borderRadius: 45, resizeMode: 'cover', borderWidth: 3, borderColor: colors.white }, fighterName: { fontSize: 20, fontWeight: '900', color: colors.ink, marginBottom: 10 }, hp: { color: colors.muted, fontSize: 10, fontWeight: '800', marginTop: 6 }, vsBadge: { width: 58, height: 58, borderRadius: 22, backgroundColor: colors.peach, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-8deg' }], shadowColor: colors.peachDark, shadowOpacity: 0.25, shadowRadius: 10 }, vsText: { color: colors.white, fontWeight: '900', fontSize: 20 }, battleConsole: { backgroundColor: colors.white, borderRadius: 25, padding: 20, marginTop: 15, borderWidth: 1, borderColor: colors.line }, logBubble: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingBottom: 16 }, battleLog: { color: colors.ink, fontWeight: '800', fontSize: 13 }, skillRow: { flexDirection: 'row', gap: 11 }, skill: { flex: 1, minHeight: 80, borderRadius: 19, flexDirection: 'row', alignItems: 'center', padding: 13, gap: 11 }, skillIcon: { width: 46, height: 46, borderRadius: 16, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' }, skillCopy: { flex: 1 }, skillName: { color: colors.ink, fontWeight: '900' }, skillMeta: { color: colors.muted, fontSize: 10, marginTop: 3 },
  nearbyStrip: { maxWidth: 680, width: '100%', alignSelf: 'center', backgroundColor: colors.peachSoft, borderRadius: 23, padding: 18, marginBottom: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, nearbyTitle: { color: colors.ink, fontWeight: '900' }, avatarRow: { flexDirection: 'row', alignItems: 'center' }, nearbyAvatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: colors.white }, avatarOverlap: { marginLeft: -9 }, moreAvatar: { marginLeft: -9, backgroundColor: colors.peach, alignItems: 'center', justifyContent: 'center' }, moreAvatarText: { color: colors.white, fontSize: 9, fontWeight: '900' }, feed: { gap: 18, maxWidth: 680, width: '100%', alignSelf: 'center' }, post: { backgroundColor: colors.white, borderRadius: 25, padding: 16, borderWidth: 1, borderColor: colors.line }, postHeader: { flexDirection: 'row', gap: 10, alignItems: 'center' }, postAvatarImage: { width: 43, height: 43, borderRadius: 16, resizeMode: 'cover' }, postIdentity: { flex: 1 }, postName: { color: colors.ink, fontWeight: '900' }, postDistance: { color: colors.muted, fontSize: 10, marginTop: 2 }, postPhotoImage: { width: '100%', height: 330, borderRadius: 19, resizeMode: 'cover', marginTop: 13, backgroundColor: '#171319' }, postText: { color: colors.ink, lineHeight: 21, marginTop: 13 }, postActions: { flexDirection: 'row', gap: 23, marginTop: 14, paddingTop: 13, borderTopWidth: 1, borderTopColor: colors.line }, postAction: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  mobileNav: { position: 'absolute', bottom: 11, left: 16, right: 16, height: 62, backgroundColor: colors.white, borderRadius: 22, flexDirection: 'row', padding: 7, shadowColor: '#5F4C5B', shadowOpacity: 0.16, shadowRadius: 16, shadowOffset: { width: 0, height: 5 }, borderWidth: 1, borderColor: colors.line }, mobileNavItem: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 16 }, mobileNavActive: { backgroundColor: colors.peachSoft, flexDirection: 'row', gap: 6 }, mobileLabelActive: { color: colors.peachDark, fontSize: 11, fontWeight: '900' },
});
