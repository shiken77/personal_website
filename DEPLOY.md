# 发布个人网站

部署根目录需包含：`index.html`、`avatar.png`、`Sijian_TIAN_CV_ds.pdf`。

## GitHub Pages

1. 在 GitHub 新建 **Public** 仓库。
2. 在本目录执行（替换为你的仓库地址）：

   ```bash
   git remote add origin https://github.com/<用户名>/<仓库名>.git
   git branch -M main
   git push -u origin main
   ```

3. 仓库 **Settings → Pages**：Source 选 `main` 分支、`/ (root)`，保存。
4. 访问：`https://<用户名>.github.io/<仓库名>/`（若仓库名为 `<用户名>.github.io` 则域名为 `https://<用户名>.github.io/`）。

## Netlify（无需 Git）

1. 打开 [Netlify Drop](https://app.netlify.com/drop) 或 Netlify 控制台 **Add new site → Deploy manually**。
2. 将本文件夹（含上述三个文件）拖入，即可获得 `https://xxx.netlify.app`。

## 上线后自检

用 **HTTPS** 打开站点，检查首页、头像、点击 **CV** 弹窗能否加载 PDF。
