import {
  SEQUENCE_BOARD,
  getBoardPositions,
  isCorner,
  isTwoEyedJack,
  isOneEyedJack,
  isJack,
} from "./sequenceBoard";

/* ── Types ──────────────────────────────────────────────── */

export type SeqTeam = "A" | "B" | "C";

export interface SeqChip {
  owner: string; // team name ("A"|"B"|"C") or playerId for individual
  partOfSequence: boolean;
}

export interface SeqSequenceData {
  positions: [number, number][];
  owner: string;
}

export interface SeqPlayer {
  playerId: string;
  name: string;
  hand: string[];
  team: SeqTeam | null;
}

export interface SeqGameState {
  board: (SeqChip | null)[][];
  players: SeqPlayer[];
  deck: string[];
  discardPile: string[];
  currentPlayerIndex: number;
  phase: "team_setup" | "playing" | "finished";
  isTeamGame: boolean;
  teamCount: number; // 2 or 3
  teams: { A: string[]; B: string[]; C: string[] };
  sequences: SeqSequenceData[];
  winner: string | null;
  lastMove: { row: number; col: number; type: "place" | "remove" } | null;
  message: string | null;
  houseRules: boolean;
  roundStartIndex: number;
}

/* ── Helpers ────────────────────────────────────────────── */

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function createSequenceDeck(houseRules: boolean): string[] {
  const ranks = houseRules
    ? ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]
    : ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const suits = ["S", "C", "D", "H"];
  const deck: string[] = [];
  for (let d = 0; d < 2; d++) {
    for (const suit of suits) {
      for (const rank of ranks) {
        deck.push(rank + suit);
      }
    }
  }
  // House rules: add 4 jokers (wild cards)
  if (houseRules) {
    deck.push("JKR1", "JKR2", "JKR3", "JKR4");
  }
  return shuffle(deck);
}

function handSize(playerCount: number): number {
  if (playerCount <= 2) return 7;
  if (playerCount <= 3) return 6;
  if (playerCount <= 6) return 5;
  if (playerCount <= 9) return 4;
  return 3;
}

function ownerOf(state: SeqGameState, playerId: string): string {
  const p = state.players.find((pl) => pl.playerId === playerId);
  if (!p) return playerId;
  return state.isTeamGame && p.team ? p.team : playerId;
}

/* ── Team count by player count ─────────────────────────── */

function getTeamCount(playerCount: number): number {
  // 3-team if divisible by 3, 2-team if divisible by 2
  if (playerCount % 3 === 0) return 3;
  if (playerCount % 2 === 0) return 2;
  return 2; // odd non-div-by-3: will be flagged as invalid
}

export function isValidPlayerCount(playerCount: number): boolean {
  return playerCount % 2 === 0 || playerCount % 3 === 0;
}

/* ── Init ───────────────────────────────────────────────── */

export function initSequenceGame(
  playerNames: { id: string; name: string }[],
  houseRules: boolean = false,
  roundStartIndex: number = 0
): SeqGameState {
  const n = playerNames.length;
  const teamCount = getTeamCount(n);
  const hs = handSize(n);
  const deck = createSequenceDeck(houseRules);

  const teams: { A: string[]; B: string[]; C: string[] } = { A: [], B: [], C: [] };
  const players: SeqPlayer[] = playerNames.map((p) => {
    const hand = deck.splice(0, hs);
    return { playerId: p.id, name: p.name, hand, team: null };
  });

  const board: (SeqChip | null)[][] = Array.from({ length: 10 }, () =>
    Array.from({ length: 10 }, () => null)
  );

  return {
    board,
    players,
    deck,
    discardPile: [],
    currentPlayerIndex: roundStartIndex % n,
    phase: "team_setup",
    isTeamGame: true,
    teamCount,
    teams,
    sequences: [],
    winner: null,
    lastMove: null,
    message: null,
    houseRules,
    roundStartIndex: roundStartIndex % n,
  };
}

/* ── Team setup ─────────────────────────────────────────── */

export function setTeam(state: SeqGameState, playerId: string, team: SeqTeam): SeqGameState {
  const s = structuredClone(state);
  const player = s.players.find((p) => p.playerId === playerId);
  if (!player) return s;
  // Remove from old team
  if (player.team) {
    s.teams[player.team] = s.teams[player.team].filter((id) => id !== playerId);
  }
  player.team = team;
  if (!s.teams[team].includes(playerId)) s.teams[team].push(playerId);
  return s;
}

