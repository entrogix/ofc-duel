import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { playSe } from '../audio';
import { SERVER_URL } from '../config';
import { OnlineClient, RankingInfo, StatsInfo } from '../game/OnlineClient';
import { getCachedPlayerUid } from '../identity';
import { colors } from '../theme';

export function StatsScreen({ onBack }: { onBack: () => void }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<StatsInfo | null>(null);
  const [ranking, setRanking] = useState<RankingInfo | null>(null);
  const [error, setError] = useState('');
  const clientRef = useRef<OnlineClient | null>(null);

  useEffect(() => {
    const uid = getCachedPlayerUid();
    const client = new OnlineClient(
      SERVER_URL,
      {
        onStats: (s) => { setStats(s); setLoading(false); },
        onRanking: (r) => setRanking(r),
        onError: () => { setError('データを取得できませんでした'); setLoading(false); },
        onClose: () => { setError((e) => e || 'サーバーに接続できません（オフライン）'); setLoading(false); },
      },
      () => {
        client.requestStats(uid);
        client.requestRanking(uid);
      },
    );
    clientRef.current = client;
    // 取得は一瞬。数秒で来なければタイムアウト表示
    const timer = setTimeout(() => setLoading(false), 6000);
    return () => {
      clearTimeout(timer);
      client.dispose();
    };
  }, []);

  const winRate = stats && stats.games > 0 ? Math.round((stats.wins / stats.games) * 100) : 0;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>📊 戦績・ランキング</Text>

        {loading && (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.gold} />
            <Text style={styles.dim}>読み込み中…</Text>
          </View>
        )}

        {!loading && error !== '' && (
          <View style={styles.center}>
            <Text style={styles.error}>{error}</Text>
            <Text style={styles.dim}>レート対戦の戦績はオンライン時に表示されます。</Text>
          </View>
        )}

        {!loading && error === '' && (
          <>
            {/* 自分の戦績 */}
            <View style={styles.myCard}>
              <Text style={styles.myRank}>{stats?.rank ?? '—'}</Text>
              <Text style={styles.myRating}>{stats?.rating ?? 1000}</Text>
              <Text style={styles.myLabel}>レート</Text>
              <View style={styles.myStatsRow}>
                <Stat label="対戦" value={`${stats?.games ?? 0}`} />
                <Stat label="勝利" value={`${stats?.wins ?? 0}`} />
                <Stat label="勝率" value={`${winRate}%`} />
                <Stat label="順位" value={ranking && ranking.myPlace > 0 ? `${ranking.myPlace}位` : '—'} />
              </View>
              {(stats?.games ?? 0) === 0 && (
                <Text style={styles.hint}>レート対戦をプレイすると記録されます</Text>
              )}
            </View>

            {/* 直近の対戦履歴 */}
            <Text style={styles.sectionTitle}>📜 最近の対戦</Text>
            {stats && stats.recent.length > 0 ? (
              stats.recent.map((m, i) => {
                const d = new Date(m.at);
                const date = `${d.getMonth() + 1}/${d.getDate()}`;
                const resultLabel = m.result === 'win' ? '勝ち' : m.result === 'lose' ? '負け' : '引分';
                const resultColor = m.result === 'win' ? colors.accent : m.result === 'lose' ? colors.danger : colors.textDim;
                return (
                  <View key={i} style={styles.histRow}>
                    <Text style={[styles.histResult, { color: resultColor }]}>{resultLabel}</Text>
                    <View style={styles.histMid}>
                      <Text style={styles.histOpp} numberOfLines={1}>vs {m.opponent}</Text>
                      <Text style={styles.histSub}>{date}・{m.mode === 'rated' ? 'レート' : 'カジュアル'}</Text>
                    </View>
                    <Text style={[styles.histDelta, { color: m.delta >= 0 ? colors.accent : colors.danger }]}>
                      {m.delta > 0 ? '+' : ''}{m.delta}
                    </Text>
                    <Text style={styles.histRating}>{m.rating}</Text>
                  </View>
                );
              })
            ) : (
              <Text style={styles.dim}>まだ対戦記録がありません</Text>
            )}

            {/* ランキング */}
            <Text style={styles.sectionTitle}>🏆 レートランキング TOP20</Text>
            {ranking && ranking.top.length > 0 ? (
              ranking.top.map((row) => (
                <View key={row.place} style={[styles.rankRow, row.you && styles.rankRowYou]}>
                  <Text style={styles.place}>{row.place}</Text>
                  <View style={styles.rankNameWrap}>
                    <Text style={styles.rankName} numberOfLines={1}>
                      {row.name}{row.you ? '（あなた）' : ''}
                    </Text>
                    <Text style={styles.rankSub}>{row.rank}・{row.games}戦</Text>
                  </View>
                  <Text style={styles.rankRating}>{row.rating}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.dim}>まだランキングデータがありません。最初の挑戦者になろう！</Text>
            )}
          </>
        )}
      </ScrollView>
      <Pressable style={styles.backBtn} onPress={() => { playSe('select'); onBack(); }}>
        <Text style={styles.backText}>← 戻る</Text>
      </Pressable>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.felt },
  scroll: { padding: 18, paddingTop: 40 },
  title: { color: colors.gold, fontSize: 22, fontWeight: '900', marginBottom: 16, textAlign: 'center' },
  center: { alignItems: 'center', gap: 8, marginTop: 40 },
  dim: { color: colors.textDim, fontSize: 12, textAlign: 'center', marginTop: 8 },
  error: { color: colors.danger, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  myCard: {
    backgroundColor: colors.panelLight,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.gold,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  myRank: { color: colors.gold, fontSize: 18, fontWeight: '900' },
  myRating: { color: colors.text, fontSize: 44, fontWeight: '900', marginTop: 2 },
  myLabel: { color: colors.textDim, fontSize: 11 },
  myStatsRow: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginTop: 14 },
  stat: { alignItems: 'center' },
  statValue: { color: colors.text, fontSize: 18, fontWeight: '800' },
  statLabel: { color: colors.textDim, fontSize: 10, marginTop: 2 },
  hint: { color: colors.textDim, fontSize: 11, marginTop: 10 },
  sectionTitle: { color: colors.gold, fontSize: 14, fontWeight: '800', marginBottom: 8, marginTop: 14 },
  histRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 10,
    marginVertical: 2,
    gap: 8,
  },
  histResult: { fontSize: 13, fontWeight: '800', width: 36 },
  histMid: { flex: 1 },
  histOpp: { color: colors.text, fontSize: 13, fontWeight: '600' },
  histSub: { color: colors.textDim, fontSize: 10, marginTop: 1 },
  histDelta: { fontSize: 14, fontWeight: '800', width: 44, textAlign: 'right' },
  histRating: { color: colors.textDim, fontSize: 12, width: 40, textAlign: 'right' },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginVertical: 2,
  },
  rankRowYou: { borderWidth: 1, borderColor: colors.accent },
  place: { color: colors.gold, fontSize: 16, fontWeight: '900', width: 32 },
  rankNameWrap: { flex: 1 },
  rankName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  rankSub: { color: colors.textDim, fontSize: 10, marginTop: 1 },
  rankRating: { color: colors.gold, fontSize: 16, fontWeight: '800' },
  backBtn: { padding: 14, alignItems: 'center' },
  backText: { color: colors.textDim, fontSize: 14 },
});
