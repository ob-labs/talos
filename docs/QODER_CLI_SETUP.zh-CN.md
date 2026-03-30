# qoder-cli 安装与配置

## 第一步：安装以及配置

```bash
# macOS / Linux
curl -fsSL https://qoder.com/install | bash
# 可选：Talos 默认查找 `qodercli`；若习惯命令名 qoder-cli 可建链接
ln -sf "$(which qodercli)" "$HOME/.local/bin/qoder-cli"
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc && source ~/.bashrc
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc && source ~/.zshrc
```

## 模型与 `talos --model`

[Qoder CLI 文档](https://docs.qoder.com/cli/using-cli)中的启动参数**未包含 `--model`**，模型由账号或 TUI 配置（例如 `/status`、`/config`）。因此 **`talos prd --tool qoder` 传入的 `--model` 不会下发给 Qoder**，可忽略该参数。
