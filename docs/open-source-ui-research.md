# Pet Battle 开源 UI 调研

调研目标：寻找可合法用于 Pet Battle 的 React Native / Expo / Web 开源界面与架构，避免直接复制无许可证项目或受保护的商业游戏素材。

## 建议采用的组合

### 1. PawPaw：宠物养成页面参考

- 仓库：https://github.com/snndmnsz/pawpaw
- 许可证：MIT
- 技术：Expo React Native、Redux
- 适合复用：宠物资料、喂食/健康记录、卡片式宠物主页的页面组织
- 不适合直接作为底座：最后更新于 2022 年，依赖较旧，缺少 Web 和卡牌对战

结论：借鉴信息架构和可爱宠物 UI，按当前 Expo 版本迁移必要组件，不整体复制旧工程。

### 2. Matchimals：游戏交互与跨平台参考

- 仓库：https://github.com/chrisheninger/matchimals.fun
- 许可证：MIT
- 技术：Expo、React Native、React Native Web、boardgame.io
- 适合复用：手机/PC 响应式游戏界面、卡牌动效、回合状态和触控交互
- 注意：原项目是动物配对游戏，玩法和美术不能直接当作 Pet Battle 成品

结论：这是对战界面和跨端体验最匹配的参考项目。

### 3. Galio：统一 UI 组件库

- 仓库：https://github.com/galio-org/galio
- 许可证：MIT
- 技术：React Native / TypeScript
- 适合复用：按钮、输入框、卡片、导航、间距和主题系统
- 优点：组件成熟，能快速消除当前原型的“临时页面感”
- 注意：它是通用组件库，“可爱感”仍需要通过颜色、圆角、字体和图标主题实现

结论：可作为基础组件层，不作为整套产品视觉。

### 4. Bluesky Social：社交信息流参考

- 仓库：https://github.com/bluesky-social/social-app
- 许可证：MIT
- 技术：React Native Web / iOS / Android / TypeScript
- 适合参考：信息流、个人主页、图片发布、关注、通知和无障碍设计
- 不适合整体引入：工程规模和 AT Protocol 架构远超本项目需求

结论：只参考社交页面模式和细节，不复制整个代码库。

### 5. Create Expo Stack：登录和工程架构

- 仓库：https://github.com/roninoss/create-expo-stack
- 许可证：MIT
- 技术：Expo Router、TypeScript、Supabase/Firebase、Tamagui 等可选组合
- 适合复用：现代 Expo 工程结构、路由、Supabase 登录与跨端配置

结论：用户系统阶段可用它生成 Supabase + Expo Router 参考工程，再把经过验证的认证结构迁入 Pet Battle。

## 不建议

- 无 LICENSE 的宠物 UI 仓库：公开可见不代表允许商用复制。
- 直接复制 FIFA / EA FC 球员卡：卡框、美术、标志和整体装潢存在知识产权风险。
- 直接迁入老旧宠物 App 全部源码：升级成本通常高于按当前技术栈迁移页面组件。
- 整体复制大型社交 App：依赖、协议和业务模型会显著拖慢 MVP。

## 推荐实施顺序

1. 用 Galio 的基础组件和 PawPaw 的宠物页面结构重构首页、宠物页和建卡页。
2. 用 Matchimals 的跨端布局和卡牌交互模式重构对战页。
3. 接入 Supabase Auth、用户表、宠物表和图片存储。
4. 用户身份稳定后再做动态、关注、附近的人和联网对战。

登录不能拖到产品最后。当前纯单机视觉原型可以没有登录，但以下功能都依赖用户身份：

- 保存和恢复宠物卡
- 多设备同步
- 图片云端存储
- 好友、关注、评论和私信
- 附近的人隐私授权
- 排位、战绩和反作弊

因此登录应在 UI 设计方向确定后立即开始，早于正式社交和联网对战。
