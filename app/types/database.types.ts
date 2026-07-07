// ============================================================
// GOLF LEAGUE APP — SUPABASE DATABASE TYPES
// ============================================================
// Generated from: migration.sql
// Place this file at: shared/types/database.types.ts
//
// Once your Supabase project is running you can keep this in
// sync automatically with:
//   supabase gen types --lang=typescript --project-id <id> \
//     > shared/types/database.types.ts
// ============================================================

// ------------------------------------------------------------
// ENUMS
// ------------------------------------------------------------

export type TeeType = 'mens' | 'ladies' | 'senior' | 'mixed'

export type EventStatus =
  | 'scheduled'  // not yet started
  | 'live'       // in progress
  | 'complete'   // finalized, handicaps recalculated
  | 'practice'   // does not count toward handicap
  | 'handicap'   // handicap round only
  | 'rain'       // rained out
  | 'cancelled'  // event cancelled

export type RsvpStatus = 'not_responded' | 'in' | 'out'


// ------------------------------------------------------------
// DATABASE ROOT TYPE
// Used by createClient<Database>() from @supabase/supabase-js
// ------------------------------------------------------------

export type Database = {
  public: {
    Tables: {
      courses:                  CoursesTable
      course_default_tees:      CourseDefaultTeesTable
      tees:                     TeesTable
      players:                  PlayersTable
      player_identities:        PlayerIdentitiesTable
      leagues:                  LeaguesTable
      league_players:           LeaguePlayersTable
      league_yearly_games:      LeagueYearlyGamesTable
      game_types:               GameTypesTable
      yearly_game_types:        YearlyGameTypesTable
      events:                   EventsTable
      event_games:              EventGamesTable
      event_rsvps:              EventRsvpsTable
      scores:                   ScoresTable
      player_league_handicaps:  PlayerLeagueHandicapsTable
      player_league_audit:      PlayerLeagueAuditTable
      push_subscriptions:       PushSubscriptionsTable
    }
    Views: {
      score_totals: ScoreTotalsView
      tee_totals:   TeeTotalsView
    }
    Functions: {
      auth_player_id: {
        Args: Record<never, never>
        Returns: string
      }
      is_league_admin: {
        Args: { p_league_id: string }
        Returns: boolean
      }
      is_league_member: {
        Args: { p_league_id: string }
        Returns: boolean
      }
      is_public_event: {
        Args: { p_event_id: string }
        Returns: boolean
      }
      validate_hole_numbers: {
        Args: { holes: number[] }
        Returns: boolean
      }
    }
    Enums: {
      tee_type_enum:          TeeType
      event_status_enum:      EventStatus
      rsvp_status_enum:       RsvpStatus
    }
  }
}


// ============================================================
// TABLE TYPES
// Each table has three shapes:
//   Row    — what SELECT returns (all columns, DB defaults applied)
//   Insert — what you pass to INSERT (required fields only, rest optional)
//   Update — what you pass to UPDATE (all fields optional)
// ============================================================


// ------------------------------------------------------------
// COURSES
// ------------------------------------------------------------

type CoursesTable = {
  Row: {
    id:         string
    name:       string
    active:     boolean
    created_at: string
    updated_at: string
    firebase_id:       string | null
  }
  Insert: {
    id?:        string
    name:       string
    active?:    boolean
    created_at?: string
    updated_at?: string
    firebase_id?:       string | null
  }
  Update: {
    id?:        string
    name?:      string
    active?:    boolean
    updated_at?: string
    firebase_id?:       string | null
  }
  Relationships: []
}


// ------------------------------------------------------------
// COURSE DEFAULT TEES
// ------------------------------------------------------------

type CourseDefaultTeesTable = {
  Row: {
    course_id: string
    tee_type:  TeeType
    tees_id:   string
  }
  Insert: {
    course_id: string
    tee_type:  TeeType
    tees_id:   string
  }
  Update: {
    course_id?: string
    tee_type?:  TeeType
    tees_id?:   string
  }
  Relationships: []
}


// ------------------------------------------------------------
// TEES
// ------------------------------------------------------------

