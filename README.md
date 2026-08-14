# Pet Battle 宠物对决

一款手机端与 PC Web 共用代码的写实宠物卡牌对战原型。玩家可以拍摄或上传自己的宠物照片，将真实宠物制作成带精致描边和光影效果的战斗卡牌，并体验养成、回合制对战和附近宠友社区。

在线体验：[https://petbattle.mapleai.top](https://petbattle.mapleai.top)

## 当前功能

- 拍照或从相册选择宠物照片
- 保留真实宠物外观的写实卡牌效果
- 自动移除照片背景，沿宠物主体生成金色轮廓
- 无装备、无随机稀有度的宠物初始白卡
- 六个宠物品类、十三种猫咪细分类，以及每只宠物随机生成的三个专属种族天赋
- 拍照后由视觉模型判断物种，并用本地宠物知识库标准化猫咪花色/品种候选
- 显示最多三个候选、置信度与判断依据，由用户最终确认；不会把花色误称为血统
- 签到、装备抽取、三段冒险及头部/身体/挂件装备槽
- 包含速度、攻防、暴击、闪避、能量和格挡的回合战斗
- 附近宠友信息流界面
- 响应式 PC 导航与手机底部导航
- Expo / React Native / React Native Web 跨平台代码

主体描边与宠物识别接口由 `server/pet_outline_api.py` 提供。描边使用本地 ONNX 分割模型；识别使用支持图片输入和结构化输出的 OpenAI 模型，再映射到 `knowledge/pet-breeds.zh-CN.json`。联网存档、匹配对战和真实社交后端尚未接入。

没有配置模型密钥时，拍照页面会自动切换为手动品类/品种选择，白卡生成仍可正常使用。

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

AI 识别通过服务端环境变量启用，密钥不要写进仓库：

```bash
sudo sh -c 'printf "OPENAI_API_KEY=你的密钥\nOPENAI_VISION_MODEL=gpt-5.4-nano\n" > /etc/pet-battle-outline.env'
sudo chmod 600 /etc/pet-battle-outline.env
sudo systemctl restart pet-battle-outline.service
```

照片识别结论仅用于游戏分类，不作为宠物血统证明、医疗或健康建议。

## 技术栈

- Expo 57
- React 19
- React Native 0.86
- React Native Web
- TypeScript
- Vitest
- Nginx

## 许可证

[MIT](LICENSE)

## 开源设计参考

本项目的界面重构参考了以下 MIT 开源项目的交互模式，并按照当前 Expo 技术栈重新实现：

- [PawPaw](https://github.com/snndmnsz/pawpaw)：宠物成长信息层级、彩色状态卡和今日任务
- [Matchimals](https://github.com/chrisheninger/matchimals.fun)：跨端游戏布局与轻量回合反馈
- [Galio](https://github.com/galio-org/galio)：基础按钮组件
- [Bluesky Social](https://github.com/bluesky-social/social-app)：社交信息流模式
- [boardgame.io](https://github.com/boardgameio/boardgame.io)：纯状态、行动与回合阶段的战斗架构
- [pkmn/engine](https://github.com/pkmn/engine)：战斗更新与合法行动边界（未复制其角色、数值或素材）

竞技卡面为本项目原创实现，不包含 FIFA / EA FC 的商标、素材或卡框复制。
