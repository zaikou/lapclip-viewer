# LAP CLIP Viewer

LAP CLIP（ https://matrix-sports.jp/lap/ ）の自転車レース結果をF1ライブタイミング風に表示するAndroidアプリ。

完全にバイブコーディングでやっています。（私はCとH8のアセンブラしかわかりません）

## 機能

- イベント一覧から選択（2026〜2023年）
- カテゴリ選択
- 全選手のラップデータを並列取得
- 4つの表示タブ:
  - **LAP順位**: 各周のラップタイム順にソート（紫＝全体ベスト、緑＝自己ベスト）
  - **経過時間**: 各周終了時点の累積タイム順
  - **総合**: 全ラップを横並びで比較表示
  - **グラフ**: 選手のラップタイム推移を折れ線グラフで比較
- テーブルの行タップでグラフに選手を追加
- 手動更新ボタン

## GitHub Actions で APK をビルド

1. このリポジトリを GitHub に push
2. Actions タブ → Build APK ワークフローが自動実行
3. 完了後、Artifacts から `lapclip-viewer-apk.zip` をダウンロード
4. 中身の `app-debug.apk` をAndroid端末に転送してインストール

### 手動ビルド（自宅PC）

```bash
npm install
npx cap add android
npx cap sync
cd android
./gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```

## 技術スタック

- Capacitor 8（Android WebViewラップ）
- JavaScript（Vanilla JS、DOMParserでHTMLスクレイピング）
- Canvas 2D API（グラフ描画）

## 開発環境

- OpenCode
  - DeepSeek V4 Flash Free
- VSC copilot （コードチェック用）
  - Claude 4.5 
