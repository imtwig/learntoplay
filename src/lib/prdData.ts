export interface PRDSection {
  title: string;
  content: string;
}

export interface PRDDocument {
  id: string;
  title: string;
  subtitle: string;
  sections: PRDSection[];
}

export const websitePRD: PRDDocument = {
  id: "website",
  title: "Game Night — Website PRD",
  subtitle: "Product Requirements Document for the Game Night Platform",
  sections: [
    {
      title: "1. Product Overview",
      content:
        "Game Night is a browser-based multiplayer gaming platform that allows friends to play classic card and board games together in real-time. The platform supports five games: Texas Hold'em Poker (2–9 players), Sequence (2–12 players), Ban Luck / Blackjack (1–7 players), Dai Di / Big 2 (4 players), and Asshole Dai Di (3–7 players). Players can create or join rooms, invite friends, and play without installing anything.",
    },
    {
      title: "2. Target Audience",
      content:
        "Casual gamers aged 18–45 who enjoy playing card and board games with friends remotely. The platform is designed for social gatherings, game nights, and casual play sessions. No prior experience with the games is required — in-app rules are provided for each game.",
    },
    {
      title: "3. Core Features",
      content:
        "• Home page showcasing all 5 available games with descriptions, player counts, and icons\n• Room-based multiplayer system with create/join functionality\n• Password-protected rooms for private sessions\n• Real-time game state synchronization via Supabase Realtime (postgres_changes)\n• Persistent session management (sessionStorage-based session IDs) with automatic reconnection on page reload\n• Host controls: kick players, transfer host (including dealer transfer for blackjack), start game\n• Ready-up system in waiting rooms before game start\n• Responsive design for desktop and mobile play\n• PRD documentation page with downloadable .docx for each game",
    },
    {
      title: "4. Technical Architecture",
      content:
        "• Frontend: React 18 + TypeScript + Vite\n• Styling: Tailwind CSS with custom HSL design tokens (dark theme: background 220 20% 7%, primary green 142 70% 45%, accent purple 262 80% 55%)\n• UI Components: shadcn/ui built on Radix primitives\n• Animations: Framer Motion\n• State Management: React hooks + TanStack React Query\n• Backend: Supabase (PostgreSQL database + Realtime subscriptions)\n• Routing: React Router v6 with routes: / (home), /game/:gameId (lobby), /room/:roomId (waiting), /play/:roomId (gameplay), /prd (documentation)\n• Fonts: Orbitron (display) + Space Grotesk (body)\n• Deployment: Lovable Cloud",
    },
    {
      title: "5. Database Schema",
      content:
        "Two primary tables:\n\n• rooms: id (uuid PK), game_type (enum: poker|sequence|blackjack|asshole_daidi|dai_di), room_name (text), password_hash (text, nullable), status (enum: waiting|in_progress|closed), host_player_id (FK → players.id), settings (jsonb), game_state (jsonb — stores all game logic state), max_players (int), created_at (timestamptz).\n\n• players: id (uuid PK), room_id (FK → rooms.id ON DELETE CASCADE), display_name (text), session_id (text — browser tab identity), is_host (boolean), join_order (int), player_state (jsonb — stores ready status etc.), connected (boolean — toggled on leave/rejoin), created_at (timestamptz).\n\nDatabase function: cleanup_empty_rooms — removes stale rooms with no connected players.",
    },
    {
      title: "6. User Flows",
      content:
        "1. Landing: User visits home page → browses 5 game cards with icons, descriptions, and player counts\n2. Game Selection: User clicks a game card → navigates to /game/:gameId lobby\n3. Room Creation: User enters display name, room name, optional password, and game-specific settings (e.g. blinds, house rules) → creates room → enters waiting room as host\n4. Room Joining: User selects an existing room from the lobby list → enters display name, optional password → joins waiting room\n5. Game Start: Host presses Start when minimum players reached and all are ready → status set to in_progress → all players redirected to /play/:roomId\n6. Gameplay: Players interact with game-specific UI → each action mutates game_state in Supabase → Realtime broadcasts changes to all players\n7. Reconnection: If a player refreshes or temporarily disconnects, returning to the room URL triggers auto-reconnect (matches session_id, sets connected=true)\n8. Host Transfer: If host leaves, host role automatically transfers to next connected player (by join_order). If no players remain, room status set to closed.",
    },
    {
      title: "7. Non-Functional Requirements",
      content:
        "• Latency: Game state updates propagate to all players within ~500ms via Supabase Realtime\n• Concurrency: Up to 12 simultaneous players per room (Sequence max)\n• Availability: 99.9% uptime via Supabase managed infrastructure\n• Browser Support: Chrome, Firefox, Safari, Edge (latest 2 versions)\n• Security: No authentication required — identity is session-based (crypto.randomUUID stored in sessionStorage). Passwords stored as plaintext (simple implementation, not hashed)\n• Game State: All game logic runs client-side; state is persisted as JSON in rooms.game_state. State is filtered per-player before display (e.g., hiding opponents' cards)",
    },
    {
      title: "8. Future Considerations",
      content:
        "• User accounts with persistent stats and history\n• Global leaderboards across all games\n• Spectator mode for watching ongoing games\n• Chat/voice integration during gameplay\n• Tournament mode with brackets\n• Additional games (Mahjong, Uno, etc.)\n• Mobile-native app wrapper\n• Server-side game state validation to prevent cheating\n• Proper password hashing for room security",
    },
  ],
};