type TeesTable = {
  Row: {
    id:         string
    course_id:  string
    name:       string
    rating:     number
    slope:      number
    pars:       number[]   // 18 elements, index 0 = hole 1
    hnds:       number[]   // 18 elements, stroke index per hole
    tee_types:  TeeType[]
    active:     boolean
    created_at: string
    updated_at: string
    firebase_id:       string | null
  }
  Insert: {
    id?:        string
    course_id:  string
    name:       string
    rating:     number
    slope:      number
    pars:       number[]
    hnds:       number[]
    tee_types?: TeeType[]
    active?:    boolean
    created_at?: string
    updated_at?: string
    firebase_id?:       string | null
  }
  Update: {
    id?:        string
    course_id?: string
    name?:      string
    rating?:    number
    slope?:     number
    pars?:      number[]
    hnds?:      number[]
    tee_types?: TeeType[]
    active?:    boolean
    updated_at?: string
    firebase_id?:       string | null
  }
  Relationships: []
}


// ------------------------------------------------------------
// PLAYERS
// ------------------------------------------------------------

type PlayersTable = {
  Row: {
    id:           string
    auth_user_id: string | null
    fname:        string
    lname:        string
    phone:        string | null
    email:        string | null
    ghin:         number | null
    tee_type:     TeeType
    tees_id:      string
    active:       boolean
    created_at:   string
    updated_at:   string
    is_super_admin: boolean
    firebase_id:  string | null
  }
  Insert: {
    id?:           string
    auth_user_id?: string | null
    fname:         string
    lname:         string
    phone?:        string | null
    email?:        string | null
    ghin?:         number | null
    tee_type:      TeeType
    tees_id:       string
    active?:       boolean
    created_at?:   string
    updated_at?:   string
    is_super_admin?: boolean
    firebase_id?:  string | null
  }
  Update: {
    id?:           string
    auth_user_id?: string | null
    fname?:        string
    lname?:        string
    phone?:        string
    email?:        string | null
    ghin?:         number | null
    tee_type?:     TeeType
    tees_id?:      string
    active?:       boolean
    updated_at?:   string
    is_super_admin?: boolean
    firebase_id?:  string | null
  }
  Relationships: []
}


// ------------------------------------------------------------
// PLAYER IDENTITIES
// ------------------------------------------------------------

type PlayerIdentitiesTable = {
  Row: {
    id:         string
    player_id:  string
    provider:   string
    uid:        string
    created_at: string
  }
  Insert: {
    id?:        string
    player_id:  string
    provider:   string
    uid:        string
    created_at?: string
  }
  Update: {
    id?:        string
    player_id?: string
    provider?:  string
    uid?:       string
  }
  Relationships: []
}


// ------------------------------------------------------------
// LEAGUES
// ------------------------------------------------------------

type LeaguesTable = {
  Row: {
    id:                string
    name:              string
    short_name:        string
    app_handicap:      boolean
    tee_type:          TeeType
    course_id:         string
    tees_id:           string
    theme_start_color: string
    theme_end_color:   string
    can_rsvp:          boolean
    active:            boolean
    created_at:        string
    updated_at:        string
    holes:             number
    per:               number
    firebase_id:       string | null
  }
  Insert: {
    id?:               string
    name:              string
    short_name:        string
    app_handicap?:     boolean
    tee_type:          TeeType
    course_id:         string
    tees_id:           string
    theme_start_color?: string
    theme_end_color?:   string
    can_rsvp?:         boolean
    active?:           boolean
    created_at?:       string
    updated_at?:       string
    holes?:            number
    per?:              number
    firebase_id?:      string | null
  }
  Update: {
    id?:               string
    name?:             string
    short_name?:       string
    app_handicap?:     boolean
    tee_type?:         TeeType
    course_id?:        string
    tees_id?:          string
    theme_start_color?: string
    theme_end_color?:   string
    can_rsvp?:         boolean
    active?:           boolean
    updated_at?:       string
    holes?:            number
    per?:              number
    firebase_id?:      string | null
  }
  Relationships: []
}


// ------------------------------------------------------------
// LEAGUE PLAYERS
// is_admin:  can manage the league
// is_player: actively plays in the league
// Both can be true (player-admin), or is_admin only (super admin
// managing a league they don't play in)
// ------------------------------------------------------------

