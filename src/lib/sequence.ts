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
  // 2→2, 3→3, 4→2, 6→3, 8→2, 9→3, 10→2, 12→3
  if (playerCount === 3 || playerCount === 6 || playerCount === 9 || playerCount === 12) return 3;
  return 2;
}

/* ── Init ───────────────────────────────────────────────── */

export function initSequenceGame(
  playerNames: { id: string; name: string }[],
  houseRules: boolean = false
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
    currentPlayerIndex: 0,
    phase: "team_setup",
    isTeamGame: true,
    teamCount,
    teams,
    sequences: [],
    winner: null,
    lastMove: null,
    message: null,
    houseRules,
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
    return teams.A.length === teams.B.length && teams.A.length > 0;
  }
  // 3 teams: all must be equal
  return teams.A.length === teams.B.length && teams.B.length === teams.C.length && teams.A.length > 0;
}

export function startSequenceGame(state: SeqGameState): SeqGameState {
  const s = structuredClone(state);
  s.phase = "playing";
  return s;
}

/* ── Dead card check ────────────────────────────────────── */

export function isDeadCard(state: SeqGameState, card: string): boolean {
  if (isJack(card)) return false;
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

  if (isTwoEyedJack(card)) {
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

  if (isOneEyedJack(card)) {
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

  if (isOneEyedJack(card)) {
    const chip = s.board[row][col];
    if (!chip || chip.owner === owner || chip.partOfSequence) return s;
    s.board[row][col] = null;
    s.lastMove = { row, col, type: "remove" };
    s.message = `${player.name} removed a chip at ${SEQUENCE_BOARD[row][col]}`;
  } else {
    if (s.board[row][col] !== null && !isCorner(row, col)) return s;
    if (isCorner(row, col)) return s; // can't place on corner; corners are always free
    s.board[row][col] = { owner, partOfSequence: false };
    s.lastMove = { row, col, type: "place" };
    s.message = null;

    // Detect new sequences
    detectNewSequences(s, owner);
  }

  // Discard & draw
  s.discardPile.push(card);
  player.hand.splice(cardIndex, 1);
  if (s.deck.length > 0) player.hand.push(s.deck.pop()!);

  // Win check
  const seqCount = s.sequences.filter((sq) => sq.owner === owner).length;
  if (seqCount >= 2) {
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
  return initSequenceGame(
    state.players.map((p) => ({ id: p.playerId, name: p.name }))
  );
}
