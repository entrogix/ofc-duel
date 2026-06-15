import React, { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { handLabel, PairResult, PlayerGameView, ROWS } from '../../../shared/src';
import { showInterstitialAd } from '../ads/interstitial';
import { playSe } from '../audio';
import { colors } from '../theme';
import { FadeIn, FadeSlideIn, PopIn } from './anim';
import { CardView } from './CardView';
import { Confetti } from './Confetti';

interface Props {
  view: PlayerGameView;
  canAdvance: boolean; // CPU戦は常にtrue、オンラインはホストのみ
  ratingResult?: { before: number; after: number; delta: number; rank: string } | null;
  onNext: () => void;
  onHome: () => void;
}

const ROW_NAMES: Record<string, string> = { front: 'フロント', middle: 'ミドル', back: 'バック' };
const ROW_SHORT = ['フ', 'ミ', 'バ'];

// ペアを「自分が左側」になるよう向きを揃える
function orientPair(pair: PairResult, youIndex: number): PairResult {
  if (pair.b !== youIndex) return pair;
  return {
    a: pair.b,
    b: pair.a,
    rowWins: pair.rowWins.map((w) => -w) as [number, number, number],
    scoop: pair.scoop,
    netToA: -pair.netToA,
    reason: pair.reason === 'a_foul' ? 'b_foul' : pair.reason === 'b_foul' ? 'a_foul' : pair.reason,
  };
}

// ペアごとの点数移動の内訳
function PairDetail({ view, pair }: { view: PlayerGameView; pair: PairResult }) {
  const result = view.result!;
  const youIndex = view.playerIds.indexOf(view.you.id);
  const p = orientPair(pair, youIndex);
  const nameOf = (i: number) => (i === youIndex ? 'あなた' : view.playerNames[i]);
  const evA = result.score.evals[p.a];
  const evB = result.score.evals[p.b];

  let body: React.ReactNode;
  if (p.reason === 'both_foul') {
    body = <Text style={ps.foulText}>💥 両者バースト — 点数移動なし</Text>;
  } else if (p.reason === 'a_foul' || p.reason === 'b_foul') {
    const foulerName = nameOf(p.reason === 'a_foul' ? p.a : p.b);
    const winnerRoy = (p.reason === 'a_foul' ? evB : evA).royalties.total;
    body = (
      <Text style={ps.foulText}>
        💥 {foulerName}がバースト → 基本6点{winnerRoy > 0 ? ` ＋ 役ボーナス${winnerRoy}点` : ''}
      </Text>
    );
  } else {
    const lines = p.rowWins[0] + p.rowWins[1] + p.rowWins[2];
    const lineScore = p.scoop ? lines * 2 : lines;
    const royA = evA.royalties.total;
    const royB = evB.royalties.total;
    body = (
      <>
        <View style={ps.rowResults}>
          {p.rowWins.map((w, i) => (
            <View key={i} style={ps.rowCell}>
              <Text style={ps.rowCellLabel}>{ROW_SHORT[i]}</Text>
              <Text style={[ps.rowCellMark, { color: w > 0 ? colors.accent : w < 0 ? colors.danger : colors.textDim }]}>
                {w > 0 ? '○' : w < 0 ? '×' : '−'}
              </Text>
            </View>
          ))}
          {p.scoop && <Text style={ps.scoop}>🔥 スクープ! 倍額</Text>}
        </View>
        <Text style={ps.formula}>
          行ポイント {lineScore >= 0 ? '+' : ''}{lineScore}
          {(royA > 0 || royB > 0) && `　役ボーナス +${royA} / −${royB}`}
        </Text>
      </>
    );
  }

  return (
    <View style={ps.box}>
      <View style={ps.header}>
        <Text style={ps.names}>
          {nameOf(p.a)} <Text style={ps.vs}>vs</Text> {nameOf(p.b)}
        </Text>
        <Text style={[ps.net, { color: p.netToA > 0 ? colors.accent : p.netToA < 0 ? colors.danger : colors.textDim }]}>
          {p.netToA > 0 ? `+${p.netToA}` : p.netToA}点
        </Text>
      </View>
      {body}
    </View>
  );
}

// 他人同士の対戦は1行のあっさり表示（自分の対戦と差別化）
function OtherPairLine({ view, pair }: { view: PlayerGameView; pair: PairResult }) {
  const nameA = view.playerNames[pair.a];
  const nameB = view.playerNames[pair.b];
  const foul =
    pair.reason === 'both_foul' ? '💥両者' : pair.reason === 'a_foul' ? `💥${nameA}` : pair.reason === 'b_foul' ? `💥${nameB}` : '';
  return (
    <View style={ps.otherLine}>
      <Text style={ps.otherNames} numberOfLines={1}>
        {nameA} vs {nameB}
        {foul ? `（${foul}バースト）` : pair.scoop ? '（スクープ）' : ''}
      </Text>
      <Text style={ps.otherNet}>
        {pair.netToA > 0 ? `${nameA} +${pair.netToA}` : pair.netToA < 0 ? `${nameB} +${-pair.netToA}` : '引き分け'}
      </Text>
    </View>
  );
}

export function ResultOverlay({ view, canAdvance, ratingResult, onNext, onHome }: Props) {
  const result = view.result;
  const boards = view.boards;
  const isOver = view.phase === 'game_over';

  // 精算表示SE（ゲーム終了時はファンファーレ代わりのチップ音）
  useEffect(() => {
    playSe(isOver ? 'win' : 'chips');
  }, [isOver]);

  if (!result || !boards) return null;
  const youIndex = view.playerIds.indexOf(view.you.id);

  // 自分が絡む対戦と他人同士の対戦を分ける
  const myPairs = result.score.pairs.filter((p) => p.a === youIndex || p.b === youIndex);
  const otherPairs = result.score.pairs.filter((p) => p.a !== youIndex && p.b !== youIndex);

  const youWon = isOver && !!view.winners?.includes(view.you.id);

  return (
    <FadeIn style={styles.backdrop}>
      {isOver && <Confetti count={youWon ? 28 : 14} />}
      <FadeSlideIn style={styles.sheetWrap} dy={40} duration={300}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{isOver ? '🏁 ゲーム終了' : `ハンド ${view.handNumber} 精算`}</Text>
          {isOver && view.winners && (
            <PopIn delay={250}>
              <View style={styles.winnerBanner}>
                <Text style={styles.winnerEmoji}>{youWon ? '🏆' : '👏'}</Text>
                <Text style={styles.winner}>
                  {youWon
                    ? 'あなたの勝ち！'
                    : `勝者: ${view.winners.map((id) => view.playerNames[view.playerIds.indexOf(id)]).join('、')}`}
                </Text>
              </View>
            </PopIn>
          )}
          {isOver && ratingResult && (
            <PopIn delay={400}>
              <View style={styles.ratingBanner}>
                <Text style={styles.ratingLabel}>レート</Text>
                <Text style={styles.ratingValue}>
                  {ratingResult.before} →{' '}
                  <Text style={{ color: ratingResult.delta >= 0 ? colors.accent : colors.danger }}>
                    {ratingResult.after}
                  </Text>
                  <Text
                    style={[styles.ratingDelta, { color: ratingResult.delta >= 0 ? colors.accent : colors.danger }]}
                  >
                    {' '}
                    ({ratingResult.delta >= 0 ? '+' : ''}{ratingResult.delta})
                  </Text>
                </Text>
                <Text style={styles.ratingRank}>{ratingResult.rank}</Text>
              </View>
            </PopIn>
          )}
          <ScrollView style={styles.scroll}>
            {/* 自分の増減サマリー */}
            <FadeSlideIn delay={100} dy={10}>
              <View style={styles.summary}>
                <Text style={styles.summaryLabel}>あなたの収支</Text>
                <Text
                  style={[
                    styles.summaryNet,
                    { color: result.score.net[youIndex] >= 0 ? colors.accent : colors.danger },
                  ]}
                >
                  {result.score.net[youIndex] >= 0 ? '+' : ''}{result.score.net[youIndex]}点
                  <Text style={styles.summaryChips}>　→ 持ち点 {result.chipsAfter[youIndex]}</Text>
                </Text>
              </View>
            </FadeSlideIn>

            {/* あなたの対戦（詳細表示） */}
            <Text style={styles.sectionTitle}>あなたの対戦</Text>
            {myPairs.map((pair, i) => (
              <FadeSlideIn key={`${pair.a}-${pair.b}`} delay={180 + i * 90} dy={12}>
                <PairDetail view={view} pair={pair} />
              </FadeSlideIn>
            ))}

            {/* 他人同士の対戦（控えめに1行で） */}
            {otherPairs.length > 0 && (
              <>
                <Text style={styles.sectionTitleDim}>その他の対戦</Text>
                {otherPairs.map((pair, i) => (
                  <FadeSlideIn key={`${pair.a}-${pair.b}`} delay={250 + i * 60} dy={8}>
                    <OtherPairLine view={view} pair={pair} />
                  </FadeSlideIn>
                ))}
              </>
            )}

            {/* 各プレイヤーの盤面と役 */}
            <Text style={styles.sectionTitle}>盤面と役</Text>
            {view.playerIds.map((pid, i) => {
              const ev = result.score.evals[i];
              const net = result.score.net[i];
              const isYou = pid === view.you.id;
              return (
                <FadeSlideIn key={pid} delay={250 + i * 90} dy={12}>
                  <View style={[styles.playerBox, isYou && styles.youBox]}>
                    <View style={styles.playerHeader}>
                      <Text style={styles.playerName}>
                        {isYou ? 'あなた' : view.playerNames[i]}
                        {result.fantasyEntered.includes(pid) && '  🎡FL突入!'}
                        {result.fantasyStayed.includes(pid) && '  🎡FL継続!'}
                      </Text>
                      <Text style={[styles.net, { color: net >= 0 ? colors.accent : colors.danger }]}>
                        {net >= 0 ? '+' : ''}{net} → {result.chipsAfter[i]}点
                      </Text>
                    </View>
                    {ev.fouled && <Text style={styles.foul}>💥 バースト（役ボーナス無効）</Text>}
                    {ROWS.map((row) => (
                      <View key={row} style={styles.rowLine}>
                        <Text style={styles.rowName}>{ROW_NAMES[row]}</Text>
                        <View style={styles.cards}>
                          {boards[i][row].map((c, k) => (
                            <CardView key={k} card={c} size="mini" />
                          ))}
                        </View>
                        <Text style={styles.handName}>
                          {handLabel(ev[row])}
                          {!ev.fouled && ev.royalties[row] > 0 ? ` +${ev.royalties[row]}` : ''}
                        </Text>
                      </View>
                    ))}
                  </View>
                </FadeSlideIn>
              );
            })}
          </ScrollView>
          <View style={styles.buttons}>
            {!isOver && canAdvance && (
              <Pressable style={styles.primaryBtn} onPress={onNext}>
                <Text style={styles.primaryBtnText}>次のハンドへ</Text>
              </Pressable>
            )}
            {!isOver && !canAdvance && <Text style={styles.waiting}>ホストの開始を待っています…</Text>}
            <Pressable
              style={styles.secondaryBtn}
              onPress={
                isOver
                  ? () => {
                      // 対戦終了時に全画面（動画）広告を出してからホームへ
                      showInterstitialAd().finally(onHome);
                    }
                  : onHome
              }
            >
              <Text style={styles.secondaryBtnText}>{isOver ? 'ホームへ戻る' : 'ゲームを抜ける'}</Text>
            </Pressable>
          </View>
        </View>
      </FadeSlideIn>
    </FadeIn>
  );
}

const ps = StyleSheet.create({
  box: {
    backgroundColor: colors.panel,
    borderRadius: 8,
    padding: 10,
    marginVertical: 3,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  names: { color: colors.text, fontWeight: '700', fontSize: 13 },
  vs: { color: colors.textDim, fontWeight: '400', fontSize: 11 },
  net: { fontWeight: '900', fontSize: 16 },
  rowResults: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 10 },
  rowCell: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  rowCellLabel: { color: colors.textDim, fontSize: 11 },
  rowCellMark: { fontSize: 14, fontWeight: '800' },
  scoop: { color: colors.pending, fontSize: 11, fontWeight: '800', marginLeft: 4 },
  formula: { color: colors.textDim, fontSize: 11, marginTop: 4 },
  foulText: { color: colors.danger, fontSize: 12, fontWeight: '700', marginTop: 6 },
  otherLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginVertical: 2,
    opacity: 0.75,
  },
  otherNames: { color: colors.textDim, fontSize: 11, flexShrink: 1 },
  otherNet: { color: colors.textDim, fontSize: 11, fontWeight: '700', marginLeft: 6 },
});

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    padding: 10,
  },
  // %指定はWebで効かないため flexShrink で収める。minHeight:0 がないとWebのflexは縮まない
  sheetWrap: { flexShrink: 1, minHeight: 0 },
  sheet: {
    backgroundColor: colors.feltDark,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.goldDim,
    padding: 12,
    flexShrink: 1,
    minHeight: 0,
  },
  title: { color: colors.gold, fontSize: 17, fontWeight: '800', textAlign: 'center' },
  winnerBanner: {
    alignItems: 'center',
    backgroundColor: colors.panelLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.gold,
    paddingVertical: 8,
    marginTop: 8,
  },
  winnerEmoji: { fontSize: 34 },
  winner: { color: colors.gold, fontSize: 17, fontWeight: '900', textAlign: 'center', marginTop: 2 },
  ratingBanner: {
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.goldDim,
    paddingVertical: 8,
    marginTop: 8,
  },
  ratingLabel: { color: colors.textDim, fontSize: 11 },
  ratingValue: { color: colors.text, fontSize: 20, fontWeight: '900', marginTop: 2 },
  ratingDelta: { fontSize: 15, fontWeight: '800' },
  ratingRank: { color: colors.gold, fontSize: 12, fontWeight: '800', marginTop: 2 },
  scroll: { marginVertical: 6, flexGrow: 0, flexShrink: 1, minHeight: 0 },
  summary: {
    backgroundColor: colors.panelLight,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    marginBottom: 6,
  },
  summaryLabel: { color: colors.textDim, fontSize: 11 },
  summaryNet: { fontSize: 24, fontWeight: '900' },
  summaryChips: { fontSize: 13, fontWeight: '700', color: colors.text },
  sectionTitle: { color: colors.gold, fontSize: 12, fontWeight: '800', marginTop: 10, marginBottom: 2 },
  sectionTitleDim: { color: colors.textDim, fontSize: 11, fontWeight: '700', marginTop: 8, marginBottom: 2 },
  playerBox: {
    backgroundColor: colors.panel,
    borderRadius: 8,
    padding: 8,
    marginVertical: 3,
  },
  youBox: { borderWidth: 1, borderColor: colors.accent },
  playerHeader: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap' },
  playerName: { color: colors.text, fontWeight: '700', fontSize: 13 },
  net: { fontWeight: '800', fontSize: 13 },
  foul: { color: colors.danger, fontWeight: '800', fontSize: 12, marginTop: 2 },
  rowLine: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  rowName: { color: colors.textDim, fontSize: 10, width: 46 },
  cards: { flexDirection: 'row' },
  handName: { color: colors.textDim, fontSize: 10, marginLeft: 6, flexShrink: 1 },
  buttons: { gap: 8 },
  primaryBtn: {
    backgroundColor: colors.gold,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  primaryBtnText: { color: '#1c1500', fontWeight: '800', fontSize: 16 },
  secondaryBtn: {
    borderColor: colors.textDim,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryBtnText: { color: colors.textDim, fontWeight: '600', fontSize: 13 },
  waiting: { color: colors.textDim, textAlign: 'center', fontSize: 12 },
});
