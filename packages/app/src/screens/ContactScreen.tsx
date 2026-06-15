import React, { useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { playSe } from '../audio';
import { CONTACT_EMAIL, CONTACT_ENDPOINT } from '../config';
import { getCachedPlayerUid } from '../identity';
import { colors } from '../theme';

const APP_VERSION = '0.1';
const KINDS = ['不具合の報告', '機能の要望', '質問', 'その他'] as const;
type Kind = (typeof KINDS)[number];
type Status = 'idle' | 'sending' | 'sent' | 'error';

export function ContactScreen({ onBack }: { onBack: () => void }) {
  const [kind, setKind] = useState<Kind>('不具合の報告');
  const [body, setBody] = useState('');
  const [replyTo, setReplyTo] = useState('');
  const [status, setStatus] = useState<Status>('idle');

  const canSend = body.trim().length > 0 && status !== 'sending';

  const submit = async () => {
    if (!canSend) return;
    playSe('confirm');
    setStatus('sending');
    const payload = {
      app: 'ofc-turbo',
      version: APP_VERSION,
      platform: Platform.OS,
      kind,
      body: body.trim(),
      replyTo: replyTo.trim(),
      uid: getCachedPlayerUid(),
      at: new Date().toISOString(),
    };

    if (CONTACT_ENDPOINT) {
      try {
        const res = await fetch(CONTACT_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(payload),
        });
        setStatus(res.ok ? 'sent' : 'error');
      } catch {
        setStatus('error');
      }
      return;
    }

    // エンドポイント未設定 → メールアプリへ
    try {
      const subject = encodeURIComponent(`[OFCデュエル] ${kind}`);
      const mailBody = encodeURIComponent(
        `${body.trim()}\n\n----\n返信先: ${replyTo.trim() || '(未記入)'}\nID: ${payload.uid}\nversion: ${APP_VERSION} / ${Platform.OS}`,
      );
      const ok = await Linking.openURL(`mailto:${CONTACT_EMAIL}?subject=${subject}&body=${mailBody}`);
      setStatus(ok === undefined ? 'sent' : 'sent');
    } catch {
      setStatus('error');
    }
  };

  if (status === 'sent') {
    return (
      <View style={styles.container}>
        <View style={styles.doneWrap}>
          <Text style={styles.doneIcon}>✅</Text>
          <Text style={styles.doneTitle}>送信しました</Text>
          <Text style={styles.doneSub}>ご協力ありがとうございます。{'\n'}いただいた内容は今後の改善に役立てます。</Text>
          <Pressable style={styles.primaryBtn} onPress={() => { playSe('select'); onBack(); }}>
            <Text style={styles.primaryBtnText}>戻る</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>✉️ お問い合わせ</Text>

        <Text style={styles.label}>種類</Text>
        <View style={styles.kindRow}>
          {KINDS.map((k) => (
            <Pressable
              key={k}
              style={[styles.kindChip, kind === k && styles.kindChipOn]}
              onPress={() => { playSe('select'); setKind(k); }}
            >
              <Text style={[styles.kindText, kind === k && styles.kindTextOn]}>{k}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>内容</Text>
        <TextInput
          style={styles.bodyInput}
          value={body}
          onChangeText={setBody}
          multiline
          numberOfLines={6}
          maxLength={1000}
          placeholder="不具合の状況・ご要望・ご質問などを具体的にご記入ください"
          placeholderTextColor={colors.textDim}
          textAlignVertical="top"
        />

        <Text style={styles.label}>返信先メール（任意）</Text>
        <TextInput
          style={styles.input}
          value={replyTo}
          onChangeText={setReplyTo}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="返信が必要な場合のみ"
          placeholderTextColor={colors.textDim}
        />

        <Text style={styles.note}>
          ※ アプリのバージョンと匿名ID（{getCachedPlayerUid().slice(0, 8) || '----'}）が一緒に送信されます。個人情報は含まれません。
        </Text>

        {status === 'error' && (
          <Text style={styles.error}>送信に失敗しました。通信環境を確認して再度お試しください。</Text>
        )}

        <Pressable
          style={[styles.primaryBtn, !canSend && styles.disabled]}
          disabled={!canSend}
          onPress={submit}
        >
          <Text style={styles.primaryBtnText}>{status === 'sending' ? '送信中…' : '送信する'}</Text>
        </Pressable>
      </ScrollView>
      <Pressable style={styles.backBtn} onPress={() => { playSe('select'); onBack(); }}>
        <Text style={styles.backText}>← 戻る</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.felt },
  scroll: { padding: 18, paddingTop: 40 },
  title: { color: colors.gold, fontSize: 22, fontWeight: '900', marginBottom: 16, textAlign: 'center' },
  label: { color: colors.textDim, fontSize: 12, marginTop: 14, marginBottom: 6 },
  kindRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kindChip: {
    borderWidth: 1,
    borderColor: colors.goldDim,
    borderRadius: 16,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  kindChipOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  kindText: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  kindTextOn: { color: '#1c1500', fontWeight: '800' },
  input: {
    backgroundColor: colors.panel,
    borderRadius: 8,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  bodyInput: {
    backgroundColor: colors.panel,
    borderRadius: 8,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    minHeight: 130,
  },
  note: { color: colors.textDim, fontSize: 10, lineHeight: 15, marginTop: 12 },
  error: { color: colors.danger, fontSize: 13, fontWeight: '700', marginTop: 12, textAlign: 'center' },
  primaryBtn: {
    backgroundColor: colors.gold,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 18,
  },
  primaryBtnText: { color: '#1c1500', fontWeight: '800', fontSize: 15 },
  disabled: { opacity: 0.35 },
  backBtn: { padding: 14, alignItems: 'center' },
  backText: { color: colors.textDim, fontSize: 14 },
  doneWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  doneIcon: { fontSize: 48 },
  doneTitle: { color: colors.gold, fontSize: 20, fontWeight: '900', marginTop: 8 },
  doneSub: { color: colors.textDim, fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 20 },
});
