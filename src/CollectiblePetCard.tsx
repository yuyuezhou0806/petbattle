import { useEffect, useId, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, Pattern, Rect, Stop } from 'react-native-svg';
import { elementThemes, rarityThemes, type CardState, type CollectibleCardData } from './cardSystem';

type Props = { data: CollectibleCardData; width?: number; selected?: boolean; state?: CardState; draggable?: boolean; onDragStateChange?: (dragging: boolean) => void; onPress?: () => void; testID?: string };

const silhouette = 'M38 5 H282 Q304 7 309 31 L316 379 Q318 406 298 423 L282 443 H38 L22 423 Q2 406 4 379 L11 31 Q14 7 38 5 Z';
const inset = 'M43 17 H277 Q291 19 295 37 L303 375 Q304 397 287 411 L274 429 H46 L33 411 Q16 397 17 375 L25 37 Q27 19 43 17 Z';
const artFrame = 'M43 65 L71 43 H249 L277 65 V248 L255 267 H65 L43 248 Z';

function useReduceMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => subscription.remove();
  }, []);
  return reduced;
}

export function PetBattleCard({ data, width = 320, selected = false, state = 'idle', draggable = false, onDragStateChange, onPress, testID }: Props) {
  const theme = rarityThemes[data.rarity];
  const element = elementThemes[data.element];
  const scale = width / 320;
  const textScale = Math.max(scale, 0.58);
  const mini = width < 190;
  const compact = width < 230;
  const reducedMotion = useReduceMotion();
  const lift = useRef(new Animated.Value(0)).current;
  const sheen = useRef(new Animated.Value(-1)).current;
  const reveal = useRef(new Animated.Value(state === 'revealing' ? 0 : 1)).current;
  const impact = useRef(new Animated.Value(0)).current;
  const drag = useRef(new Animated.ValueXY()).current;
  const dust = useRef(new Animated.Value(0)).current;
  const [dragging, setDragging] = useState(false);
  const id = useId().replace(/:/g, '');

  const dragResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => draggable,
    onMoveShouldSetPanResponder: (_, gesture) => draggable && Math.abs(gesture.dy) + Math.abs(gesture.dx) > 4,
    onPanResponderGrant: () => { setDragging(true); onDragStateChange?.(true); },
    onPanResponderMove: Animated.event([null, { dx: drag.x, dy: drag.y }], { useNativeDriver: false }),
    onPanResponderRelease: () => {
      setDragging(false); onDragStateChange?.(false);
      Animated.spring(drag, { toValue: { x: 0, y: 0 }, speed: 18, bounciness: 4, useNativeDriver: false }).start();
      if (!reducedMotion) Animated.sequence([Animated.timing(dust, { toValue: 1, duration: 90, useNativeDriver: false }), Animated.timing(dust, { toValue: 0, duration: 260, useNativeDriver: false })]).start();
    },
    onPanResponderTerminate: () => { setDragging(false); onDragStateChange?.(false); drag.setValue({ x: 0, y: 0 }); },
  })).current;

  useEffect(() => {
    if (state !== 'revealing' || reducedMotion) { reveal.setValue(1); return; }
    reveal.setValue(0);
    Animated.sequence([Animated.delay(280), Animated.spring(reveal, { toValue: 1, speed: 10, bounciness: 5, useNativeDriver: false })]).start();
  }, [reducedMotion, reveal, state]);

  useEffect(() => {
    if (reducedMotion || !theme.sheen) { sheen.setValue(-1); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(data.rarity === 'legendary' || data.rarity === 'mythic' ? 1100 : 2300),
      Animated.timing(sheen, { toValue: 1, duration: 1350, useNativeDriver: false }),
      Animated.delay(2600),
      Animated.timing(sheen, { toValue: -1, duration: 0, useNativeDriver: false }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [data.rarity, reducedMotion, sheen, theme.sheen]);

  useEffect(() => {
    if (state !== 'damaged' || reducedMotion) { impact.setValue(0); return; }
    Animated.sequence([0, -1, 1, -0.6, 0].map((value) => Animated.timing(impact, { toValue: value, duration: 55, useNativeDriver: false }))).start();
  }, [impact, reducedMotion, state]);

  const move = (value: number) => Animated.spring(lift, { toValue: reducedMotion ? 0 : value, speed: 24, bounciness: 3, useNativeDriver: false }).start();
  const attack = data.attributes.find((item) => item.key === 'ATK')?.value ?? 0;
  const health = data.health;
  const ability = data.abilities[0] ?? { name: '陪伴本能', description: `${data.bond}使它在旅途中更加敏锐。` };

  return (
    <Animated.View {...(draggable ? dragResponder.panHandlers : {})} testID={testID} style={[styles.cardShadow, { width, height: width * 1.4, shadowColor: theme.shadow, transform: [
      { perspective: 900 },
      { translateX: drag.x }, { translateY: drag.y },
      { translateY: selected ? -6 : 0 },
      { translateY: lift.interpolate({ inputRange: [-0.3, 0, 1], outputRange: [3, 0, -8] }) },
      { rotateZ: lift.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-1.2deg'] }) },
      { rotateY: reveal.interpolate({ inputRange: [0, 0.48, 0.52, 1], outputRange: ['180deg', '92deg', '88deg', '0deg'] }) },
    ] }] }>
      <Pressable accessibilityRole="button" accessibilityLabel={`${theme.label}${data.name}宠物卡，评分${data.rating}`} onPress={state === 'locked' ? undefined : onPress} onHoverIn={() => move(1)} onHoverOut={() => move(0)} onPressIn={() => move(-0.3)} onPressOut={() => move(0)} style={styles.pressable}>
        <Svg width="100%" height="100%" viewBox="0 0 320 448" style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id={`${id}body`} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor={theme.surface[0]} /><Stop offset="0.5" stopColor={theme.surface[1]} /><Stop offset="1" stopColor={theme.surface[2]} /></LinearGradient>
            <LinearGradient id={`${id}metal`} x1="0" y1="0" x2="1" y2="0"><Stop offset="0" stopColor={theme.frameInner} /><Stop offset="0.48" stopColor={theme.frame} /><Stop offset="0.7" stopColor={theme.accent} /><Stop offset="1" stopColor={theme.frameInner} /></LinearGradient>
            <Pattern id={`${id}grain`} width="16" height="16" patternUnits="userSpaceOnUse"><Rect width="16" height="16" fill="transparent" /><Path d={theme.texture === 'radiant' ? 'M0 16 L16 0 M8 16 L16 8' : theme.texture === 'etched' ? 'M1 8 Q8 2 15 8 Q8 14 1 8' : 'M0 4 Q8 1 16 4 M0 12 Q8 9 16 12'} fill="none" stroke={theme.accent} strokeWidth="0.7" strokeOpacity="0.16" /></Pattern>
          </Defs>
          <Path d={silhouette} fill={`url(#${id}body)`} stroke="#21140E" strokeWidth="5" />
          <Path d={inset} fill={`url(#${id}grain)`} stroke={`url(#${id}metal)`} strokeWidth={data.rarity === 'common' ? 3 : 6} />
          <Path d={artFrame} fill={element.dark} stroke={theme.frameInner} strokeWidth="5" />
          <Path d="M49 69 L74 50 H246 L271 69" fill="none" stroke={element.color} strokeWidth="2" strokeOpacity="0.45" />
          {theme.frameLayers >= 3 && <Path d="M29 145 L18 158 M291 145 L302 158 M29 230 L18 217 M291 230 L302 217" stroke={theme.accent} strokeWidth="4" />}
          {theme.frameLayers >= 4 && <G><Circle cx="32" cy="109" r="4" fill={theme.accent} /><Circle cx="288" cy="109" r="4" fill={theme.accent} /><Path d="M36 28 Q160 7 284 28" fill="none" stroke={theme.accent} strokeWidth="2" /></G>}
          {Array.from({ length: theme.particles }).map((_, index) => <Circle key={index} cx={50 + ((index * 43) % 225)} cy={75 + ((index * 57) % 165)} r={index % 3 === 0 ? 1.8 : 1} fill={index % 2 ? theme.frame : element.color} opacity="0.66" />)}
          {(selected || dragging) && <Path d={silhouette} fill="none" stroke="#FFF0B2" strokeWidth="4" />}
          {state === 'damaged' && <Path d="M256 74 L231 112 L244 140 L218 172 M75 322 L99 299 L88 271" fill="none" stroke="#D6503D" strokeWidth="4" />}
        </Svg>

        <Animated.Image source={data.art} resizeMode="contain" style={{ position: 'absolute', zIndex: 3, left: 42 * scale, top: 51 * scale, width: 236 * scale, height: 216 * scale, transform: [{ translateX: impact.interpolate({ inputRange: [-1, 1], outputRange: [-5, 5] }) }] }} />
        {state === 'exhausted' && <View pointerEvents="none" style={[styles.exhaustedWash, { left: 42 * scale, top: 51 * scale, width: 236 * scale, height: 216 * scale }]} />}
        <View style={[styles.powerSeal, state === 'idle' && styles.energyReady, { left: 17 * scale, top: 19 * scale, width: 66 * scale, height: 66 * scale, borderColor: theme.frame, backgroundColor: theme.frameInner }]}><Text style={[styles.powerValue, { fontSize: 25 * textScale, color: theme.ink }]}>{data.energy}</Text><Text style={[styles.powerLabel, { fontSize: 6.5 * textScale, color: theme.muted }]}>能量</Text></View>
        <View style={[styles.elementRune, { right: 22 * scale, top: 20 * scale, borderColor: element.color, backgroundColor: element.dark }]}><Text style={[styles.elementGlyph, { color: element.color, fontSize: 18 * textScale }]}>{element.glyph}</Text>{!mini && <Text style={[styles.elementLabel, { color: element.color, fontSize: 6.5 * textScale }]}>{element.label}</Text>}</View>
        <View style={[styles.namePlate, { left: 48 * scale, right: 48 * scale, top: 246 * scale, minHeight: 54 * scale, backgroundColor: theme.panel, borderColor: theme.frame }]}><Text numberOfLines={1} style={[styles.name, { color: theme.ink, fontSize: (mini ? 15 : 20) * textScale }]}>{data.name}</Text><Text numberOfLines={1} style={[styles.nameMeta, { color: theme.muted, fontSize: 6.8 * textScale }]}>{compact ? `${data.species} · ${data.role}` : `${data.species} · ${data.role} · ${data.evolution}`}</Text></View>
        <View style={[styles.parchment, state === 'silenced' && styles.silencedParchment, { left: 42 * scale, right: 42 * scale, top: 307 * scale, height: 66 * scale }]}><Text numberOfLines={1} style={[styles.skillTitle, { fontSize: 9 * textScale }]}>{ability.name}</Text>{!mini && <Text numberOfLines={2} style={[styles.skillBody, { fontSize: 8.3 * textScale, lineHeight: 12 * textScale }]}>{ability.description}</Text>}{state === 'silenced' && <Text style={styles.silenceSeal}>封</Text>}</View>
        <View style={[styles.combatOrb, styles.attackOrb, { left: 18 * scale, bottom: 21 * scale, width: 57 * scale, height: 57 * scale, borderColor: theme.frame }]}><View style={styles.combatInner}><Text style={[styles.combatValue, { fontSize: 24 * textScale }]}>{attack}</Text><Text style={[styles.combatLabel, { fontSize: 6.5 * textScale }]}>攻击</Text></View></View>
        <View style={[styles.combatOrb, styles.healthOrb, { right: 18 * scale, bottom: 21 * scale, width: 57 * scale, height: 57 * scale, borderColor: theme.frame }]}><View style={styles.combatInner}><Text style={[styles.combatValue, { fontSize: 21 * textScale }]}>{health}</Text><Text style={[styles.combatLabel, { fontSize: 7 * textScale }]}>生命</Text></View></View>
        <View style={[styles.rarityRune, { bottom: 21 * scale }]}><View style={[styles.gem, { width: 20 * textScale, height: 20 * textScale, backgroundColor: theme.gem, borderColor: theme.frame }]}><View style={styles.gemFacet} /></View>{!mini && <Text style={[styles.rarityText, { color: theme.ink, fontSize: 6.5 * textScale }]}>{theme.label}</Text>}</View>
        {theme.sheen && <Animated.View pointerEvents="none" style={[styles.sheen, { backgroundColor: theme.frame, opacity: data.rarity === 'legendary' ? 0.18 : 0.1, transform: [{ translateX: sheen.interpolate({ inputRange: [-1, 1], outputRange: [-width, width * 1.3] }) }, { rotate: '14deg' }] }]} />}
        {state === 'locked' && <View style={styles.stateOverlay}><Text style={styles.stateIcon}>⌁</Text><Text style={styles.stateLabel}>收藏已锁定</Text></View>}
        {state === 'healing' && <View pointerEvents="none" style={styles.healEffect}><Text style={styles.healRune}>⌁  +  ⌁</Text></View>}
        {state === 'shielded' && <View pointerEvents="none" style={styles.shieldEffect} />}
        {state === 'poisoned' && <View pointerEvents="none" style={styles.poisonEffect}><Text style={styles.poisonBubbles}>◦  ●  ◦</Text></View>}
        {state === 'defeated' && <View pointerEvents="none" style={styles.defeatedEffect}><Text style={styles.defeatedCrack}>╱╲{`\n`} ╳</Text></View>}
        {dragging && <View pointerEvents="none" style={styles.dragHint}><Text style={styles.dragHintText}>释放到有效目标</Text></View>}
        <Animated.View pointerEvents="none" style={[styles.dropDust, { opacity: dust, transform: [{ scaleX: dust.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.2] }) }] }]}><Text style={styles.dropDustText}>·  ·  ·  ·</Text></Animated.View>
        {state === 'upgrading' && <View pointerEvents="none" style={[styles.upgradeEdge, { borderColor: theme.gem }]} />}
        {state === 'revealing' && <Animated.View pointerEvents="none" style={[styles.revealGlow, { backgroundColor: theme.gem, opacity: reveal.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.8, 0.42, 0] }) }]} />}
      </Pressable>
    </Animated.View>
  );
}

