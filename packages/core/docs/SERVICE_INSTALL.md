# Talos System Service Integration

This document explains how to configure Talos as a system service for auto-start on boot.

## macOS (launchd)

### Install Service

1. Copy plist file to launchd directory:

   ```bash
   cp packages/talos/launchd/com.talos.agent.plist ~/Library/LaunchAgents/
   ```

2. Load the service:

   ```bash
   launchctl load ~/Library/LaunchAgents/com.talos.agent.plist
   ```

3. Verify service is running:

   ```bash
   launchctl list | grep talos
   talos health
   ```

### Uninstall Service

1. Unload the service:

   ```bash
   launchctl unload ~/Library/LaunchAgents/com.talos.agent.plist
   ```

2. Remove plist file:

   ```bash
   rm ~/Library/LaunchAgents/com.talos.agent.plist
   ```

### View Service Logs

```bash
# View Talos logs
tail -f ~/.talos/talos.log

# View error logs
tail -f ~/.talos/talos.error.log
```

## Linux (systemd)

### Install Service

1. Copy service file to systemd directory:

   ```bash
   cp packages/talos/systemd/talos.service ~/.config/systemd/user/
   ```

2. Reload systemd configuration:

   ```bash
   systemctl --user daemon-reload
   ```

3. Enable service (start on boot):

   ```bash
   systemctl --user enable talos.service
   ```

4. Start the service:

   ```bash
   systemctl --user start talos.service
   ```

5. Verify service is running:

   ```bash
   systemctl --user status talos.service
   talos health
   ```

### Uninstall Service

1. Stop and disable the service:

   ```bash
   systemctl --user stop talos.service
   systemctl --user disable talos.service
   ```

2. Remove service file:

   ```bash
   rm ~/.config/systemd/user/talos.service
   ```

3. Reload systemd configuration:

   ```bash
   systemctl --user daemon-reload
   ```

### View Service Logs

```bash
# View service logs
journalctl --user -u talos.service -f

# View Talos logs
talos logs -f

# Or directly view log file
tail -f ~/.talos/talos.log
```

## Service Management Commands

### macOS (launchd)

```bash
# Start service
launchctl start com.talos.agent

# Stop service
launchctl stop com.talos.agent

# Restart service
launchctl restart com.talos.agent

# View service status
launchctl list | grep talos
```

### Linux (systemd)

```bash
# Start service
systemctl --user start talos.service

# Stop service
systemctl --user stop talos.service

# Restart service
systemctl --user restart talos.service

# View service status
systemctl --user status talos.service

# View service logs
journalctl --user -u talos.service -f
```

## Manual Start

If you don't want to use system service, you can also start Talos manually:

```bash
# Start Talos
talos start

# View status
talos status

# View logs
talos logs -f

# Stop Talos
talos stop
```

## Troubleshooting

### Talos Fails to Start

1. Check log files:

   ```bash
   talos logs
   tail -f ~/.talos/talos.log
   ```

2. Check health status:

   ```bash
   talos health
   ```

3. Check process status:

   ```bash
   ps aux | grep talos
   cat ~/.talos/talos.pid
   ```

### Service Fails to Auto-Start

1. **macOS**: Check launchd logs:

   ```bash
   log show --predicate 'process == "talos"' --last 1h
   ```

2. **Linux**: Check systemd logs:

   ```bash
   journalctl --user -u talos.service -n 50
   ```

3. Check service file permissions:

   ```bash
   ls -la ~/.config/systemd/user/talos.service
   ls -la ~/Library/LaunchAgents/com.talos.agent.plist
   ```

### Talos CLI Path Issues

Service files assume `talos` command is installed in standard path:

- macOS: `/usr/local/bin/talos`
- Linux: `/usr/bin/talos`

If using a different path, modify the path in service files:

```bash
# Find talos path
which talos

# Edit the path in service files
```

## Permission Requirements

Talos service requires the following permissions:

- Read/write access to `~/.talos/` directory
- Create child processes (for starting tasks)
- Network access (for Socket communication)

Service files are configured with appropriate permission limits:

- `NoNewPrivileges=true`: Don't allow gaining new privileges
- `PrivateTmp=true`: Use private /tmp directory
- `ProtectSystem=strict`: Protect system directories
- `ProtectHome=true`: Protect home directory (except ~/.talos)

## Updating Service

After modifying service files, reload is required:

### macOS

```bash
launchctl unload ~/Library/LaunchAgents/com.talos.agent.plist
launchctl load ~/Library/LaunchAgents/com.talos.agent.plist
```

### Linux

```bash
systemctl --user daemon-reload
systemctl --user restart talos.service
```

## Best Practices

1. **Development Environment**: Use manual start for easier debugging

2. **Production Environment**: Use system service for auto-restart

3. **Log Monitoring**: Regularly check log file size and content

4. **Health Checks**: Regularly run `talos health` to ensure service is healthy

5. **Backup Configuration**: Backup important config files in `~/.talos/` directory
