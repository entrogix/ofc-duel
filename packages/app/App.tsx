import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { PlayerGameView } from '../shared/src';
import { initAds } from './src/ads/init';
import { LocalGame } from './src/game/LocalGame';
import { getPlayerUid } from './src/identity';
import { parseJoinCode } from './src/invite';
import { GameScreen } from './src/screens/GameScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { loadSettings } from './src/settings';
import { ContactScreen } from './src/screens/ContactScreen';
import { CreditsScreen } from './src/screens/CreditsScreen';
import { OnlineScreen } from './src/screens/OnlineScreen';
import { RulesScreen } from './src/screens/RulesScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { StatsScreen } from './src/screens/StatsScreen';
import { TitleScreen } from './src/screens/TitleScreen';
import { colors } from './src/theme';

type Screen = 'title' | 'home' | 'cpu' | 'online' | 'rules' | 'credits' | 'settings' | 'stats' | 'contact';
type OnlineMode = 'random' | 'friend';

export default function App() {
  const [screen, setScreen] = useState<Screen>('title');
  const [playerName, setPlayerName] = useState('あなた');
  const [onlineMode, setOnlineMode] = useState<OnlineMode>('random');
  const [pendingJoinCode, setPendingJoinCode] = useState<string | undefined>(undefined);
  const [cpuView, setCpuView] = useState<PlayerGameView | null>(null);
  const gameRef = useRef<LocalGame | null>(null);

  // 起動時に広告SDK初期化＋永続ユーザーID（レート対戦の土台）を読み込む
  useEffect(() => {
    initAds();
    getPlayerUid();
    loadSettings();
  }, []);

  // 招待リンク（ofcturbo://join?code=1234）で起動／復帰したら、合言葉を持って
  // フレンド対戦の参加画面へ直行する。1人が3人を呼ぶ獲得ループの受け口。
  useEffect(() => {
    const handleUrl = (url: string | null | undefined) => {
      const code = parseJoinCode(url);
      if (!code) return;
      setOnlineMode('friend');
      setPendingJoinCode(code);
      setScreen('online');
    };
    Linking.getInitialURL().then(handleUrl).catch(() => {});
    const sub = Linking.addEventListener('url', (e) => handleUrl(e.url));
    return () => sub.remove();
  }, []);

  const goOnline = (name: string, mode: OnlineMode) => {
    setPlayerName(name);
    setOnlineMode(mode);
    setPendingJoinCode(undefined);
    setScreen('online');
  };

  const startCpu = (name: string) => {
    setPlayerName(name);
    const game = new LocalGame(name);
    gameRef.current = game;
    game.onView(setCpuView);
    setScreen('cpu');
  };

  const quitCpu = () => {
    gameRef.current = null;
    setCpuView(null);
    setScreen('home');
  };

  return (
    <SafeAreaProvider>
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />
      {/* Webでもスマホ縦持ち相当の幅に収める */}
      <View style={styles.phoneFrame}>
      {screen === 'title' && <TitleScreen onStart={() => setScreen('home')} />}
      {screen === 'home' && (
        <HomeScreen
          onStartCpu={startCpu}
          onRandom={(name) => goOnline(name, 'random')}
          onFriend={(name) => goOnline(name, 'friend')}
          onStats={() => setScreen('stats')}
          onRules={() => setScreen('rules')}
          onCredits={() => setScreen('credits')}
          onSettings={() => setScreen('settings')}
        />
      )}
      {screen === 'cpu' && cpuView && (
        <GameScreen
          view={cpuView}
          canAdvance
          onSubmit={(p) => gameRef.current?.submit(p)}
          onNextHand={() => gameRef.current?.nextHand()}
          onQuit={quitCpu}
        />
      )}
      {screen === 'online' && (
        <OnlineScreen
          playerName={playerName}
          initialMode={onlineMode}
          initialJoinCode={pendingJoinCode}
          onHome={() => { setPendingJoinCode(undefined); setScreen('home'); }}
        />
      )}
      {screen === 'rules' && <RulesScreen onBack={() => setScreen('home')} />}
      {screen === 'credits' && <CreditsScreen onBack={() => setScreen('home')} />}
      {screen === 'settings' && (
        <SettingsScreen onBack={() => setScreen('home')} onContact={() => setScreen('contact')} />
      )}
      {screen === 'contact' && <ContactScreen onBack={() => setScreen('settings')} />}
      {screen === 'stats' && <StatsScreen onBack={() => setScreen('home')} />}
      </View>
    </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Platform.OS === 'web' ? colors.feltDark : colors.felt, alignItems: 'center' },
  phoneFrame: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
    backgroundColor: colors.felt,
    ...(Platform.OS === 'web'
      ? { borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.goldDim }
      : null),
  },
});
