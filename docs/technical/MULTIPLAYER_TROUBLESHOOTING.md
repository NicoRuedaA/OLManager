# Multiplayer Troubleshooting Guide (MVP)

**Version**: 2.0 (MVP - WebSocket Server)  
**Last Updated**: 2026-04-30

---

## Table of Contents

1. [Common Errors](#common-errors)
2. [Network Connectivity Issues](#network-connectivity-issues)
3. [WebSocket Troubleshooting](#websocket-troubleshooting)
4. [Port Forwarding Issues](#port-forwarding-issues)
5. [Testing with ZeroTier](#testing-with-zerotier)
6. [Backup Recovery Guide](#backup-recovery-guide)
7. [Performance Optimization](#performance-optimization)
8. [Debug Mode](#debug-mode)

---

## Common Errors (MVP - WebSocket Server)

### Error: "Failed to create room"

**Description**: Unable to start WebSocket server on host.

**Possible Causes**:
1. Port 3000 already in use
2. No administrator permissions (rare on Windows)
3. Firewall blocking

**Solutions**:
```bash
# 1. Check if port is in use
netstat -an | findstr :3000

# 2. Try a different port
# In the UI, set custom port (e.g., 3001, 3002)

# 3. Check firewall
# Allow OLManager through Windows Firewall
```

**Prevention**:
- Use default port 3000 (or let user configure)
- Show clear error message with port number
- Suggest alternative ports

---

### Error: "Failed to join room" / "Connection refused"

**Description**: Cannot connect to host's IP:port.

**Possible Causes**:
1. Host's port 3000 not open on router
2. Wrong IP address
3. Host behind CGNAT (can't port forward)
4. Firewall blocking

**Solutions**:
```bash
# 1. Verify host's public IP
# Host: Visit https://whatismyipaddress.com

# 2. Host must open port 3000
# See Port Forwarding Issues section below

# 3. Try ZeroTier (no port forwarding needed)
# See Testing with ZeroTier section
```

---

### Error: "Connection lost" / "WebSocket closed"

**Description**: Connection dropped during gameplay.

**Possible Causes**:
1. Host's internet unstable
2. Client's internet unstable
3. Host's PC went to sleep
4. Router closed idle connection

**Solutions**:
```bash
# 1. Check both network connections
ping 8.8.8.8

# 2. Disable power saving (Host)
# Control Panel → Power Options → High Performance

# 3. Reconnect manually
# Click "Reconnect" in the UI
```

**Auto-recovery**:
- Client attempts reconnection for 60 seconds
- If failed, show recovery modal
- User can choose to continue offline (load backup)

---

### Error: "Checksum mismatch"

**Description**: Client and host state don't match.

**Possible Causes**:
1. Sync failed during transfer
2. Network packet loss
3. Host modified game while client was connecting

**Solutions**:
```bash
# 1. Request full sync
# Click "Request Sync" in the UI

# 2. Check network stability
# Run a speed test (need >5 Mbps)

# 3. Restart if persistent
# Host: Restart game, Client: Rejoin
```

**Prevention**:
- Automatic sync every 30 seconds
- Checksum verification after each sync
- Retry mechanism for failed syncs

---

### Error: "Host behind CGNAT"

**Description**: Host cannot port forward (ISP uses Carrier-Grade NAT).

**Solutions**:
```bash
# 1. Test for CGNAT
# Visit https://whatismyipaddress.com
# If IP shown ≠ IP from router admin page → CGNAT

# 2. Use ZeroTier (recommended for testing)
# See Testing with ZeroTier section

# 3. Use mobile hotspot (some carriers allow incoming)
# Host: Connect to mobile hotspot, try again
```

---

### Error: "Room is full"

**Description**: Attempted to join a room that already has 2 players.

**Solutions**:
```bash
# Wait for current game to end
# Ask host to create a new room
```

---

### Error: "Backup not found"

**Description**: No backup save available after disconnect.

**Possible Causes**:
1. First time joining (no backup created)
2. Backup file corrupted
3. Backup deleted manually

**Solutions**:
```bash
# Cannot recover game state
# Must start new game
# Consider saving more frequently (host should save often)
```

---

## Network Connectivity Issues (MVP - WebSocket Server)

### Symptoms

- High ping (> 200ms)
- Packet loss
- Frequent disconnects
- Slow state synchronization
- "Connection refused" errors

### Diagnosis

#### Step 1: Test Host Connectivity (from Client PC)

```bash
# Test if Host's IP is reachable
ping <host-public-ip>

# Test if port 3000 is open
# Windows:
Test-NetConnection -ComputerName <host-public-ip> -Port 3000

# Linux/Mac:
nc -zv <host-public-ip> 3000
```

#### Step 2: Check Network Latency

```bash
# Test to Host's IP
ping -n 100 <host-public-ip>
# Look for: "Lost = 0%" (or low packet loss)
```

#### Step 3: Check Host's Public IP

```bash
# Host: Visit https://whatismyipaddress.com
# Compare with router admin page IP
# If different → Host is behind CGNAT (can't port forward)
```

### Common Solutions

#### Port Forwarding Not Working

**Cause**: Port 3000 not open on Host's router.

**Solutions**:
1. **Verify router settings**: Port 3000 → Host's local IP (e.g., 192.168.1.5)
2. **Check Host's firewall**: Allow OLManager through Windows Firewall
3. **Test locally**: Host can try `telnet localhost 3000` to verify server is running
4. **Use ZeroTier**: See [Testing with ZeroTier](#testing-with-zerotier) to bypass port forwarding

#### CGNAT Issues

**Cause**: ISP uses Carrier-Grade NAT (can't receive incoming connections).

**Solutions**:
1. **Try ZeroTier**: Free VPN that bypasses CGNAT (see section below)
2. **Mobile hotspot**: Host connects to mobile hotspot (some carriers allow incoming)
3. **Future**: Wait for Relay Server mode (no port forwarding needed)

#### Firewall Blocking

Firewalls may block connections.

**Solutions**:
```bash
# Windows (Host):
# Allow OLManager through Windows Firewall
# Or temporarily disable firewall for testing

# Windows (Client):
# Ensure OLManager can access network
```

#### VPN Issues

VPNs can cause connectivity problems.

**Solutions**:
1. Disable VPN during gameplay
2. Use split tunneling to exclude the game
3. Try a different VPN protocol

---

## Port Forwarding Issues

### How to Verify Port is Open

#### Step 1: Host - Check Local Server

```bash
# Windows (in PowerShell):
Test-NetConnection -ComputerName localhost -Port 3000

# Should show: TcpTestSucceeded: True
```

#### Step 2: Host - Check Public IP

```bash
# Visit: https://whatismyipaddress.com
# Note: Public IP (e.g., 181.23.45.67)
```

#### Step 3: Client - Test Connection

```bash
# Windows (in PowerShell):
Test-NetConnection -ComputerName <host-public-ip> -Port 3000

# If TcpTestSucceeded: False → Port not open
```

### Common Problems

| Problem | Solution |
|----------|----------|
| Router admin page not accessible | Try 192.168.0.1, 10.0.0.1, or check router label |
| Port forwarding option not found | Look for "NAT", "Virtual Server", "Gaming" |
| Saved but not working | Restart router after saving settings |
| IP changed after restart | Set static local IP on Host PC |

---

## Testing with ZeroTier (No Port Forwarding)

### When to Use ZeroTier

- Host can't open ports (CGNAT)
- Router configuration is too complex
- Quick testing with friends

### Step 1: Install on Both PCs

1. Download: [zerotier.com/download](https://www.zerotier.com/download/)
2. Install and restart if needed.

### Step 2: Create Network (One-time Setup)

1. Go to [my.zerotier.com](https://my.zerotier.com/)
2. Create account (free)
3. Click "Create a Network"
4. Copy the **Network ID** (e.g., `a1b2c3d4e5f6g7h8`)

### Step 3: Join Network (Both PCs)

1. Click ZeroTier icon in system tray
2. Click "Join Network"
3. Enter the **Network ID**
4. Wait for "Authorized" status (may need approval in my.zerotier.com)

### Step 4: Get ZeroTier IPs

**On both PCs**:
```bash
# Windows (PowerShell):
ipconfig | findstr "ZeroTier"
# Look for: IPv4 Address (e.g., 10.147.17.5)

# Mac/Linux:
ifconfig | grep "zt0"
```

### Step 5: Play!

1. **Host**: Create room (uses ZeroTier IP automatically)
2. **Client**: Connect using Host's ZeroTier IP (e.g., `ws://10.147.17.5:3000`)
3. **No port forwarding needed!**

> **Note**: ZeroTier is for testing. For production, use Relay Server (see User Guide).

---

## WebSocket Troubleshooting (MVP)

### Understanding WebSocket Connection

OLManager MVP uses simple WebSocket connections (not WebRTC).

### Connection Flow

```
1. Host starts WebSocket server on port 3000
2. Host shares Public IP + Port with Client
3. Client connects to ws://<host-ip>:3000
4. WebSocket connection established
5. Game state syncs over WebSocket
```

### Common WebSocket Errors

#### Error: "Connection refused"

**Cause**: Host's port 3000 not accessible.

**Solutions**:
1. Verify port forwarding on Host's router
2. Check Host's firewall allows port 3000
3. Try ZeroTier to bypass router config

#### Error: "WebSocket closed unexpectedly"

**Cause**: Connection lost.

**Solutions**:
1. Check both internet connections
2. Host: Disable power saving (PC going to sleep)
3. Implement auto-reconnect in settings

#### Error: "Host behind CGNAT"

**Cause**: Can't receive incoming connections.

**Solutions**:
1. Use ZeroTier (see section above)
2. Wait for Relay Server mode (future)

### Debugging WebSocket

Check Host's server logs:

```bash
# Look for:
# "WebSocket server listening on 0.0.0.0:3000"
# "New connection from <client-ip>"
```

#### Step 2: Check Network Latency

```bash
# Test to various servers
curl -w "%{time_total}s\n" -o /dev/null -s https://your-server.com/health
```

#### Step 3: Check for packet loss

```bash
# macOS
ping -c 100 your-server.com | grep "packet loss"

# Linux
ping -c 100 your-server.com
```

### Common Solutions

#### NAT Issues

Many home networks use NAT (Network Address Translation), which can cause WebRTC connectivity issues.

**Solutions**:
1. **Enable UPnP** on your router
2. **Port forwarding** for ports 3478-3480
3. **Use STUN/TURN servers** for better NAT traversal

#### Firewall Blocking

Firewalls may block WebRTC connections.

**Solutions**:
```bash
# Windows
# Allow OLManager through Windows Firewall

# Linux (UFW)
sudo ufw allow 3478:3480/udp
sudo ufw allow 443/tcp
```

#### VPN Issues

VPNs can cause connectivity problems with WebRTC.

**Solutions**:
1. Disable VPN during gameplay
2. Use split tunneling to exclude the game
3. Try a different VPN protocol

---

## WebRTC Troubleshooting

### Understanding WebRTC

WebRTC (Web Real-Time Communication) enables peer-to-peer communication directly between browsers/applications.

### Connection Flow

```
1. Host creates offer (SDP)
2. Host sends offer to signaling server
3. Signaling server notifies client
4. Client retrieves offer
5. Client creates answer (SDP)
6. Client sends answer to signaling server
7. Signaling server notifies host
8. Both clients exchange ICE candidates
9. P2P connection established
```

### Common WebRTC Errors

#### Error: "ICE connection failed"

**Cause**: Could not establish P2P connection.

**Solutions**:
1. Use STUN server
2. Use TURN server for relay
3. Check firewall/NAT settings

#### Error: "DTLS negotiation failed"

**Cause**: Security handshake failure.

**Solutions**:
1. Check TLS certificates
2. Verify system time is correct
3. Update WebRTC library

#### Error: "WebSocket closed unexpectedly"

**Cause**: Signaling server connection lost.

**Solutions**:
1. Check server status
2. Implement reconnection logic
3. Use fallback server

### Debugging WebRTC

Enable WebRTC debugging in the browser:

```javascript
// In browser console
localStorage.setItem('webrtc-debug', 'log')
```

Or use Chrome flags:

```
chrome://webrtc-internals
```

---

## Backup Recovery Guide

### Understanding Backups

In online multiplayer, the client creates backup saves periodically:

- **Auto-backup**: Every 5 minutes
- **On sync**: After each state synchronization
- **On disconnect**: Before losing connection

### Backup Locations

| Platform | Path |
|----------|------|
| Windows | `%APPDATA%\com.olmanager\saves\{id}_backup.db` |
| macOS | `~/Library/Application Support/com.olmanager/saves/{id}_backup.db` |
| Linux | `~/.local/share/com.olmanager/saves/{id}_backup.db` |

### Recovery Process

#### Step 1: Detect Disconnect

When host disconnects:
1. Client detects connection loss
2. Client shows recovery modal

#### Step 2: Choose Action

**Option A: Continue Offline**
```bash
# 1. Click "Continue Offline"
# 2. System loads backup save
# 3. Converts to single-player
# 4. Player 2's team is removed
```

**Option B: Quit to Menu**
```bash
# 1. Click "Quit to Menu"
# 2. Returns to main menu
# 3. No changes made
```

### Manual Backup Recovery

If automatic recovery fails:

#### Step 1: Locate Backup

```bash
# Find backup files
find ~/.local/share/com.olmanager -name "*_backup.db"
```

#### Step 2: Verify Backup

```bash
# Check file size (should be > 0)
ls -lh backup.db

# Try to open with SQLite
sqlite3 backup.db ".tables"
```

#### Step 3: Manual Load

> **Note**: Manual backup loading is a developer feature. Contact support if needed.

---

## Performance Optimization

### Network Optimization

#### Reduce Polling Frequency

The game polls for status updates. Reduce frequency when idle:

```typescript
// In useMultiplayer hook
const POLL_INTERVAL = {
  CONNECTED: 5000,   // 5 seconds when connected
  IDLE: 30000,      // 30 seconds when idle
  SYNCING: 1000,    // 1 second when syncing
};
```

#### Implement Visibility API

Pause polling when tab is hidden:

```typescript
// Pause when tab is hidden
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // Stop polling
  } else {
    // Resume polling
  }
});
```

### Frontend Optimization

#### Memoize Expensive Computations

```typescript
// Memoize checksum computation
const checksum = useMemo(() => 
  computeChecksum(gameState), 
  [gameState]
);
```

#### Debounce State Updates

```typescript
// Debounce rapid state changes
const debouncedState = useMemo(
  () => debounce(updateState, 100),
  []
);
```

#### Lazy Load Components

```typescript
// Lazy load multiplayer components
const MultiplayerMenu = lazy(() => import('./components/multiplayer/MultiplayerMenu'));
const ConnectionStatus = lazy(() => import('./components/multiplayer/ConnectionStatus'));
```

### Backend Optimization

#### Optimize Checksum Computation

```rust
// Only compute checksums for changed data
fn compute_checksum(&self) -> u64 {
    // Use xxhash for faster hashing
    xxhash64::hash(&self.serialize())
}
```

#### Cache Game State

```rust
// Cache serialized game state
let cached_state = self.state_cache.lock().unwrap();
if let Some(state) = cached_state.as_ref() {
    return state.clone();
}
```

---

## Debug Mode

### Enable Debug Logging

#### Frontend

```typescript
// Enable verbose logging
localStorage.setItem('debug', '*')
localStorage.setItem('multiplayer-debug', 'true')
```

#### Backend

Set environment variable:

```bash
RUST_LOG=debug
```

### Useful Debug Commands

#### Check Connection Status

```typescript
// In browser console
console.log(window.RTCPeerConnection?.connectionState)
```

#### View Sync Status

```typescript
// In browser console
const syncStatus = await invoke('multiplayer_get_sync_status')
console.log(syncStatus)
```

#### Force Sync

```typescript
// In browser console
await invoke('multiplayer_force_sync')
```

### Log Analysis

#### Common Log Patterns

| Pattern | Meaning |
|---------|---------|
| `[SYNC] Checksum mismatch` | State desync detected |
| `[SYNC] Full sync requested` | Client requesting full state |
| `[NET] ICE candidate received` | Network path discovered |
| `[NET] Data channel opened` | P2P connection ready |

#### Finding Issues

```bash
# Filter logs by severity
grep "ERROR" logs/app.log

# Filter by component
grep "multiplayer" logs/app.log

# Filter by time
sed -n '/10:00:00/,/10:30:00/p' logs/app.log
```

---

## Network Diagnostics Script

Create a `diagnose.sh` script:

```bash
#!/bin/bash
echo "=== OLManager Network Diagnostics ==="

echo -e "\n1. Testing DNS..."
nslookup olmanager-signaling.example.com

echo -e "\n2. Testing basic connectivity..."
ping -c 3 olmanager-signaling.example.com

echo -e "\n3. Testing port 443..."
nc -zv olmanager-signaling.example.com 443

echo -e "\n4. Checking local network..."
ip addr show | grep inet

echo -e "\n5. Checking firewall..."
sudo iptables -L -n | head -20

echo -e "\n=== Complete ==="
```

---

## Emergency Procedures

### Complete Game Recovery

If game state is completely corrupted:

1. **Host**: Delete save and start new game
2. **Client**: 
   - Load backup to get to last known good state
   - Ask host to resend any changes since last backup

### Server Outage

If signaling server is down:

1. **Wait** for server to come back
2. **Use backup** server if configured
3. **Contact** server administrator

### Data Loss Prevention

1. **Save frequently** as host
2. **Verify sync** after important actions
3. **Note last sync time** in UI

---

## Support Resources

- **GitHub Issues**: https://github.com/your-repo/issues
- **Discord**: https://discord.gg/your-server
- **Email**: support@olmanager.com

### Before Reporting

Please include:

1. **Error message** (exact text)
2. **Steps to reproduce**
3. **Network info** (ping, firewall status)
4. **Log files** (if available)
5. **Screenshots** (if applicable)
6. **Game version** (check in main menu)

---

**Document Version**: 1.0  
**Last Updated**: 2026-04-30