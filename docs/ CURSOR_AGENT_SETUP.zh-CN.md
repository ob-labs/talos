# Cursor—Agent 安装与配置

## 第一步：安装以及配置

```bash
# macOS / Linux
curl https://cursor.com/install -fsSL | bash
ln -s "$(which agent)" "$HOME/.local/bin/cursor-agent"
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc && source ~/.bashrc
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc && source ~/.zshrc
```

## 第二步：配置 API Key

在 Cursor 控制台创建并获取 API Key：打开 [https://cursor.com/dashboard/cloud-agents](https://cursor.com/dashboard/cloud-agents)，在 Cloud Agents 页面新增或复制已有的 API Key，再在终端中设置环境变量：

```bash
export CURSOR_API_KEY="your-cursor-api-key"
```