type LeaguePlayersTable = {
  Row: {
    id:        string
    league_id: string
    player_id: string
    is_admin:  boolean
    is_player: boolean
    active:    boolean
    joined_at: string
  }
  Insert: {
    id?:        string
    league_id:  string
    player_id:  string
    is_admin?:  boolean
    is_player?: boolean
    active?:    boolean
    joined_at?: string
  }
  Update: {
    id?:        string
    league_id?: string
    player_id?: string
    is_admin?:  boolean
    is_player?: boolean
    active?:    boolean
    joined_at?: string
  }
  Relationships: []
}


// ------------------------------------------------------------
// LEAGUE YEARLY GAMES
// ------------------------------------------------------------

type LeagueYearlyGamesTable = {
  Row: {
    league_id:           string
    yearly_game_type_id: number
  }
  Insert: {
    league_id:           string
    yearly_game_type_id: number
  }
  Update: {
    league_id?:           string
    yearly_game_type_id?: number
  }
  Relationships: []
}


// ------------------------------------------------------------
// GAME TYPES (weekly)
// ------------------------------------------------------------

type GameTypesTable = {
  Row: {
    id:          number
    name:        string
    description: string | null
  }
  Insert: {
    id?:         number
    name:        string
    description?: string | null
  }
  Update: {
    id?:         number
    name?:       string
    description?: string | null
  }
  Relationships: []
}


// ------------------------------------------------------------
// YEARLY GAME TYPES
// ------------------------------------------------------------

type YearlyGameTypesTable = {
  Row: {
    id:          number
    name:        string
    description: string | null
  }
  Insert: {
    id?:         number
    name:        string
    description?: string | null
  }
  Update: {
    id?:         number
    name?:       string
    description?: string | null
  }
  Relationships: []
}


// ------------------------------------------------------------
// EVENTS
// ------------------------------------------------------------

type BbbPairingJson = {
  label:  string
  score:  number
  ids:    string
  p1_id:  string
  p2_id:  string
}

type EventsTable = {
  Row: {
    id:                  string
    league_id:           string
    course_id:           string
    tees_id:             string | null  // null for mixed tee leagues
    event_date:          string   // ISO date string 'YYYY-MM-DD'
    status:              EventStatus
    holes:               number
    per:                 number
    money:               number
    double_birdie_holes: number[] | null
    bbb_pairings:        BbbPairingJson[] | null
    created_at:          string
    updated_at:          string
  }
  Insert: {
    id?:                  string
    league_id:            string
    course_id:            string
    tees_id?:             string | null
    event_date:           string
    status?:              EventStatus
    holes?:               number
    per?:                 number
    money?:               number
    double_birdie_holes?: number[] | null
    bbb_pairings?:        BbbPairingJson[] | null
    created_at?:          string
    updated_at?:          string
  }
  Update: {
    id?:                  string
    league_id?:           string
    course_id?:           string
    tees_id?:             string
    event_date?:          string
    status?:              EventStatus
    holes?:               number
    per?:                 number
    money?:               number
    double_birdie_holes?: number[] | null
    bbb_pairings?:        BbbPairingJson[] | null
    updated_at?:          string
  }
  Relationships: []
}


// ------------------------------------------------------------
// EVENT GAMES
// ------------------------------------------------------------

type EventGamesTable = {
  Row: {
    event_id:     string
    game_type_id: number
  }
  Insert: {
    event_id:     string
    game_type_id: number
  }
  Update: {
    event_id?:     string
    game_type_id?: number
  }
  Relationships: []
}


// ------------------------------------------------------------
// EVENT RSVPS
// ------------------------------------------------------------

type EventRsvpsTable = {
  Row: {
    id:         string
    event_id:   string
    player_id:  string
    status:     RsvpStatus
    created_at: string
    updated_at: string
  }
  Insert: {
    id?:        string
    event_id:   string
    player_id:  string
    status?:    RsvpStatus
    created_at?: string
    updated_at?: string
  }
  Update: {
    id?:        string
    event_id?:  string
    player_id?: string
    status?:    RsvpStatus
    updated_at?: string
  }
  Relationships: []
}


