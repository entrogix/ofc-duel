import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card, parseCards } from '../../../shared/src';
import { CardView } from '../components/CardView';
import { HandList } from '../components/HandGuide';
import { colors } from '../theme';

// ボードの図解（例付き）
function BoardDiagram({ foul }: { foul?: boolean }) {
  const rows: { label: string; cards: Card[]; hand: string }[] = foul
    ? [
        { label: 'フロント', cards: parseCards('As Ad 5c'), hand: 'AAペア 😱強すぎ!' },
        { label: 'ミドル', cards: parseCards('Kc 9d 7h 5s 2c'), hand: 'ハイカード' },
        { label: 'バック', cards: parseCards('Qs Qd 8c 6h 3s'), hand: 'ワンペア' },
      ]
    : [
        { label: 'フロント', cards: parseCards('Qs Qd 5c'), hand: 'ワンペア' },
        { label: 'ミドル', cards: parseCards('Ks Kd 8c 8h 2s'), hand: 'ツーペア' },
        { label: 'バック', cards: parseCards('9s 9d 9c Ah 4s'), hand: 'スリーカード' },
      ];
  return (
    <View style={[ds.board, foul && ds.boardFoul]}>
      {rows.map((row, i) => (
        <View key={row.label} style={ds.row}>
          <View style={ds.labelBox}>
            <Text style={ds.label}>{row.label}</Text>
            <Text style={ds.strength}>{i === 0 ? '弱' : i === 1 ? '中' : '強'}</Text>
          </View>
          <View style={ds.cards}>
            {row.cards.map((c, k) => (
              <CardView key={k} card={c} size="mini" />
            ))}
          </View>
          <Text style={[ds.hand, foul && i === 0 && ds.handBad]}>{row.hand}</Text>
        </View>
      ))}
      <Text style={[ds.verdict, foul ? ds.verdictBad : ds.verdictGood]}>
        {foul ? '💥 フロントが一番強い → バースト！' : '✅ 下にいくほど強い → OK！'}
      </Text>
    </View>
  );
}

export function RulesScreen({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>📖 あそびかた</Text>

        <Section title="🎯 目的" emphasis>
          13枚を 3つの段 に分けて置き、各段の役の強さで <Text style={styles.bold}>1対1</Text> の相手と勝負！{'\n'}
          ルールはひとつだけ——
          <Text style={styles.bold}>「下の段ほど強い役にする」</Text>
        </Section>

        <Text style={styles.diagramTitle}>✅ 正しい置き方の例</Text>
        <BoardDiagram />
        <Text style={styles.diagramTitle}>💥 ダメな例（バースト）</Text>
        <BoardDiagram foul />
        <Section title="">
          バーストすると役が全部無効になり、相手に 6点＋相手の役ボーナス を支払う大事故！{'\n'}
          まずは「強いカードは下の段（バック）から」と覚えればOK。
        </Section>

        <Section title="🔄 ゲームの流れ（1枚捨て）">
          ① 6枚配られる → 5枚置いて1枚捨てる{'\n'}
          ② 5枚配られる → 4枚置いて1枚捨てる{'\n'}
          ③ 5枚配られる → 4枚置いて1枚捨てる（計13枚で完成）{'\n\n'}
          置かずに残った1枚は<Text style={styles.bold}>自動で捨て札</Text>になります（捨て操作は不要）。
          相手の捨て札も見えるので、何を切ったかも読みどころ。{'\n'}
          両者同時に置いて、確定すると同時にオープン。
          <Text style={styles.bold}>一度置いたカードは動かせない</Text>ので、後から来るカードを想像しながら置こう。
        </Section>

        <Section title="💰 点数の計算">
          相手と段ごとに強さを比べる：{'\n'}
          ・勝った段 ×1点 もらう（負けたら払う）{'\n'}
          ・3段すべて勝つと <Text style={styles.bold}>倍額の6点</Text>（スクープ！）{'\n'}
          ・強い役を作ると <Text style={styles.bold}>役ボーナス</Text>（下の役一覧の🎁）が追加でもらえる{'\n\n'}
          例: 3段勝ち(6点) + フラッシュをバックに作った(+4点) = 10点ゲット
        </Section>

        <Section title="🎡 ファンタジーランド（フィーバー）" emphasis>
          フロントに <Text style={styles.bold}>QQペア以上</Text> を作ると突入！{'\n'}
          次のハンドは14枚を最初から全部見て置ける大チャンス（うち1枚は捨て）。{'\n\n'}
          さらに「フロント3カード / ミドルFH以上 / バック4カード以上」のどれかを作れば連続フィーバー！
        </Section>

        <Section title="🏁 ゲームの終わり">
          全 <Text style={styles.bold}>10ハンド</Text> で決着（途中でチップが尽きても終了）。{'\n'}
          チップ（初期50点）が多い方の勝ち！
        </Section>

        <Section title="🎮 対戦モード">
          ・<Text style={styles.bold}>CPU対戦</Text>：AIと1対1。オフラインOK{'\n'}
          ・<Text style={styles.bold}>ランダムマッチ</Text>：世界中の人と1対1（カジュアル／レート）{'\n'}
          ・<Text style={styles.bold}>フレンド対戦</Text>：合言葉で友達と1対1{'\n'}
          レート対戦で勝つとランクが上がります（戦績・ランキングで確認）。
        </Section>

        <Text style={styles.handListTitle}>🃏 ポーカーの役一覧（弱い順）</Text>
        <Text style={styles.handListNote}>プレイ中もヘッダーの ❓ からいつでも見られます</Text>
        <HandList />
      </ScrollView>
      <Pressable style={styles.backBtn} onPress={onBack}>
        <Text style={styles.backText}>← 戻る</Text>
      </Pressable>
    </View>
  );
}

