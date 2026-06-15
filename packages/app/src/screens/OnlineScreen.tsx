import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Placement, PlayerGameView } from '../../../shared/src';
import { playSe } from '../audio';
import { SERVER_URL } from '../config';
import { LobbyInfo, MatchmakingInfo, OnlineClient, RatingResult, StatsInfo } from '../game/OnlineClient';
import { getCachedPlayerUid } from '../identity';
import { shareInvite } from '../invite';
import { colors } from '../theme';
import { GameScreen } from './GameScreen';

interface Props {
  playerName: string;
  initialMode: 'random' | 'friend';
  // 招待リンク経由で渡された合言葉。あれば自動で参加する。
  initialJoinCode?: string;
  onHome: () => void;
}

type Stage = 'mode_select' | 'setup' | 'connecting' | 'matching' | 'lobby' | 'game' | 'reconnecting';
type Action = 'create' | 'join' | 'random' | 'reconnect';

export function OnlineScreen({ playerName, initialMode, initialJoinCode, onHome }: Props) {
  const firstStage: Stage = initialMode === 'random' ? 'mode_select' : 'setup';
  const [stage, setStage] = useState<Stage>(firstStage);
  const [joinCode, setJoinCode] = useState('');
  const [lobby, setLobby] = useState<LobbyInfo | null>(null);
  const [view, setView] = useState<PlayerGameView | null>(null);
  const [placeDeadline, setPlaceDeadline] = useState<number | null>(null);
  const [matchInfo, setMatchInfo] = useState<MatchmakingInfo | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [ratingResult, setRatingResult] = useState<RatingResult | null>(null);
  const [myStats, setMyStats] = useState<StatsInfo | null>(null);
  const clientRef = useRef<OnlineClient | null>(null);
  const stageRef = useRef<Stage>(firstStage);
  const tokenRef = useRef<string | null>(null);
  const reconnectTries = useRef(0);

  const setStageBoth = (s: Stage) => {
    stageRef.current = s;
    setStage(s);
  };

  useEffect(() => () => clientRef.current?.dispose(), []);

  // 招待リンク経由（合言葉つき）で来たら、自動でその合言葉に参加する（1回だけ）。
  const autoJoinedRef = useRef(false);
  useEffect(() => {
    if (initialJoinCode && /^\d{4}$/.test(initialJoinCode) && !autoJoinedRef.current) {
      autoJoinedRef.current = true;
      setJoinCode(initialJoinCode);
      connect('join', { code: initialJoinCode });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialJoinCode]);

  // mode_select に居る間、現在のレート/ランクを取得して表示する（短命接続で問い合わせ）
  useEffect(() => {
    if (initialMode !== 'random') return;
    const uid = getCachedPlayerUid();
    if (!uid) return;
    let done = false;
    let c: OnlineClient | null = null;
    const finish = () => {
      if (done) return;
      done = true;
      c?.dispose();
    };
    c = new OnlineClient(
      SERVER_URL,
      { onStats: (s) => { setMyStats(s); finish(); }, onError: finish, onClose: () => {} },
      () => c?.requestStats(uid),
    );
    const t = setTimeout(finish, 4000);
    return () => { clearTimeout(t); finish(); };
  }, [initialMode]);

  const connect = (action: Action, opts?: { token?: string; matchType?: 'casual' | 'rated'; code?: string }) => {
    setError('');
    setNotice('');
    if (action !== 'reconnect') setRatingResult(null);
    setStageBoth(action === 'reconnect' ? 'reconnecting' : 'connecting');
    const uid = getCachedPlayerUid();

    const client = new OnlineClient(
      SERVER_URL,
      {
        onJoined: (info) => {
          if (info.reconnectToken) tokenRef.current = info.reconnectToken;
          if (action === 'reconnect') {
            reconnectTries.current = 0;
            return;
          }
          if (info.random) setStageBoth('matching');
          else setStageBoth('lobby');
        },
        onLobby: (l) => setLobby(l),
        onState: (v, deadline) => {
          setView(v);
          setPlaceDeadline(deadline);
          setStageBoth('game');
        },
        onMatchmaking: (m) => {
          if (m.cancelled) return;
          setMatchInfo(m);
        },
        onAborted: (reason) => {
          setNotice(`ゲーム中断: ${reason}`);
          setView(null);
          setStageBoth(clientRef.current?.isRandom ? 'mode_select' : 'lobby');
        },
        onReconnectFailed: () => {
          setError('再接続できませんでした。ゲームは終了しています。');
          setView(null);
          setStageBoth(initialMode === 'random' ? 'mode_select' : 'setup');
        },
        onRating: (r) => setRatingResult(r),
        onError: (message) => {
          setError(message);
          if (stageRef.current === 'connecting') setStageBoth(initialMode === 'random' ? 'mode_select' : 'setup');
        },
        onClose: () => {
          const tok = tokenRef.current;
          if (stageRef.current === 'game' && tok && reconnectTries.current < 3) {
            reconnectTries.current += 1;
            setNotice('接続が切れました。再接続中…');
            setTimeout(() => connect('reconnect', { token: tok }), 600);
            return;
          }
          if (stageRef.current === 'reconnecting' && tok && reconnectTries.current < 3) {
            reconnectTries.current += 1;
            setTimeout(() => connect('reconnect', { token: tok }), 800);
            return;
          }
          setError((prev) => prev || 'サーバーに接続できませんでした');
          setView(null);
          setLobby(null);
          setStageBoth(initialMode === 'random' ? 'mode_select' : 'setup');
        },
      },
      () => {
        if (action === 'reconnect' && opts?.token) client.reconnect(opts.token);
        else if (action === 'create') client.createRoom(playerName, uid);
        else if (action === 'join') client.joinRoom(opts?.code ?? joinCode, playerName, uid);
        else if (action === 'random') client.joinRandom(playerName, uid, opts?.matchType ?? 'casual');
      },
    );
    clientRef.current = client;
  };

  const cancelMatching = () => {
    clientRef.current?.cancelRandom();
    clientRef.current?.dispose();
    clientRef.current = null;
    tokenRef.current = null;
    setMatchInfo(null);
    setStageBoth(initialMode === 'random' ? 'mode_select' : 'setup');
  };

  const leave = () => {
    clientRef.current?.dispose();
    clientRef.current = null;
    tokenRef.current = null;
    onHome();
  };

  if (stage === 'game' && view) {
    const isRandom = !!clientRef.current?.isRandom;
    const isHost = lobby?.hostId === clientRef.current?.playerId;
    return (
      <GameScreen
        view={view}
        canAdvance={isRandom || isHost}
        placeDeadline={placeDeadline}
        ratingResult={ratingResult}
        onSubmit={(placements: Placement[]) => clientRef.current?.place(placements)}
        onNextHand={() => clientRef.current?.nextHand()}
        onQuit={leave}
      />
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{initialMode === 'random' ? '🌍 ランダムマッチ' : '👥 フレンド対戦'}</Text>

      {stage === 'reconnecting' && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.gold} />
          <Text style={styles.notice}>接続が切れました。再接続中…</Text>
          <Pressable style={styles.linkBtn} onPress={leave}>
            <Text style={styles.linkText}>← あきらめてホームへ</Text>
          </Pressable>
        </View>
      )}

      {/* ランダムマッチ: カジュアル / レート 選択 */}
      {stage === 'mode_select' && (
        <View style={styles.center}>
          <Pressable
            style={styles.modeBtn}
            onPress={() => {
              playSe('select');
              connect('random', { matchType: 'casual' });
            }}
          >
            <Text style={styles.modeBtnTitle}>🎲 カジュアル対戦</Text>
            <Text style={styles.modeBtnSub}>気軽に1戦。勝敗はレートに影響しません</Text>
          </Pressable>

          <Pressable
            style={styles.modeBtn}
            onPress={() => {
              playSe('select');
              connect('random', { matchType: 'rated' });
            }}
          >
            <View style={styles.soonRow}>
              <Text style={styles.modeBtnTitle}>🏆 レート対戦</Text>
              {myStats && <Text style={styles.ratingPill}>{myStats.rank}・{myStats.rating}</Text>}
            </View>
            <Text style={styles.modeBtnSub}>
              勝てば上がり、負ければ下がる。{myStats && myStats.games > 0 ? `これまで${myStats.games}戦` : 'ランクを駆け上がれ'}
            </Text>
          </Pressable>

          <Pressable style={styles.linkBtn} onPress={leave}>
            <Text style={styles.linkText}>← ホームへ戻る</Text>
          </Pressable>
        </View>
      )}

      {stage === 'connecting' && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.gold} />
          <Text style={styles.notice}>接続中…</Text>
        </View>
      )}

      {stage === 'matching' && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.gold} />
          <Text style={styles.matchTitle}>対戦相手を探しています…</Text>
          <Text style={styles.notice}>
            待機中: {matchInfo?.waiting ?? 1}人{'\n'}
            相手が見つかると自動で開始します
          </Text>
          <Pressable style={styles.cancelBtn} onPress={cancelMatching}>
            <Text style={styles.cancelText}>キャンセル</Text>
          </Pressable>
        </View>
      )}

      {/* フレンド対戦: ルーム作成 / 合言葉で参加 */}
      {stage === 'setup' && (
        <View style={styles.center}>
          <Pressable style={styles.primaryBtn} onPress={() => { playSe('select'); connect('create'); }}>
            <Text style={styles.primaryBtnText}>ルームを作成</Text>
          </Pressable>
          <Text style={styles.orText}>または 合言葉で参加</Text>
          <View style={styles.joinRow}>
            <TextInput
              style={[styles.input, styles.codeInput]}
              value={joinCode}
              onChangeText={(t) => setJoinCode(t.replace(/[^0-9]/g, '').slice(0, 4))}
              maxLength={4}
              keyboardType="number-pad"
              placeholder="4桁の数字"
              placeholderTextColor={colors.textDim}
            />
            <Pressable
              style={[styles.secondaryBtn, joinCode.length !== 4 && styles.disabled]}
              disabled={joinCode.length !== 4}
              onPress={() => { playSe('select'); connect('join'); }}
            >
              <Text style={styles.secondaryBtnText}>参加</Text>
            </Pressable>
          </View>
          <Pressable style={styles.linkBtn} onPress={leave}>
            <Text style={styles.linkText}>← ホームへ戻る</Text>
          </Pressable>
        </View>
      )}

      {stage === 'lobby' && (
        <View style={styles.center}>
          <Text style={styles.codeLabel}>合言葉</Text>
          <Text style={styles.code}>{lobby?.code ?? '----'}</Text>
          <Pressable
            style={[styles.shareBtn, !lobby?.code && styles.disabled]}
            disabled={!lobby?.code}
            onPress={() => { playSe('select'); shareInvite(lobby?.code ?? ''); }}
          >
            <Text style={styles.shareBtnText}>📨 友達を招待（リンクを送る）</Text>
          </Pressable>
          <Text style={styles.notice}>合言葉を伝えるか、上のボタンでリンクを送る（1対1）</Text>
          <View style={styles.playerList}>
            {lobby?.players.map((p) => (
              <Text key={p.id} style={styles.playerItem}>
                {p.id === lobby.hostId ? '👑 ' : '・'}{p.name}
                {p.id === clientRef.current?.playerId ? '（あなた）' : ''}
              </Text>
            ))}
          </View>
          {lobby?.hostId === clientRef.current?.playerId ? (
            <Pressable
              style={[styles.primaryBtn, (lobby?.players.length ?? 0) < 2 && styles.disabled]}
              disabled={(lobby?.players.length ?? 0) < 2}
              onPress={() => { playSe('confirm'); clientRef.current?.startGame(); }}
            >
              <Text style={styles.primaryBtnText}>ゲーム開始</Text>
            </Pressable>
          ) : (
            <Text style={styles.notice}>ホストの開始を待っています…</Text>
          )}
          <Pressable style={styles.linkBtn} onPress={leave}>
            <Text style={styles.linkText}>← 退出</Text>
          </Pressable>
        </View>
      )}

      {!!notice && stage !== 'matching' && stage !== 'reconnecting' && <Text style={styles.notice}>{notice}</Text>}
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.felt, alignItems: 'center', justifyContent: 'center', padding: 24 },
  center: { alignItems: 'center', gap: 4, width: '100%' },
  title: { color: colors.gold, fontSize: 24, fontWeight: '900', marginBottom: 28 },
  input: {
    backgroundColor: colors.panel,
    borderRadius: 8,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  modeBtn: {
    backgroundColor: colors.panelLight,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 18,
    width: '100%',
    maxWidth: 320,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  modeBtnDisabled: { backgroundColor: colors.panel, borderColor: colors.panelLight, opacity: 0.7 },
  modeBtnTitle: { color: colors.gold, fontSize: 18, fontWeight: '900' },
  modeBtnTitleDim: { color: colors.textDim, fontSize: 18, fontWeight: '900' },
  modeBtnSub: { color: colors.textDim, fontSize: 11, marginTop: 4 },
  soonRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ratingPill: {
    color: '#1c1500',
    backgroundColor: colors.gold,
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  soonBadge: {
    color: '#1c1500',
    backgroundColor: colors.textDim,
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  primaryBtn: {
    backgroundColor: colors.gold,
    borderRadius: 10,
    paddingVertical: 13,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#1c1500', fontWeight: '800', fontSize: 15 },
  orText: { color: colors.textDim, fontSize: 12, marginVertical: 14 },
  joinRow: { flexDirection: 'row', gap: 8, width: '100%', maxWidth: 320, alignItems: 'center' },
  codeInput: { flex: 1, textAlign: 'center', letterSpacing: 8, fontWeight: '800', fontSize: 18 },
  secondaryBtn: {
    borderColor: colors.gold,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  secondaryBtnText: { color: colors.gold, fontWeight: '800', fontSize: 14 },
  disabled: { opacity: 0.35 },
  matchTitle: { color: colors.gold, fontSize: 18, fontWeight: '800', marginTop: 12 },
  cancelBtn: {
    borderColor: colors.textDim,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 28,
    marginTop: 20,
  },
  cancelText: { color: colors.textDim, fontWeight: '700' },
  codeLabel: { color: colors.textDim, fontSize: 12 },
  code: { color: colors.gold, fontSize: 48, fontWeight: '900', letterSpacing: 12, marginVertical: 4 },
  shareBtn: {
    backgroundColor: colors.gold,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    marginTop: 6,
  },
  shareBtnText: { color: '#1c1500', fontWeight: '800', fontSize: 14 },
  playerList: { marginVertical: 16, alignItems: 'flex-start', gap: 4 },
  playerItem: { color: colors.text, fontSize: 15 },
  notice: { color: colors.textDim, fontSize: 12, marginTop: 10, textAlign: 'center' },
  error: { color: colors.danger, fontSize: 13, marginTop: 10, textAlign: 'center', fontWeight: '700' },
  linkBtn: { marginTop: 24 },
  linkText: { color: colors.textDim, fontSize: 13 },
});
