// server/utils/gameLogic.ts
// Pure game calculation functions — no Nuxt/Supabase dependencies.

export interface TeeData {
  pars:   number[]
  hnds:   number[]
  rating: number
  slope:  number
}

export interface PlayerGames {
  scores:        (number | null)[]
  pops:          number[]
  net:           number[]
  totalNet:      number
  birds:         number[]
  totalBirds:    number
  deuces:        number[]
  totalDeuces:   number
  chicago:       number[]
  totalChicago:  number
  totalGross:    number
  holesPlayed:   number
}

export interface SkinWinner {
  hole:      number
  player_id: string
  player:    string
  score:     number
}

export interface BbbPairing {
  label:   string
  score:   number
  ids:     string
  p1_id:   string
  p2_id:   string
}

export interface LeaguePassResult {
  grossSkins:    SkinWinner[]
  netSkins:      SkinWinner[]
  deuces:        SkinWinner[]
  blindBestBall: BbbPairing[]
}

// ── Core calculations ─────────────────────────────────────────

export function calcPops(index: number, hnds: number[]): number[] {
  const rounded = Math.round(index)
  return hnds.map((hnd) => {
    const pop = Math.floor(rounded / 18) + (rounded % 18 >= hnd ? 1 : 0)
    return Math.max(0, pop)
  })
}

export function calcGames(
  scores:      (number | null)[],
  index:       number,
  teeData:     TeeData,
  pops:        number[],
  appHandicap: boolean,
  ddHoles:     number[] = [],
): PlayerGames {
  const { pars } = teeData

  const birds = scores.map((score, i) => {
    if (!score || score <= 0) return 0
    const dd  = ddHoles.includes(i + 1) ? 2 : 1
    const par = pars[i] as number
    const pop = pops[i] as number
    const b   = score > par
      ? ((par - (score - pop)) * 0.5) * dd
      : ((par - score) + (pop * 0.5)) * dd
    return Math.max(0, b)
  })
  const totalBirds = birds.reduce((s, v) => s + v, 0)

  const deuces = scores.map((score, i) => {
    if (!score || score <= 0) return 0
    return (score - (pops[i] > 0 ? 1 : 0) <= 2) ? 1 : 0
  })
  const totalDeuces = deuces.reduce((s, v) => s + v, 0)

  const net = scores.map((score, i) => {
    if (!score || score <= 0) return 0
    return appHandicap
      ? score - pars[i] - index / 18
      : score - pars[i] - pops[i]
  })
  const totalNet = net.reduce((s, v) => s + v, 0)

  // Chicago / Modified Chicago: bogey=1, par=2, birdie=4, eagle=8, albatross=16
  const chicago = net.map((n, i) => {
    if (!scores[i] || scores[i]! <= 0) return 0
    const d = appHandicap ? Math.round(n) : n  // net vs par (already computed above)
    if (d <= -3) return 16
    if (d === -2) return 8
    if (d === -1) return 4
    if (d === 0)  return 2
    if (d === 1)  return 1
    return 0
  })
  const totalChicago = chicago.reduce((s, v) => s + v, 0)

  const totalGross  = scores.reduce((a, b) => a + (Number(b) || 0), 0)
  const holesPlayed = scores.filter((n) => n && n > 0).length

  return { scores, pops, net, totalNet, birds, totalBirds, deuces, totalDeuces, chicago, totalChicago, totalGross, holesPlayed }
}

// ── Cross-player game results ─────────────────────────────────

interface PlayerForPass {
  id:    string
  name:  string
  games: PlayerGames
  tee_type?: string
}

function seededHash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return h
}

export function runLeaguePass(
  players:    PlayerForPass[],
  totalHoles: number,
  gameNames:  string[],
  eventDate:  string,
): LeaguePassResult {
  const result: LeaguePassResult = {
    grossSkins:    [],
    netSkins:      [],
    deuces:        [],
    blindBestBall: [],
  }

  const n = players.length
  if (n === 0) return result

  // Hole-by-hole games
  for (let i = 0; i < totalHoles; i++) {
    const holeNum = i + 1

    const holeScores = players.map((p) => ({
      id:    p.id,
      name:  p.name,
      gross: Number(p.games.scores[i]) || 0,
      net:   p.games.net[i] ?? 99,
      pops:  p.games.pops[i] ?? 0,
    })).filter((s) => s.gross > 0)

    // Deuce Pot: gross 2 only — counts whenever any player makes one, no full-field requirement
    if (gameNames.includes('Deuce Pot')) {
      for (const s of holeScores) {
        if (s.gross === 2)
          result.deuces.push({ hole: holeNum, player_id: s.id, player: s.name, score: 2 })
      }
    }

    if (holeScores.length < n) continue  // skins require every player to have scored

    if (gameNames.includes('Gross Skins')) {
      const min = Math.min(...holeScores.map((s) => s.gross))
      const winners = holeScores.filter((s) => s.gross === min)
      if (winners.length === 1)
        result.grossSkins.push({ hole: holeNum, player_id: winners[0].id, player: winners[0].name, score: winners[0].gross })
    }

    if (gameNames.includes('Net Skins')) {
      const min = Math.min(...holeScores.map((s) => s.net))
      const winners = holeScores.filter((s) => s.net === min)
      if (winners.length === 1)
        // score = actual net strokes (gross − pops), not score-to-par
        result.netSkins.push({ hole: holeNum, player_id: winners[0].id, player: winners[0].name, score: winners[0].gross - winners[0].pops })
    }
  }

  // Blind Best Ball
  if (n > 1 && gameNames.includes('Blind Best Ball')) {
    const men   = players.filter((p) => (p.tee_type ?? 'mens').toLowerCase() === 'mens')
    const women = players.filter((p) => (p.tee_type ?? '').toLowerCase() === 'ladies')

    const shuffle = (group: PlayerForPass[]) =>
      [...group].sort((a, b) => seededHash(a.id + eventDate) - seededHash(b.id + eventDate))

    const sm = shuffle(men)
    const sw = shuffle(women)
    const pairings: BbbPairing[] = []
    const leftovers: PlayerForPass[] = []
    const maxPairs = Math.max(sm.length, sw.length)

    for (let i = 0; i < maxPairs; i++) {
      const m = sm[i]
      const w = sw[i]
      if (m && w) {
        pairings.push(makePairing(m, w, totalHoles))
      } else {
        if (m) leftovers.push(m)
        if (w) leftovers.push(w)
      }
    }
    for (let i = 0; i + 1 < leftovers.length; i += 2) {
      pairings.push(makePairing(leftovers[i], leftovers[i + 1], totalHoles))
    }

    result.blindBestBall = pairings.sort((a, b) => a.score - b.score)
  }

  return result
}

function makePairing(p1: PlayerForPass, p2: PlayerForPass, totalHoles: number): BbbPairing {
  let score = 0
  for (let h = 0; h < totalHoles; h++) {
    const n1 = p1.games.net[h] ?? 99
    const n2 = p2.games.net[h] ?? 99
    const best = Math.min(n1, n2)
    if (best < 50) score += best
  }
  return {
    label:  `${p1.name} / ${p2.name}`,
    score,
    ids:    `${p1.id}|${p2.id}`,
    p1_id:  p1.id,
    p2_id:  p2.id,
  }
}
