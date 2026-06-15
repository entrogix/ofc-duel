import Constants from 'expo-constants';

// Expo Go（storeClient）にはネイティブ広告モジュールが無いため広告を無効化する。
// EAS Build（standalone / dev client）でのみ実広告を有効にする。
export const adsAvailable = Constants.executionEnvironment !== 'storeClient';