export function teamsBalanced(state: SeqGameState): boolean {
  const { teamCount, teams, players } = state;
  const assigned = teams.A.length + teams.B.length + teams.C.length;
  if (assigned !== players.length) return false; // everyone must pick
  if (teamCount === 2) {
    // 2-team games use Blue (B) and Green (C)
    return teams.B.length === teams.C.length && teams.B.length > 0 && teams.A.length === 0;
  }
  // 3 teams: all must be equal
  return teams.A.length === teams.B.length && teams.B.length === teams.C.length && teams.A.length > 0;
}

export function startSequenceGame(state: SeqGameState): SeqGameState {
  const s = structuredClone(state);
  s.phase = "playing";

  // Reorder players so teams alternate turns
  const teamOrder: SeqTeam[] = s.teamCount >= 3 ? ["A", "B", "C"] : ["B", "C"];
  const buckets: Record<string, SeqPlayer[]> = {};
  for (const t of teamOrder) buckets[t] = [];
  for (const p of s.players) {
    if (p.team && buckets[p.team]) buckets[p.team].push(p);
  }

  const reordered: SeqPlayer[] = [];
  const maxPerTeam = Math.max(...teamOrder.map((t) => buckets[t].length));
  for (let i = 0; i < maxPerTeam; i++) {
    for (const t of teamOrder) {
      if (i < buckets[t].length) reordered.push(buckets[t][i]);
    }
  }

  s.players = reordered;
  s.currentPlayerIndex = s.roundStartIndex % s.players.length;
  return s;
}

/* ── House rules helpers ─────────────────────────────────── */

function isJoker(card: string): boolean {
  return card.startsWith("JKR");
}

/* ── Dead card check ────────────────────────────────────── */

export function isDeadCard(state: SeqGameState, card: string): boolean {
  if (isJack(card) || isJoker(card)) return false;
  const positions = getBoardPositions(card);
  return positions.every(([r, c]) => state.board[r][c] !== null);
}

/* ── Valid placements ───────────────────────────────────── */

export function getValidPlacements(
  state: SeqGameState,
  playerId: string,
  card: string
): [number, number][] {
  const owner = ownerOf(state, playerId);
  const hr = state.houseRules;

  // Jokers are wild (house rules only) — place on any empty non-corner
  if (isJoker(card)) {
    const valid: [number, number][] = [];
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        if (state.board[r][c] === null && !isCorner(r, c)) {
          valid.push([r, c]);
        }
      }
    }
    return valid;
  }

  // Standard rules: two-eyed jacks are wild
  if (!hr && isTwoEyedJack(card)) {
    const valid: [number, number][] = [];
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        if (state.board[r][c] === null && !isCorner(r, c)) {
          valid.push([r, c]);
        }
      }
    }
    return valid;
  }

  // Standard rules: one-eyed jacks remove (not from sequences)
  if (!hr && isOneEyedJack(card)) {
    const valid: [number, number][] = [];
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        const chip = state.board[r][c];
        if (chip && chip.owner !== owner && !chip.partOfSequence) {
          valid.push([r, c]);
        }
      }
    }
    return valid;
  }

  // House rules: ALL jacks are removal cards (can remove even from sequences)
  if (hr && isJack(card)) {
    const valid: [number, number][] = [];
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        const chip = state.board[r][c];
        if (chip && chip.owner !== owner) {
          valid.push([r, c]);
        }
      }
    }
    return valid;
  }

  // Normal card
  return getBoardPositions(card).filter(([r, c]) => state.board[r][c] === null);
}

/* ── Play card ──────────────────────────────────────────── */

