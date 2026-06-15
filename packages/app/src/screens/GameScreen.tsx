import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { applyAudioSettings, playSe, startBgm, stopBgm } from '../audio';
import { getSettings, updateSettings } from '../settings';
import {
  Card,
  cardId,
  evaluate3,
  evaluate5,
  HandCat,
  partialHandLabel,
  Placement,
  PlayerGameView,
  Row,
  ROW_CAPACITY,
  ROWS,
} from '../../../shared/src';
import { FadeSlideIn, PopIn } from '../components/anim';
import { CardSlot, CardView } from '../components/CardView';
import { ConfirmModal } from '../components/ConfirmModal';
import { DraggableCard } from '../components/DraggableCard';
import { FantasyCutIn } from '../components/FantasyCutIn';
import { HandFx, handTier } from '../components/HandFx';
import { HandGuideModal } from '../components/HandGuide';
import { HandHistoryModal } from '../components/HandHistoryModal';
import { OpponentBoard } from '../components/OpponentBoard';
import { ResultOverlay } from '../components/ResultOverlay';
import type { RatingResult } from '../game/OnlineClient';
import { colors } from '../theme';

interface Props {
  view: PlayerGameView;
  canAdvance: boolean;
  placeDeadline?: number | null; // ランダムマッチの配置制限時刻（epoch ms）
  ratingResult?: RatingResult | null; // レート対戦の終局時に表示するレート変動
  onSubmit: (placements: Placement[]) => void;
  onNextHand: () => void;
  onQuit: () => void;
}

