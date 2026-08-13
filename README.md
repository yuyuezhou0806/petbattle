# Pet Battle 宠物对决

一款手机端与 PC Web 共用代码的写实宠物卡牌对战原型。玩家可以拍摄或上传自己的宠物照片，将真实宠物制作成带精致描边和光影效果的战斗卡牌，并体验养成、回合制对战和附近宠友社区。

在线体验：[https://petbattle.mapleai.top](https://petbattle.mapleai.top)

## 当前功能

- 拍照或从相册选择宠物照片
- 保留真实宠物外观的写实卡牌效果
- 自动移除照片背景，沿宠物主体生成金色轮廓
- 足球球员卡风格的原创竞技卡面背景
- 宠物档案、等级、属性、成长任务
- 两种技能和伤害反击机制的单机回合战斗
- 附近宠友信息流界面
- 响应式 PC 导航与手机底部导航
- Expo / React Native / React Native Web 跨平台代码

主体描边由 `server/pet_outline_api.py` 提供，使用本地 ONNX 分割模型处理。联网存档、匹配对战和真实社交后端尚未接入。

## 本地运行

需要 Node.js 20 或更新版本。

```bash
npm install
npm run web
```

原生移动端开发预览：

```bash
npm start
```

然后使用 Expo Go 扫描终端中的二维码。

## 构建 Web 生产版本

```bash
npx expo export --platform web
```

产物生成在 `dist/` 目录。

## 服务器部署

`deploy/` 包含本项目使用的 Nginx 示例配置：

- `paw-duel-8060.nginx`：通过服务器的 8060 端口访问
- `petbattle.mapleai.top.nginx`：通过域名、HTTPS 和主体描边 API 访问
- `pet-battle-outline.service`：主体分割服务的 systemd 配置

部署时需要根据自己的服务器目录和域名调整配置。证书、私钥及服务器登录信息不包含在仓库中。

## 技术栈

- Expo 57
- React 19
- React Native 0.86
- React Native Web
- TypeScript
- Nginx

## 许可证

[MIT](LICENSE)