export function playCard(
  state: SeqGameState,
  playerId: string,
  cardIndex: number,
  row: number,
  col: number
): SeqGameState {
  const s = structuredClone(state);
  if (s.phase !== "playing") return s;

  const player = s.players[s.currentPlayerIndex];
  if (!player || player.playerId !== playerId) return s;

  const card = player.hand[cardIndex];
  if (card === undefined) return s;

  const owner = ownerOf(s, playerId);
  const hr = s.houseRules;

  // Determine if this is a removal action
  const isRemoval = hr
    ? isJack(card)
    : isOneEyedJack(card);

  if (isRemoval) {
    const chip = s.board[row][col];
    if (!chip || chip.owner === owner) return s;
    // Standard rules: can't remove from sequence. House rules: can.
    if (!hr && chip.partOfSequence) return s;

    // If removing from a sequence (house rules), invalidate that sequence
    if (hr && chip.partOfSequence) {
      // Remove sequences that include this position
      s.sequences = s.sequences.filter((seq) => {
        const includes = seq.positions.some(([pr, pc]) => pr === row && pc === col);
        if (includes) {
          // Unmark partOfSequence for positions in this sequence (unless in another sequence)
          for (const [pr, pc] of seq.positions) {
            if (pr === row && pc === col) continue;
            const inOther = s.sequences.some(
              (other) => other !== seq && other.positions.some(([or, oc]) => or === pr && oc === pc)
            );
            if (!inOther && s.board[pr][pc]) {
              s.board[pr][pc]!.partOfSequence = false;
            }
          }
        }
        return !includes;
      });
    }

    s.board[row][col] = null;
    s.lastMove = { row, col, type: "remove" };
    s.message = `${player.name} removed a chip at ${SEQUENCE_BOARD[row][col]}`;
  } else {
    // Placement (normal card, joker, or two-eyed jack in standard rules)
    if (s.board[row][col] !== null && !isCorner(row, col)) return s;
    if (isCorner(row, col)) return s;
    s.board[row][col] = { owner, partOfSequence: false };
    s.lastMove = { row, col, type: "place" };
    s.message = null;

    detectNewSequences(s, owner);
  }

  // Discard & draw
  s.discardPile.push(card);
  player.hand.splice(cardIndex, 1);
  if (s.deck.length > 0) player.hand.push(s.deck.pop()!);

  // Win check: 3-team games need 1 sequence, 2-team games need 2
  const seqCount = s.sequences.filter((sq) => sq.owner === owner).length;
  const seqsToWin = s.teamCount >= 3 ? 1 : 2;
  if (seqCount >= seqsToWin) {
    s.phase = "finished";
    s.winner = owner;
    return s;
  }

  // Advance turn
  s.currentPlayerIndex = (s.currentPlayerIndex + 1) % s.players.length;
  return s;
}

/* ── Discard dead card ──────────────────────────────────── */

export function discardDeadCard(
  state: SeqGameState,
  playerId: string,
  cardIndex: number
): SeqGameState {
  const s = structuredClone(state);
  if (s.phase !== "playing") return s;

  const player = s.players[s.currentPlayerIndex];
  if (!player || player.playerId !== playerId) return s;

  const card = player.hand[cardIndex];
  if (card === undefined || !isDeadCard(s, card)) return s;

  s.discardPile.push(card);
  player.hand.splice(cardIndex, 1);
  if (s.deck.length > 0) player.hand.push(s.deck.pop()!);

  s.message = `${player.name} discarded dead card`;
  s.currentPlayerIndex = (s.currentPlayerIndex + 1) % s.players.length;
  return s;
}

/* ── Sequence detection ─────────────────────────────────── */

const DIRS: [number, number][] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

function detectNewSequences(state: SeqGameState, owner: string) {
  for (const [dr, dc] of DIRS) {
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        const endR = r + 4 * dr;
        const endC = c + 4 * dc;
        if (endR < 0 || endR >= 10 || endC < 0 || endC >= 10) continue;

        const positions: [number, number][] = [];
        let valid = true;

        for (let i = 0; i < 5; i++) {
          const nr = r + i * dr;
          const nc = c + i * dc;
          positions.push([nr, nc]);
          if (isCorner(nr, nc)) continue; // free space counts for everyone
          const chip = state.board[nr][nc];
          if (!chip || chip.owner !== owner) {
            valid = false;
            break;
          }
        }
        if (!valid) continue;

        // Check this sequence doesn't overlap more than 1 position with any existing same-owner sequence
        const posSet = new Set(positions.map(([pr, pc]) => `${pr},${pc}`));
        let tooMuchOverlap = false;
        for (const existing of state.sequences) {
          if (existing.owner !== owner) continue;
          const overlap = existing.positions.filter(([er, ec]) => posSet.has(`${er},${ec}`)).length;
          if (overlap > 1) {
            tooMuchOverlap = true;
            break;
          }
        }
        if (tooMuchOverlap) continue;

        // Check not already recorded
        const key = positions
          .map(([pr, pc]) => `${pr},${pc}`)
          .sort()
          .join("|");
        const exists = state.sequences.some(
          (sq) =>
            sq.positions
              .map(([pr, pc]) => `${pr},${pc}`)
              .sort()
              .join("|") === key
        );
        if (exists) continue;

        state.sequences.push({ positions, owner });
        for (const [pr, pc] of positions) {
          if (!isCorner(pr, pc) && state.board[pr][pc]) {
            state.board[pr][pc]!.partOfSequence = true;
          }
        }
      }
    }
  }
}