// ------------------------------------------------------------
// SCORES
// ------------------------------------------------------------

type ScoresTable = {
  Row: {
    id:               string
    event_id:         string
    league_id:        string
    course_id:        string
    tees_id:          string
    player_id:        string
    entered_by:       string
    ghin_index:       number | null   // player's GHIN at time of round, nullable
    playing_handicap: number          // actual handicap applied to this round
    hole_1:           number | null
    hole_2:           number | null
    hole_3:           number | null
    hole_4:           number | null
    hole_5:           number | null
    hole_6:           number | null
    hole_7:           number | null
    hole_8:           number | null
    hole_9:           number | null
    hole_10:          number | null
    hole_11:          number | null
    hole_12:          number | null
    hole_13:          number | null
    hole_14:          number | null
    hole_15:          number | null
    hole_16:          number | null
    hole_17:          number | null
    hole_18:          number | null
    created_at:       string
    updated_at:       string
  }
  Insert: {
    id?:               string
    event_id:          string
    league_id:         string
    course_id:         string
    tees_id:           string
    player_id:         string
    entered_by:        string
    ghin_index?:       number | null
    playing_handicap:  number
    hole_1?:           number | null
    hole_2?:           number | null
    hole_3?:           number | null
    hole_4?:           number | null
    hole_5?:           number | null
    hole_6?:           number | null
    hole_7?:           number | null
    hole_8?:           number | null
    hole_9?:           number | null
    hole_10?:          number | null
    hole_11?:          number | null
    hole_12?:          number | null
    hole_13?:          number | null
    hole_14?:          number | null
    hole_15?:          number | null
    hole_16?:          number | null
    hole_17?:          number | null
    hole_18?:          number | null
    created_at?:       string
    updated_at?:       string
  }
  Update: {
    id?:               string
    event_id?:         string
    league_id?:        string
    course_id?:        string
    tees_id?:          string
    player_id?:        string
    entered_by?:       string
    ghin_index?:       number | null
    playing_handicap?: number
    hole_1?:           number | null
    hole_2?:           number | null
    hole_3?:           number | null
    hole_4?:           number | null
    hole_5?:           number | null
    hole_6?:           number | null
    hole_7?:           number | null
    hole_8?:           number | null
    hole_9?:           number | null
    hole_10?:          number | null
    hole_11?:          number | null
    hole_12?:          number | null
    hole_13?:          number | null
    hole_14?:          number | null
    hole_15?:          number | null
    hole_16?:          number | null
    hole_17?:          number | null
    hole_18?:          number | null
    updated_at?:       string
  }
  Relationships: []
}


// ------------------------------------------------------------
// PLAYER LEAGUE HANDICAPS
// ------------------------------------------------------------

type PlayerLeagueHandicapsTable = {
  Row: {
    id:              string
    player_id:       string
    league_id:       string
    handicap_value:  number
    calculated_at:   string
  }
  Insert: {
    id?:             string
    player_id:       string
    league_id:       string
    handicap_value:  number
    calculated_at?:  string
  }
  Update: {
    id?:             string
    player_id?:      string
    league_id?:      string
    handicap_value?: number
    calculated_at?:  string
  }
  Relationships: []
}


// ------------------------------------------------------------
// PLAYER LEAGUE AUDIT
// ------------------------------------------------------------

type PlayerLeagueAuditTable = {
  Row: {
    id:             string
    player_id:      string
    league_id:      string
    score_id:       string | null
    event_date:     string        // ISO date string 'YYYY-MM-DD'
    raw_gross:      number | null
    adjusted_gross: number | null
    course_rating:  number
    slope_rating:   number
    differential:   number
    is_padding:     boolean
    is_best:        boolean
    round_position: number        // 1–10, 1 = most recent
    created_at:     string
  }
  Insert: {
    id?:             string
    player_id:       string
    league_id:       string
    score_id?:       string | null
    event_date:      string
    raw_gross?:      number | null
    adjusted_gross?: number | null
    course_rating:   number
    slope_rating:    number
    differential:    number
    is_padding?:     boolean
    is_best?:        boolean
    round_position:  number
    created_at?:     string
  }
  Update: {
    id?:             string
    player_id?:      string
    league_id?:      string
    score_id?:       string | null
    event_date?:     string
    raw_gross?:      number | null
    adjusted_gross?: number | null
    course_rating?:  number
    slope_rating?:   number
    differential?:   number
    is_padding?:     boolean
    is_best?:        boolean
    round_position?: number
  }
  Relationships: []
}