export const CollectiblePetCard = PetBattleCard;

const styles = StyleSheet.create({
  cardShadow: { shadowOpacity: 0.42, shadowRadius: 13, shadowOffset: { width: 0, height: 9 }, elevation: 11 }, pressable: { flex: 1, overflow: 'hidden' }, exhaustedWash: { position: 'absolute', zIndex: 4, backgroundColor: '#6E706FB0' },
  powerSeal: { position: 'absolute', zIndex: 8, borderWidth: 3, borderRadius: 10, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-5deg' }], shadowColor: '#170D08', shadowOpacity: 0.45, shadowRadius: 4 }, energyReady: { shadowColor: '#F2C36C', shadowOpacity: 0.72, shadowRadius: 7 }, powerValue: { fontWeight: '900', lineHeight: 28, fontFamily: 'serif' }, powerLabel: { fontWeight: '900', letterSpacing: 1 },
  elementRune: { position: 'absolute', zIndex: 8, width: 50, minHeight: 50, borderWidth: 2, borderRadius: 8, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '4deg' }] }, elementGlyph: { fontWeight: '900' }, elementLabel: { fontWeight: '900', letterSpacing: 0.7, marginTop: 1 },
  rarityRune: { position: 'absolute', zIndex: 10, left: 0, right: 0, alignItems: 'center' }, gem: { transform: [{ rotate: '45deg' }], borderWidth: 2, alignItems: 'center', justifyContent: 'center', shadowColor: '#FFF0B2', shadowOpacity: 0.65, shadowRadius: 6 }, gemFacet: { width: '42%', height: '42%', borderTopWidth: 1, borderLeftWidth: 1, borderColor: '#FFFFFFAA' }, rarityText: { marginTop: 5, fontWeight: '900', letterSpacing: 0.8 },
  namePlate: { position: 'absolute', zIndex: 7, borderWidth: 2, borderRadius: 5, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', shadowColor: '#140A05', shadowOpacity: 0.55, shadowRadius: 4 }, name: { fontWeight: '900', fontFamily: 'serif', letterSpacing: 1 }, nameMeta: { fontWeight: '800', marginTop: 1 },
  parchment: { position: 'absolute', zIndex: 6, backgroundColor: '#E8D4A5', borderTopWidth: 2, borderBottomWidth: 2, borderColor: '#9A7241', paddingHorizontal: 14, paddingVertical: 8, justifyContent: 'center' }, silencedParchment: { backgroundColor: '#B8AB91', borderColor: '#63584B' }, silenceSeal: { position: 'absolute', right: 9, color: '#6A4935', fontSize: 18, fontWeight: '900', borderWidth: 2, borderColor: '#6A4935', paddingHorizontal: 4 }, skillTitle: { color: '#44301F', fontWeight: '900', textAlign: 'center' }, skillBody: { color: '#5F4932', fontWeight: '700', textAlign: 'center', marginTop: 4 },
  combatOrb: { position: 'absolute', zIndex: 9, borderWidth: 3, borderRadius: 10, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '45deg' }], shadowColor: '#140A05', shadowOpacity: 0.55, shadowRadius: 5 }, combatInner: { alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-45deg' }] }, attackOrb: { backgroundColor: '#62483A' }, healthOrb: { backgroundColor: '#3D5A50' }, combatValue: { color: '#FFF4D0', fontWeight: '900', lineHeight: 24, fontFamily: 'serif' }, combatLabel: { color: '#E7D7BB', fontWeight: '900', letterSpacing: 0.8 },
  footerMark: { position: 'absolute', zIndex: 6, left: 70, right: 70, alignItems: 'center' }, footerText: { fontWeight: '900', letterSpacing: 0.5 }, sheen: { position: 'absolute', zIndex: 12, top: -90, bottom: -90, width: 32 },
  stateOverlay: { position: 'absolute', inset: 0, zIndex: 20, backgroundColor: '#1D110DDD', alignItems: 'center', justifyContent: 'center' }, stateIcon: { color: '#E6C791', fontSize: 40, fontWeight: '900' }, stateLabel: { color: '#FFF0D0', fontSize: 11, fontWeight: '900', letterSpacing: 1, marginTop: 7 }, healEffect: { position: 'absolute', zIndex: 16, inset: 8, borderWidth: 3, borderColor: '#78B68A', justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 78 }, healRune: { color: '#A9E7B7', fontSize: 19, fontWeight: '900' }, shieldEffect: { position: 'absolute', zIndex: 16, inset: 4, borderWidth: 7, borderColor: '#B4D9D0A8', borderRadius: 28, backgroundColor: '#D5F1EA20' }, poisonEffect: { position: 'absolute', zIndex: 16, inset: 7, borderWidth: 3, borderColor: '#6F9A55', justifyContent: 'flex-start', alignItems: 'flex-end', padding: 18 }, poisonBubbles: { color: '#9BC46E', fontSize: 19, fontWeight: '900' }, defeatedEffect: { position: 'absolute', zIndex: 18, inset: 6, backgroundColor: '#211B18B5', alignItems: 'center', justifyContent: 'center' }, defeatedCrack: { color: '#C6BBA9', fontSize: 37, fontWeight: '900', lineHeight: 42 }, dragHint: { position: 'absolute', zIndex: 24, left: 52, right: 52, top: 208, paddingVertical: 7, backgroundColor: '#2F2119E8', borderWidth: 1, borderColor: '#E5B966', alignItems: 'center' }, dragHintText: { color: '#FFE7AE', fontSize: 8, fontWeight: '900', letterSpacing: 0.5 }, dropDust: { position: 'absolute', zIndex: 25, left: 44, right: 44, bottom: 4, alignItems: 'center' }, dropDustText: { color: '#C8A36A', fontSize: 18, fontWeight: '900', letterSpacing: 6 }, upgradeEdge: { position: 'absolute', zIndex: 15, inset: 7, borderWidth: 4, borderRadius: 24, shadowColor: '#FFF4B0', shadowOpacity: 0.8, shadowRadius: 12 }, revealGlow: { position: 'absolute', zIndex: 30, inset: 0 },
});
