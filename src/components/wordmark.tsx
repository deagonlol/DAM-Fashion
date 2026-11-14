import { Image } from 'expo-image';

/** The image files are 2400 × 763. */
const ASPECT = 2400 / 763;

const SOURCES = {
  green: require('@/assets/images/wordmark.png'),
  dark: require('@/assets/images/wordmark-dark.png'),
};

type Props = {
  height: number;
  /** Green for dark backgrounds (the default), dark for the lime loading screen. */
  color?: keyof typeof SOURCES;
};

/** The "lendr" logo, with the pants for the n. */
export function Wordmark({ height, color = 'green' }: Props) {
  return (
    <Image
      source={SOURCES[color]}
      style={{ height, width: height * ASPECT }}
      contentFit="contain"
      accessibilityRole="image"
      accessibilityLabel="Lendr"
    />
  );
}
