import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // 包名与存储 key 前缀口径一致（Y0-05 / JY-03 §7：一律 jiyi.*）
  appId: 'com.jiyi.app',
  // 启动器显示名（写入 android/app/src/main/res/values/strings.xml 的 app_name）
  appName: '稽疑',
  webDir: 'dist'
};

export default config;
