import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AdBanner } from '../ads/AdBanner';
import { playSe, startBgm } from '../audio';
import { Logo } from '../components/Logo';
import { getSettings } from '../settings';
import { colors } from '../theme';

interface Props {
  onStartCpu: (name: string) => void;
  onRandom: (name: string) => void;
  onFriend: (name: string) => void;
  onStats: () => void;
  onRules: () => void;
  onCredits: () => void;
  onSettings: () => void;
}

export function HomeScreen({ onStartCpu, onRandom, onFriend, onStats, onRules, onCredits, onSettings }: Props) {
  // 名前は設定画面で管理（TOPからは入力欄を廃止）
  const playerName = () => getSettings().playerName.trim() || 'あなた';

  // TOP画面でもBGMを流す（画面遷移しても同じトラックなら途切れず継続）
  useEffect(() => {
    startBgm('normal');
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.logoWrap}>
          <Logo size="small" />
        </View>

        <ModeCard
          icon="🤖"
          title="CPU対戦"
          subtitle="オフラインOK・すぐ遊べる（1対1）"
          onPress={() => onStartCpu(playerName())}
          accent
        />
        <ModeCard
          icon="🌍"
          title="ランダムマッチ"
          subtitle="世界中の誰かと1対1"
          onPress={() => onRandom(playerName())}
          accent
        />
        <ModeCard
          icon="👥"
          title="フレンド対戦"
          subtitle="合言葉で友達と1対1"
          onPress={() => onFriend(playerName())}
          accent
        />

        <Pressable style={styles.statsBtn} onPress={() => { playSe('select'); onStats(); }}>
          <Text style={styles.statsText}>📊 戦績・ランキング</Text>
        </Pressable>

        <View style={styles.spacer} />

        <Pressable onPress={() => { playSe('select'); onCredits(); }}>
          <Text style={styles.creditLink}>ⓘ クレジット / ライセンス</Text>
        </Pressable>

        <View style={styles.footerLinks}>
          <Pressable style={styles.footerBtn} onPress={() => { playSe('select'); onRules(); }}>
            <Text style={styles.footerText}>📖 あそびかた</Text>
          </Pressable>
          <Pressable style={styles.footerBtn} onPress={() => { playSe('select'); onSettings(); }}>
            <Text style={styles.footerText}>⚙️ 設定</Text>
          </Pressable>
        </View>
      </View>

      {/* TOP最下部のバナー広告 */}
      <AdBanner />
    </View>
  );
}

function ModeCard({
  icon,
  title,
  subtitle,
  onPress,
  accent,
}: {
  icon: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  accent?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, accent && styles.cardAccent, pressed && styles.cardPressed]}
      onPress={() => {
        playSe('select');
        onPress();
      }}
    >
      <Text style={styles.cardIcon}>{icon}</Text>
      <View style={styles.cardTextWrap}>
        <Text style={[styles.cardTitle, accent && styles.cardTitleAccent]}>{title}</Text>
        <Text style={styles.cardSubtitle}>{subtitle}</Text>
      </View>
      <Text style={[styles.cardArrow, accent && styles.cardTitleAccent]}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.felt },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  logoWrap: { marginBottom: 22 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.panel,
    borderRadius: 12,
    padding: 14,
    marginVertical: 5,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  cardAccent: { borderColor: colors.gold, backgroundColor: colors.panelLight },
  cardPressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
  cardIcon: { fontSize: 30, marginRight: 14 },
  cardTextWrap: { flex: 1 },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  cardTitleAccent: { color: colors.gold },
  cardSubtitle: { color: colors.textDim, fontSize: 11, marginTop: 2 },
  cardArrow: { color: colors.textDim, fontSize: 24, fontWeight: '300' },
  statsBtn: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.goldDim,
  },
  statsText: { color: colors.gold, fontSize: 14, fontWeight: '700' },
  spacer: { height: 20 },
  creditLink: { color: colors.textDim, fontSize: 10, marginBottom: 10 },
  footerLinks: { flexDirection: 'row', gap: 18 },
  footerBtn: { padding: 8 },
  footerText: { color: colors.textDim, fontSize: 14 },
});
