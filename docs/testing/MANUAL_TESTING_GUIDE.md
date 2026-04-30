# Manual Testing Guide - Online Multiplayer Mode

**Branch**: `online-mvp`  
**Version**: 1.0  
**Date**: 2026-04-30  
**Status**: Ready for testing

---

## Overview

This guide covers manual testing procedures for the online P2P multiplayer mode. Testing should be performed on **2 separate machines** to validate WebRTC connectivity, state synchronization, and disconnect recovery.

**Estimated Time**: 1-2 hours

---

## Prerequisites

### Hardware Requirements
- **2 machines** (2 PCs, or 1 PC + 1 VM, or 2 VMs)
- **Internet connection** (for STUN servers)
- **Signaling server deployed** (Render, Railway, Fly.io, or local)

### Software Requirements
- Node.js 18+
- Rust stable toolchain
- Git

### Setup Commands

#### Machine 1 (Host)
```bash
cd F:\Proyectos\OLManager
git checkout online-mvp
npm install
npm run tauri dev
```

#### Machine 2 (Client)
```bash
git clone https://github.com/NicoRuedaA/OLManager.git
cd OLManager
git checkout online-mvp
npm install
npm run tauri dev
```

---

## Step 1: Deploy Signaling Server

### Option A: Render (Free Tier) - RECOMMENDED

1. Create account at https://render.com
2. Click "New +" → "Web Service"
3. Connect GitHub repository
4. Configure:
   - **Name**: `olmanager-signaling`
   - **Root Directory**: `src-tauri`
   - **Build Command**: `cargo build --release --bin signaling_server`
   - **Start Command**: `./target/release/signaling_server`
   - **Environment Variables**:
     - `RUST_LOG=info`
     - `CORS_ORIGIN=*`
5. Click "Create Web Service"
6. Wait for deployment (~5 minutes)
7. Copy the URL (e.g., `https://olmanager-signaling.onrender.com`)

### Option B: Local Testing

```bash
cd F:\Proyectos\OLManager\src-tauri
cargo run --release --bin signaling_server
```

Server runs on `http://localhost:3000` by default.

---

## Step 2: Test Scenarios

### Test 1: Create and Join Room ✅

**Purpose**: Validate room creation and join flow

| Step | Machine 1 (Host) | Machine 2 (Client) |
|------|------------------|-------------------|
| 1 | Menu → Multiplayer | Menu → Multiplayer |
| 2 | Tab "Create Game" | Tab "Join Game" |
| 3 | Click "Create Room" | Enter room code (e.g., ABC123) |
| 4 | Copy room code | Click "Join Room" |
| 5 | Wait for player | Wait for connection |
| 6 | ✅ See "Player joined" | ✅ See "Connected to host" |

**Expected Results:**
- ✅ Room code generates (6 characters, uppercase)
- ✅ Client can join with valid code
- ✅ Both see "Connected" status (🟢 green)
- ✅ Ping displays (<100ms ideal)

**Common Issues:**
- ❌ "Room not found" → Check room code is correct
- ❌ "Connection failed" → Check firewall/ports
- ❌ "Room expired" → Room times out after 5 min

---

### Test 2: Player Selection ✅

**Purpose**: Validate P1 vs P2 auto-detection

| Step | Host | Client |
|------|------|--------|
| 1 | Auto-selects P1 | Auto-selects P2 |
| 2 | See team (Home) | See team (Away) |
| 3 | Click "Confirm" | Click "Confirm" |
| 4 | ✅ Locked as P1 | ✅ Locked as P2 |

**Expected Results:**
- ✅ Host = Player 1 automatically
- ✅ Client = Player 2 automatically
- ✅ Cannot change after confirmation
- ✅ Team names display correctly

---

### Test 3: Ready Button & Day Advancement ✅

**Purpose**: Validate double-check day advancement

| Step | Host | Client |
|------|------|--------|
| 1 | Click "Ready" | Click "Ready" |
| 2 | See "Waiting for P2" | See "Waiting for host" |
| 3 | Both ready → day advances | Both ready → day advances |
| 4 | ✅ See results | ✅ See same results |

**Expected Results:**
- ✅ Button turns green when ready
- ✅ Shows opponent status
- ✅ Day ONLY advances when BOTH ready
- ✅ Both players see identical results

**Common Issues:**
- ❌ Day advances with one player → Check `both_players_ready` logic
- ❌ Results differ → Check state sync

---

### Test 4: Disconnect Recovery ✅

**Purpose**: Validate client recovery when host disconnects

| Step | Host | Client |
|------|------|--------|
| 1 | Close app (simulate disconnect) | — |
| 2 | — | ✅ Modal "Host disconnected" appears |
| 3 | — | Click "Continue Offline" |
| 4 | — | ✅ Loads backup save |
| 5 | — | ✅ Converts to single-player |
| 6 | — | ✅ Can continue playing |

**Expected Results:**
- ✅ Client detects disconnect within 10 seconds
- ✅ Modal shows recovery options
- ✅ Backup loads successfully
- ✅ Game continues in offline mode
- ✅ Player 2 manager removed

**Common Issues:**
- ❌ Modal doesn't appear → Check connection polling
- ❌ Backup not found → Check backup creation on sync
- ❌ Crash on load → Check `convert_to_offline_mode()` logic

---

### Test 5: State Synchronization ✅

**Purpose**: Validate state sync between host and client

| Step | Host | Client |
|------|------|--------|
| 1 | Make a transfer | — |
| 2 | — | ✅ See transfer within 30s |
| 3 | Change formation | — |
| 4 | — | ✅ See formation updated |
| 5 | Click manual sync | ✅ Shows "Syncing..." |
| 6 | ✅ Sync complete | ✅ Checksum verified |