/* ── Visibility filter ──────────────────────────────────── */

export function filterSeqStateForPlayer(state: SeqGameState, viewerPlayerId: string): SeqGameState {
  const s = structuredClone(state);
  for (const p of s.players) {
    if (p.playerId === viewerPlayerId) continue;
    // Hide other players' hands — show count but not content
    p.hand = p.hand.map(() => "HIDDEN");
  }
  return s;
}

/* ── New round (rematch) ────────────────────────────────── */

export function newSequenceRound(state: SeqGameState): SeqGameState {
  const nextStart = (state.roundStartIndex + 1) % state.players.length;
  const fresh = initSequenceGame(
    state.players.map((p) => ({ id: p.playerId, name: p.name })),
    state.houseRules,
    nextStart
  );
  // Preserve teams from the previous round
  fresh.teams = structuredClone(state.teams);
  for (const p of fresh.players) {
    const prev = state.players.find((sp) => sp.playerId === p.playerId);
    if (prev?.team) p.team = prev.team;
  }
  return fresh;
}

/* ── Add player (when they join/rejoin) ───────────────────── */

export function addSeqPlayer(state: SeqGameState, playerId: string, name: string): SeqGameState {
  const s = structuredClone(state);
  // Already in game
  if (s.players.find((p) => p.playerId === playerId)) return s;
  const hs = handSize(s.players.length + 1);
  const hand = s.deck.splice(0, Math.min(hs, s.deck.length));
  s.players.push({ playerId, name, hand, team: null });
  // Update teamCount based on new player count
  s.teamCount = s.players.length % 3 === 0 ? 3 : 2;
  return s;
}

/* ── Sync players list with room players ─────────────────── */

export function syncSeqPlayers(
  state: SeqGameState,
  roomPlayers: { id: string; name: string }[]
): SeqGameState {
  let s = structuredClone(state);
  const roomIds = new Set(roomPlayers.map((p) => p.id));
  const stateIds = new Set(s.players.map((p) => p.playerId));

  // Add missing players
  for (const rp of roomPlayers) {
    if (!stateIds.has(rp.id)) {
      s = addSeqPlayer(s, rp.id, rp.name);
    }
  }

  // Remove players no longer in room
  for (const sp of [...s.players]) {
    if (!roomIds.has(sp.playerId)) {
      s = removeSeqPlayer(s, sp.playerId);
    }
  }

  // Normalize hand sizes during team_setup so everyone has the correct count
  if (s.phase === "team_setup" && s.players.length > 0) {
    const hs = handSize(s.players.length);
    for (const p of s.players) {
      // Return excess cards to deck
      while (p.hand.length > hs) {
        s.deck.push(p.hand.pop()!);
      }
      // Deal more cards if needed
      while (p.hand.length < hs && s.deck.length > 0) {
        p.hand.push(s.deck.pop()!);
      }
    }
  }

  return s;
}

/* ── Remove player (when they leave) ─────────────────────── */

export function removeSeqPlayer(state: SeqGameState, playerId: string): SeqGameState {
  const s = structuredClone(state);
  const playerIndex = s.players.findIndex((p) => p.playerId === playerId);
  if (playerIndex === -1) return s;

  const player = s.players[playerIndex];

  // Remove from team
  if (player.team) {
    s.teams[player.team] = s.teams[player.team].filter((id) => id !== playerId);
  }

  // Return cards to deck
  s.deck.push(...player.hand);

  // Remove player
  s.players.splice(playerIndex, 1);

  // Update teamCount
  if (s.players.length > 0) {
    s.teamCount = s.players.length % 3 === 0 ? 3 : 2;
  }

  // Fix currentPlayerIndex
  if (s.players.length === 0) {
    s.phase = "finished";
    return s;
  }
  if (s.currentPlayerIndex >= s.players.length) {
    s.currentPlayerIndex = 0;
  } else if (playerIndex < s.currentPlayerIndex) {
    s.currentPlayerIndex--;
  }

  return s;
}
