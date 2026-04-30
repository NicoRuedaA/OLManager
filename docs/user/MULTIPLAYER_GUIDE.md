# Online Multiplayer Mode - User Guide (MVP)

**Version**: 2.0 (MVP)  
**Last Updated**: 2026-04-30

---

## Table of Contents

1. [What is Online Multiplayer?](#what-is-online-multiplayer)
2. [System Requirements](#system-requirements)
3. [How to Create a Game (Host)](#how-to-create-a-game-host)
4. [How to Join a Game (Client)](#how-to-join-a-game-client)
5. [How to Play](#how-to-play)
6. [Port Forwarding Guide](#port-forwarding-guide)
7. [Testing with ZeroTier (No Router Config)](#testing-with-zerotier)
8. [Troubleshooting](#troubleshooting)
9. [FAQ](#faq)
10. [Future: Relay Server Mode](#future-relay-server-mode)

---

## What is Online Multiplayer?

Online Multiplayer Mode allows you to play OLManager with a friend over the internet. Each player controls their own team, and you compete in the same league with AI-controlled teams.

### Key Features (MVP)

- **2-Player Online**: Play against a friend over the internet
- **Host-Runs-Server**: The host's game includes a WebSocket server
- **Host-Authoritative**: The host's game is the source of truth
- **State Synchronization**: Game state is automatically synced between players
- **Disconnect Recovery**: Continue playing offline if your opponent disconnects

### Game Modes

| Mode | Description |
|------|-------------|
| **Offline** | Single-player mode (existing) |
| **Hotseat** | Two players taking turns on the same device |
| **Online (MVP)** | Host runs server, Client connects via IP:port |
| **Online (Future)** | Both connect to cloud Relay Server (no config) |

---

## System Requirements

### Minimum Requirements

- **OS**: Windows 10+, macOS 11+, or Linux (Ubuntu 20.04+)
- **Processor**: Intel Core i5 / AMD Ryzen 5 or better
- **Memory**: 8 GB RAM
- **Storage**: 500 MB available space
- **Network**: Internet connection required (minimum 5 Mbps)

### Network Requirements (MVP)

**For the Host**:
- **Port Forwarding**: Must open port **3000** on their router
- **Public IP**: Needed for Client to connect
- **Firewall**: Must allow OLManager through firewall

**For the Client**:
- **Internet Connection**: Just needs to be online
- **No port forwarding** required

> **⚠️ MVP Limitation**: This version requires the Host to open a port on their router. 
> For a zero-config experience, see [Future: Relay Server Mode](#future-relay-server-mode).

### Quick Test Option: ZeroTier (No Port Forwarding)

For testing with friends without router configuration, use **ZeroTier** (free VPN):
1. Both players install ZeroTier
2. Join the same ZeroTier network
3. Connect using ZeroTier virtual IPs (no port forwarding needed!)

See [Testing with ZeroTier](#testing-with-zerotier) for details.

---

## How to Create a Game (Host)

Follow these steps to create an online game as the host:

### Step 1: Start the Game

1. Launch OLManager
2. From the main menu, click **"Multiplayer"**
3. Click the **"Create Room"** tab

### Step 2: Configure Host Settings

1. Enter a name for your game (e.g., "My League")
2. **Port**: Default is `3000` (or set a custom port)
3. Click **"Create Room"**

### Step 3: Configure Your Router (Port Forwarding)

⚠️ **IMPORTANT**: You MUST open port `3000` (or your custom port) on your router.

1. Access your router settings (usually `192.168.1.1` or `192.168.0.1`)
2. Find "Port Forwarding" section
3. Add rule: **External Port 3000 → Internal Port 3000 → Your PC's Local IP**
4. Save changes

> **Need help?** See [Port Forwarding Guide](#port-forwarding-guide) below.

### Step 4: Share Your Public IP

1. The game will display your **Public IP** and **Port** (e.g., `181.23.45.67:3000`)
2. Share this information with your friend (the Client)
3. You'll see "Waiting for Player..." status

> **Testing without port forwarding?** Use [ZeroTier](#testing-with-zerotier) for testing.

### Step 5: Player Selection

Once your friend joins:

1. Both players will see the Player Selection screen
2. **You are Player 1 (Host)** - your team is pre-selected
3. Click **"Confirm Selection"** to lock in your player

### Step 6: Start the Game

1. When both players have confirmed their selection
2. Click **"Start Game"** to begin

---

## How to Join a Game (Client)

Follow these steps to join a game as a client:

### Step 1: Get Connection Info

Ask your friend (the Host) for:
1. **Their Public IP** (e.g., `181.23.45.67`)
2. **Port** (default: `3000`)
3. Make sure they've created a room and are waiting

> **Testing without port forwarding?** Use [ZeroTier](#testing-with-zerotier) and ask for the ZeroTier IP (e.g., `10.147.17.5`)

### Step 2: Join the Game

1. Launch OLManager
2. Click **"Multiplayer"**
3. Click the **"Join Game"** tab
4. Enter the **Host's IP** (e.g., `181.23.45.67`)
5. Enter the **Port** (default: `3000`)
6. Click **"Join Room"**

### Step 3: Connect

1. The game will connect to the Host's IP:Port
2. You'll see "Connecting..." while establishing the connection
3. Once connected: **"Connected!"**
4. You'll see the Player Selection screen

### Step 4: Player Selection

1. **You are Player 2 (Client)** - your team is pre-selected
2. Click **"Confirm Selection"** to lock in your player

### Step 5: Wait for Host

1. Wait for the host to start the game
2. The game will begin when both players are ready

---

## How to Play

### During the Day

Each day, both players can perform the following actions:

- **Transfers**: Scout players, make transfer bids, negotiate contracts
- **Tactics**: Set formation, play style, training schedule
- **Staff**: Hire or fire staff members
- **Academy**: Promote youth players to the main squad

### Marking Ready

When you've completed your actions for the day:

1. Click the **"Ready for Next Day"** button
2. Wait for your opponent to also mark ready
3. When both are ready, the day advances

![Ready Button](screenshots/ready-button.png)

### Day Advancement

- Only the **Host** can advance the day
- The day advances automatically when both players are ready
- Both players see the same results (match outcomes, news, etc.)

### Connection Status

The connection status is always visible:

- **Green**: Connected - everything is working
- **Yellow**: Reconnecting - attempting to restore connection
- **Red**: Disconnected - connection lost

![Connection Status](screenshots/connection-status.png)

### Sync Indicator

State synchronization happens automatically:

- **Synced**: Checksum verified - states match
- **Syncing...**: State is being transferred
- **Sync Error**: Checksum mismatch - requesting full sync

![Sync Indicator](screenshots/sync-indicator.png)

---

## Troubleshooting (MVP)

### Connection Issues

#### "Failed to connect to host"

**Cause**: Cannot reach the Host's IP:port.

**Solutions**:
1. **Host**: Verify port 3000 is open on your router (see [Port Forwarding Guide](#port-forwarding-guide))
2. **Client**: Double-check the Host's IP address
3. **Both**: Check firewall allows OLManager
4. **Both**: Try [ZeroTier](#testing-with-zerotier) for testing

#### "Connection timed out"

**Cause**: Host's port is not open or firewall blocking.

**Solutions**:
1. **Host**: Re-check port forwarding settings
2. **Host**: Verify your public IP hasn't changed
3. **Client**: Try to ping the Host's IP
4. **Alternative**: Use [ZeroTier](#testing-with-zerotier) to bypass router config

#### "Host behind CGNAT"

**Cause**: Your ISP uses Carrier-Grade NAT (can't open ports).

**Solutions**:
1. **Best option**: Use [ZeroTier](#testing-with-zerotier) for testing
2. **Future**: Wait for Relay Server mode (no port forwarding needed)
3. **Alternative**: Use mobile hotspot (some mobile carriers allow incoming connections)

#### "Room is full"

**Cause**: Someone else already joined the room.

**Solutions**:
1. Ask the host to create a new room
2. Wait for the current game to end

### Gameplay Issues

#### "My transfers don't appear"

**Cause**: State desynchronization or network issue.

**Solutions**:
1. Click the **Sync** button to force a sync
2. Wait for the next automatic sync
3. If issue persists, ask host to verify their actions

#### "Day didn't advance"

**Cause**: One player hasn't marked ready yet.

**Solutions**:
1. Wait for opponent to mark ready
2. Check if opponent's connection is stable
3. Host can check player readiness in the status bar

#### "Opponent's changes don't show"

**Cause**: Sync delay or failure.

**Solutions**:
1. Wait for automatic sync (every 30 seconds)
2. Click **"Request Sync"** to trigger manual sync
3. Reconnect if issues persist

### Disconnect Recovery

#### "Host disconnected"

When the host disconnects, you'll see a recovery modal:

![Disconnect Recovery](screenshots/disconnect-recovery.png)

**Options**:
- **Continue Offline**: Load last backup and continue as single-player
- **Quit to Menu**: Return to the main menu

> **Warning**: Progress since the last sync may be lost.

#### "Client disconnected"

The host will see a toast notification. The client will attempt to reconnect automatically.

---

## FAQ

### General

**Q: Can I play with more than 2 players?**
> A: Not currently. Online multiplayer supports exactly 2 players (Host + Client).

**Q: Can I save my game in multiplayer?**
> A: Yes, but only the host can save. The client's game is restored from the host's save.

**Q: Can I pause the game?**
> A: No. Multiplayer games don't support pausing. Both players must be online to play.

**Q: What happens if I close the game?**
> - **Host**: Game ends for both players
> - **Client**: Can reconnect within 5 minutes; otherwise, game ends

### Technical

**Q: Why do I need a signaling server?**
> A: The signaling server helps establish the initial P2P connection between players. After connecting, all data flows directly between clients.

**Q: Can I host on a different port?**
> A: Yes, you can configure the signaling server port in the deployment settings.

**Q: Is my game data secure?**
> A: Yes. All game data is transmitted over encrypted WebRTC data channels. The signaling server only handles connection establishment.

**Q: What happens if checksums don't match?**
> A: The client automatically requests a full state sync from the host to resolve the mismatch.

### Troubleshooting

**Q: Why is my ping so high?**
> A: Ping depends on your network distance to the other player. Higher ping may affect gameplay experience.

**Q: Can I use a VPN?**
> A: Yes, but it may increase latency. Not recommended for competitive play.

**Q: My game crashed. Can I rejoin?**
> - **Host**: No - game ends when host disconnects
> - **Client**: Yes - if backup exists, you can continue offline

---

## Quick Reference

### Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Open Multiplayer Menu | `M` (from main menu) |
| Mark Ready | `R` (during gameplay) |
| Request Sync | `S` (during gameplay) |

### Menu Flow

```
Main Menu
    └── Multiplayer
            ├── Create Game (Host)
            │       └── Waiting for Player
            │               └── Player Selection → Game
            │
            └── Join Game (Client)
                    └── Player Selection → Game
```

### Game Flow

```
Day Start
    → Player Actions (Transfers, Tactics, etc.)
    → Mark Ready (both players)
    → Day Advances (host only)
    → Match Results (if match day)
    → Repeat
```

---

## Port Forwarding Guide

If you're the **Host**, you MUST open a port on your router. Here's how:

### Step 1: Access Your Router

1. Open browser, go to: `192.168.1.1` or `192.168.0.1`
2. Login (check router label for credentials)

### Step 2: Find Port Forwarding

Look for: "Port Forwarding", "NAT Forwarding", or "Virtual Server"

### Step 3: Add Rule

| Field | Value |
|-------|-------|
| **External Port** | `3000` (or custom port) |
| **Internal Port** | `3000` (same as above) |
| **Internal IP** | Your PC's local IP (e.g., `192.168.1.5`) |
| **Protocol** | `TCP` (or `Both`) |

### Step 4: Save & Test

1. Save the rule
2. **Host**: Run `ipconfig` (Windows) or `ifconfig` (Mac/Linux) to get your **Public IP**
3. **Client**: Try to connect using the Public IP

> **Still not working?** See [Testing with ZeroTier](#testing-with-zerotier) for a no-config alternative.

---

## Testing with ZeroTier (No Port Forwarding)

For testing without router configuration, use **ZeroTier** (free VPN):

### Step 1: Install ZeroTier

1. Download from [zerotier.com](https://www.zerotier.com/)
2. Install on **both PCs** (Host and Client)

### Step 2: Create Network

1. Go to [my.zerotier.com](https://my.zerotier.com/)
2. Create account (free)
3. Click "Create a Network"
4. Copy the **Network ID** (e.g., `a1b2c3d4e5`)

### Step 3: Join Network

**On both PCs**:
1. Open ZeroTier (system tray icon)
2. Click "Join Network"
3. Enter the **Network ID** from Step 2
4. Wait for "Authorized" status (may need approval in my.zerotier.com)

### Step 4: Get ZeroTier IPs

**On both PCs**, run:
- **Windows**: `ipconfig` → Look for "ZeroTier" adapter
- **Mac/Linux**: `ifconfig` → Look for `zt0` interface

Example IP: `10.147.17.5`

### Step 5: Play!

1. **Host**: Create room (uses ZeroTier IP automatically)
2. **Client**: Connect using Host's ZeroTier IP (e.g., `ws://10.147.17.5:3000`)
3. **No port forwarding needed!**

> **Note**: ZeroTier is for testing only. For production, see [Future: Relay Server Mode](#future-relay-server-mode).

---

## Future: Relay Server Mode

The MVP requires port forwarding, which is hard for many users. **Future versions will use a Relay Server:**

### What Changes?

| MVP (Current) | Relay Server (Future) |
|--------------|---------------------|
| Host opens port 3000 | ✅ No port forwarding |
| Client connects to Host IP | ✅ Both connect to cloud server |
| CGNAT = can't host | ✅ Works behind any NAT |
| User must configure router | ✅ Zero configuration |

### How It Works

```
MVP:
[Host:3000] ←── [Client]

Relay Server:
[Host] → [Cloud Relay Server] ← [Client]
          (wss://olmanager-relay.onrender.com)
```

### Benefits

- ✅ **Zero config** for users
- ✅ **Works everywhere** (CGNAT, corporate networks, etc.)
- ✅ **Same protocol** (WebSocket, just different endpoint)
- ✅ **Cost**: ~$5-7/month (Render.com / Railway)

### Timeline

- ✅ **Now**: MVP with WebSocket Server (port forwarding)
- 🔨 **Next**: Deploy Relay Server for testing
- 🎯 **v1.0**: Relay Server as default mode

---

## Support

If you encounter issues not covered in this guide:

1. Check the [Technical Troubleshooting Guide](../technical/MULTIPLAYER_TROUBLESHOOTING.md)
2. Search for existing issues on GitHub
3. Create a new issue with:
   - Steps to reproduce
   - Expected vs actual behavior
   - Network information (ping, firewall status)
   - Log files (if applicable)

---

**Document Version**: 2.0 (MVP)  
**Last Updated**: 2026-04-30  
**Game Version**: 0.1.1+ (MVP WebSocket Server)