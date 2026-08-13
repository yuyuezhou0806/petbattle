import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { useMemo, useState } from 'react';
import {
  Image,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

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
  ink: '#201A2B',
  muted: '#746D7D',
  paper: '#FFF9F0',
  purple: '#6D4AFF',
  purpleDark: '#4A2AD0',
  coral: '#FF6B59',
  mint: '#71D7B0',
  yellow: '#FFD768',
  line: '#E9E0F0',
};

const initialPet: Pet = {
  name: '团子',
  species: '中华田园猫',
  element: '烈焰',
  level: 8,
  hp: 126,
  attack: 38,
};

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [pet, setPet] = useState<Pet>(initialPet);
  const [draftName, setDraftName] = useState('');
  const [draftImage, setDraftImage] = useState<string>();
  const [playerHp, setPlayerHp] = useState(initialPet.hp);
  const [enemyHp, setEnemyHp] = useState(112);
  const [battleLog, setBattleLog] = useState('轮到你了，选择团子的技能！');
  const [turn, setTurn] = useState(1);
  const { width } = useWindowDimensions();
  const wide = width >= 840;

  const pickImage = async (camera = false) => {
    const result = camera
      ? await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: true, aspect: [4, 5] })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.8, allowsEditing: true, aspect: [4, 5] });
    if (!result.canceled) setDraftImage(result.assets[0].uri);
  };

  const generatePet = () => {
    const seed = (draftName || '新伙伴').length + (draftImage?.length || 0);
    const elements: Element[] = ['烈焰', '潮汐', '森林'];
    const next: Pet = {
      name: draftName.trim() || '新伙伴',
      species: 'AI 待识别宠物',
      element: elements[seed % elements.length],
      level: 1,
      hp: 98 + (seed % 18),
      attack: 25 + (seed % 12),
      image: draftImage,
    };
    setPet(next);
    setPlayerHp(next.hp);
    setScreen('pet');
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
    setBattleLog(
      nextPlayer === 0
        ? `对手反击造成 ${counter} 点伤害，${pet.name}需要休息。`
        : `${pet.name}的${skill}造成 ${damage} 点伤害，对手反击 ${counter} 点。`,
    );
  };

  const page = useMemo(() => {
    if (screen === 'create') {
      return (
        <Page title="召唤你的宠物英雄" subtitle="拍一张清晰正脸照，我们会把真实特征变成专属战斗卡。">
          <View style={[styles.createGrid, wide && styles.row]}>
            <Pressable style={styles.upload} onPress={() => pickImage(false)}>
              {draftImage ? (
                <Image source={{ uri: draftImage }} style={styles.uploadImage} />
              ) : (
                <>
                  <Text style={styles.uploadIcon}>📸</Text>
                  <Text style={styles.uploadTitle}>添加宠物照片</Text>
                  <Text style={styles.uploadHint}>支持 JPG、PNG · 建议光线充足</Text>
                </>
              )}
            </Pressable>
            <View style={styles.formCard}>
              <Text style={styles.label}>宠物名字</Text>
              <TextInput
                value={draftName}
                onChangeText={setDraftName}
                placeholder="例如：团子"
                placeholderTextColor="#ACA4B4"
                style={styles.input}
              />
              <Text style={styles.label}>获取照片</Text>
              <View style={styles.inlineButtons}>
                <ActionButton label="打开相机" onPress={() => pickImage(true)} secondary />
                <ActionButton label="选择相册" onPress={() => pickImage(false)} secondary />
              </View>
              <ActionButton label="生成宠物卡牌 ✨" onPress={generatePet} disabled={!draftImage} />
              <Text style={styles.privacy}>照片仅用于生成宠物形象。正式版将提供删除原图和隐私设置。</Text>
            </View>
          </View>
        </Page>
      );
    }

    if (screen === 'pet') {
      return (
        <Page title="我的宠物英雄" subtitle="每次陪伴与训练，都会让它变得更强。">
          <View style={[styles.petLayout, wide && styles.row]}>
            <PetCard pet={pet} large />
            <View style={styles.petPanel}>
              <View style={styles.levelLine}>
                <Text style={styles.sectionTitle}>成长进度</Text>
                <Text style={styles.level}>Lv.{pet.level}</Text>
              </View>
              <Progress value={62} color={colors.purple} />
              <View style={styles.statsRow}>
                <Stat emoji="❤️" value={pet.hp} label="生命" />
                <Stat emoji="⚔️" value={pet.attack} label="攻击" />
                <Stat emoji="🛡️" value={21} label="防御" />
              </View>
              <Text style={styles.sectionTitle}>今日陪伴</Text>
              <Task title="一起玩耍" reward="+20 经验" done />
              <Task title="完成一次对战" reward="+30 经验" />
              <View style={styles.inlineButtons}>
                <ActionButton label="开始对战" onPress={() => { resetBattle(); setScreen('battle'); }} />
                <ActionButton label="重新建卡" onPress={() => setScreen('create')} secondary />
              </View>
            </View>
          </View>
        </Page>
      );
    }

    if (screen === 'battle') {
      const ended = playerHp <= 0 || enemyHp <= 0;
      return (
        <Page title="训练场" subtitle={`第 ${turn} 回合 · 单机规则原型`}>
          <View style={styles.arena}>
            <Fighter name="影爪" emoji="🐺" hp={enemyHp} max={112} enemy />
            <View style={styles.vsBadge}><Text style={styles.vsText}>VS</Text></View>
            <Fighter name={pet.name} image={pet.image} emoji="🐱" hp={playerHp} max={pet.hp} />
          </View>
          <View style={styles.battleConsole}>
            <Text style={styles.battleLog}>{battleLog}</Text>
            {ended ? (
              <View style={styles.inlineButtons}>
                <ActionButton label="再来一局" onPress={resetBattle} />
                <ActionButton label="返回宠物" onPress={() => setScreen('pet')} secondary />
              </View>
            ) : (
              <View style={styles.skillRow}>
                <Skill name="迅捷爪击" meta="稳定 · 17–24" emoji="🐾" onPress={() => attack('爪击')} />
                <Skill name="烈焰毛球" meta="爆发 · 25–36" emoji="🔥" onPress={() => attack('火球')} />
              </View>
            )}
          </View>
        </Page>
      );
    }

    if (screen === 'social') {
      return (
        <Page title="宠友广场" subtitle="看看附近宠友的最新冒险。精确位置永远不会公开。">
          <View style={styles.feed}>
            <SocialPost name="柯基布丁" distance="1.2 km 内" emoji="🐶" text="今天第一次赢下训练赛，奖励自己一个大鸡腿！" />
            <SocialPost name="缅因船长" distance="3 km 内" emoji="🐈" text="寻找森林系伙伴周末切磋，有没有宠友一起？" />
          </View>
        </Page>
      );
    }

    return (
      <Page title="把最熟悉的伙伴，变成独一无二的英雄" subtitle="拍下真实宠物，生成专属卡牌，一起成长、对战并认识附近宠友。">
        <View style={[styles.hero, wide && styles.row]}>
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>🐾 每一只宠物都有自己的故事</Text>
            <Text style={styles.heroTitle}>宠物对决</Text>
            <Text style={styles.heroBody}>从一张照片开始，建立属于你和宠物的冒险小队。</Text>
            <View style={styles.inlineButtons}>
              <ActionButton label="创建我的宠物卡" onPress={() => setScreen('create')} />
              <ActionButton label="看看我的宠物" onPress={() => setScreen('pet')} secondary />
            </View>
          </View>
          <PetCard pet={pet} large />
        </View>
        <Text style={styles.sectionTitle}>今天想做什么？</Text>
        <View style={styles.featureGrid}>
          <Feature emoji="📸" title="生成卡牌" body="用真实照片创造专属英雄" color="#FFF0C8" onPress={() => setScreen('create')} />
          <Feature emoji="⚔️" title="快速对战" body="三分钟一局的策略较量" color="#FFE2DB" onPress={() => { resetBattle(); setScreen('battle'); }} />
          <Feature emoji="💬" title="附近宠友" body="分享日常，认识同城伙伴" color="#DFF7EC" onPress={() => setScreen('social')} />
        </View>
      </Page>
    );
  }, [screen, pet, draftName, draftImage, playerHp, enemyHp, battleLog, turn, wide]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.shell}>
        <Header screen={screen} setScreen={setScreen} />
        <ScrollView contentContainerStyle={styles.scroll}>{page}</ScrollView>
        <MobileNav screen={screen} setScreen={setScreen} />
      </View>
    </SafeAreaView>
  );
}

