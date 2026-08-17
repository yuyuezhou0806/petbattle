import { useEffect, useId, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, Pattern, Rect, Stop } from 'react-native-svg';
import { elementThemes, rarityThemes, type CardState, type CollectibleCardData } from './cardSystem';

type Props = {
  data: CollectibleCardData;
  width?: number;
  selected?: boolean;
  state?: CardState;
  onPress?: () => void;
  testID?: string;
};

const outerPath = 'M28 4 H102 L117 18 H203 L218 4 H292 L316 28 V394 L299 416 V444 H21 V416 L4 394 V28 Z';
const middlePath = 'M31 12 H99 L114 26 H206 L221 12 H289 L307 31 V389 L291 410 V435 H29 V410 L13 389 V31 Z';
const innerPath = 'M37 22 H96 L110 35 H210 L224 22 H283 L297 35 V384 L281 402 V425 H39 V402 L23 384 V35 Z';

function useReduceMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => subscription.remove();
  }, []);
  return reduced;
}

export function CollectiblePetCard({ data, width = 320, selected = false, state = 'idle', onPress, testID }: Props) {
  const theme = rarityThemes[data.rarity];
  const element = elementThemes[data.element];
  const scale = width / 320;
  const textScale = Math.max(scale, 0.58);
  const mini = width < 190;
  const compact = width < 260;
  const reducedMotion = useReduceMotion();
  const lift = useRef(new Animated.Value(0)).current;
  const sheen = useRef(new Animated.Value(-1)).current;
  const upgrade = useRef(new Animated.Value(0)).current;
  const id = useId().replace(/:/g, '');

  useEffect(() => {
    if (reducedMotion || !theme.sheen) { sheen.setValue(-1); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(data.rarity === 'legendary' || data.rarity === 'mythic' ? 900 : 1800),
      Animated.timing(sheen, { toValue: 1, duration: data.rarity === 'mythic' ? 1500 : 1900, useNativeDriver: true }),
      Animated.delay(2200),
      Animated.timing(sheen, { toValue: -1, duration: 0, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [data.rarity, reducedMotion, sheen, theme.sheen]);

  useEffect(() => {
    if (reducedMotion || state !== 'upgrading') { upgrade.setValue(0); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(upgrade, { toValue: 1, duration: 650, useNativeDriver: true }),
      Animated.timing(upgrade, { toValue: 0, duration: 650, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [reducedMotion, state, upgrade]);

  const animateLift = (value: number) => {
    Animated.spring(lift, { toValue: reducedMotion ? 0 : value, speed: 24, bounciness: 4, useNativeDriver: true }).start();
  };
  const visibleAttributes = mini ? data.attributes.slice(0, 3) : data.attributes;
  const texturePath = theme.texture === 'stellar'
    ? 'M1 1h1M8 7h1'
    : theme.texture === 'etched'
      ? 'M0 10 L5 5 L10 10'
      : theme.texture === 'radiant'
        ? 'M0 11 L11 0 M11 11 L22 0'
        : 'M0 1 H22';

  return (
    <Animated.View
      testID={testID}
      style={{
        width,
        height: width * 1.4,
        transform: [
          { translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [0, -7] }) },
          { scale: Animated.add(1, Animated.multiply(upgrade, 0.012)) },
        ],
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${theme.label}${data.name}收藏卡，评分${data.rating}`}
        onPress={state === 'locked' ? undefined : onPress}
        onHoverIn={() => animateLift(1)}
        onHoverOut={() => animateLift(0)}
        style={styles.pressable}
      >
        <Svg width="100%" height="100%" viewBox="0 0 320 448" style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id={`${id}surface`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={theme.surface[0]} />
              <Stop offset="0.46" stopColor={theme.surface[1]} />
              <Stop offset="1" stopColor={theme.surface[2]} />
            </LinearGradient>
            <LinearGradient id={`${id}foil`} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={theme.frame} stopOpacity="0.25" />
              <Stop offset="0.5" stopColor={theme.accent} stopOpacity="0.92" />
              <Stop offset="1" stopColor={theme.frameInner} stopOpacity="0.3" />
            </LinearGradient>
            <Pattern id={`${id}texture`} width={theme.texture === 'radiant' ? 22 : 11} height="11" patternUnits="userSpaceOnUse" patternTransform={theme.texture === 'diagonal' ? 'rotate(28)' : undefined}>
              <Rect width="100%" height="100%" fill="transparent" />
              <Path d={texturePath} stroke={theme.accent} strokeOpacity={theme.texture === 'brushed' ? 0.08 : 0.14} strokeWidth="0.7" />
            </Pattern>
          </Defs>
          <Path d={outerPath} fill={`url(#${id}surface)`} stroke={theme.frame} strokeWidth={data.rarity === 'common' ? 3 : 5} />
          {theme.frameLayers >= 2 && <Path d={middlePath} fill="none" stroke={`url(#${id}foil)`} strokeWidth={data.rarity === 'legendary' || data.rarity === 'mythic' ? 3 : 1.5} />}
          {theme.frameLayers >= 3 && <Path d={innerPath} fill="none" stroke={theme.frameInner} strokeOpacity="0.9" strokeWidth="1" />}
          <Path d={innerPath} fill={`url(#${id}texture)`} />
          {theme.frameLayers >= 4 && <Path d="M18 88 L18 367 M302 88 L302 367" fill="none" stroke={theme.accent} strokeWidth="2" strokeOpacity="0.78" />}
          {theme.frameLayers >= 5 && <Path d="M7 126 L20 109 M7 321 L20 338 M313 126 L300 109 M313 321 L300 338" fill="none" stroke={theme.frame} strokeWidth="5" />}
          {(data.rarity === 'legendary' || data.rarity === 'mythic') && (
            <G>
              <Path d="M111 34 L160 15 L209 34 L197 47 H123 Z" fill={theme.frameInner} stroke={theme.frame} strokeWidth="2" />
              <Path d="M132 36 L160 24 L188 36" fill="none" stroke={theme.accent} strokeWidth="2" />
            </G>
          )}
          {Array.from({ length: theme.particles }).map((_, index) => (
            <Circle key={index} cx={36 + ((index * 47) % 252)} cy={82 + ((index * 61) % 244)} r={index % 3 === 0 ? 1.6 : 0.9} fill={index % 2 ? theme.frame : theme.accent} opacity={0.32 + (index % 3) * 0.16} />
          ))}
          {state === 'damaged' && <Path d="M251 58 L224 101 L244 132 L210 176 M84 295 L106 271 L96 238" fill="none" stroke="#FF6D5E" strokeWidth="3" strokeOpacity="0.72" />}
          {selected && <Path d={outerPath} fill="none" stroke={theme.accent} strokeWidth="4" />}
        </Svg>

        <View style={[styles.topLeft, { left: 22 * scale, top: 24 * scale }]}>
          <Text style={[styles.rating, { color: theme.ink, fontSize: 49 * textScale, lineHeight: 50 * textScale }]}>{data.rating}</Text>
          <Text style={[styles.role, { color: theme.muted, fontSize: 9 * textScale }]}>{data.role}</Text>
        </View>
        <View style={[styles.topRight, { right: 21 * scale, top: 28 * scale }]}>
          <Text style={[styles.rarityLabel, { color: theme.ink, fontSize: 9 * textScale }]}>{mini ? theme.label : `${theme.label} // ${theme.code}`}</Text>
          <View style={[styles.elementMark, { borderColor: element.color, width: 32 * textScale, height: 32 * textScale, backgroundColor: element.dark }]}>
            <Text style={{ color: element.color, fontSize: 17 * textScale, fontWeight: '900' }}>{element.glyph}</Text>
          </View>
          {!mini && <Text style={[styles.elementName, { color: theme.muted, fontSize: 8 * textScale }]}>{element.label}</Text>}
        </View>

        <Image
          source={data.art}
          style={[
            styles.art,
            {
              left: 24 * scale,
              top: (compact ? 69 : 56) * scale,
              width: 272 * scale,
              height: (compact ? 239 : 257) * scale,
            },
          ]}
          resizeMode="contain"
        />

        <View style={[styles.namePlate, { left: 24 * scale, right: 24 * scale, top: 285 * scale, minHeight: 58 * scale, backgroundColor: theme.panel, borderColor: theme.frameInner }]}>
          <View style={styles.nameLine}>
            <Text numberOfLines={1} style={[styles.name, { color: theme.ink, fontSize: (mini ? 15 : 21) * textScale }]}>{data.name}</Text>
            <Text style={[styles.level, { color: theme.accent, fontSize: 9 * textScale }]}>LV.{data.level}</Text>
          </View>
          {!mini && <Text style={[styles.meta, { color: theme.muted, fontSize: 8 * textScale }]}>{data.evolution} · {data.species} · {data.bond}</Text>}
        </View>

        <View style={[styles.attributes, { left: 24 * scale, right: 24 * scale, top: 349 * scale, height: 53 * scale, borderColor: theme.frameInner }]}>
          {visibleAttributes.map((attribute) => (
            <View key={attribute.key} style={styles.attribute}>
              <Text style={[styles.attributeValue, { color: theme.ink, fontSize: (mini ? 15 : 14) * textScale }]}>{attribute.value}</Text>
              <Text style={[styles.attributeKey, { color: theme.accent, fontSize: 7.5 * textScale }]}>{attribute.key}</Text>
              {!compact && <Text style={[styles.attributeName, { color: theme.muted, fontSize: 6.5 * textScale }]}>{attribute.name}</Text>}
            </View>
          ))}
        </View>

        {!mini && <View style={[styles.footer, { left: 27 * scale, right: 27 * scale, bottom: 23 * scale }]}>
          <Text style={[styles.footerText, { color: theme.muted, fontSize: 7.5 * textScale }]}>{data.faction}</Text>
          <Text style={[styles.footerAccent, { color: theme.accent, fontSize: 7.5 * textScale }]}>{data.archetype}</Text>
          <Text style={[styles.footerText, { color: theme.muted, fontSize: 7.5 * textScale }]}>#{data.serial}</Text>
        </View>}

        {theme.sheen && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.sheen,
              {
                backgroundColor: theme.frame,
                opacity: data.rarity === 'epic' ? 0.09 : 0.16,
                transform: [
                  { translateX: sheen.interpolate({ inputRange: [-1, 1], outputRange: [-width * 0.8, width * 1.2] }) },
                  { rotate: '16deg' },
                ],
              },
            ]}
          />
        )}
        {selected && !mini && <View style={[styles.selectedTab, { backgroundColor: theme.accent }]}><Text style={styles.selectedText}>编入</Text></View>}
        {state === 'locked' && <View style={styles.stateOverlay}><Text style={styles.stateIcon}>⌁</Text><Text style={styles.stateLabel}>LOCKED // 已锁定</Text></View>}
        {state === 'upgrading' && <Animated.View pointerEvents="none" style={[styles.upgradeEdge, { borderColor: theme.accent, opacity: upgrade }]} />}
        {state === 'revealing' && <View style={[styles.revealBack, { borderColor: theme.frame, backgroundColor: theme.surface[1] }]}><Text style={[styles.revealMark, { color: theme.frame }]}>PAW//CORE</Text><Text style={[styles.revealSub, { color: theme.accent }]}>SYNCHRONIZING</Text></View>}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pressable: { flex: 1, overflow: 'hidden' },
  topLeft: { position: 'absolute', zIndex: 5 },
  rating: { fontWeight: '900', letterSpacing: -2 },
  role: { fontWeight: '900', letterSpacing: 1.1, marginTop: -2 },
  topRight: { position: 'absolute', zIndex: 6, alignItems: 'flex-end' },
  rarityLabel: { fontWeight: '900', letterSpacing: 0.9, marginBottom: 6 },
  elementMark: { borderWidth: 1.5, transform: [{ rotate: '45deg' }], alignItems: 'center', justifyContent: 'center', marginRight: 4 },
  elementName: { fontWeight: '900', letterSpacing: 0.8, marginTop: 7 },
  art: { position: 'absolute', zIndex: 3 },
  namePlate: { position: 'absolute', zIndex: 5, borderTopWidth: 1, borderBottomWidth: 1, paddingHorizontal: 10, paddingVertical: 7, justifyContent: 'center' },
  nameLine: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  name: { flex: 1, fontWeight: '900', letterSpacing: 0.2 },
  level: { fontWeight: '900', letterSpacing: 0.8 },
  meta: { fontWeight: '800', letterSpacing: 0.5, marginTop: 2 },
  attributes: { position: 'absolute', zIndex: 5, flexDirection: 'row', borderBottomWidth: 1, paddingBottom: 4 },
  attribute: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  attributeValue: { fontWeight: '900', lineHeight: 16 },
  attributeKey: { fontWeight: '900', letterSpacing: 0.4, marginTop: 2 },
  attributeName: { fontWeight: '700', marginTop: 1 },
  footer: { position: 'absolute', zIndex: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footerText: { fontWeight: '800', letterSpacing: 0.65 },
  footerAccent: { fontWeight: '900', letterSpacing: 0.65 },
  sheen: { position: 'absolute', zIndex: 8, top: -80, bottom: -80, width: 38 },
  selectedTab: { position: 'absolute', zIndex: 11, right: 17, bottom: 8, paddingHorizontal: 8, paddingVertical: 3 },
  selectedText: { color: '#111', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  stateOverlay: { position: 'absolute', inset: 0, zIndex: 20, backgroundColor: '#0B0E10D9', alignItems: 'center', justifyContent: 'center' },
  stateIcon: { color: '#D7DADD', fontSize: 36, fontWeight: '900' },
  stateLabel: { color: '#F0F2F2', fontSize: 10, fontWeight: '900', letterSpacing: 1.4, marginTop: 8 },
  upgradeEdge: { position: 'absolute', zIndex: 12, left: 5, right: 5, top: 5, bottom: 5, borderWidth: 4 },
  revealBack: { position: 'absolute', inset: 0, zIndex: 30, margin: 4, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  revealMark: { fontSize: 23, fontWeight: '900', letterSpacing: 2.2 },
  revealSub: { fontSize: 8, fontWeight: '900', letterSpacing: 3, marginTop: 9 },
});
