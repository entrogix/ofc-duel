import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { playSe } from '../audio';
import { FadeSlideIn, PopIn, Pulse } from '../components/anim';
import { Logo } from '../components/Logo';
import { colors } from '../theme';

// スタートページ。最初のタップがWebの音声自動再生制限の解除も兼ねる
export function TitleScreen({ onStart }: { onStart: () => void }) {
  return (
    <Pressable style={styles.container} onPress={() => { playSe('confirm'); onStart(); }}>
      <PopIn delay={100}>
        <Logo size="large" />
      </PopIn>
      <View style={styles.spacer} />
      <Pulse>
        <Text style={styles.tap}>― タップしてスタート ―</Text>
      </Pulse>
      <Text style={styles.version}>v0.1　© 2026 Entrogix</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.felt,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  spacer: { height: 90 },
  tap: { color: colors.text, fontSize: 16, fontWeight: '700' },
  version: { color: colors.textDim, fontSize: 10, marginTop: 40 },
});
