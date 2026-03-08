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
        "Game Night is a browser-based multiplayer gaming platform that allows friends to play classic card and board games together in real-time. The platform supports Texas Hold'em Poker, Sequence, Ban Luck (Blackjack variant), Dai Di (Big 2), and Asshole Dai Di. Players can create or join rooms, invite friends, and play without needing to install anything.",
    },
    {
      title: "2. Target Audience",
      content:
        "Casual gamers aged 18–45 who enjoy playing card and board games with friends remotely. The platform is designed for social gatherings, game nights, and casual play sessions. No prior experience with the games is required — rules are provided in-app.",
    },
    {
      title: "3. Core Features",
      content:
        "• Home page showcasing all available games with descriptions and player counts\n• Room-based multiplayer system with create/join functionality\n• Password-protected rooms for private sessions\n• Real-time game state synchronization via Supabase Realtime\n• Persistent session management for reconnection support\n• Host controls (kick players, transfer host, start game)\n• Ready-up system in waiting rooms\n• Responsive design for desktop and mobile play",
    },
    {
      title: "4. Technical Architecture",
      content:
        "• Frontend: React 18 + TypeScript + Vite\n• Styling: Tailwind CSS with custom design tokens\n• UI Components: shadcn/ui (Radix primitives)\n• Animations: Framer Motion\n• State Management: React hooks + TanStack Query\n• Backend: Supabase (PostgreSQL database + Realtime subscriptions)\n• Routing: React Router v6\n• Deployment: Lovable Cloud",
    },
    {
      title: "5. Database Schema",
      content:
        "Two primary tables:\n\n• rooms: Stores room metadata including game_type (enum), room_name, password_hash, status (waiting/in_progress/closed), host_player_id, settings (JSON), game_state (JSON), max_players, and timestamps.\n\n• players: Stores player data including room_id (FK), display_name, session_id, is_host, join_order, player_state (JSON), connected (boolean), and timestamps.\n\nA cleanup_empty_rooms database function handles stale room cleanup.",
    },
    {
      title: "6. User Flows",
      content:
        "1. Landing: User visits home page → browses available games\n2. Game Selection: User clicks a game card → navigates to game lobby\n3. Room Creation: User enters name, room name, optional password → creates room → enters waiting room as host\n4. Room Joining: User selects an existing room → enters name, optional password → joins waiting room\n5. Game Start: Host presses Start when all players are ready → game begins\n6. Gameplay: Players interact with game-specific UI → real-time state sync\n7. Reconnection: If disconnected, returning to the room URL auto-reconnects the player",
    },
    {
      title: "7. Non-Functional Requirements",
      content:
        "• Latency: Game state updates should propagate to all players within 500ms\n• Concurrency: Support up to 12 simultaneous players per room\n• Availability: 99.9% uptime via Supabase managed infrastructure\n• Browser Support: Chrome, Firefox, Safari, Edge (latest 2 versions)\n• Accessibility: Keyboard navigation support, sufficient color contrast\n• Security: No authentication required (session-based identity), password-hashed rooms",
    },
    {
      title: "8. Future Considerations",
      content:
        "• User accounts with persistent stats and history\n• Global leaderboards across all games\n• Spectator mode for watching ongoing games\n• Chat/voice integration during gameplay\n• Tournament mode with brackets\n• Additional games (Mahjong, Uno, etc.)\n• Mobile-native app wrapper",
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
          "A no-limit Texas Hold'em poker implementation supporting 2–9 players. Each player receives 2 private hole cards, and 5 community cards are dealt across three stages (Flop, Turn, River). Players aim to make the best 5-card hand or force opponents to fold.",
      },
      {
        title: "2. Game Flow",
        content:
          "1. Blinds are posted (small blind and big blind)\n2. Two hole cards dealt to each player\n3. Pre-Flop betting round\n4. Three community cards dealt (Flop)\n5. Flop betting round\n6. Fourth community card dealt (Turn)\n7. Turn betting round\n8. Fifth community card dealt (River)\n9. River betting round\n10. Showdown — best hand wins the pot",
      },
      {
        title: "3. Player Actions",
        content:
          "• Fold: Surrender your hand and forfeit the current pot\n• Check: Pass the action (only if no bet is pending)\n• Call: Match the current bet\n• Raise: Increase the current bet\n• All-In: Bet all remaining chips",
      },
      {
        title: "4. Hand Rankings (Highest to Lowest)",
        content:
          "1. Royal Flush (A-K-Q-J-10, same suit)\n2. Straight Flush (five consecutive, same suit)\n3. Four of a Kind\n4. Full House (three of a kind + pair)\n5. Flush (five same suit)\n6. Straight (five consecutive)\n7. Three of a Kind\n8. Two Pair\n9. One Pair\n10. High Card",
      },
      {
        title: "5. Technical Implementation",
        content:
          "• Game logic: src/lib/poker.ts\n• React hook: src/hooks/usePoker.ts\n• UI component: src/components/poker/PokerTable.tsx\n• State stored in rooms.game_state as JSON\n• Real-time sync via Supabase Realtime subscriptions\n• Chip tracking, pot calculation, and side pot management handled server-side in game_state",
      },
      {
        title: "6. Rules & Edge Cases",
        content:
          "• Side pots created automatically when a player goes all-in with fewer chips\n• Players with 0 chips are eliminated\n• Dealer button rotates clockwise each round\n• Minimum raise equals the previous raise amount\n• The game ends when one player has all chips",
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
          "Sequence is a strategy board-and-card game played on a 10×10 grid. Players play cards from their hand to place chips on matching board spaces. The goal is to form rows of 5 chips (a Sequence). Supports 2–12 players in individual or team configurations.",
      },
      {
        title: "2. Board Layout",
        content:
          "The 10×10 board contains 96 card spaces (each standard card appears twice) and 4 corner free spaces. Free spaces count as a chip for all players. The board layout is defined in src/lib/sequenceBoard.ts.",
      },
      {
        title: "3. Turn Flow",
        content:
          "1. Player selects a card from their hand\n2. Player places a chip on a matching board space\n3. Card is discarded, a new card is drawn\n4. Turn passes to the next player\n\nSpecial: If a card is 'dead' (both matching spaces occupied), the player reveals it, discards, and draws a replacement.",
      },
      {
        title: "4. Special Cards — Jacks",
        content:
          "• Two-Eyed Jacks (♦ and ♣): Wild cards — place a chip on any empty space\n• One-Eyed Jacks (♥ and ♠): Anti-wild — remove any opponent's chip (not part of a completed Sequence)",
      },
      {
        title: "5. Winning Conditions",
        content:
          "• 2–3 players: First to complete 2 Sequences wins\n• Team games: First team to complete 2 Sequences wins\n• A Sequence is 5 chips in a row (horizontal, vertical, or diagonal)\n• Corner free spaces count toward any player's Sequence",
      },
      {
        title: "6. Technical Implementation",
        content:
          "• Board definition: src/lib/sequenceBoard.ts\n• Game logic: src/lib/sequence.ts\n• React hook: src/hooks/useSequence.ts\n• UI component: src/components/sequence/SequenceTable.tsx\n• Result overlay: src/components/sequence/SequenceResultOverlay.tsx\n• Team assignment managed in game_state JSON",
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
          "Ban Luck is a multiplayer blackjack variant supporting 1–7 players. One player acts as the dealer. Players bet and try to beat the dealer by getting a hand value as close to 21 as possible without busting. Features include custom bets, special hands, dealer reveal controls, and a live leaderboard.",
      },
      {
        title: "2. Card Values",
        content:
          "• Number cards (2–10): Face value\n• Face cards (J, Q, K): 10\n• Ace: 1 or 11 (automatically optimized)",
      },
      {
        title: "3. Game Flow",
        content:
          "1. Betting phase: All players place bets\n2. Deal: Each player and dealer receives 2 cards (dealer's cards face-down)\n3. Player turns: Each player chooses to Draw (hit) or Done (stand)\n4. Dealer reveal: Dealer reveals players' hands one by one\n5. Dealer turn: Dealer draws or stands\n6. Settlement: Payouts calculated and distributed\n7. Next round or end",
      },
      {
        title: "4. Special Hands & Payouts",
        content:
          "• Ban Luck (Ace + 10-value card): Pays 2:1\n• Ban Ban (Double Aces): Pays 3:1\n• Triple Sevens (7-7-7): Pays 3:1\n• Five Card Charlie (5 cards, ≤21): Pays 2:1\n• Regular Win: Pays 1:1\n• Push (tie): Bet returned\n• Bust (>21): Lose bet",
      },
      {
        title: "5. Dealer Mechanics",
        content:
          "• Dealer has reveal controls to expose each player's hand\n• Dealer can reveal all hands at once\n• If dealer gets a special hand (Ban Luck, Ban Ban), they can immediately stand\n• Dealer is rotated or transferred via host controls",
      },
      {
        title: "6. Technical Implementation",
        content:
          "• Game logic: src/lib/blackjack.ts\n• React hook: src/hooks/useBlackjack.ts\n• UI components: src/components/blackjack/ (BlackjackTable, PlayingCard, HandDisplay, DealingAnimation, RoundResultOverlay, DebugPanel, LeaderboardButton)\n• Leaderboard persisted across rounds in game_state\n• State filtering ensures players only see their own cards until revealed",
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
          "Dai Di (Big 2) is a classic 4-player shedding card game. All 52 cards are dealt evenly (13 per player). The player with the 3 of Diamonds starts. Players take turns playing valid combinations that beat the previous play. The first player to shed all cards wins the round.",
      },
      {
        title: "2. Card Ranking",
        content:
          "• Rank order: 3 < 4 < 5 < 6 < 7 < 8 < 9 < 10 < J < Q < K < A < 2\n• Suit order: ♦ (Diamonds) < ♣ (Clubs) < ♥ (Hearts) < ♠ (Spades)\n• The 2 of Spades is the highest single card in the game",
      },
      {
        title: "3. Valid Combinations",
        content:
          "• Singles: One card\n• Pairs: Two cards of the same rank\n• Five-card hands (ranked lowest to highest):\n  - Straight (five consecutive ranks)\n  - Flush (five cards of the same suit)\n  - Full House (three of a kind + pair)\n  - Four of a Kind (+ any kicker)\n  - Straight Flush (consecutive + same suit)\n• Optional house rule: Triples (three of a kind)",
      },
      {
        title: "4. Turn Flow",
        content:
          "1. Active player must play a valid combination that beats the current play (same type, higher rank)\n2. If unable or unwilling to play, the player passes\n3. If all other players pass, the last player who played starts a new trick (any combination)\n4. Play continues until one player sheds all cards",
      },
      {
        title: "5. Scoring",
        content:
          "• Each remaining card in a loser's hand = 1 penalty point\n• Optional multipliers:\n  - 10+ cards remaining: ×2 penalty\n  - 13 cards remaining (never played): ×3 penalty\n  - +2 per 2 (twos) still held\n• The round winner earns the sum of all other players' penalties",
      },
      {
        title: "6. Technical Implementation",
        content:
          "• Game logic: src/lib/daiDi.ts\n• React hook: src/hooks/useDaiDi.ts\n• UI component: src/components/dai-di/DaiDiTable.tsx\n• Fixed 4-player game with automatic card distribution\n• State stored in rooms.game_state JSON",
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
          "Asshole Dai Di is a shedding card game for 3–7 players combining Dai Di card mechanics with the Asshole/President ranking system. Players shed cards using valid combinations. Finishing order determines ranks (President, Vice President, … Asshole). Ranks carry into the next round via mandatory card swaps.",
      },
      {
        title: "2. Card Ranking",
        content:
          "• Rank order: 3 < 4 < 5 < 6 < 7 < 8 < 9 < 10 < J < Q < K < A < 2\n• Suit order: ♦ (Diamonds) < ♣ (Clubs) < ♥ (Hearts) < ♠ (Spades)\n• The 2 of Spades is the highest single card",
      },
      {
        title: "3. Valid Combinations",
        content:
          "• Singles: One card\n• Pairs: Two cards of same rank\n• Triples: Three cards of same rank\n• Five-card hands: Straight, Flush, Full House, Four of a Kind (+kicker), Straight Flush\n• Must match the current combination type and beat it in rank",
      },
      {
        title: "4. Ranking System",
        content:
          "After each round, players are ranked by finish order:\n• 1st out: President\n• 2nd out: Vice President\n• … (middle ranks)\n• 2nd to last: Vice Asshole\n• Last out: Asshole\n\nRanks persist and affect the next round's card swap phase.",
      },
      {
        title: "5. Card Swap Phase",
        content:
          "Before each new round (after the first):\n• The Asshole must give their 2 best cards to the President\n• The President gives back any 2 cards of their choice\n• Vice Asshole gives 1 best card to Vice President, who returns 1 card\n• This creates strategic advantage for higher-ranked players",
      },
      {
        title: "6. Scoring",
        content:
          "• The President earns points equal to the total cards remaining in all other players' hands when they finished\n• Cumulative scoring across rounds\n• Highest total score at session end wins",
      },
      {
        title: "7. Technical Implementation",
        content:
          "• Game logic: src/lib/assholeDaiDi.ts\n• React hook: src/hooks/useAssholeDaiDi.ts\n• UI component: src/components/asshole-daidi/AssholeDaiDiTable.tsx\n• Supports 3–7 players with dynamic card distribution\n• Ranking and swap logic embedded in game_state transitions",
      },
    ],
  },
];

export const allPRDs = [websitePRD, ...gamePRDs];
