# Apply Progress: Replace Position Enum with LoL Role Enum

## Change: 50-position-to-lol-role

## Status: IN_PROGRESS

## Completed Tasks

### Phase 1: Foundation (4/4 tasks) ✅
- [x] 1.1 LolRole custom Deserialize impl already exists in domain/src/stats.rs
- [x] 1.2 Role-specific weight maps already implemented in player_rating.rs
- [x] 1.3 Side-based penalty logic already removed
- [x] 1.4 Rating functions already accept LolRole

### Phase 2: Core Domain (6/6 tasks) ✅
- [x] 2.1 Position enum already removed from player.rs
- [x] 2.2 Player struct uses LolRole for position, natural_position, alternate_positions
- [x] 2.3 Legacy methods (is_legacy_bucket, to_group_position) not present on LolRole
- [x] 2.4 TeamComposition::role_rows() returns Vec<Vec<LolRole>>
- [x] 2.5 Football line helpers removed from team.rs
- [x] 2.6 Domain crate compiles

### Phase 3: Engine Types (3/3 tasks) ✅
- [x] 3.1 Engine types.rs uses engine::LolRole (defined in live_match/lol_map.rs)
- [x] 3.2 Engine LolRole unified - now using internal engine LolRole
- [x] 3.3 Engine crate compiles

### Phase 4: Commands & Application Layer (PARTIAL)
- [x] 4.1 Removed lol_role_for_position function from time_blockers.rs
- [x] 4.2 Updated squad.rs - replaced domain::player::Position with LolRole
- [x] 4.3 Updated generation.rs to use LolRole
- [x] 4.4 Updated team_builder.rs - removed map_position_to_lol_role, use LolRole directly
- [x] 4.5 Updated db entities - removed Position references
- [ ] 4.6 Commands layer - more files need updating

### Phase 5: Database & Migration (PARTIAL)
- [x] 5.1 LolRole deserialize handles legacy Position strings (via custom impl)
- [ ] 5.2 player_repo.rs - needs parse_position function update
- [ ] 5.3 save_manager.rs - needs Position references fixed

### Phase 6: Frontend TypeScript - NOT STARTED
- [ ] 6.1-6.8 All frontend tasks pending

### Phase 7: Testing - PARTIAL
- [x] 7.1 Some test fixtures updated in ofm_core/tests/
- [ ] 7.2-7.8 Additional tests needed

### Phase 8: Cleanup - NOT STARTED
- [ ] 8.1-8.5 All cleanup tasks pending

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `src-tauri/crates/engine/src/types.rs` | Modified | Import LolRole from live_match module |
| `src-tauri/crates/engine/src/lib.rs` | Modified | Re-export LolRole from live_match |
| `src-tauri/crates/ofm_core/src/generator/generation.rs` | Modified | Use LolRole instead of Position |
| `src-tauri/crates/ofm_core/src/live_match_manager/team_builder.rs` | Modified | Use LolRole directly |
| `src-tauri/crates/ofm_core/src/player_identity.rs` | Modified | Simplified for LoL |
| `src-tauri/crates/ofm_core/src/scouting.rs` | Modified | Use LolRole |
| `src-tauri/crates/ofm_core/src/season_awards.rs` | Modified | Use LolRole in tests |
| `src-tauri/crates/ofm_core/src/transfers.rs` | Modified | Use LolRole |
| `src-tauri/crates/ofm_core/src/turn/mod.rs` | Modified | Use engine::LolRole |
| `src-tauri/crates/ofm_core/src/turn/post_match.rs` | Modified | Remove Goalkeeper logic |
| `src-tauri/crates/ofm_core/src/player_events/mod.rs` | Modified | Remove Goalkeeper check |
| `src-tauri/crates/ofm_core/src/player_rating.rs` | Modified | Use attribute calculation for Unknown |
| `src-tauri/crates/db/src/repositories/player_repo.rs` | Modified | Remove Position import |
| `src-tauri/crates/db/src/save_manager.rs` | Modified | Remove Position import |
| `src-tauri/crates/domain/src/stats.rs` | Modified | Fix unused import warning |

## Remaining Work

1. **Database layer (db crate)**: 
   - Fix parse_position function in player_repo.rs
   - Fix is_mirrored_side_pair function in save_manager.rs
   - Update test code in legacy_migration.rs

2. **Frontend (TypeScript)**:
   - Update src/store/types.ts
   - Update src/lib/playerRating.ts
   - Update src/components/squad/SquadTab.helpers.ts
   - Update src/lib/lolIdentity.ts
   - Update src/utils/backendI18n.ts
   - Update public/locales/*/common.json

3. **Testing**:
   - Run full test suite
   - Add unit tests for legacy deserialization

4. **Cleanup**:
   - Verify no remaining Position references
   - Run clippy

## Current Compilation Status

- domain crate: ✅ Compiles
- engine crate: ✅ Compiles  
- ofm_core crate: ⚠️ Compiles with warnings
- db crate: ❌ Has errors (Position references in player_repo.rs, save_manager.rs)

## Next Steps

1. Fix remaining db crate errors
2. Continue with frontend TypeScript changes
3. Run tests and verify
4. Complete cleanup phase