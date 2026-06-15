import React, { useRef, useState } from 'react';
import { Animated, PanResponder } from 'react-native';

interface Props {
  children: React.ReactNode;
  // ドロップ先判定。配置できたら true（カードは状態変化で再マウントされる）
  onDrop: (pageX: number, pageY: number) => boolean;
  // ドラッグ開始時に呼ぶ（ドロップ先座標の再計測などに使う）
  onDragStart?: () => void;
}

// タップは子のPressableに任せ、一定距離動いたらドラッグを開始する
export function DraggableCard({ children, onDrop, onDragStart }: Props) {
  const pos = useRef(new Animated.ValueXY()).current;
  const [dragging, setDragging] = useState(false);
  // PanResponderは初回マウント時に1度だけ作られるため、
  // 最新のprops（=最新のpending状態を掴んだクロージャ）をrefで参照する
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;
  const onDragStartRef = useRef(onDragStart);
  onDragStartRef.current = onDragStart;

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 6 || Math.abs(g.dy) > 6,
      // 縦方向の動きは横スクロール（トレイ）より優先してドラッグにする
      onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dy) > 10 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderGrant: () => {
        setDragging(true);
        onDragStartRef.current?.();
      },
      onPanResponderMove: Animated.event([null, { dx: pos.x, dy: pos.y }], { useNativeDriver: false }),
      onPanResponderRelease: (_, g) => {
        setDragging(false);
        const placed = onDropRef.current(g.moveX, g.moveY);
        if (placed) {
          pos.setValue({ x: 0, y: 0 });
        } else {
          Animated.spring(pos, { toValue: { x: 0, y: 0 }, friction: 6, useNativeDriver: false }).start();
        }
      },
      onPanResponderTerminate: () => {
        setDragging(false);
        Animated.spring(pos, { toValue: { x: 0, y: 0 }, friction: 6, useNativeDriver: false }).start();
      },
    }),
  ).current;

  return (
    <Animated.View
      {...pan.panHandlers}
      style={{
        transform: [...pos.getTranslateTransform(), { scale: dragging ? 1.15 : 1 }],
        zIndex: dragging ? 1000 : 0,
        elevation: dragging ? 10 : 0,
      }}
    >
      {children}
    </Animated.View>
  );
}
