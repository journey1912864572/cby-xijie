# 系统解剖学标本自测 Pro

基于两份 PDF 生成的响应式 PWA 自测应用。当前题库包含 74 道题、235 个嵌入式答案框。

## 本地预览

在项目目录运行：

```bash
python -m http.server 8080
```

浏览器打开：

```text
http://localhost:8080
```

默认邀请码：`HXKQ2026`

## 部署到 GitHub Pages

1. 新建仓库，例如 `anatomy-quiz`。
2. 将本项目全部文件提交到仓库根目录。
3. 在 GitHub 仓库进入 `Settings` -> `Pages`。
4. Source 选择 `Deploy from a branch`，分支选择 `main`，目录选择 `/root`。
5. 部署完成后访问 `https://username.github.io/anatomy-quiz/`。

项目全部资源使用相对路径，兼容 GitHub Pages 子路径部署。

## 部署到 Cloudflare Pages

1. 将项目推送到 GitHub。
2. 在 Cloudflare Pages 新建项目并连接仓库。
3. Framework preset 选择 `None`。
4. Build command 留空。
5. Output directory 填 `/` 或留空。
6. 部署完成后访问 Pages 分配的域名。

## 修改邀请码

邀请码配置在 `app.js` 顶部：

```js
const APP = {
  codeSalt: 23,
  codeCipher: [95, 79, 92, 70, 37, 39, 37, 33],
};
```

当前校验值是通过 `字符码 ^ codeSalt` 做的简单混淆。要更换邀请码，可在浏览器控制台或 Node.js 中运行：

```js
const code = "NEWCODE";
const salt = 23;
console.log([...code].map((ch) => ch.charCodeAt(0) ^ salt));
```

把输出数组替换到 `codeCipher` 即可。

## 更新题库

1. 将新的原版 PDF 与无文字版 PDF 放到桌面。
2. 如文件名变化，修改 `generate_assets.py` 顶部的 `ORIGINAL` 和 `BLANK`。
3. 运行：

```bash
python generate_assets.py
```

脚本会重新生成：

- `images/q01.webp` 到最后一题图片
- `answers.json`
- `icons/icon-192.png`
- `icons/icon-512.png`

生成后检查控制台输出中的 `questions`、`images`、`blanks` 和 `empty answer pages`。

## 质量检查

本项目已按两份 PDF 自动生成并检查：

- 原版 PDF 页数：74
- 自测版 PDF 页数：74
- 导入图片：74
- 生成题目：74
- 生成答案框：235
- 空答案页：0
- PWA 离线缓存包含核心文件、题库数据、74 张题图和图标

注意：邀请码是前端轻量门禁，适合班级资料访问控制，不等同于服务器级鉴权。
