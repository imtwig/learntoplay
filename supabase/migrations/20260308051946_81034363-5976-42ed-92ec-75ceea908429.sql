
-- Create enum for game types
CREATE TYPE public.game_type AS ENUM ('poker', 'sequence', 'blackjack');

-- Create enum for room states
CREATE TYPE public.room_status AS ENUM ('waiting', 'in_progress', 'closed');

-- Rooms table
CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_type public.game_type NOT NULL,
  room_name TEXT NOT NULL,
  password_hash TEXT,
  status public.room_status NOT NULL DEFAULT 'waiting',
  host_player_id UUID,
  settings JSONB NOT NULL DEFAULT '{}',
  game_state JSONB NOT NULL DEFAULT '{}',
  max_players INT NOT NULL DEFAULT 9,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Players table (ephemeral, tied to room)
CREATE TABLE public.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE NOT NULL,
  display_name TEXT NOT NULL,
  session_id TEXT NOT NULL,
  is_host BOOLEAN NOT NULL DEFAULT false,
  join_order INT NOT NULL DEFAULT 0,
  player_state JSONB NOT NULL DEFAULT '{}',
  connected BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Update rooms host_player_id FK after players table exists
ALTER TABLE public.rooms ADD CONSTRAINT fk_host_player FOREIGN KEY (host_player_id) REFERENCES public.players(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

-- Rooms: anyone can read non-closed rooms, anyone can insert
CREATE POLICY "Anyone can view open rooms" ON public.rooms FOR SELECT USING (status != 'closed');
CREATE POLICY "Anyone can create rooms" ON public.rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update rooms" ON public.rooms FOR UPDATE USING (true);

-- Players: anyone can view players in a room, anyone can join
CREATE POLICY "Anyone can view players" ON public.players FOR SELECT USING (true);
CREATE POLICY "Anyone can join rooms" ON public.players FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update players" ON public.players FOR UPDATE USING (true);
CREATE POLICY "Anyone can leave rooms" ON public.players FOR DELETE USING (true);

-- Enable realtime for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