**Expected Results:**
- ✅ Auto-sync every 30 seconds
- ✅ Manual sync works
- ✅ Checksums match
- ✅ States remain consistent

**Common Issues:**
- ❌ States diverge → Check checksum validation
- ❌ Sync never completes → Check WebRTC data channel

---

### Test 6: Extended Play Session ✅

**Purpose**: Validate stability over time

**Steps:**
1. Play for 30+ minutes
2. Advance 10+ days
3. Make multiple transfers
4. Change tactics/formation frequently
5. Monitor memory usage

**Expected Results:**
- ✅ No crashes
- ✅ Memory stable (<500MB)
- ✅ Sync remains consistent
- ✅ No performance degradation

---

### Test 7: PvP Match Simulation ✅

**Purpose**: Validate match simulation between P1 and P2 teams

**Steps:**
1. Set up match: P1 team vs P2 team
2. Both players confirm lineup
3. Host simulates match
4. Both view results

**Expected Results:**
- ✅ Host simulates ONCE
- ✅ Both see identical score
- ✅ Both managers update with same result
- ✅ Stats (goals, assists, rating) match

---

### Test 8: Backup After Extended Session ✅

**Purpose**: Validate backup works after long play session

**Steps:**
1. Play for 5+ minutes (multiple syncs)
2. Host disconnects
3. Client loads backup
4. Verify game state

**Expected Results:**
- ✅ Backup exists
- ✅ State matches last sync (within 5 min)
- ✅ No data corruption
- ✅ Can continue from backup

---

## Step 3: Testing Checklist

```
□ Test 1: Create and join room
□ Test 2: Player selection
□ Test 3: Ready button & day advancement
□ Test 4: Disconnect recovery
□ Test 5: State synchronization
□ Test 6: Extended play session (30+ min)
□ Test 7: PvP match simulation
□ Test 8: Backup after extended session
□ Test 9: Multiple transfers between players
□ Test 10: Formation/tactics changes

□ No crashes in 30 minutes
□ No memory leaks (check Task Manager)
□ UI responsive on both sides
□ Error messages display correctly
□ Toast notifications work
```

---

## Debugging

### View Signaling Server Logs

**Render:**
- Dashboard → Select service → Logs tab

**Local:**
- Check terminal where server is running

### View App Logs

**In DevTools:**
```bash
# Press F12 in the app
# Go to Console tab
# All logs appear here
```

**Force Re-sync:**
```javascript
// In DevTools Console (F12)
await window.__TAURI__.invoke('multiplayer_request_sync', { 
  reason: 'ManualRefresh' 
})
```

### Check Backup Location

**Windows:**
```
%APPDATA%\com.olmanager\app_data\saves\{game_id}_backup.db
```

**macOS:**
```
~/Library/Application Support/com.olmanager/app_data/saves/{game_id}_backup.db
```

**Linux:**
```
~/.config/com.olmanager/app_data/saves/{game_id}_backup.db
```

### Network Debugging

**Check WebRTC Connection:**
```javascript
// In DevTools Console
const status = await window.__TAURI__.invoke('get_connection_status')
console.log('Connection status:', status)
```

**Check Room Status:**
```javascript
const roomStatus = await window.__TAURI__.invoke('get_room_status', { 
  roomCode: 'ABC123' 
})
console.log('Room status:', roomStatus)
```

---

## Known Limitations

### What's NOT Tested
- ❌ Real-world latency (>500ms)
- ❌ Packet loss simulation
- ❌ TURN server (for strict NATs)
- ❌ Concurrent rooms (>10)
- ❌ Mobile devices

### Why
- Requires network simulation tools
- TURN server needs separate infrastructure
- Load testing requires k6/Artillery

### Recommendations
- **Before merge**: Complete this manual testing
- **After merge**: Deploy to staging, test with real users
- **Post-launch**: Monitor real-world performance

---

## Reporting Results

Create a comment on the PR with:

```markdown
## Manual Testing Results

**Date**: YYYY-MM-DD  
**Testers**: [Names]  
**Machines**: [PC specs or VMs]  
**Signaling Server**: [Render/local/other + URL]  
**Duration**: [X hours]

### Tests Passed
- [ ] Test 1: Create/join room
- [ ] Test 2: Player selection
- [ ] Test 3: Ready button
- [ ] Test 4: Disconnect recovery
- [ ] Test 5: State sync
- [ ] Test 6: Extended session
- [ ] Test 7: PvP match
- [ ] Test 8: Backup recovery

### Issues Found
1. **Issue Title**
   - **Steps**: [How to reproduce]
   - **Expected**: [What should happen]
   - **Actual**: [What happened]
   - **Severity**: Critical/Major/Minor

### Overall Assessment
✅ Ready to merge / ❌ Needs fixes

### Notes
[Any additional observations]
```

---

## Success Criteria

The multiplayer mode is considered **production-ready** when:

- ✅ All 8 tests pass
- ✅ No crashes in 30+ minute session
- ✅ Disconnect recovery works 100% of the time
- ✅ State sync remains consistent (no divergence)
- ✅ Both players see identical game state
- ✅ UI/UX is smooth (no lag, stuttering)
- ✅ Error messages are clear and actionable

---

## Contact

For issues or questions:
- **GitHub Issues**: https://github.com/NicoRuedaA/OLManager/issues
- **PR Discussion**: https://github.com/NicoRuedaA/OLManager/pull/[PR_NUMBER]

---

**Last Updated**: 2026-04-30  
**Branch**: `online-mvp`  
**Status**: Ready for testing ✅