// ------------------------------------------------------------
// PUSH SUBSCRIPTIONS
// ------------------------------------------------------------

type PushSubscriptionsTable = {
  Row: {
    id:         string
    player_id:  string
    endpoint:   string
    p256dh:     string
    auth:       string
    created_at: string
  }
  Insert: {
    id?:        string
    player_id:  string
    endpoint:   string
    p256dh:     string
    auth:       string
    created_at?: string
  }
  Update: {
    id?:        string
    player_id?: string
    endpoint?:  string
    p256dh?:    string
    auth?:      string
  }
  Relationships: []
}


// ============================================================
// VIEW TYPES
// ============================================================

type ScoreTotalsView = {
  Row: {
    score_id:         string
    player_id:        string
    event_id:         string
    ghin_index:       number | null
    playing_handicap: number
    gross_out:        number   // front 9 total
    gross_in:         number   // back 9 total
    gross_total:      number   // 18-hole total
  }
  Relationships: []
}

type TeeTotalsView = {
  Row: {
    tees_id:   string
    name:      string
    course_id: string
    rating:    number
    slope:     number
    par_out:   number   // front 9 par
    par_in:    number   // back 9 par
    par_total: number   // 18-hole par
  }
  Relationships: []
}


// ============================================================
// CONVENIENCE TYPES
// Row shapes extracted for use throughout the app
// ============================================================

export type Course               = Database['public']['Tables']['courses']['Row']
export type CourseInsert         = Database['public']['Tables']['courses']['Insert']
export type CourseUpdate         = Database['public']['Tables']['courses']['Update']

export type CourseDefaultTee     = Database['public']['Tables']['course_default_tees']['Row']

export type Tee                  = Database['public']['Tables']['tees']['Row']
export type TeeInsert            = Database['public']['Tables']['tees']['Insert']
export type TeeUpdate            = Database['public']['Tables']['tees']['Update']

export type Player               = Database['public']['Tables']['players']['Row']
export type PlayerInsert         = Database['public']['Tables']['players']['Insert']
export type PlayerUpdate         = Database['public']['Tables']['players']['Update']

export type PlayerIdentity       = Database['public']['Tables']['player_identities']['Row']
export type PlayerIdentityInsert = Database['public']['Tables']['player_identities']['Insert']

export type League               = Database['public']['Tables']['leagues']['Row']
export type LeagueInsert         = Database['public']['Tables']['leagues']['Insert']
export type LeagueUpdate         = Database['public']['Tables']['leagues']['Update']

export type LeaguePlayer         = Database['public']['Tables']['league_players']['Row']
export type LeaguePlayerInsert   = Database['public']['Tables']['league_players']['Insert']
export type LeaguePlayerUpdate   = Database['public']['Tables']['league_players']['Update']

export type LeagueYearlyGame     = Database['public']['Tables']['league_yearly_games']['Row']

export type GameType             = Database['public']['Tables']['game_types']['Row']
export type YearlyGameType       = Database['public']['Tables']['yearly_game_types']['Row']

export type Event                = Database['public']['Tables']['events']['Row']
export type EventInsert          = Database['public']['Tables']['events']['Insert']
export type EventUpdate          = Database['public']['Tables']['events']['Update']

export type EventGame            = Database['public']['Tables']['event_games']['Row']
export type EventRsvp            = Database['public']['Tables']['event_rsvps']['Row']
export type EventRsvpInsert      = Database['public']['Tables']['event_rsvps']['Insert']
export type EventRsvpUpdate      = Database['public']['Tables']['event_rsvps']['Update']

export type Score                = Database['public']['Tables']['scores']['Row']
export type ScoreInsert          = Database['public']['Tables']['scores']['Insert']
export type ScoreUpdate          = Database['public']['Tables']['scores']['Update']

