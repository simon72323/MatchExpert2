# MatchExpert2 SDK／上架接線說明

本專案已接好 **可配置骨架**：預覽走 stub，真機掛上 `globalThis.MatchExpertSdk` 即可走真實廣告／內購／分享。

## 1. 填設定

編輯 `assets/resources/config/sdk_config.json`：

| 欄位 | 說明 |
|------|------|
| `ads.androidGameId` / `iosGameId` | Unity Ads Game ID（對齊原 Unity `AdsInitializer`） |
| `ads.rewardedAndroid` / `rewardedIos` | 預設 `Rewarded_Android` / `Rewarded_iOS` |
| `ads.interstitial*` | 插頁 Unit；`interstitialEveryNWins` 控制每 N 次過關播一次 |
| `ads.testMode` | 上架前改 `false` |
| `iap.products.remove_ads.*Sku` | Google Play / App Store 商品 ID |
| `share.url` / `title` / `hashtag` | 分享文案與商店連結 |

預覽預設 `useStubInPreview: true`，瀏覽器不需原生 SDK。

## 2. 原生橋接介面

在原生啟動腳本（或 JSB 注入）掛上：

```js
globalThis.MatchExpertSdk = {
  ads: {
    async init(cfg) { /* Advertisement.Initialize(cfg.gameId, cfg.testMode) */ return true; },
    async showRewarded(unitId, place) { /* show + 等獎勵 callback */ return true; },
    async showInterstitial(unitId) { return true; },
  },
  iap: {
    async init(skus) { /* 查價 */ },
    async purchase(sku) { return { ok: true }; },
    async restore() { return ['remove_ads']; },
    getPrice(sku) { return '$2.99'; },
  },
  share: {
    async share({ title, text, url }) { /* 系統分享面板 */ return true; },
  },
};
```

對應 TS：`NativeBridge` / `AdsService` / `IapService` / `ShareService`。

## 3. 已串好的遊戲時機

- 獎勵廣告 place：`loseRevival`、`buyItem`、`openEight`、`openEightLevel`、`winCoin`…
- 過關：`AdsService.maybeShowInterstitialOnWin`（去廣告用戶跳過）
- 商店：購買去廣告、還原購買、分享成績
- 啟動：`GameApp.bootstrap` → `SdkConfig` → Ads／IAP `init`

## 4. 建置／合圖／安全區

- 直豎屏：`settings/v2/packages/device.json`（portrait only）
- 設計解析度 720×1280：`project.json`
- 自動圖集：`resources/ui/auto-atlas.pac`、`resources/skin/auto-atlas.pac`（建置時合圖）
- 安全區：`SafeAreaFit` 掛在 Canvas（`GameApp.ensureSafeArea`）

## 5. 上架檢查清單

- [ ] 填入真實 GameId／SKU，`testMode: false`
- [ ] 原生專案接入 Unity Ads（或改 provider）與商店 IAP
- [ ] 注入 `MatchExpertSdk` 並在真機驗證獎勵／還原／插頁
- [ ] Creator 建置 Android／iOS，確認合圖與直屏
- [ ] 更新 `share.url` 為商店頁