function Section({ title, children, emphasis }: { title: string; children: React.ReactNode; emphasis?: boolean }) {
  return (
    <View style={[styles.section, emphasis && styles.sectionEmphasis]}>
      {title !== '' && <Text style={styles.sectionTitle}>{title}</Text>}
      <Text style={styles.sectionBody}>{children}</Text>
    </View>
  );
}

const ds = StyleSheet.create({
  board: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  boardFoul: { borderColor: colors.danger },
  row: { flexDirection: 'row', alignItems: 'center', marginVertical: 2 },
  labelBox: { width: 52 },
  label: { color: colors.textDim, fontSize: 10 },
  strength: { color: colors.gold, fontSize: 9, fontWeight: '800' },
  cards: { flexDirection: 'row' },
  hand: { color: colors.textDim, fontSize: 10, marginLeft: 6, flexShrink: 1 },
  handBad: { color: colors.danger, fontWeight: '800' },
  verdict: { fontSize: 12, fontWeight: '800', textAlign: 'center', marginTop: 4 },
  verdictGood: { color: colors.accent },
  verdictBad: { color: colors.danger },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.felt },
  scroll: { padding: 16, paddingTop: 36 },
  title: { color: colors.gold, fontSize: 22, fontWeight: '900', marginBottom: 12, textAlign: 'center' },
  section: { backgroundColor: colors.panel, borderRadius: 10, padding: 12, marginVertical: 6 },
  sectionEmphasis: { borderWidth: 1, borderColor: colors.gold },
  sectionTitle: { color: colors.gold, fontWeight: '800', fontSize: 14, marginBottom: 6 },
  sectionBody: { color: colors.text, fontSize: 13, lineHeight: 21 },
  bold: { fontWeight: '900', color: colors.pending },
  diagramTitle: { color: colors.text, fontSize: 13, fontWeight: '800', marginTop: 10, marginBottom: 4 },
  handListTitle: { color: colors.gold, fontSize: 16, fontWeight: '900', marginTop: 16, textAlign: 'center' },
  handListNote: { color: colors.textDim, fontSize: 11, textAlign: 'center', marginBottom: 6 },
  backBtn: { padding: 14, alignItems: 'center' },
  backText: { color: colors.textDim, fontSize: 14 },
});
