import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card, parseCards } from '../../../shared/src';
import { colors } from '../theme';
import { FadeIn, FadeSlideIn } from './anim';
import { CardView } from './CardView';

// ポーカーの役一覧（弱い順）。初心者向けに例カード付きで表示する
interface HandInfo {
  name: string;
  cards: Card[];
  desc: string;
  royalty?: string; // ミドル/バックのボーナス
}

const HANDS: HandInfo[] = [
  { name: 'ハイカード', cards: parseCards('As Jd 9c 6h 3s'), desc: '役なし。いちばん強いカードで勝負' },
  { name: 'ワンペア', cards: parseCards('Ks Kd 8c 5h 2s'), desc: '同じ数字が2枚' },
  { name: 'ツーペア', cards: parseCards('Qs Qd 7c 7h 3s'), desc: 'ペアが2組' },
  { name: 'スリーカード', cards: parseCards('9s 9d 9c Ah 4s'), desc: '同じ数字が3枚', royalty: 'ミドル+2' },
  { name: 'ストレート', cards: parseCards('8s 7d 6c 5h 4s'), desc: '数字が5枚連続（マークはバラバラでOK）', royalty: 'バック+2 / ミドル+4' },
  { name: 'フラッシュ', cards: parseCards('Kh Th 7h 5h 2h'), desc: '同じマークが5枚', royalty: 'バック+4 / ミドル+8' },
  { name: 'フルハウス', cards: parseCards('Js Jd Jc 6h 6s'), desc: '3枚組＋ペア', royalty: 'バック+6 / ミドル+12' },
  { name: 'フォーカード', cards: parseCards('7s 7d 7c 7h Ks'), desc: '同じ数字が4枚', royalty: 'バック+10 / ミドル+20' },
  { name: 'ストレートフラッシュ', cards: parseCards('9h 8h 7h 6h 5h'), desc: '同じマークで5枚連続', royalty: 'バック+15 / ミドル+30' },
  { name: 'ロイヤルフラッシュ', cards: parseCards('As Ks Qs Js Ts'), desc: '同じマークの10〜Aのストレート', royalty: 'バック+25 / ミドル+30' },
];

// 役リスト本体（ルール画面にも埋め込める）
export function HandList() {
  return (
    <View>
      {HANDS.map((h, i) => (
        <View key={h.name} style={styles.handRow}>
          <View style={styles.handHeader}>
            <Text style={styles.handRank}>{i === 0 ? '弱' : i === HANDS.length - 1 ? '最強' : i + 1}</Text>
            <Text style={styles.handName}>{h.name}</Text>
            {h.royalty && <Text style={styles.royalty}>🎁 {h.royalty}</Text>}
          </View>
          <View style={styles.cards}>
            {h.cards.map((c, k) => (
              <CardView key={k} card={c} size="mini" />
            ))}
          </View>
          <Text style={styles.desc}>{h.desc}</Text>
        </View>
      ))}
      <View style={styles.frontNote}>
        <Text style={styles.frontNoteTitle}>フロント（3枚）の役は3種類だけ</Text>
        <Text style={styles.frontNoteBody}>
          ハイカード / ワンペア / スリーカード のみ（ストレート・フラッシュは数えない）{'\n'}
          🎁 66ペア=+1 〜 AAペア=+9、スリーカードは+10〜+22{'\n'}
          🎡 QQペア以上でファンタジーランド突入！
        </Text>
      </View>
    </View>
  );
}

// プレイ中に開ける役一覧モーダル
export function HandGuideModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  if (!visible) return null;
  return (
    <FadeIn style={styles.backdrop}>
      <FadeSlideIn style={styles.sheetWrap} dy={30} duration={250}>
        <View style={styles.sheet}>
          <Text style={styles.title}>📖 ポーカーの役（弱い順）</Text>
          <ScrollView style={styles.scroll}>
            <HandList />
          </ScrollView>
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeText}>閉じる</Text>
          </Pressable>
        </View>
      </FadeSlideIn>
    </FadeIn>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 10,
    zIndex: 1800,
  },
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
  title: { color: colors.gold, fontSize: 16, fontWeight: '800', textAlign: 'center', marginBottom: 6 },
  scroll: { flexGrow: 0, flexShrink: 1, minHeight: 0 },
  closeBtn: {
    backgroundColor: colors.gold,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: 8,
  },
  closeText: { color: '#1c1500', fontWeight: '800', fontSize: 15 },
  handRow: {
    backgroundColor: colors.panel,
    borderRadius: 8,
    padding: 8,
    marginVertical: 3,
  },
  handHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  handRank: {
    color: '#111',
    backgroundColor: colors.textDim,
    fontSize: 9,
    fontWeight: '800',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    overflow: 'hidden',
  },
  handName: { color: colors.text, fontWeight: '800', fontSize: 13 },
  royalty: { color: colors.pending, fontSize: 10, fontWeight: '700', marginLeft: 'auto' },
  cards: { flexDirection: 'row', marginTop: 4 },
  desc: { color: colors.textDim, fontSize: 11, marginTop: 3 },
  frontNote: {
    backgroundColor: colors.panelLight,
    borderRadius: 8,
    padding: 8,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: colors.goldDim,
  },
  frontNoteTitle: { color: colors.gold, fontWeight: '800', fontSize: 12 },
  frontNoteBody: { color: colors.text, fontSize: 11, lineHeight: 17, marginTop: 3 },
});
