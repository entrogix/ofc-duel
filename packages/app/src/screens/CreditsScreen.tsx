import React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

const YEAR = 2026;

export function CreditsScreen({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>クレジット / ライセンス</Text>

        <Section title="© 著作権">
          <Text style={styles.body}>© {YEAR} Entrogix. All rights reserved.</Text>
          <Text style={styles.bodyDim}>
            アプリのコード・画面デザイン・ロゴ・アイコンは制作者に帰属します。
          </Text>
        </Section>

        <Section title="ゲームについて">
          <Text style={styles.body}>
            「オープンフェイス・チャイニーズポーカー・デュエル（OFCデュエル）」は、
            オープンフェイス・チャイニーズポーカーを1対1向けに独自アレンジ（毎ターン1枚捨て）した
            オリジナルゲームです。
          </Text>
          <Text style={styles.bodyDim}>
            ※本アプリはエンターテインメントです。ゲーム内のチップに金銭的価値はなく、
            換金や賭博はできません。
          </Text>
        </Section>

        <Section title="🎵 音源（CC0 / パブリックドメイン）">
          <Credit
            label="効果音: Kenney「Casino Audio」"
            url="https://kenney.nl/assets/casino-audio"
          />
          <Credit
            label="BGM: Joth「Bossa Nova」「Porkymon Battle Theme」"
            url="https://opengameart.org/users/joth"
          />
          <Text style={styles.bodyDim}>
            いずれもCC0ライセンス。表記義務はありませんが、感謝を込めて記載しています。
          </Text>
        </Section>

        <Section title="📦 オープンソースソフトウェア">
          <Text style={styles.body}>本アプリは以下のOSSを利用しています：</Text>
          <Text style={styles.ossItem}>・React, React Native（MIT, © Meta Platforms, Inc.）</Text>
          <Text style={styles.ossItem}>・Expo SDK（MIT, © 650 Industries, Inc.）</Text>
          <Text style={styles.ossItem}>・react-native-google-mobile-ads（Apache-2.0）</Text>
          <Text style={styles.ossItem}>・@react-native-async-storage/async-storage（MIT）</Text>
          <Text style={styles.ossItem}>・react-native-safe-area-context（MIT）</Text>
          <Text style={styles.ossItem}>・ws（MIT, © Einar Otto Stangvik ほか）</Text>
          <Text style={styles.bodyDim}>
            上記を含むすべての依存ライブラリは MIT / ISC / BSD / Apache-2.0 などの
            オープンソースライセンスに基づき利用しています。各ライセンスの全文は
            それぞれの配布元で確認できます。
          </Text>
        </Section>

        <Section title="お問い合わせ">
          <Credit label="entrogix.works@gmail.com" url="mailto:entrogix.works@gmail.com" />
        </Section>
      </ScrollView>
      <Pressable style={styles.backBtn} onPress={onBack}>
        <Text style={styles.backText}>← 戻る</Text>
      </Pressable>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Credit({ label, url }: { label: string; url: string }) {
  return (
    <Pressable onPress={() => Linking.openURL(url).catch(() => {})}>
      <Text style={styles.link}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.felt },
  scroll: { padding: 18, paddingTop: 40 },
  title: { color: colors.gold, fontSize: 20, fontWeight: '900', marginBottom: 14, textAlign: 'center' },
  section: { backgroundColor: colors.panel, borderRadius: 10, padding: 12, marginBottom: 10 },
  sectionTitle: { color: colors.gold, fontWeight: '800', fontSize: 14, marginBottom: 6 },
  body: { color: colors.text, fontSize: 13, lineHeight: 20 },
  bodyDim: { color: colors.textDim, fontSize: 11, lineHeight: 18, marginTop: 6 },
  ossItem: { color: colors.text, fontSize: 12, lineHeight: 19, marginTop: 2 },
  link: { color: '#7ab8ff', fontSize: 13, lineHeight: 22, textDecorationLine: 'underline' },
  backBtn: { padding: 14, alignItems: 'center' },
  backText: { color: colors.textDim, fontSize: 14 },
});
