

## Plan: Add Kick Player Ability to All Games

Currently, only Sequence has a kick player feature. This plan adds kick functionality to Ban Luck (Blackjack), Poker, Asshole Dai Di, and Dai Di — available to the host only.

### Approach

The kick logic is simple: disconnect the player from the `players` table (set `connected = false`). No game-state-level removal is needed for most games since they already handle disconnected players gracefully. The Sequence game has extra game-state removal logic which is already implemented.

### Changes

**1. `src/hooks/useRoom.ts`** — Add a shared `kickPlayer` function:
- Export an async `kickPlayer(roomId, playerId)` function that sets `connected = false` on the target player
- This keeps it centralized rather than duplicating across each game hook

**2. `src/pages/GamePlay.tsx`** — Wire up kick handler:
- Import `kickPlayer` from `useRoom`
- Create a `handleKickPlayer` callback that calls `kickPlayer(roomId, playerId)`
- Pass `onKickPlayer={handleKickPlayer}` to BlackjackTable, PokerTable, AssholeDaiDiTable, and DaiDiTable

**3. `src/components/blackjack/BlackjackTable.tsx`** — Add kick UI:
- Add `onKickPlayer` to Props interface
- In the player list area, show a kick button (UserX icon) next to each non-host player, visible only to the host

**4. `src/components/poker/PokerTable.tsx`** — Add kick UI:
- Same pattern: add `onKickPlayer` prop, show kick button for host next to other players

**5. `src/components/asshole-daidi/AssholeDaiDiTable.tsx`** — Add kick UI:
- Same pattern

**6. `src/components/dai-di/DaiDiTable.tsx`** — Add kick UI:
- Same pattern

**7. `src/pages/WaitingRoom.tsx`** — Add kick in waiting room:
- Import `kickPlayer` from `useRoom`
- Show a kick button (UserX icon) next to each non-host player, visible only to the host
- Kicking sets `connected = false`, which removes them from the player list

### UI Pattern (consistent across all games)
Following the Sequence implementation: a small ghost button with `UserX` icon, red/destructive color, shown only to the host, next to each other player's name.

