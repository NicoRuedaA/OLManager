# Multiplayer Troubleshooting Guide

**Version**: 1.0  
**Last Updated**: 2026-04-30

---

## Table of Contents

1. [Common Errors](#common-errors)
2. [Network Connectivity Issues](#network-connectivity-issues)
3. [WebRTC Troubleshooting](#webrtc-troubleshooting)
4. [Backup Recovery Guide](#backup-recovery-guide)
5. [Performance Optimization](#performance-optimization)
6. [Debug Mode](#debug-mode)

---

## Common Errors

### Error: "Failed to create room"

**Description**: Unable to create a multiplayer room.

**Possible Causes**:
1. Signaling server is down
2. Network connection issue
3. Internal server error

**Solutions**:
```bash
# 1. Check server status
curl https://your-signaling-server.com/health

# 2. Check network connection
ping your-signaling-server.com

# 3. Check firewall settings
# Ensure ports 3478-3480 are open
```

**Prevention**:
- Use a reliable signaling server
- Implement retry logic in the client
- Show user-friendly error messages

---

### Error: "Failed to join room"

**Description**: Cannot connect to an existing room.

**Possible Causes**:
1. Invalid room code
2. Room is full
3. Room has expired
4. Network connectivity issue

**Solutions**:
```bash
# Verify room code format
# Should be 6 alphanumeric characters

# Check if room exists
curl https://your-signaling-server.com/room/ABC123

# Ask host to verify room is active
```

---

### Error: "Connection lost"

**Description**: WebRTC connection dropped during gameplay.

**Possible Causes**:
1. Network interruption
2. Firewall blocking connection
3. NAT traversal failure
4. High network latency

**Solutions**:
```bash
# 1. Check local network
ping 8.8.8.8

# 2. Check firewall
# Add exception for OLManager

# 3. Try different network
# Use mobile hotspot if available
```

**Auto-recovery**:
- Client attempts reconnection for 60 seconds
- If failed, show recovery modal
- User can choose to continue offline

---

### Error: "Checksum mismatch"

**Description**: Client and host state don't match.

**Possible Causes**:
1. Sync failed during transfer
2. Network packet loss
3. Concurrent modifications

**Solutions**:
```bash
# 1. Request full sync
# Click "Request Sync" in the UI

# 2. Check network stability
# Run a speed test

# 3. Verify no firewall interference
```

**Prevention**:
- Automatic sync every 30 seconds
- Checksum verification after each sync
- Retry mechanism for failed syncs

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
# Consider saving more frequently
```

---

## Network Connectivity Issues

### Symptoms

- High ping (> 200ms)
- Packet loss
- Frequent disconnects
- Slow state synchronization

### Diagnosis

#### Step 1: Test Basic Connectivity

```bash
# Test DNS resolution
nslookup your-signaling-server.com

# Test ping
ping your-signaling-server.com

# Test port connectivity
nc -zv your-signaling-server.com 443
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