export type PlayerLeagueHandicap       = Database['public']['Tables']['player_league_handicaps']['Row']
export type PlayerLeagueHandicapInsert = Database['public']['Tables']['player_league_handicaps']['Insert']

export type PlayerLeagueAudit          = Database['public']['Tables']['player_league_audit']['Row']
export type PlayerLeagueAuditInsert    = Database['public']['Tables']['player_league_audit']['Insert']
export type PlayerLeagueAuditUpdate    = Database['public']['Tables']['player_league_audit']['Update']

export type ScoreTotal           = Database['public']['Views']['score_totals']['Row']
export type TeeTotal             = Database['public']['Views']['tee_totals']['Row']


// ============================================================
// JOINED / COMPOSITE TYPES
// Common query shapes that join multiple tables.
// Used as return types for composables and server routes.
// ============================================================

/** Player row with their home tee joined */
export type PlayerWithTee = Player & {
  tees: Tee
}

/** Event row with league, course, and tee joined */
export type EventWithRelations = Event & {
  leagues:  League
  courses:  Course
  tees:     Tee
  event_games: Array<EventGame & { game_types: GameType }>
}

/** Score row with player name fields joined — for leaderboard display */
export type ScoreWithPlayer = Score & {
  players: Pick<Player, 'fname' | 'lname' | 'tee_type'>
}

/**
 * Full leaderboard row — score totals joined with player and tee data.
 * Built from the score_totals view with additional joins.
 */
export type LeaderboardRow = ScoreTotal & {
  players:                 Pick<Player, 'id' | 'fname' | 'lname' | 'tee_type'>
  player_league_handicaps: Pick<PlayerLeagueHandicap, 'handicap_value'> | null
}

/** League player with full player details — for roster display */
export type LeagueRosterRow = LeaguePlayer & {
  players: Player
}

/** Convenience type for checking a player's league access level */
export type LeagueAccess = {
  is_admin:  boolean
  is_player: boolean
  active:    boolean
}

/** Player audit row — for handicap calculation display */
export type AuditWithLeague = PlayerLeagueAudit & {
  leagues: Pick<League, 'id' | 'name' | 'short_name' | 'app_handicap'>
}


// ============================================================
// HOLE UTILITIES
// ============================================================

/** Tuple of exactly 18 hole scores — used for typed score entry */
export type HoleScores = [
  number | null, number | null, number | null, number | null, number | null,
  number | null, number | null, number | null, number | null, number | null,
  number | null, number | null, number | null, number | null, number | null,
  number | null, number | null, number | null,
]

/** Map score row hole columns to an ordered array */
export function scoreToHoleArray(score: Score): HoleScores {
  return [
    score.hole_1,  score.hole_2,  score.hole_3,  score.hole_4,
    score.hole_5,  score.hole_6,  score.hole_7,  score.hole_8,
    score.hole_9,  score.hole_10, score.hole_11, score.hole_12,
    score.hole_13, score.hole_14, score.hole_15, score.hole_16,
    score.hole_17, score.hole_18,
  ]
}

/** Map an ordered array back to Score column names for insert/update */
export function holeArrayToScoreColumns(
  holes: HoleScores,
): Pick<
  ScoreInsert,
  | 'hole_1'  | 'hole_2'  | 'hole_3'  | 'hole_4'  | 'hole_5'  | 'hole_6'
  | 'hole_7'  | 'hole_8'  | 'hole_9'  | 'hole_10' | 'hole_11' | 'hole_12'
  | 'hole_13' | 'hole_14' | 'hole_15' | 'hole_16' | 'hole_17' | 'hole_18'
> {
  return {
    hole_1:  holes[0],  hole_2:  holes[1],  hole_3:  holes[2],
    hole_4:  holes[3],  hole_5:  holes[4],  hole_6:  holes[5],
    hole_7:  holes[6],  hole_8:  holes[7],  hole_9:  holes[8],
    hole_10: holes[9],  hole_11: holes[10], hole_12: holes[11],
    hole_13: holes[12], hole_14: holes[13], hole_15: holes[14],
    hole_16: holes[15], hole_17: holes[16], hole_18: holes[17],
  }
}
