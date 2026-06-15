import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { applyAudioSettings, playSe } from '../audio';
import { getCachedPlayerUid } from '../identity';
import { getSettings, updateSettings } from '../settings';
import { colors } from '../theme';

export function SettingsScreen({ onBack, onContact }: { onBack: () => void; onContact: () => void }) {
  const s = getSettings();
  const [bgmOn, setBgmOn] = useState(s.bgmOn);
  const [seOn, setSeOn] = useState(s.seOn);
  const [reduceMotion, setReduceMotion] = useState(s.reduceMotion);
  const [name, setName] = useState(s.playerName);

  const uid = getCachedPlayerUid();
  const shortUid = uid ? uid.slice(0, 8).toUpperCase() : '----';

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>⚙️ 設定</Text>

        <Section title="サウンド">
          <ToggleRow
            label="BGM"
            value={bgmOn}
            onChange={(v) => {
              setBgmOn(v);
              updateSettings({ bgmOn: v });
              applyAudioSettings();
            }}
          />
          <ToggleRow
            label="効果音"
            value={seOn}
            onChange={(v) => {
              setSeOn(v);
              updateSettings({ seOn: v });
              if (v) playSe('select'); // ONにしたら確認音
            }}
          />
        </Section>

        <Section title="表示">
          <ToggleRow
            label="演出を減らす"
            sub="アニメーションを控えめにして動作を軽くします"
            value={reduceMotion}
            onChange={(v) => {
              setReduceMotion(v);
              updateSettings({ reduceMotion: v });
            }}
          />
        </Section>

        <Section title="プレイヤー">
          <Text style={styles.fieldLabel}>名前</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={(t) => {
              setName(t);
              updateSettings({ playerName: t });
            }}
            maxLength={12}
            placeholder="プレイヤー名"
            placeholderTextColor={colors.textDim}
          />
          <View style={styles.idRow}>
            <Text style={styles.fieldLabel}>あなたのID（サポート・引き継ぎ用）</Text>
            <Text style={styles.idValue}>{shortUid}</Text>
          </View>
          <Text style={styles.idNote}>
            このIDに戦績・レートが紐づきます。名前を変えてもIDは変わりません。
          </Text>
        </Section>

        <Section title="サポート">
          <Pressable style={styles.contactBtn} onPress={() => { playSe('select'); onContact(); }}>
            <Text style={styles.contactText}>✉️ お問い合わせ</Text>
            <Text style={styles.contactArrow}>›</Text>
          </Pressable>
        </Section>
      </ScrollView>
      <Pressable style={styles.backBtn} onPress={() => { playSe('select'); onBack(); }}>
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

function ToggleRow({
  label,
  sub,
  value,
  onChange,
}: {
  label: string;
  sub?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        {sub && <Text style={styles.rowSub}>{sub}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: '#3a3a3a', true: colors.goldDim }}
        thumbColor={value ? colors.gold : '#ccc'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.felt },
  scroll: { padding: 18, paddingTop: 40 },
  title: { color: colors.gold, fontSize: 22, fontWeight: '900', marginBottom: 16, textAlign: 'center' },
  section: { backgroundColor: colors.panel, borderRadius: 10, padding: 12, marginBottom: 12 },
  sectionTitle: { color: colors.gold, fontWeight: '800', fontSize: 13, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  rowText: { flex: 1, paddingRight: 12 },
  rowLabel: { color: colors.text, fontSize: 15, fontWeight: '600' },
  rowSub: { color: colors.textDim, fontSize: 11, marginTop: 2 },
  fieldLabel: { color: colors.textDim, fontSize: 12, marginTop: 4, marginBottom: 4 },
  input: {
    backgroundColor: colors.feltDark,
    borderRadius: 8,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  idRow: { marginTop: 12 },
  idValue: { color: colors.gold, fontSize: 18, fontWeight: '900', letterSpacing: 2 },
  idNote: { color: colors.textDim, fontSize: 10, lineHeight: 15, marginTop: 4 },
  contactBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  contactText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  contactArrow: { color: colors.textDim, fontSize: 22, fontWeight: '300' },
  backBtn: { padding: 14, alignItems: 'center' },
  backText: { color: colors.textDim, fontSize: 14 },
});
