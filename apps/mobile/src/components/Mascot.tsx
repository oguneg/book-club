import { useEffect, useState } from 'react';
import { Animated, type ViewStyle } from 'react-native';
import Svg, { Ellipse, G, Path, Rect, Circle } from 'react-native-svg';
import { spring, useReducedMotion, useTheme } from '@/theme';
import type { Art } from '@/theme/tokens';

export type BunnyPose = 'reading' | 'waving' | 'cheering';

/**
 * Playful's bunny, the pace rabbit drawn: reading on an empty shelf, waving where a club could start,
 * cheering at the end of a book. It hops in once when it appears (it simply appears with reduced motion).
 * Other styles don't draw. Decorative.
 */
export function Mascot({ pose, size = 136, style }: { pose: BunnyPose; size?: number; style?: ViewStyle }) {
  const { art, colors, motion } = useTheme();
  const reduce = useReducedMotion();
  const [hop] = useState(() => new Animated.Value(art && !reduce ? 0 : 1));

  useEffect(() => {
    if (!art || reduce) {
      hop.setValue(1);
      return;
    }
    const arrive = Animated.sequence([Animated.delay(120), spring(hop, 1, motion.pop)]);
    arrive.start();
    return () => arrive.stop();
    // Once, when it appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!art) return null;
  return (
    <Animated.View
      aria-hidden
      style={{
        ...style,
        width: size,
        height: size,
        alignSelf: 'center',
        opacity: hop.interpolate({ inputRange: [0, 0.4], outputRange: [0, 1], extrapolate: 'clamp' }),
        transform: [
          { translateY: hop.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
          { scale: hop.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) },
        ],
      }}
    >
      <Bunny pose={pose} art={art} book={colors.accent} />
    </Animated.View>
  );
}

/** A four-pointed sparkle centred on (x, y). */
function Sparkle({ x, y, r, fill }: { x: number; y: number; r: number; fill: string }) {
  return <Path d={`M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r}Z`} fill={fill} />;
}

const BLOB = 'M80 18 C122 14 152 46 150 88 C148 128 120 156 80 154 C38 152 8 126 10 86 C12 46 40 22 80 18Z';

function Bunny({ pose, art, book }: { pose: BunnyPose; art: Art; book: string }) {
  const line = { stroke: art.line, strokeWidth: 3, strokeLinejoin: 'round', strokeLinecap: 'round' } as const;
  const thin = { ...line, strokeWidth: 2 } as const;
  const fur = { fill: art.fur, ...line } as const;
  const ear = (cx: number, angle: number, pivotY: number) => (
    <G transform={`rotate(${angle} ${cx} ${pivotY})`}>
      <Ellipse cx={cx} cy={24} rx={11.5} ry={27} {...fur} />
      <Ellipse cx={cx} cy={27} rx={5.5} ry={18} fill={art.blush} />
    </G>
  );
  const raisedArm = (cx: number, angle: number) => (
    <G transform={`rotate(${angle} ${cx} 104)`}>
      <Ellipse cx={cx} cy={88} rx={9} ry={19} {...fur} />
    </G>
  );

  return (
    <Svg viewBox="0 0 160 160" width="100%" height="100%">
      <Path d={BLOB} fill={art.blob} />

      {pose === 'reading' && (
        <>
          <Sparkle x={132} y={58} r={7} fill={art.sun} />
          <Sparkle x={24} y={84} r={5} fill={book} />
          <Sparkle x={140} y={92} r={4} fill={art.mint} />
        </>
      )}
      {pose === 'waving' && (
        <>
          <Path d="M136 64 Q142 72 138 82" fill="none" stroke={book} strokeWidth={3} strokeLinecap="round" />
          <Path d="M144 58 Q152 70 146 84" fill="none" stroke={book} strokeWidth={3} strokeLinecap="round" />
          <Sparkle x={26} y={60} r={6} fill={art.sun} />
          <Sparkle x={36} y={92} r={4} fill={art.mint} />
        </>
      )}
      {pose === 'cheering' && (
        <>
          <Sparkle x={20} y={54} r={7} fill={art.sun} />
          <Sparkle x={140} y={50} r={8} fill={book} />
          <Sparkle x={146} y={110} r={5} fill={art.mint} />
          <Sparkle x={14} y={104} r={5} fill={art.lilac} />
          <Circle cx={34} cy={30} r={3.5} fill={art.mint} />
          <Circle cx={128} cy={22} r={3} fill={art.sun} />
        </>
      )}

      {ear(64, -10, 46)}
      {ear(96, pose === 'reading' ? 34 : 18, 48)}
      <Ellipse cx={80} cy={122} rx={35} ry={30} {...fur} />
      {pose === 'cheering' && (
        <>
          {raisedArm(44, -34)}
          {raisedArm(116, 34)}
        </>
      )}
      <Ellipse cx={60} cy={150} rx={12} ry={7} {...fur} />
      <Ellipse cx={100} cy={150} rx={12} ry={7} {...fur} />
      <Ellipse cx={80} cy={72} rx={37} ry={30} {...fur} />
      <Ellipse cx={57} cy={82} rx={7.5} ry={4.5} fill={art.blush} />
      <Ellipse cx={103} cy={82} rx={7.5} ry={4.5} fill={art.blush} />
      <Path d="M76.5 76 Q80 74 83.5 76 Q81.5 80 80 80 Q78.5 80 76.5 76Z" fill={art.nose} />

      {pose === 'reading' && (
        <>
          {/* Eyes down on the page, content; an open book held in both paws. */}
          <Path d="M63 72 Q67 75.5 71 72" fill="none" {...line} />
          <Path d="M89 72 Q93 75.5 97 72" fill="none" {...line} />
          <Path d="M75.5 84 Q77.8 86.5 80 84 Q82.2 86.5 84.5 84" fill="none" {...line} strokeWidth={2.2} />
          <Path d="M40 106 Q60 100 80 106 Q100 100 120 106 L120 138 Q100 132 80 138 Q60 132 40 138Z" fill={book} {...line} />
          <Path d="M44 104 Q62 98 80 104 L80 133 Q62 127 44 133Z" fill={art.page} {...line} />
          <Path d="M116 104 Q98 98 80 104 L80 133 Q98 127 116 133Z" fill={art.page} {...line} />
          <Path d="M52 111 Q62 108 72 111 M52 118 Q62 115 72 118 M52 125 Q60 122.5 68 125" fill="none" stroke={art.blush} strokeWidth={2.4} strokeLinecap="round" />
          <Path d="M88 111 Q98 108 108 111 M88 118 Q98 115 108 118" fill="none" stroke={art.blush} strokeWidth={2.4} strokeLinecap="round" />
          <Ellipse cx={42} cy={118} rx={8} ry={9} {...fur} />
          <Ellipse cx={118} cy={118} rx={8} ry={9} {...fur} />
        </>
      )}
      {pose === 'waving' && (
        <>
          {/* Bright-eyed, a book under one arm, the other paw waving. */}
          <Ellipse cx={67} cy={70} rx={3.6} ry={4.6} fill={art.line} />
          <Ellipse cx={93} cy={70} rx={3.6} ry={4.6} fill={art.line} />
          <Circle cx={68.3} cy={68.3} r={1.3} fill={art.fur} />
          <Circle cx={94.3} cy={68.3} r={1.3} fill={art.fur} />
          <Path d="M74.5 84 Q80 91 85.5 84Z" fill={art.line} {...thin} />
          <G transform="rotate(-8 50 122)">
            <Rect x={34} y={104} width={24} height={34} rx={3} fill={book} {...line} />
            <Path d="M53 104 L53 138" stroke={art.page} strokeWidth={2.4} />
          </G>
          {raisedArm(116, 38)}
          <Ellipse cx={54} cy={124} rx={9} ry={10} {...fur} />
        </>
      )}
      {pose === 'cheering' && (
        <>
          {/* Eyes squeezed happy, mouth open, the finished book hugged. */}
          <Path d="M62 72 Q67 66 72 72" fill="none" {...line} />
          <Path d="M88 72 Q93 66 98 72" fill="none" {...line} />
          <Path d="M73 83 Q80 94 87 83Z" fill={art.line} {...thin} />
          <Rect x={64} y={106} width={32} height={38} rx={4} fill={book} {...line} />
          <Path d="M71 106 L71 144" stroke={art.page} strokeWidth={2.4} />
          <Path d="M86 106 L86 118 L90 115 L94 118 L94 106" fill={art.sun} {...thin} />
        </>
      )}
    </Svg>
  );
}

/** The bunny's head: Playful's mark for the pace rabbit on book lines and the club track. */
export function BunnyHead({ size, art }: { size: number; art: Art }) {
  const line = { stroke: art.line, strokeWidth: 1.5, strokeLinejoin: 'round', strokeLinecap: 'round' } as const;
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Ellipse cx={8.6} cy={6} rx={2.6} ry={5.6} fill={art.fur} {...line} transform="rotate(-10 8.6 9)" />
      <Ellipse cx={15.4} cy={6} rx={2.6} ry={5.6} fill={art.fur} {...line} transform="rotate(16 15.4 9)" />
      <Ellipse cx={12} cy={15.5} rx={8.5} ry={7} fill={art.fur} {...line} />
      <Circle cx={9} cy={15} r={1.1} fill={art.line} />
      <Circle cx={15} cy={15} r={1.1} fill={art.line} />
      <Ellipse cx={6.6} cy={17.6} rx={1.5} ry={1} fill={art.blush} />
      <Ellipse cx={17.4} cy={17.6} rx={1.5} ry={1} fill={art.blush} />
      <Path d="M11 17.4 Q12 16.8 13 17.4 Q12.4 18.4 12 18.4 Q11.6 18.4 11 17.4Z" fill={art.nose} />
    </Svg>
  );
}