const ROW_NAMES: Record<Row, string> = { front: 'フロント', middle: 'ミドル', back: 'バック' };

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function GameScreen({ view, canAdvance, placeDeadline, ratingResult, onSubmit, onNextHand, onQuit }: Props) {
  // 未確定の配置: cardId -> row
  const [pending, setPending] = useState<Map<string, Row>>(new Map());
  const [selected, setSelected] = useState<string | null>(null);
  const [handKey, setHandKey] = useState('');
  const [now, setNow] = useState(Date.now());
  const [bgmOn, setBgmOn] = useState(getSettings().bgmOn);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [handFx, setHandFx] = useState<{ key: number; row: Row; label: string; tier: number } | null>(null);
  const [cutIn, setCutIn] = useState(false);
  const fxKey = useRef(0);
  const cutInShownHand = useRef(0);
  const rowRefs = useRef<Partial<Record<Row, View | null>>>({});
  const rowRects = useRef<Partial<Record<Row, Rect>>>({});

  const inFever = view.you.inFantasy;

  // BGM: ゲーム画面の表示中だけ流す。FL中はフィーバー曲に切替
  useEffect(() => {
    startBgm(inFever ? 'fever' : 'normal');
  }, [inFever]);
  useEffect(() => () => stopBgm(), []);

  // FL突入ハンドの開始時にカットインを1回だけ出す
  useEffect(() => {
    if (inFever && view.phase === 'placing' && cutInShownHand.current !== view.handNumber) {
      cutInShownHand.current = view.handNumber;
      setCutIn(true);
      playSe('win');
    }
  }, [inFever, view.phase, view.handNumber]);

  // ハンド/ストリートが変わったら選択状態をリセット
  const currentKey = `${view.handNumber}:${view.street}:${view.you.dealt.length}`;
  if (handKey !== currentKey) {
    setHandKey(currentKey);
    setPending(new Map());
    setSelected(null);
    setHandFx(null);
  }

  const dealt = view.you.dealt;

  // 配札SE（ハンド開始はシャッフル音）
  useEffect(() => {
    if (view.phase === 'placing' && dealt.length > 0 && !view.you.submitted) {
      playSe(view.street === 0 ? 'shuffle' : 'deal');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentKey]);

  const trayCards = dealt.filter((c) => !pending.has(cardId(c)));
  const pendingInRow = (row: Row): Card[] =>
    dealt.filter((c) => pending.get(cardId(c)) === row);

  const rowCount = (row: Row) => view.you.board[row].length + pendingInRow(row).length;
  // needPlace 枚を配置すれば確定可能。トレイに残る1枚が自動的に捨て札になる。
  const placedCount = pending.size;
  const allPlaced = dealt.length > 0 && placedCount === view.you.needPlace;
  const discardCandidate = allPlaced && trayCards.length === 1 ? trayCards[0] : null;

  const placeCard = (id: string, row: Row) => {
    // 配置で役が変わったら演出（強い役ほど派手に）
    const card = dealt.find((c) => cardId(c) === id);
    if (card) {
      const before = [...view.you.board[row], ...pendingInRow(row)];
      const labelBefore = partialHandLabel(before, ROW_CAPACITY[row]);
      const labelAfter = partialHandLabel([...before, card], ROW_CAPACITY[row]);
      const tier = handTier(labelAfter);
      if (labelAfter !== labelBefore && tier > 0) {
        fxKey.current += 1;
        setHandFx({ key: fxKey.current, row, label: labelAfter, tier });
        if (tier >= 4) playSe('win');
        else if (tier === 3) playSe('chips');
      }
    }
    setPending((prev) => {
      const next = new Map(prev);
      next.set(id, row);
      return next;
    });
    setSelected(null);
    playSe('place');
  };

  const placeSelected = (row: Row) => {
    if (!selected) return;
    if (rowCount(row) >= ROW_CAPACITY[row]) return;
    placeCard(selected, row);
  };

  const unplace = (card: Card) => {
    setPending((prev) => {
      const next = new Map(prev);
      next.delete(cardId(card));
      return next;
    });
    playSe('select');
  };

  // D&D: 行の画面上の位置を記録し、ドロップ座標から行を判定
  const measureRow = (row: Row) => {
    rowRefs.current[row]?.measureInWindow((x, y, w, h) => {
      rowRects.current[row] = { x, y, w, h };
    });
  };
  // レイアウト変化やリサイズで座標が古くなるため、ドラッグ開始時に毎回測り直す
  const measureAllRows = () => ROWS.forEach(measureRow);
  const rowAt = (pageX: number, pageY: number): Row | null => {
    for (const row of ROWS) {
      const r = rowRects.current[row];
      if (!r) continue;
      if (pageY >= r.y - 12 && pageY <= r.y + r.h + 12 && pageX >= r.x - 8 && pageX <= r.x + r.w + 8) {
        return row;
      }
    }
    return null;
  };

  // トレイ → 行へのドロップ
  const dropCard = (card: Card) => (pageX: number, pageY: number): boolean => {
    const row = rowAt(pageX, pageY);
    if (!row) return false;
    if (rowCount(row) >= ROW_CAPACITY[row]) return false;
    placeCard(cardId(card), row);
    return true;
  };

  // 仮置き（黄色）カードのドロップ: 別の行へ直接移動、行の外ならトレイへ戻す
  const dropPendingCard = (card: Card) => (pageX: number, pageY: number): boolean => {
    const id = cardId(card);
    const from = pending.get(id);
    const row = rowAt(pageX, pageY);
    if (row) {
      if (row === from) return true; // 同じ行ならそのまま
      if (rowCount(row) >= ROW_CAPACITY[row]) return false;
      placeCard(id, row);
      return true;
    }
    unplace(card); // 行の外 → トレイへ
    return true;
  };

  // 配置途中でも現時点の役を表示（確定分＋仮置き分）
  const rowHand = (row: Row): string =>
    partialHandLabel([...view.you.board[row], ...pendingInRow(row)], ROW_CAPACITY[row]);

  // FL継続条件の達成状況（行が完成している場合のみ判定）
  const flStay = useMemo(() => {
    if (!inFever) return null;
    const cards = (row: Row) => [...view.you.board[row], ...pendingInRow(row)];
    const f = cards('front');
    const m = cards('middle');
    const b = cards('back');
    return {
      front: f.length === 3 && evaluate3(f).cat === HandCat.Trips,
      middle: m.length === 5 && evaluate5(m).cat >= HandCat.FullHouse,
      back: b.length === 5 && evaluate5(b).cat >= HandCat.Quads,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inFever, view, pending]);

  const submit = () => {
    // pending に置いたカードだけを送る。残り1枚はサーバー/エンジン側で捨て札になる。
    const placements: Placement[] = dealt
      .filter((card) => pending.has(cardId(card)))
      .map((card) => ({ card, row: pending.get(cardId(card))! }));
    playSe('confirm');
    onSubmit(placements);
  };

  // ゲーム終了後はそのまま退出、進行中は確認を挟む
  const requestQuit = () => {
    if (view.phase === 'game_over') onQuit();
    else setConfirmQuit(true);
  };

  // 配置の残り時間（ランダムマッチのみ。自分が未配置のときだけカウントダウン）
  const countdownActive = placeDeadline != null && view.phase === 'placing' && !view.you.submitted;
  useEffect(() => {
    if (!countdownActive) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [countdownActive]);
  const secsLeft = countdownActive ? Math.max(0, Math.ceil((placeDeadline! - now) / 1000)) : null;

  const compactOpp = view.opponents.length >= 3;

  return (
    <View style={[styles.container, inFever && styles.containerFever]}>
      {/* ヘッダー（2段パネル） */}
      <View style={[styles.header, inFever && styles.headerFever]}>
        {/* 上段: 操作ボタン */}
        <View style={styles.headerTop}>
          <Pressable style={styles.iconBtn} onPress={requestQuit} hitSlop={8}>
            <Text style={styles.quitText}>← 退出</Text>
          </Pressable>
          <View style={styles.headerIcons}>
            <Pressable style={styles.iconBtn} onPress={() => setShowHistory(true)} hitSlop={8} disabled={view.history.length === 0}>
              <Text style={[styles.iconEmoji, view.history.length === 0 && styles.iconDisabled]}>📋</Text>
            </Pressable>
            <Pressable style={styles.iconBtn} onPress={() => setShowGuide(true)} hitSlop={8}>
              <Text style={styles.iconEmoji}>❓</Text>
            </Pressable>
            <Pressable
              style={styles.iconBtn}
              hitSlop={8}
              onPress={() => {
                const next = !getSettings().bgmOn;
                updateSettings({ bgmOn: next });
                applyAudioSettings();
                setBgmOn(next);
              }}
            >
              <Text style={styles.iconEmoji}>{bgmOn ? '🔊' : '🔇'}</Text>
            </Pressable>
          </View>
        </View>

        {/* 中段: プレイヤー名 + チップ */}
        <View style={styles.headerMid}>
          <Text style={styles.playerName} numberOfLines={1}>
            {view.you.isDealer ? '🔘 ' : ''}{view.you.name}
          </Text>
          <View style={styles.chipBadge}>
            <Text style={styles.chipIcon}>💰</Text>
            <Text style={styles.chipValue}>{view.you.chips}</Text>
          </View>
        </View>

        {/* 下段: 進捗 + 残ハンド + 制限時間 */}
        <View style={styles.headerBot}>
          {!view.you.inFantasy && (
            <View style={styles.streetDots}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={[styles.dot, i <= view.street && styles.dotOn]} />
              ))}
            </View>
          )}
          <Text style={styles.progressText} numberOfLines={1}>
            {view.you.submitted && view.phase === 'placing'
              ? '✓ 確定 — 相手を待っています'
              : view.you.inFantasy
                ? '🎡 ファンタジーランド'
                : `ストリート ${view.street + 1}/3`}
            <Text style={styles.progressDim}>　｜　残り{view.remainingHands}ハンド</Text>
          </Text>
          {secsLeft != null && (
            <Text style={[styles.timer, secsLeft <= 10 && styles.timerUrgent]}>⏱{secsLeft}</Text>
          )}
        </View>
      </View>

      {/* 相手ボード（ストリートごとに公開アニメーション） */}
      <ScrollView horizontal style={styles.oppRow} contentContainerStyle={styles.oppRowContent}>
        {view.opponents.map((opp) => (
          <FadeSlideIn key={`${opp.id}-${view.handNumber}-${view.street}`} dy={8} duration={300}>
            <OpponentBoard opp={opp} compact={compactOpp} />
          </FadeSlideIn>
        ))}
      </ScrollView>

      {/* FL継続条件バー */}
      {inFever && flStay && (
        <View style={styles.flBar}>
          <Text style={styles.flBarTitle}>🎡 FL継続条件（どれか1つ）</Text>
          <View style={styles.flBarItems}>
            <Text style={[styles.flBarItem, flStay.front && styles.flBarMet]}>
              {flStay.front ? '✓' : '・'}フロント3カード
            </Text>
            <Text style={[styles.flBarItem, flStay.middle && styles.flBarMet]}>
              {flStay.middle ? '✓' : '・'}ミドルFH以上
            </Text>
            <Text style={[styles.flBarItem, flStay.back && styles.flBarMet]}>
              {flStay.back ? '✓' : '・'}バック4カード以上
            </Text>
          </View>
        </View>
      )}

      {/* 自分のボード */}
      <View style={styles.board}>
        {ROWS.map((row) => (
          <Pressable
            key={row}
            ref={(r) => { rowRefs.current[row] = r as unknown as View; }}
            onLayout={() => measureRow(row)}
            style={styles.boardRow}
            onPress={() => placeSelected(row)}
          >
            {handFx && handFx.row === row && (
              <HandFx
                key={handFx.key}
                label={handFx.label}
                tier={handFx.tier}
                onDone={() => setHandFx(null)}
              />
            )}
            <View style={styles.rowLabelBox}>
              <Text style={styles.rowLabel}>{ROW_NAMES[row]}</Text>
              {rowHand(row) !== '' && <Text style={styles.rowHand}>{rowHand(row)}</Text>}
            </View>
            <View style={styles.rowCards}>
              {view.you.board[row].map((c, i) => (
                <CardView key={`b${i}`} card={c} />
              ))}
              {pendingInRow(row).map((c) => (
                <PopIn key={cardId(c)}>
                  {/* 黄色カードはドラッグで別の行へ直接移動できる。行の外へ離すとトレイへ */}
                  <DraggableCard onDrop={dropPendingCard(c)} onDragStart={measureAllRows}>
                    <CardView card={c} pending onPress={() => unplace(c)} />
                  </DraggableCard>
                </PopIn>
              ))}
              {Array.from({ length: ROW_CAPACITY[row] - rowCount(row) }).map((_, i) => (
                <Pressable key={`s${i}`} onPress={() => placeSelected(row)}>
                  <CardSlot />
                </Pressable>
              ))}
            </View>
          </Pressable>
        ))}
      </View>

      {/* 手札トレイ（ドラッグ中のはみ出しを許すためScrollViewではなく折返しView） */}
      <View style={styles.tray}>
        {view.you.submitted && view.phase === 'placing' ? (
          <Text style={styles.waitText}>✔ 配置確定 — 待機中</Text>
        ) : (
          <>
            {/* 自分の捨て札（確定済み） */}
            {view.you.discards.length > 0 && (
              <View style={styles.discardRow}>
                <Text style={styles.discardRowLabel}>🗑 捨て札</Text>
                {view.you.discards.map((c, i) => (
                  <CardView key={`d${i}`} card={c} size="micro" />
                ))}
              </View>
            )}
            <View style={styles.trayCards}>
              {trayCards.map((c, i) => {
                const isDiscard = !!discardCandidate && cardId(c) === cardId(discardCandidate);
                return (
                  <FadeSlideIn key={`${cardId(c)}-${view.handNumber}-${view.street}`} delay={i * 60} dy={24}>
                    <View style={styles.trayCardWrap}>
                      <DraggableCard onDrop={dropCard(c)} onDragStart={measureAllRows}>
                        <CardView
                          card={c}
                          selected={selected === cardId(c)}
                          discard={isDiscard}
                          onPress={() => {
                            if (selected !== cardId(c)) playSe('select');
                            setSelected(selected === cardId(c) ? null : cardId(c));
                          }}
                        />
                      </DraggableCard>
                      {isDiscard && <Text style={styles.discardTag}>捨て</Text>}
                    </View>
                  </FadeSlideIn>
                );
              })}
            </View>
            <View style={styles.trayActions}>
              <Pressable
                style={[styles.confirmBtn, !allPlaced && styles.btnDisabled]}
                disabled={!allPlaced}
                onPress={submit}
              >
                <Text style={styles.confirmText}>確定</Text>
              </Pressable>
              <Pressable style={styles.resetBtn} onPress={() => { setPending(new Map()); setSelected(null); }}>
                <Text style={styles.resetText}>置き直す</Text>
              </Pressable>
            </View>
            <Text style={styles.hint}>
              {view.you.needPlace}枚を配置 → 残り1枚は自動で捨て札（🗑）になります
            </Text>
          </>
        )}
      </View>

      {(view.phase === 'hand_result' || view.phase === 'game_over') && (
        <ResultOverlay view={view} canAdvance={canAdvance} ratingResult={ratingResult} onNext={onNextHand} onHome={requestQuit} />
      )}

      {cutIn && <FantasyCutIn onDone={() => setCutIn(false)} />}

      <HandHistoryModal
        visible={showHistory}
        history={view.history}
        myName={view.you.name}
        oppName={view.opponents[0]?.name ?? '相手'}
        onClose={() => setShowHistory(false)}
      />

      <HandGuideModal visible={showGuide} onClose={() => setShowGuide(false)} />

      <ConfirmModal
        visible={confirmQuit}
        message={'ゲームを抜けますか？\n（対戦は破棄されます）'}
        yesLabel="抜ける"
        noLabel="続ける"
        onYes={() => {
          setConfirmQuit(false);
          onQuit();
        }}
        onNo={() => setConfirmQuit(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.felt },
  containerFever: { backgroundColor: colors.feverFelt },
  flBar: {
    backgroundColor: colors.feverPanel,
    borderRadius: 8,
    marginHorizontal: 6,
    marginTop: 2,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#ffd700',
  },
  flBarTitle: { color: '#ffd700', fontSize: 10, fontWeight: '800' },
  flBarItems: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  flBarItem: { color: colors.feverAccent, fontSize: 10 },
  flBarMet: { color: colors.accent, fontWeight: '800' },
  oppRow: { flexGrow: 0 },
  oppRowContent: { paddingHorizontal: 2, flexGrow: 1, justifyContent: 'center' },
  header: {
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 8,
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderBottomWidth: 1,
    borderBottomColor: colors.goldDim,
    gap: 5,
  },
  headerFever: { backgroundColor: 'rgba(74,20,140,0.4)', borderBottomColor: '#ffd700' },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerIcons: { flexDirection: 'row', gap: 6 },
  iconBtn: { padding: 4 },
  iconEmoji: { fontSize: 18 },
  iconDisabled: { opacity: 0.3 },
  headerMid: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  playerName: { color: colors.text, fontSize: 16, fontWeight: '800', flexShrink: 1 },
  chipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 13,
    paddingHorizontal: 10,
    paddingVertical: 2,
    gap: 4,
  },
  chipIcon: { fontSize: 14 },
  chipValue: { color: colors.gold, fontSize: 18, fontWeight: '900' },
  headerBot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  streetDots: { flexDirection: 'row', gap: 4 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.25)' },
  dotOn: { backgroundColor: colors.accent },
  progressText: { color: colors.text, fontSize: 12, fontWeight: '700' },
  progressDim: { color: colors.textDim, fontWeight: '400' },
  timer: {
    color: '#1c1500',
    backgroundColor: colors.accent,
    fontSize: 12,
    fontWeight: '900',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  timerUrgent: { backgroundColor: colors.danger, color: '#fff' },
  // 行間は詰めて中央寄せ（space-evenlyの無駄な間隔をやめる）
  board: { flex: 1, justifyContent: 'center', paddingHorizontal: 4 },
  boardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderRadius: 10,
    paddingVertical: 4,
    paddingHorizontal: 4,
    marginVertical: 3,
  },
  rowLabelBox: { width: 52 },
  rowLabel: { color: colors.textDim, fontSize: 10 },
  rowHand: { color: colors.pending, fontSize: 9, fontWeight: '700', marginTop: 2 },
  rowCards: { flexDirection: 'row', flexWrap: 'wrap', flex: 1, justifyContent: 'center' },
  tray: {
    backgroundColor: colors.feltDark,
    borderTopWidth: 1,
    borderTopColor: colors.goldDim,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  trayCards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingVertical: 2,
    minHeight: 80,
  },
  trayCardWrap: { alignItems: 'center' },
  discardTag: { color: colors.danger, fontSize: 9, fontWeight: '800', marginTop: -2 },
  discardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 2,
    paddingBottom: 2,
  },
  discardRowLabel: { color: colors.textDim, fontSize: 9, marginRight: 2 },
  trayActions: { flexDirection: 'row', gap: 8, marginTop: 4, paddingHorizontal: 2 },
  confirmBtn: {
    flex: 1,
    backgroundColor: colors.gold,
    borderRadius: 10,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.35 },
  confirmText: { color: '#1c1500', fontWeight: '800', fontSize: 16 },
  resetBtn: {
    borderColor: colors.textDim,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  resetText: { color: colors.textDim, fontWeight: '600' },
  hint: { color: colors.textDim, fontSize: 9, textAlign: 'center', marginTop: 3 },
  waitText: { color: colors.accent, textAlign: 'center', fontSize: 14, fontWeight: '700', marginVertical: 40 },
  quitText: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
});