function Header({ screen, setScreen }: { screen: Screen; setScreen: (screen: Screen) => void }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={() => setScreen('home')}><Text style={styles.brand}>PAW⚡DUEL</Text></Pressable>
      <View style={styles.desktopNav}>
        {(['home', 'pet', 'battle', 'social'] as Screen[]).map((item) => (
          <Pressable key={item} onPress={() => setScreen(item)} style={[styles.navItem, screen === item && styles.navActive]}>
            <Text style={[styles.navText, screen === item && styles.navTextActive]}>{navLabel[item]}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.avatar}><Text>🐱</Text></View>
    </View>
  );
}

function MobileNav({ screen, setScreen }: { screen: Screen; setScreen: (screen: Screen) => void }) {
  return (
    <View style={styles.mobileNav}>
      {(['home', 'pet', 'battle', 'social'] as Screen[]).map((item) => (
        <Pressable key={item} onPress={() => setScreen(item)} style={styles.mobileNavItem}>
          <Text style={styles.mobileIcon}>{navIcon[item]}</Text>
          <Text style={[styles.mobileLabel, screen === item && styles.mobileLabelActive]}>{navLabel[item]}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const navLabel: Record<Screen, string> = { home: '首页', create: '建卡', pet: '宠物', battle: '对战', social: '宠友' };
const navIcon: Record<Screen, string> = { home: '⌂', create: '＋', pet: '🐾', battle: '⚔', social: '◉' };

function Page({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <View style={styles.page}>
      <View style={styles.pageIntro}><Text style={styles.pageTitle}>{title}</Text><Text style={styles.pageSubtitle}>{subtitle}</Text></View>
      {children}
    </View>
  );
}

function PetCard({ pet, large = false }: { pet: Pet; large?: boolean }) {
  return (
    <View style={[styles.petCard, large && styles.petCardLarge]}>
      <View style={styles.cardTop}><Text style={styles.rarity}>EPIC · 专属卡</Text><Text style={styles.cardLevel}>LV {pet.level}</Text></View>
      <View style={styles.petPortrait}>
        {pet.image ? <Image source={{ uri: pet.image }} style={styles.petImage} /> : <Text style={styles.petEmoji}>🐱</Text>}
        <View style={styles.elementPill}><Text style={styles.elementText}>🔥 {pet.element}</Text></View>
      </View>
      <Text style={styles.petName}>{pet.name}</Text>
      <Text style={styles.petSpecies}>{pet.species}</Text>
      <View style={styles.cardStats}><Text style={styles.cardStat}>❤️ {pet.hp}</Text><Text style={styles.cardStat}>⚔️ {pet.attack}</Text></View>
    </View>
  );
}

function ActionButton({ label, onPress, secondary, disabled }: { label: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, secondary && styles.buttonSecondary, disabled && styles.buttonDisabled, pressed && styles.pressed]}>
      <Text style={[styles.buttonText, secondary && styles.buttonTextSecondary]}>{label}</Text>
    </Pressable>
  );
}

function Feature({ emoji, title, body, color, onPress }: { emoji: string; title: string; body: string; color: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.feature, { backgroundColor: color }]}><Text style={styles.featureEmoji}>{emoji}</Text><Text style={styles.featureTitle}>{title}</Text><Text style={styles.featureBody}>{body}</Text><Text style={styles.featureArrow}>进入 →</Text></Pressable>;
}

function Stat({ emoji, value, label }: { emoji: string; value: number; label: string }) {
  return <View style={styles.stat}><Text style={styles.statEmoji}>{emoji}</Text><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

function Progress({ value, color }: { value: number; color: string }) {
  return <View style={styles.progress}><View style={[styles.progressFill, { width: `${value}%`, backgroundColor: color }]} /></View>;
}

function Task({ title, reward, done }: { title: string; reward: string; done?: boolean }) {
  return <View style={styles.task}><Text style={styles.taskCheck}>{done ? '✓' : '○'}</Text><Text style={styles.taskTitle}>{title}</Text><Text style={styles.taskReward}>{reward}</Text></View>;
}

function Fighter({ name, emoji, image, hp, max, enemy }: { name: string; emoji: string; image?: string; hp: number; max: number; enemy?: boolean }) {
  return (
    <View style={styles.fighter}>
      <Text style={styles.fighterTag}>{enemy ? '对手' : '我的宠物'}</Text>
      {image ? <Image source={{ uri: image }} style={styles.fighterImage} /> : <Text style={styles.fighterEmoji}>{emoji}</Text>}
      <Text style={styles.fighterName}>{name}</Text>
      <Progress value={(hp / max) * 100} color={enemy ? colors.coral : colors.mint} />
      <Text style={styles.hp}>{hp} / {max} HP</Text>
    </View>
  );
}

function Skill({ name, meta, emoji, onPress }: { name: string; meta: string; emoji: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.skill, pressed && styles.pressed]}><Text style={styles.skillEmoji}>{emoji}</Text><View><Text style={styles.skillName}>{name}</Text><Text style={styles.skillMeta}>{meta}</Text></View></Pressable>;
}

function SocialPost({ name, distance, emoji, text }: { name: string; distance: string; emoji: string; text: string }) {
  return (
    <View style={styles.post}>
      <View style={styles.postHeader}><View style={styles.postAvatar}><Text style={styles.postEmoji}>{emoji}</Text></View><View><Text style={styles.postName}>{name}</Text><Text style={styles.postDistance}>📍 {distance}</Text></View></View>
      <View style={styles.postPhoto}><Text style={styles.postHero}>{emoji}</Text></View>
      <Text style={styles.postText}>{text}</Text>
      <Text style={styles.postActions}>♡ 赞　　💬 评论　　⚔ 发起切磋</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper }, shell: { flex: 1 }, scroll: { paddingBottom: 96 },
  header: { height: 70, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(255,249,240,0.97)', borderBottomWidth: 1, borderBottomColor: colors.line },
  brand: { fontSize: 20, fontWeight: '900', color: colors.purpleDark, letterSpacing: 0.5 }, desktopNav: { flexDirection: 'row', gap: 8 }, navItem: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20 }, navActive: { backgroundColor: '#EDE7FF' }, navText: { color: colors.muted, fontWeight: '700' }, navTextActive: { color: colors.purple }, avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.yellow, alignItems: 'center', justifyContent: 'center' },
  page: { width: '100%', maxWidth: 1100, alignSelf: 'center', paddingHorizontal: 22, paddingTop: 42 }, pageIntro: { maxWidth: 760, marginBottom: 28 }, pageTitle: { color: colors.ink, fontSize: 34, lineHeight: 43, fontWeight: '900' }, pageSubtitle: { color: colors.muted, fontSize: 16, lineHeight: 25, marginTop: 8 },
  hero: { backgroundColor: '#F0EAFF', borderRadius: 30, padding: 28, gap: 30, alignItems: 'center', marginBottom: 36, overflow: 'hidden' }, row: { flexDirection: 'row' }, heroCopy: { flex: 1, minWidth: 260 }, eyebrow: { color: colors.purpleDark, fontWeight: '800', marginBottom: 10 }, heroTitle: { fontSize: 48, lineHeight: 56, fontWeight: '900', color: colors.ink }, heroBody: { fontSize: 18, lineHeight: 28, color: colors.muted, marginTop: 10, marginBottom: 22 },
  inlineButtons: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginTop: 16 }, button: { minHeight: 48, backgroundColor: colors.purple, borderRadius: 16, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', shadowColor: colors.purple, shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 5 } }, buttonSecondary: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.line, shadowOpacity: 0 }, buttonDisabled: { opacity: 0.38 }, buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' }, buttonTextSecondary: { color: colors.ink }, pressed: { opacity: 0.76, transform: [{ scale: 0.98 }] },
  sectionTitle: { color: colors.ink, fontSize: 20, fontWeight: '900', marginBottom: 16, marginTop: 6 }, featureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 }, feature: { flexGrow: 1, flexBasis: 220, borderRadius: 24, padding: 22, minHeight: 190 }, featureEmoji: { fontSize: 32 }, featureTitle: { color: colors.ink, fontWeight: '900', fontSize: 20, marginTop: 18 }, featureBody: { color: colors.muted, lineHeight: 21, marginTop: 6 }, featureArrow: { color: colors.purpleDark, fontWeight: '800', marginTop: 'auto' },
  petCard: { width: 265, backgroundColor: '#FFFFFF', padding: 14, borderRadius: 26, borderWidth: 2, borderColor: '#BBAAFF', shadowColor: '#32178A', shadowOpacity: 0.14, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, alignSelf: 'center' }, petCardLarge: { width: 290 }, cardTop: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 10 }, rarity: { color: colors.purpleDark, fontSize: 11, fontWeight: '900' }, cardLevel: { color: colors.muted, fontSize: 11, fontWeight: '800' }, petPortrait: { height: 245, borderRadius: 19, backgroundColor: '#FFE1A8', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, petEmoji: { fontSize: 112 }, petImage: { width: '100%', height: '100%', resizeMode: 'cover' }, elementPill: { position: 'absolute', right: 10, bottom: 10, backgroundColor: '#FFFFFFDD', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 13 }, elementText: { color: colors.coral, fontSize: 12, fontWeight: '900' }, petName: { fontSize: 25, color: colors.ink, fontWeight: '900', marginTop: 13 }, petSpecies: { color: colors.muted, fontSize: 12, marginTop: 2 }, cardStats: { flexDirection: 'row', gap: 14, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.line }, cardStat: { color: colors.ink, fontWeight: '800' },
  createGrid: { gap: 24, alignItems: 'stretch' }, upload: { flex: 1, minHeight: 430, borderWidth: 2, borderStyle: 'dashed', borderColor: '#B9A8E8', borderRadius: 28, backgroundColor: '#F5F0FF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, uploadImage: { width: '100%', height: '100%', minHeight: 430, resizeMode: 'cover' }, uploadIcon: { fontSize: 52 }, uploadTitle: { fontSize: 20, fontWeight: '900', color: colors.ink, marginTop: 15 }, uploadHint: { color: colors.muted, marginTop: 8 }, formCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 28, padding: 26, borderWidth: 1, borderColor: colors.line }, label: { color: colors.ink, fontWeight: '800', marginBottom: 8, marginTop: 8 }, input: { height: 52, backgroundColor: '#FAF7FC', borderColor: colors.line, borderWidth: 1, borderRadius: 15, paddingHorizontal: 15, color: colors.ink, fontSize: 16 }, privacy: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 16 },
  petLayout: { gap: 30, alignItems: 'flex-start' }, petPanel: { flex: 1, width: '100%', backgroundColor: '#FFFFFF', borderRadius: 28, padding: 25, borderWidth: 1, borderColor: colors.line }, levelLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, level: { color: colors.purple, fontWeight: '900' }, progress: { height: 10, borderRadius: 10, backgroundColor: '#EEEAF1', overflow: 'hidden' }, progressFill: { height: '100%', borderRadius: 10 }, statsRow: { flexDirection: 'row', gap: 10, marginVertical: 24 }, stat: { flex: 1, backgroundColor: '#FAF7FC', borderRadius: 18, padding: 14, alignItems: 'center' }, statEmoji: { fontSize: 19 }, statValue: { fontSize: 20, fontWeight: '900', color: colors.ink, marginTop: 5 }, statLabel: { fontSize: 11, color: colors.muted }, task: { minHeight: 56, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.line, gap: 12 }, taskCheck: { color: colors.mint, fontSize: 22, fontWeight: '900' }, taskTitle: { flex: 1, color: colors.ink, fontWeight: '700' }, taskReward: { color: colors.purple, fontSize: 12, fontWeight: '800' },
  arena: { minHeight: 390, borderRadius: 30, backgroundColor: '#E9F8EF', padding: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', overflow: 'hidden' }, fighter: { width: '38%', maxWidth: 280, alignItems: 'center' }, fighterTag: { color: colors.muted, fontSize: 12, fontWeight: '800' }, fighterEmoji: { fontSize: 92, marginVertical: 16 }, fighterImage: { width: 150, height: 150, borderRadius: 75, resizeMode: 'cover', marginVertical: 16, borderWidth: 5, borderColor: '#FFFFFF' }, fighterName: { fontSize: 21, fontWeight: '900', color: colors.ink, marginBottom: 11 }, hp: { color: colors.muted, fontSize: 12, fontWeight: '700', marginTop: 7 }, vsBadge: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.coral, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-7deg' }] }, vsText: { color: '#FFFFFF', fontWeight: '900', fontSize: 21 }, battleConsole: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 22, marginTop: 18, borderWidth: 1, borderColor: colors.line }, battleLog: { textAlign: 'center', color: colors.ink, fontWeight: '800', marginBottom: 18 }, skillRow: { flexDirection: 'row', gap: 12 }, skill: { flex: 1, minHeight: 75, borderRadius: 18, backgroundColor: '#F5F0FF', borderWidth: 1, borderColor: '#D8CBFA', flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 }, skillEmoji: { fontSize: 29 }, skillName: { color: colors.ink, fontWeight: '900' }, skillMeta: { color: colors.muted, fontSize: 12, marginTop: 3 },
  feed: { gap: 20, maxWidth: 680, width: '100%', alignSelf: 'center' }, post: { backgroundColor: '#FFFFFF', borderRadius: 26, padding: 18, borderWidth: 1, borderColor: colors.line }, postHeader: { flexDirection: 'row', gap: 12, alignItems: 'center' }, postAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#F0EAFF', alignItems: 'center', justifyContent: 'center' }, postEmoji: { fontSize: 26 }, postName: { color: colors.ink, fontWeight: '900' }, postDistance: { color: colors.muted, fontSize: 11, marginTop: 3 }, postPhoto: { height: 270, borderRadius: 20, backgroundColor: '#E8F6DF', alignItems: 'center', justifyContent: 'center', marginTop: 15 }, postHero: { fontSize: 105 }, postText: { color: colors.ink, lineHeight: 22, marginTop: 15 }, postActions: { color: colors.muted, fontWeight: '700', marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.line },
  mobileNav: { display: 'none', height: 68, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: colors.line, flexDirection: 'row' }, mobileNavItem: { flex: 1, alignItems: 'center', justifyContent: 'center' }, mobileIcon: { color: colors.muted, fontSize: 19 }, mobileLabel: { color: colors.muted, fontSize: 10, marginTop: 2 }, mobileLabelActive: { color: colors.purple, fontWeight: '900' },
  ...(Platform.OS !== 'web' || (typeof window !== 'undefined' && window.innerWidth < 700) ? {
    desktopNav: { display: 'none' as const }, mobileNav: { display: 'flex' as const, height: 68, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: colors.line, flexDirection: 'row' as const }, header: { height: 60, paddingHorizontal: 18, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, backgroundColor: '#FFF9F0', borderBottomWidth: 1, borderBottomColor: colors.line }, page: { width: '100%' as const, paddingHorizontal: 16, paddingTop: 26 }, pageTitle: { color: colors.ink, fontSize: 28, lineHeight: 36, fontWeight: '900' as const }, heroTitle: { fontSize: 39, lineHeight: 47, fontWeight: '900' as const, color: colors.ink }, hero: { backgroundColor: '#F0EAFF', borderRadius: 25, padding: 20, gap: 26, alignItems: 'center' as const, marginBottom: 30, overflow: 'hidden' as const }, arena: { minHeight: 330, borderRadius: 25, backgroundColor: '#E9F8EF', padding: 15, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-around' as const, overflow: 'hidden' as const }, fighterEmoji: { fontSize: 65, marginVertical: 16 }, fighterImage: { width: 100, height: 100, borderRadius: 50, resizeMode: 'cover' as const, marginVertical: 16, borderWidth: 4, borderColor: '#FFFFFF' }, skillRow: { flexDirection: 'column' as const, gap: 10 } } : {}),
});