export const gamePRDs: PRDDocument[] = [
  {
    id: "poker",
    title: "Texas Hold'em Poker — Game PRD",
    subtitle: "Product Requirements Document for Texas Hold'em Poker",
    sections: [
      {
        title: "1. Game Overview",
        content:
          "A no-limit Texas Hold'em poker implementation supporting 2–9 players. Each player receives 2 private hole cards, and 5 community cards are dealt across three stages (Flop, Turn, River). Players aim to make the best 5-card hand or force opponents to fold. Configurable small blind and starting chips (default: 10 small blind, 1000 starting chips).",
      },
      {
        title: "2. Game Flow",
        content:
          "1. Dealer button is assigned (rotates clockwise each hand)\n2. Small blind and big blind are posted (SB = configurable, BB = 2× SB)\n3. Two hole cards dealt to each active (non-eliminated, non-sitting-out) player\n4. Pre-Flop betting round (action starts left of big blind; BB is considered last raiser)\n5. Burn 1, deal 3 community cards (Flop)\n6. Flop betting round (action starts left of dealer)\n7. Burn 1, deal 4th community card (Turn)\n8. Turn betting round\n9. Burn 1, deal 5th community card (River)\n10. River betting round\n11. Showdown — best 5-card hand wins the pot (evaluates all C(7,5)=21 combinations)\n12. If only one player remains after folding, they win the pot immediately without showdown",
      },
      {
        title: "3. Player Actions",
        content:
          "• Fold: Surrender your hand and forfeit the current pot (always available)\n• Check: Pass the action when no bet is pending (only when current bet = player's bet)\n• Call: Match the current bet (pays difference between current bet and player's bet)\n• Raise: Increase the bet (minimum raise = previous raise amount; maximum = all-in)\n• All-In: Bet all remaining chips. If the all-in amount exceeds the current bet, it acts as a raise and resets the action. If below current bet, it's treated as a call.\n\nBetting round ends when all non-folded, non-all-in players have acted and their bets match the current bet.",
      },
      {
        title: "4. Hand Rankings (Highest to Lowest)",
        content:
          "1. Royal Flush — A-K-Q-J-10 of the same suit\n2. Straight Flush — Five consecutive cards of the same suit\n3. Four of a Kind — Four cards of the same rank + kicker\n4. Full House — Three of a kind + one pair\n5. Flush — Five cards of the same suit (compared by highest card, then next)\n6. Straight — Five consecutive ranks (Ace-low straight A-2-3-4-5 is valid, high card = 5)\n7. Three of a Kind — Three same rank + two kickers\n8. Two Pair — Two pairs + kicker\n9. One Pair — One pair + three kickers\n10. High Card — Five highest cards compared sequentially",
      },
      {
        title: "5. Side Pots & Elimination",
        content:
          "• Side pots are built automatically when players go all-in with different chip amounts\n• Each pot level is calculated: contribution × number of contributors, with eligible (non-folded) players tracked\n• In multi-way pots, each side pot is awarded independently to its best hand\n• Ties split the pot evenly (remainder goes to first tied player)\n• Players with 0 chips after a hand are marked eliminated and sit out future hands\n• The game ends when only 1 player has chips remaining",
      },
      {
        title: "6. Visibility & State Filtering",
        content:
          "• Each player's hole cards are hidden from other players during active play (replaced with 'HIDDEN')\n• At showdown/hand_over phase, all remaining players' hole cards are revealed to everyone\n• Community cards are always visible to all players\n• Deck contents are never exposed to clients",
      },
      {
        title: "7. Technical Implementation",
        content:
          "• Game logic: src/lib/poker.ts (761 lines) — pure functions operating on PokerGameState\n• React hook: src/hooks/usePoker.ts\n• UI component: src/components/poker/PokerTable.tsx\n• State stored in rooms.game_state as JSON\n• Real-time sync via Supabase Realtime subscriptions on rooms table\n• Key types: PokerPlayer, PokerGameState, PokerPhase (waiting|pre_flop|flop|turn|river|showdown|hand_over), SidePot, PokerAction (fold|check|call|raise|all_in)",
      },
    ],
  },
  {
    id: "sequence",
    title: "Sequence — Game PRD",
    subtitle: "Product Requirements Document for Sequence Board Game",
    sections: [
      {
        title: "1. Game Overview",
        content:
          "Sequence is a strategy board-and-card game played on a 10×10 grid. Players play cards from their hand to place chips on matching board spaces. The goal is to form rows of 5 chips (a Sequence). Supports 2–12 players in team configurations. Team count is auto-determined: divisible by 3 → 3 teams (A, B, C); divisible by 2 → 2 teams (B, C). Player counts must be divisible by 2 or 3.",
      },
      {
        title: "2. Board & Deck",
        content:
          "• The 10×10 board contains 96 card spaces (each standard card appears twice on the board) and 4 corner free spaces\n• Corner spaces are free for all players and count toward any Sequence\n• Two standard 52-card decks are used (104 cards total)\n• Hand sizes scale by player count: ≤2 players = 7 cards, ≤3 = 6 cards, ≤6 = 5 cards, ≤9 = 4 cards, 10+ = 3 cards\n• Board layout is defined in src/lib/sequenceBoard.ts",
      },
      {
        title: "3. Team Setup Phase",
        content:
          "• Before gameplay, all players must choose a team\n• For 2-team games: teams B (Blue) and C (Green) must have equal members; team A must be empty\n• For 3-team games: all three teams (A, B, C) must have equal members\n• Players are reordered so teams alternate turns (e.g. B, C, B, C or A, B, C, A, B, C)\n• Starting player rotates each round via roundStartIndex",
      },
      {
        title: "4. Turn Flow",
        content:
          "1. Player selects a card from their hand\n2. Player places a chip on a matching empty board space\n3. Card is discarded, a new card is drawn from the deck\n4. Turn passes to the next player (cycling through reordered list)\n\nDead Cards: If both matching board spaces for a card are occupied, it's a dead card. The player discards it and draws a replacement — this counts as their turn.",
      },
      {
        title: "5. Special Cards",
        content:
          "Standard Rules:\n• Two-Eyed Jacks (J♦, J♣): Wild — place a chip on any empty non-corner space\n• One-Eyed Jacks (J♥, J♠): Anti-wild — remove any opponent's chip (not part of a completed Sequence)\n\nHouse Rules (configurable per room):\n• Jokers (4 added to deck): Wild placement cards — place a chip on any empty non-corner space\n• All Jacks Remove: ALL jacks (both one-eyed and two-eyed) become removal cards instead of the standard split behavior\n• Remove From Sequence: Allows removing chips that are part of a completed Sequence (invalidates that Sequence and unmarks its chips)",
      },
      {
        title: "6. Winning Conditions",
        content:
          "• 2-team games: First team to complete 2 Sequences wins\n• 3-team games: First team to complete 1 Sequence wins\n• A Sequence is 5 chips in a row (horizontal, vertical, or diagonal) belonging to the same team\n• Corner free spaces count for any team\n• Two Sequences of the same owner may share at most 1 position (no excessive overlap)",
      },
      {
        title: "7. Technical Implementation",
        content:
          "• Board definition: src/lib/sequenceBoard.ts — SEQUENCE_BOARD 10×10 grid, getBoardPositions(), isCorner(), isJack() helpers\n• Game logic: src/lib/sequence.ts (612 lines) — initSequenceGame, playCard, discardDeadCard, detectNewSequences, setTeam, startSequenceGame, newSequenceRound, syncSeqPlayers, removeSeqPlayer, addSeqPlayer\n• House rules: SeqHouseRules interface (jokers, allJacksRemove, removeFromSequence) with normalizeHouseRules() for backward compatibility\n• React hook: src/hooks/useSequence.ts\n• UI components: src/components/sequence/SequenceTable.tsx, SequenceResultOverlay.tsx\n• Key types: SeqGameState, SeqPlayer, SeqChip, SeqTeam ('A'|'B'|'C'), SeqHouseRules, SeqSequenceData\n• State filtered per-player: opponents' hands are hidden (replaced with 'HIDDEN')",
      },
    ],
  },
  {
    id: "blackjack",
    title: "Ban Luck (Blackjack) — Game PRD",
    subtitle: "Product Requirements Document for Ban Luck",
    sections: [
      {
        title: "1. Game Overview",
        content:
          "Ban Luck is a multiplayer blackjack variant supporting 1–7 players. One player acts as the dealer (initially the host; transferable). Players bet and try to beat the dealer by getting a hand value as close to 21 as possible without busting. Features include special hands, dealer reveal controls, a configurable 'show first card' setting, a debug panel for testing scenarios, and a live leaderboard tracking net profit across rounds.",
      },
      {
        title: "2. Card Values",
        content:
          "• Number cards (2–10): Face value\n• Face cards (J, Q, K): 10 points\n• Ace in first 2 cards: 11 (soft, reduces to 1 if bust)\n• Ace as 3rd+ card: 10 (reduces to 1 if bust)\n• Uses a single standard 52-card deck (auto-reshuffled when < 5 cards remain)",
      },
      {
        title: "3. Game Phases",
        content:
          "1. Betting Phase: All players set their bet amount and press Ready. The dealer's bet is always 0. Game proceeds when all players are ready.\n2. Dealing Phase: Two cards dealt to each player. First card always face-up. Second card face-up or face-down based on 'show first card' setting. Opening specials are auto-evaluated.\n3. Player Turns Phase: Each non-dealer player (in order) chooses Draw (hit) or Done (stand). If a player busts or hits a special, they're auto-advanced.\n4. Dealer Turn Phase: Dealer reveals players' hands one-by-one (must have ≥16 points or a natural to reveal). Dealer can Draw or Done. Dealer with a resolved special (ban luck, ban ban, etc.) can immediately press Done.\n5. Results Phase: All hands settled, profits displayed. Host can start next round.",
      },
      {
        title: "4. Special Hands & Payouts",
        content:
          "Opening specials (auto-detected on deal):\n• Ban Luck (Ace + 10-value): Player wins 2× bet from dealer\n• Ban Ban (Double Aces): Player wins 3× bet from dealer\n• When both player and dealer have specials: higher strength wins (Ban Ban > Ban Luck). Equal = push.\n• When dealer has a special: all non-special players lose at the dealer's multiplier. Dealer goes to dealer_turn to press Done.\n\nHit specials (during player turns):\n• Triple Sevens (7-7-7): Player wins 7× bet from dealer. If dealer gets triple sevens, wins 7× from all unsettled players.\n• Five Card Charlie (5 cards ≤ 21): Player wins 2× bet. If busted at 5 cards, loses 2× bet. Dealer five-card-charlie wins 2× from all unsettled players.\n\nSettlement:\n• Regular Win (player > dealer, both ≤ 21): 1× bet\n• Lose (player < dealer): -1× bet\n• Bust (> 21): -1× bet\n• Fail (player < 15 and dealer didn't bust): -1× bet\n• Dealer Fail (dealer < 16, not busted): counts as dealer loss\n• Push (tie, or both bust): bet returned\n• Dealer bust: all non-busted pending players win 1×",
      },
      {
        title: "5. Dealer Mechanics",
        content:
          "• Dealer does not bet (bet = 0)\n• During dealer_turn, dealer has reveal controls:\n  - Reveal individual player hands (button per player)\n  - Reveal all hands at once\n  - Reveal requires dealer value ≥ 16 OR a natural (ban luck / ban ban)\n• When revealing a player: if player busted → auto-settle as bust. If player value > dealer value → auto-settle as win. Otherwise, hand stays pending until dealer stands.\n• When dealer stands (Done): all remaining pending hands are settled. Both-bust = push. Player < 15 = fail. Otherwise compare values.\n• If dealer busts during hitting: result is marked but dealer must still press Done to settle\n• Dealer can be transferred via host controls (uses transferDealer function to update isDealer flag)",
      },
      {
        title: "6. Settings & Debug",
        content:
          "Settings:\n• Show First Card: Toggle whether opponents' first card is visible before reveal. Applies next round (showFirstCardNextRound → showFirstCard on newRound).\n\nDebug Panel (test scenarios for development):\n• Scenario presets: ban_luck, ban_ban, triple_sevens, ngou_leng (five card charlie), bust, fail, normal\n• Can set scenarios separately for dealer and players\n• Rigged deck: specific cards are injected for the scenario, including hit-cards for multi-card specials",
      },
      {
        title: "7. State Filtering & Visibility",
        content:
          "• filterStateForPlayer hides opponents' cards unless they are in revealedPlayerIds\n• A player always sees their own cards face-up\n• If showFirstCard setting is on, the first card of unrevealed players is shown\n• Unrevealed cards are replaced with face-down placeholder cards\n• Dealer's cards are auto-revealed when they have a natural or when finishDealerTurn is called",
      },
      {
        title: "8. Technical Implementation",
        content:
          "• Card utilities: src/lib/cards.ts — Card type, createDeck (single deck), handValue (with soft ace logic for 1st/2nd vs 3rd+ cards), isBlackjack, isBust\n• Game logic: src/lib/blackjack.ts (775 lines) — initGameState, startDeal, playerAction, revealPlayer, revealAll, newRound, transferDealer, getAvailableActions, filterStateForPlayer\n• React hook: src/hooks/useBlackjack.ts — manages Supabase sync, exposes doAction/doRevealPlayer/doRevealAll/doNextRound\n• UI components: src/components/blackjack/ — BlackjackTable, PlayingCard, HandDisplay, DealingAnimation, RoundResultOverlay, DebugPanel, LeaderboardButton\n• Key types: BJGameState, BJPlayerState, BJHand, BJSettings, HandResult (win|lose|bust|fail|push|blackjack|double_aces|five_card|triple_sevens|pending), PlayerAction (hit|stand), TestScenario",
      },
    ],
  },
  {
    id: "dai_di",
    title: "Dai Di (Big 2) — Game PRD",
    subtitle: "Product Requirements Document for Dai Di",
    sections: [
      {
        title: "1. Game Overview",
        content:
          "Dai Di (Big 2) is a 4-player shedding card game. All 52 cards are dealt evenly (13 per player). The player with the 3 of Diamonds starts the first round. Players take turns playing valid combinations that beat the previous play. The first player to shed all cards wins the round immediately, and all remaining players receive penalty scores.",
      },
      {
        title: "2. Card Ranking",
        content:
          "• Rank order (low → high): 3, 4, 5, 6, 7, 8, 9, 10, J, Q, K, A, 2\n• Suit order (low → high): ♦ (Diamonds), ♣ (Clubs), ♥ (Hearts), ♠ (Spades)\n• The 2 of Spades (2♠) is the single highest card in the game\n• Cards are compared by rank first, then suit for tiebreaking",
      },
      {
        title: "3. Valid Combinations",
        content:
          "• Singles: One card\n• Pairs: Two cards of the same rank (compared by highest suit)\n• Triples: Three cards of the same rank (house rule — disabled by default)\n• Five-card hands (ranked by tier, low → high):\n  1. Straight (tier 1): Five consecutive ranks (compared by high card)\n  2. Flush (tier 2): Five cards of the same suit (compared by high card)\n  3. Full House (tier 3): Three of a kind + pair (compared by triple's high card)\n  4. Four of a Kind (tier 4): Four of same rank + any kicker (compared by quad's high card)\n  5. Straight Flush (tier 5): Consecutive + same suit (compared by high card)\n\nSpecial beats:\n• Four of a Kind or Straight Flush can beat a single 2\n• Straight Flush can beat a pair of 2s\n• Straight Flush can beat triple 2s\n• Higher tier always beats lower tier for 5-card combos",
      },
      {
        title: "4. Turn Flow & Passing",
        content:
          "1. Active player must play a valid combination of the same size that beats the current play (same card count, higher rank/tier)\n2. If unable or unwilling, the player passes (cannot pass if leading a new trick)\n3. If all other active players pass, the table is cleared and the last player who played leads a new trick (any combination)\n4. Round 1 restriction: the very first play must include the 3♦\n5. Play continues until one player sheds all cards\n6. Previous round winner leads the next round (first round: 3♦ holder leads)",
      },
      {
        title: "5. House Rules (Configurable)",
        content:
          "• Allow End on 2: If disabled (default), a player cannot finish the game by playing only 2s as their last cards (singles, pairs, or triples of 2s)\n• Allow Triples: If enabled, three-of-a-kind is a valid combination type (disabled by default)",
      },
      {
        title: "6. Scoring & Penalty Multipliers",
        content:
          "Losers score penalties based on cards remaining:\n• Base penalty: 1 point per card remaining\n• Configurable multipliers:\n  - 10+ cards remaining: ×2 penalty (enabled by default)\n  - 13 cards remaining (never played): ×3 penalty (disabled by default)\n  - 2s surcharge: +2 penalty per 2 (two) still held (disabled by default)\n• The round winner earns points equal to the sum of all other players' penalties\n• Cumulative scores and earnings are tracked across rounds",
      },
      {
        title: "7. Technical Implementation",
        content:
          "• Game logic: src/lib/daiDi.ts (424 lines) — imports card ranking and combination logic from assholeDaiDi.ts (shared code)\n• Functions: initDDGame, dealDDRound, ddPlayCards, ddPass, endDDRound, filterDDStateForPlayer, rematchDDGame\n• React hook: src/hooks/useDaiDi.ts\n• UI component: src/components/dai-di/DaiDiTable.tsx\n• Key types: DDGameState, DDPlayer, DDPhase (waiting|playing|round_end), DDHouseRules, DDPenaltyMultipliers\n• State filtered per-player: opponents' hands are hidden (empty array)\n• Re-exports shared types: CombinationType, PlayedCombination, compareCards, parseCard, cardDisplay, sortHand, detectCombination, beats",
      },
    ],
  },
  {
    id: "asshole_daidi",
    title: "Asshole Dai Di — Game PRD",
    subtitle: "Product Requirements Document for Asshole Dai Di",
    sections: [
      {
        title: "1. Game Overview",
        content:
          "Asshole Dai Di is a shedding card game for 3–7 players combining Dai Di card mechanics with the Asshole/President ranking system. Players shed cards using valid combinations. Finishing order determines ranks (President through Asshole). Ranks carry into the next round via a mandatory card swap phase. The President scores points equal to all other players' remaining card counts.",
      },
      {
        title: "2. Card Ranking",
        content:
          "• Rank order (low → high): 3, 4, 5, 6, 7, 8, 9, 10, J, Q, K, A, 2\n• Suit order (low → high): ♦ (Diamonds), ♣ (Clubs), ♥ (Hearts), ♠ (Spades)\n• The 2♠ is the highest single card\n• Same combination detection and comparison logic as Dai Di (shared code in assholeDaiDi.ts)",
      },
      {
        title: "3. Valid Combinations",
        content:
          "• Singles: One card\n• Pairs: Two cards of same rank\n• Triples: Three cards of same rank (always enabled, unlike Dai Di where it's optional)\n• Five-card hands (tier order): Straight (1) < Flush (2) < Full House (3) < Four of a Kind (4) < Straight Flush (5)\n\nSpecial beats (same as Dai Di):\n• Four of a Kind or Straight Flush beats a single 2\n• Straight Flush beats a pair of 2s or triple 2s\n• Must match combination size (except the special beat cases above)",
      },
      {
        title: "4. Game Phases",
        content:
          "1. Waiting: Lobby, waiting for enough players\n2. Playing: Active card play (deal → play rounds → shedding)\n3. Round End: Scores calculated, rank titles assigned\n4. Swap Give: President/VP select cards to return to Asshole/VA\n5. Swap Summary: Display what was swapped before continuing\n6. Game Over: Session ended (manual rematch available)\n\nCards are dealt evenly (52 ÷ player count). Remainder cards go to: first-round → lowest-index players, subsequent rounds → lowest-ranked players (Asshole first).",
      },
      {
        title: "5. Ranking System",
        content:
          "Ranks are assigned by finish order. Title distribution by player count:\n• 3 players: President, Citizen, Asshole\n• 4 players: President, Vice President, Vice Asshole, Asshole\n• 5 players: President, Vice President, Citizen, Vice Asshole, Asshole\n• 6 players: President, Vice President, Citizen, Citizen, Vice Asshole, Asshole\n• 7 players: President, Vice President, Citizen, Citizen, Citizen, Vice Asshole, Asshole\n\nRound ends when only 1 player remains with cards (they get last rank automatically).",
      },
      {
        title: "6. Card Swap Phase",
        content:
          "After round 1+, before the next round plays:\n\n• Asshole → President: Automatically gives their N best cards (N = 2 for 4+ players, 1 for 3 players). Cards are auto-selected (highest by sort order).\n• President → Asshole: Must manually select N cards to return. Returned cards must be lower rank than the lowest card received (validated server-side).\n• Vice Asshole → Vice President: Same mechanic with 1 card (only for 4+ players).\n\nSwap execution: Cards are removed from source hand and added to target hand. Hands are re-sorted after swap. Phase transitions: swap_give → swap_summary → playing (President leads).",
      },
      {
        title: "7. House Rules & Turn Flow",
        content:
          "House Rules:\n• Allow End on 2: If disabled (default), cannot finish the game by playing only 2s as the last cards\n\nTurn Flow:\n• Round 1: Player holding 3♦ goes first, first play must include 3♦\n• Subsequent rounds: President leads after swap phase\n• Players pass if unable/unwilling to beat current combination (cannot pass when leading)\n• When all others pass, the last player to play leads a new trick\n• Turn timer: configurable (default 30 seconds), with auto-play on timeout (auto-pass if combination exists, auto-play lowest card if leading)",
      },
      {
        title: "8. Scoring",
        content:
          "• The President earns points equal to the total cards remaining in all other players' hands when they shed their last card\n• Points accumulate across rounds (cumulativeScore)\n• Other players receive no score (unlike Dai Di where losers get penalties)\n• Highest cumulative score at session end wins",
      },
      {
        title: "9. Technical Implementation",
        content:
          "• Game logic: src/lib/assholeDaiDi.ts (862 lines) — contains both game logic AND shared card ranking/combination utilities used by Dai Di\n• Functions: initADDGame, dealRound, playCards, passPlay, autoPlay, startSwapPhase, submitSwapReturn, finishSwapAndPlay, rematchADDGame, getValidSinglePlays, endRound\n• Shared exports: compareCards, parseCard, cardDisplay, sortHand, detectCombination, beats, cardRankValue\n• React hook: src/hooks/useAssholeDaiDi.ts\n• UI component: src/components/asshole-daidi/AssholeDaiDiTable.tsx\n• Key types: ADDGameState, ADDPlayer, ADDPhase (waiting|playing|round_end|swap_give|swap_summary|game_over), ADDRankTitle, CombinationType, PlayedCombination, ADDHouseRules\n• State filtered per-player: opponents' hands, swap cards, and swap pending details are hidden",
      },
    ],
  },
];

export const allPRDs = [websitePRD, ...gamePRDs];
