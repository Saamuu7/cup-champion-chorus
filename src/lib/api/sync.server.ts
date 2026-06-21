import { supabaseAdmin } from "@/integrations/supabase/client.server";
import annexCData from "./annex_c.json";

// Cache/throttle memory
let lastSyncTime = 0;
const THROTTLE_MS = 10 * 60 * 1000; // 10 minutes

const ENGLISH_TO_SPANISH_TEAMS: Record<string, string> = {
  "Mexico": "México",
  "South Africa": "Sudáfrica",
  "South Korea": "Corea del Sur",
  "Korea Republic": "Corea del Sur",
  "Czech Republic": "República Checa",
  "Czechia": "República Checa",
  "Canada": "Canadá",
  "Bosnia and Herzegovina": "Bosnia y Herzegovina",
  "Bosnia-Herzegovina": "Bosnia y Herzegovina",
  "Uzbekistan": "Uzbekistán",
  "Colombia": "Colombia",
  "Qatar": "Catar",
  "United States": "Estados Unidos",
  "USA": "Estados Unidos",
  "Australia": "Australia",
  "Paraguay": "Paraguay",
  "Germany": "Alemania",
  "Ecuador": "Ecuador",
  "Curacao": "Curazao",
  "Curaçao": "Curazao",
  "Ivory Coast": "Costa de Marfil",
  "Côte d'Ivoire": "Costa de Marfil",
  "Cote d'Ivoire": "Costa de Marfil",
  "Tunisia": "Túnez",
  "Netherlands": "Países Bajos",
  "Japan": "Japón",
  "Sweden": "Suecia",
  "Brazil": "Brasil",
  "Morocco": "Marruecos",
  "Scotland": "Escocia",
  "Haiti": "Haití",
  "Belgium": "Bélgica",
  "Iran": "Irán",
  "Spain": "España",
  "Saudi Arabia": "Arabia Saudita",
  "Egypt": "Egipto",
  "Cape Verde": "Cabo Verde",
  "Cabo Verde": "Cabo Verde",
  "New Zealand": "Nueva Zelanda",
  "Uruguay": "Uruguay",
  "France": "Francia",
  "Senegal": "Senegal",
  "Iraq": "Irak",
  "Norway": "Noruega",
  "Argentina": "Argentina",
  "Austria": "Austria",
  "Algeria": "Algeria",
  "Jordan": "Jordania",
  "Portugal": "Portugal",
  "DR Congo": "RD del Congo",
  "Congo DR": "RD del Congo",
  "Panama": "Panamá",
  "England": "Inglaterra",
  "Croatia": "Croacia",
  "Ghana": "Ghana",
  "Switzerland": "Suiza",
  "Turkey": "Turquía",
  "Democratic Republic of the Congo": "RD del Congo"
};

function translateTeam(apiName: string): string {
  if (!apiName) return "";
  const normalized = apiName.trim();
  if (ENGLISH_TO_SPANISH_TEAMS[normalized]) {
    return ENGLISH_TO_SPANISH_TEAMS[normalized];
  }
  const lower = normalized.toLowerCase();
  for (const [eng, esp] of Object.entries(ENGLISH_TO_SPANISH_TEAMS)) {
    if (eng.toLowerCase() === lower) {
      return esp;
    }
  }
  return normalized;
}

const STADIUM_OFFSETS: Record<string, number> = {
  "1": 8,   // Mexico City (Mexico)
  "2": 8,   // Guadalajara (Mexico)
  "3": 8,   // Monterrey (Mexico)
  "4": 7,   // Dallas (US Central)
  "5": 7,   // Houston (US Central)
  "6": 7,   // Kansas City (US Central)
  "7": 6,   // Atlanta (US Eastern)
  "8": 6,   // Miami (US Eastern)
  "9": 6,   // Boston (US Eastern)
  "10": 6,  // Philadelphia (US Eastern)
  "11": 6,  // New York/NJ (US Eastern)
  "12": 6,  // Toronto (Canada Eastern)
  "13": 9,  // Vancouver (Canada Western/Pacific)
  "14": 9,  // Seattle (US Western/Pacific)
  "15": 9,  // San Francisco (US Western/Pacific)
  "16": 9   // Los Angeles (US Western/Pacific)
};

function getSpainIsoDate(localDateStr: string, stadiumId: string): string {
  const [datePart, timePart] = localDateStr.split(' ');
  const [month, day, year] = datePart.split('/').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  
  const offsetHours = STADIUM_OFFSETS[stadiumId] ?? 6;
  const utcYear = year;
  const utcMonth = month - 1;
  const utcDay = day;
  const utcHour = hour + offsetHours - 2; // Spain CEST is UTC+2
  
  const date = new Date(Date.UTC(utcYear, utcMonth, utcDay, utcHour, minute));
  const spainMs = date.getTime() + 2 * 60 * 60 * 1000;
  const spainDate = new Date(spainMs);
  
  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = spainDate.getUTCFullYear();
  const mm = pad(spainDate.getUTCMonth() + 1);
  const dd = pad(spainDate.getUTCDate());
  const hh = pad(spainDate.getUTCHours());
  const min = pad(spainDate.getUTCMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}:00+02:00`;
}

interface ApiGame {
  id: string;
  home_team_name_en?: string;
  away_team_name_en?: string;
  home_score?: string;
  away_score?: string;
  finished?: string;
  local_date?: string;
  stadium_id?: string;
}

interface KnockoutDef {
  homeSource: { type: 'group' | 'match', ref: string },
  awaySource: { type: 'group' | 'match', ref: string },
  placeholderHome: string,
  placeholderAway: string
}

const KNOCKOUT_DEFS: Record<string, KnockoutDef> = {
  "73": { homeSource: { type: 'group', ref: '2A' }, awaySource: { type: 'group', ref: '2B' }, placeholderHome: "2º Grupo A", placeholderAway: "2º Grupo B" },
  "74": { homeSource: { type: 'group', ref: '1E' }, awaySource: { type: 'group', ref: '3rd_1E' }, placeholderHome: "1º Grupo E", placeholderAway: "3º Grupo A/B/C/D/F" },
  "75": { homeSource: { type: 'group', ref: '1F' }, awaySource: { type: 'group', ref: '2C' }, placeholderHome: "1º Grupo F", placeholderAway: "2º Grupo C" },
  "76": { homeSource: { type: 'group', ref: '1C' }, awaySource: { type: 'group', ref: '2F' }, placeholderHome: "1º Grupo C", placeholderAway: "2º Grupo F" },
  "77": { homeSource: { type: 'group', ref: '1I' }, awaySource: { type: 'group', ref: '3rd_1I' }, placeholderHome: "1º Grupo I", placeholderAway: "3º Grupo C/D/F/G/H" },
  "78": { homeSource: { type: 'group', ref: '2E' }, awaySource: { type: 'group', ref: '2I' }, placeholderHome: "2º Grupo E", placeholderAway: "2º Grupo I" },
  "79": { homeSource: { type: 'group', ref: '1A' }, awaySource: { type: 'group', ref: '3rd_1A' }, placeholderHome: "1º Grupo A", placeholderAway: "3º Grupo C/E/F/H/I" },
  "80": { homeSource: { type: 'group', ref: '1L' }, awaySource: { type: 'group', ref: '3rd_1L' }, placeholderHome: "1º Grupo L", placeholderAway: "3º Grupo E/H/I/J/K" },
  "81": { homeSource: { type: 'group', ref: '1D' }, awaySource: { type: 'group', ref: '3rd_1D' }, placeholderHome: "1º Grupo D", placeholderAway: "3º Grupo B/E/F/I/J" },
  "82": { homeSource: { type: 'group', ref: '1G' }, awaySource: { type: 'group', ref: '3rd_1G' }, placeholderHome: "1º Grupo G", placeholderAway: "3º Grupo A/E/H/I/J" },
  "83": { homeSource: { type: 'group', ref: '2K' }, awaySource: { type: 'group', ref: '2L' }, placeholderHome: "2º Grupo K", placeholderAway: "2º Grupo L" },
  "84": { homeSource: { type: 'group', ref: '1H' }, awaySource: { type: 'group', ref: '2J' }, placeholderHome: "1º Grupo H", placeholderAway: "2º Grupo J" },
  "85": { homeSource: { type: 'group', ref: '1B' }, awaySource: { type: 'group', ref: '3rd_1B' }, placeholderHome: "1º Grupo B", placeholderAway: "3º Grupo E/F/G/I/J" },
  "86": { homeSource: { type: 'group', ref: '1J' }, awaySource: { type: 'group', ref: '2H' }, placeholderHome: "1º Grupo J", placeholderAway: "2º Grupo H" },
  "87": { homeSource: { type: 'group', ref: '1K' }, awaySource: { type: 'group', ref: '3rd_1K' }, placeholderHome: "1º Grupo K", placeholderAway: "3º Grupo D/E/I/J/L" },
  "88": { homeSource: { type: 'group', ref: '2D' }, awaySource: { type: 'group', ref: '2G' }, placeholderHome: "2º Grupo D", placeholderAway: "2º Grupo G" },
  
  "89": { homeSource: { type: 'match', ref: '73' }, awaySource: { type: 'match', ref: '74' }, placeholderHome: "Ganador Partido 73", placeholderAway: "Ganador Partido 74" },
  "90": { homeSource: { type: 'match', ref: '75' }, awaySource: { type: 'match', ref: '76' }, placeholderHome: "Ganador Partido 75", placeholderAway: "Ganador Partido 76" },
  "91": { homeSource: { type: 'match', ref: '77' }, awaySource: { type: 'match', ref: '78' }, placeholderHome: "Ganador Partido 77", placeholderAway: "Ganador Partido 78" },
  "92": { homeSource: { type: 'match', ref: '79' }, awaySource: { type: 'match', ref: '80' }, placeholderHome: "Ganador Partido 79", placeholderAway: "Ganador Partido 80" },
  "93": { homeSource: { type: 'match', ref: '83' }, awaySource: { type: 'match', ref: '84' }, placeholderHome: "Ganador Partido 83", placeholderAway: "Ganador Partido 84" },
  "94": { homeSource: { type: 'match', ref: '81' }, awaySource: { type: 'match', ref: '82' }, placeholderHome: "Ganador Partido 81", placeholderAway: "Ganador Partido 82" },
  "95": { homeSource: { type: 'match', ref: '86' }, awaySource: { type: 'match', ref: '88' }, placeholderHome: "Ganador Partido 86", placeholderAway: "Ganador Partido 88" },
  "96": { homeSource: { type: 'match', ref: '85' }, awaySource: { type: 'match', ref: '87' }, placeholderHome: "Ganador Partido 85", placeholderAway: "Ganador Partido 87" },
  
  "97": { homeSource: { type: 'match', ref: '89' }, awaySource: { type: 'match', ref: '90' }, placeholderHome: "Ganador Partido 89", placeholderAway: "Ganador Partido 90" },
  "98": { homeSource: { type: 'match', ref: '91' }, awaySource: { type: 'match', ref: '92' }, placeholderHome: "Ganador Partido 91", placeholderAway: "Ganador Partido 92" },
  "99": { homeSource: { type: 'match', ref: '93' }, awaySource: { type: 'match', ref: '94' }, placeholderHome: "Ganador Partido 93", placeholderAway: "Ganador Partido 94" },
  "100": { homeSource: { type: 'match', ref: '95' }, awaySource: { type: 'match', ref: '96' }, placeholderHome: "Ganador Partido 95", placeholderAway: "Ganador Partido 96" },
  
  "101": { homeSource: { type: 'match', ref: '97' }, awaySource: { type: 'match', ref: '98' }, placeholderHome: "Ganador Partido 97", placeholderAway: "Ganador Partido 98" },
  "102": { homeSource: { type: 'match', ref: '99' }, awaySource: { type: 'match', ref: '100' }, placeholderHome: "Ganador Partido 99", placeholderAway: "Ganador Partido 100" },
  
  "103": { homeSource: { type: 'match', ref: 'loser_101' }, awaySource: { type: 'match', ref: 'loser_102' }, placeholderHome: "Perdedor Partido 101", placeholderAway: "Perdedor Partido 102" },
  "104": { homeSource: { type: 'match', ref: '101' }, awaySource: { type: 'match', ref: '102' }, placeholderHome: "Ganador Partido 101", placeholderAway: "Ganador Partido 102" }
};

function buildFlagMap(dbMatches: any[]): Record<string, string> {
  const flags: Record<string, string> = {};
  dbMatches.forEach(m => {
    if (m.home_team && m.home_flag && m.home_flag !== '❓') {
      flags[m.home_team.toLowerCase()] = m.home_flag;
    }
    if (m.away_team && m.away_flag && m.away_flag !== '❓') {
      flags[m.away_team.toLowerCase()] = m.away_flag;
    }
  });
  flags['por determinar'] = '❓';
  return flags;
}

export async function initializeApiIdsAndKnockouts(dbMatches: any[], apiGames: ApiGame[]) {
  const updates: any[] = [];
  const inserts: any[] = [];
  
  // 1. Assign api_id to existing 72 group stage matches if missing
  const groupDbMatches = dbMatches.filter(m => m.stage === 'group' && !m.api_id);
  
  if (groupDbMatches.length > 0) {
    console.log(`[Sync] Asignando api_id a ${groupDbMatches.length} partidos de fase de grupos...`);
    for (const dbM of groupDbMatches) {
      const apiG = apiGames.find(apiG => {
        const idNum = parseInt(apiG.id, 10);
        if (idNum > 72) return false;
        
        const apiHomeSpanish = translateTeam(apiG.home_team_name_en || "");
        const apiAwaySpanish = translateTeam(apiG.away_team_name_en || "");
        
        const homeMatch = dbM.home_team.toLowerCase() === apiHomeSpanish.toLowerCase();
        const awayMatch = dbM.away_team.toLowerCase() === apiAwaySpanish.toLowerCase();
        const reverseHomeMatch = dbM.home_team.toLowerCase() === apiAwaySpanish.toLowerCase();
        const reverseAwayMatch = dbM.away_team.toLowerCase() === apiHomeSpanish.toLowerCase();
        return (homeMatch && awayMatch) || (reverseHomeMatch && reverseAwayMatch);
      });
      
      if (apiG) {
        updates.push({
          id: dbM.id,
          api_id: apiG.id
        });
        dbM.api_id = apiG.id;
      }
    }
    
    if (updates.length > 0) {
      console.log(`[Sync] Actualizando ${updates.length} api_ids de fase de grupos...`);
      const results = await Promise.all(
        updates.map(u => 
          supabaseAdmin.from("matches").update({ api_id: u.api_id }).eq("id", u.id)
        )
      );
      const errors = results.map(r => r.error).filter(Boolean);
      if (errors.length > 0) {
        console.error("[Sync] Error al actualizar api_ids de fase de grupos:", errors);
      } else {
        console.log(`[Sync] Se actualizaron ${updates.length} api_ids de fase de grupos.`);
      }
    }
  }
  
  // 2. Verify that knockout matches 73-104 exist, insert if missing
  const existingApiIds = new Set(dbMatches.map(m => m.api_id).filter(Boolean));
  const knockoutApiGames = apiGames.filter(g => {
    const idNum = parseInt(g.id, 10);
    return idNum >= 73 && idNum <= 104;
  });
  
  for (const apiG of knockoutApiGames) {
    if (!existingApiIds.has(apiG.id)) {
      const idNum = parseInt(apiG.id, 10);
      let stage = 'r32';
      if (idNum >= 89 && idNum <= 96) stage = 'r16';
      else if (idNum >= 97 && idNum <= 100) stage = 'qf';
      else if (idNum >= 101 && idNum <= 102) stage = 'sf';
      else if (idNum === 103) stage = 'third_place';
      else if (idNum === 104) stage = 'final';
      
      const spainDate = getSpainIsoDate(apiG.local_date || "06/28/2026 12:00", apiG.stadium_id || "16");
      
      inserts.push({
        api_id: apiG.id,
        home_team: "Por determinar",
        away_team: "Por determinar",
        home_flag: "❓",
        away_flag: "❓",
        stage,
        match_date: spainDate,
        home_score: null,
        away_score: null
      });
    }
  }
  
  if (inserts.length > 0) {
    console.log(`[Sync] Insertando ${inserts.length} partidos de eliminatorias en la base de datos...`);
    const { error } = await supabaseAdmin.from("matches").insert(inserts);
    if (error) {
      console.error("[Sync] Error al insertar partidos de eliminatorias:", error);
    } else {
      console.log(`[Sync] Se insertaron con éxito ${inserts.length} partidos de eliminatorias.`);
    }
  }
}

interface Standing {
  team: string;
  flag: string;
  grp: string;
  rk: number;
  pts: number;
  gd: number;
  gf: number;
}

export async function generateKnockoutMatchesTS() {
  console.log("[Knockouts TS] Calculando eliminatorias del Mundial 2026...");
  
  const { data: dbMatches, error: dbError } = await supabaseAdmin
    .from("matches")
    .select("*");
    
  if (dbError) throw dbError;
  if (!dbMatches || dbMatches.length === 0) return;
  
  const { data: standingsRaw, error: stError } = await supabaseAdmin
    .rpc("compute_standings");
    
  if (stError) throw stError;
  const standings: Standing[] = standingsRaw || [];
  
  const groupMatches = dbMatches.filter(m => m.stage === 'group');
  const groupFinished = groupMatches.every(m => m.home_score !== null && m.away_score !== null);
  
  const flagMap = buildFlagMap(dbMatches);
  const matchesMap = new Map<string, any>();
  dbMatches.forEach(m => {
    if (m.api_id) matchesMap.set(m.api_id, m);
  });
  
  const updates: any[] = [];
  
  let groupWinners: Record<string, Standing> = {};
  let groupRunnersUp: Record<string, Standing> = {};
  let groupThirds: Record<string, Standing> = {};
  let qualifiedThirdsKeys: string[] = [];
  let assignments: Record<string, string> = {};
  
  if (groupFinished && standings.length > 0) {
    standings.forEach(s => {
      if (s.rk === 1) groupWinners[s.grp.toUpperCase()] = s;
      else if (s.rk === 2) groupRunnersUp[s.grp.toUpperCase()] = s;
      else if (s.rk === 3) groupThirds[s.grp.toUpperCase()] = s;
    });
    
    const thirdsList = Object.values(groupThirds).sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      if (b.gd !== a.gd) return b.gd - a.gd;
      if (b.gf !== a.gf) return b.gf - a.gf;
      return a.grp.localeCompare(b.grp);
    });
    
    const top8Thirds = thirdsList.slice(0, 8);
    qualifiedThirdsKeys = top8Thirds.map(t => t.grp.toUpperCase()).sort();
    const combinationKey = qualifiedThirdsKeys.join('');
    
    const comboData = (annexCData as Record<string, Record<string, string>>)[combinationKey];
    if (comboData) {
      assignments = comboData;
      console.log(`[Knockouts TS] Combinación de terceros detectada: ${combinationKey}. Asignaciones:`, assignments);
    } else {
      console.error(`[Knockouts TS] Error: No se encontró la combinación de terceros "${combinationKey}" en annex_c.json.`);
    }
  }
  
  const idsToProcess = Array.from({ length: 32 }, (_, i) => String(73 + i));
  
  for (const id of idsToProcess) {
    const def = KNOCKOUT_DEFS[id];
    if (!def) continue;
    
    const dbM = matchesMap.get(id);
    if (!dbM) continue;
    
    let homeTeam = def.placeholderHome;
    let awayTeam = def.placeholderAway;
    let homeFlag = "❓";
    let awayFlag = "❓";
    
    // 1. Resolve Home Team
    if (def.homeSource.type === 'group') {
      if (groupFinished) {
        const ref = def.homeSource.ref;
        if (ref.startsWith('3rd_')) {
          const winnerKey = ref.replace('3rd_', '');
          const assignedGroup = assignments[winnerKey];
          const standing = assignedGroup ? groupThirds[assignedGroup] : null;
          if (standing) {
            homeTeam = standing.team;
            homeFlag = standing.flag;
          }
        } else {
          const rank = parseInt(ref[0], 10);
          const grp = ref[1];
          const standing = rank === 1 ? groupWinners[grp] : groupRunnersUp[grp];
          if (standing) {
            homeTeam = standing.team;
            homeFlag = standing.flag;
          }
        }
      }
    } else {
      const refId = def.homeSource.ref;
      const isLoser = refId.startsWith('loser_');
      const cleanRefId = refId.replace('loser_', '');
      const targetMatch = matchesMap.get(cleanRefId);
      
      if (targetMatch) {
        if (targetMatch.home_score !== null && targetMatch.away_score !== null) {
          const homeWins = targetMatch.home_score >= targetMatch.away_score;
          if (isLoser) {
            homeTeam = homeWins ? targetMatch.away_team : targetMatch.home_team;
            homeFlag = homeWins ? targetMatch.away_flag : targetMatch.home_flag;
          } else {
            homeTeam = homeWins ? targetMatch.home_team : targetMatch.away_team;
            homeFlag = homeWins ? targetMatch.home_flag : targetMatch.away_flag;
          }
        } else {
          homeTeam = isLoser ? `Perdedor Partido ${cleanRefId}` : `Ganador Partido ${cleanRefId}`;
          homeFlag = "❓";
        }
      }
    }
    
    // 2. Resolve Away Team
    if (def.awaySource.type === 'group') {
      if (groupFinished) {
        const ref = def.awaySource.ref;
        if (ref.startsWith('3rd_')) {
          const winnerKey = ref.replace('3rd_', '');
          const assignedGroup = assignments[winnerKey];
          const standing = assignedGroup ? groupThirds[assignedGroup] : null;
          if (standing) {
            awayTeam = standing.team;
            awayFlag = standing.flag;
          }
        } else {
          const rank = parseInt(ref[0], 10);
          const grp = ref[1];
          const standing = rank === 1 ? groupWinners[grp] : groupRunnersUp[grp];
          if (standing) {
            awayTeam = standing.team;
            awayFlag = standing.flag;
          }
        }
      }
    } else {
      const refId = def.awaySource.ref;
      const isLoser = refId.startsWith('loser_');
      const cleanRefId = refId.replace('loser_', '');
      const targetMatch = matchesMap.get(cleanRefId);
      
      if (targetMatch) {
        if (targetMatch.home_score !== null && targetMatch.away_score !== null) {
          const homeWins = targetMatch.home_score >= targetMatch.away_score;
          if (isLoser) {
            awayTeam = homeWins ? targetMatch.away_team : targetMatch.home_team;
            awayFlag = homeWins ? targetMatch.away_flag : targetMatch.home_flag;
          } else {
            awayTeam = homeWins ? targetMatch.home_team : targetMatch.away_team;
            awayFlag = homeWins ? targetMatch.home_flag : targetMatch.away_flag;
          }
        } else {
          awayTeam = isLoser ? `Perdedor Partido ${cleanRefId}` : `Ganador Partido ${cleanRefId}`;
          awayFlag = "❓";
        }
      }
    }
    
    const needsUpdate = 
      dbM.home_team !== homeTeam || 
      dbM.away_team !== awayTeam ||
      dbM.home_flag !== homeFlag ||
      dbM.away_flag !== awayFlag;
      
    if (needsUpdate) {
      console.log(`[Knockouts TS] Partido ${id} asignado: ${homeTeam} vs ${awayTeam}`);
      updates.push({
        id: dbM.id,
        home_team: homeTeam,
        away_team: awayTeam,
        home_flag: homeFlag,
        away_flag: awayFlag
      });
      dbM.home_team = homeTeam;
      dbM.away_team = awayTeam;
      dbM.home_flag = homeFlag;
      dbM.away_flag = awayFlag;
    }
  }
  
  if (updates.length > 0) {
    console.log(`[Knockouts TS] Guardando ${updates.length} actualizaciones de eliminatorias...`);
    const results = await Promise.all(
      updates.map(u => 
        supabaseAdmin.from("matches").update({
          home_team: u.home_team,
          away_team: u.away_team,
          home_flag: u.home_flag,
          away_flag: u.away_flag
        }).eq("id", u.id)
      )
    );
    const errors = results.map(r => r.error).filter(Boolean);
    if (errors.length > 0) {
      console.error("[Knockouts TS] Error al guardar eliminatorias:", errors);
    } else {
      console.log("[Knockouts TS] Eliminatorias actualizadas correctamente.");
    }
  }
}

export async function syncMatches(force = false): Promise<{ success: boolean; message: string; updatedCount: number }> {
  const now = Date.now();
  
  // Dynamic throttle: if there is an active/recent match without a score, reduce throttle to 1 minute
  let hasActiveMatch = false;
  try {
    const { data: dbMatches } = await supabaseAdmin
      .from("matches")
      .select("match_date, home_score, away_score");
    
    if (dbMatches) {
      hasActiveMatch = dbMatches.some(m => {
        const matchTime = new Date(m.match_date).getTime();
        // Started in the last 36 hours, or starting in the next 15 minutes, and has no score yet
        const isRecentOrUpcoming = matchTime < now + 15 * 60 * 1000 && matchTime > now - 36 * 60 * 60 * 1000;
        return isRecentOrUpcoming && m.home_score === null;
      });
    }
  } catch (e) {
    console.error("[Sync] Error checking for active matches for throttle bypass:", e);
  }

  const currentThrottle = hasActiveMatch ? 1 * 60 * 1000 : THROTTLE_MS;

  if (!force && now - lastSyncTime < currentThrottle) {
    return {
      success: true,
      message: `Sync en caché (throttle activo: ${hasActiveMatch ? "1 min" : "10 min"})`,
      updatedCount: 0
    };
  }

  try {
    console.log("[Sync Matches] Iniciando sincronización con la API externa...");
    const res = await fetch("https://worldcup26.ir/get/games");
    if (!res.ok) {
      throw new Error(`Error HTTP: ${res.status}`);
    }

    const data = await res.json();
    const apiGames: ApiGame[] = data.games || [];
    if (!apiGames.length) {
      return { success: true, message: "No se encontraron partidos en la API", updatedCount: 0 };
    }

    // Obtener todos los partidos locales
    const { data: dbMatches, error: dbError } = await supabaseAdmin
      .from("matches")
      .select("*");

    if (dbError) throw dbError;
    if (!dbMatches) {
      return { success: true, message: "No hay partidos locales en la base de datos", updatedCount: 0 };
    }

    // Inicializar api_ids e insertar eliminatorias si faltan
    await initializeApiIdsAndKnockouts(dbMatches, apiGames);

    // Refrescar partidos locales tras inicialización
    const { data: refreshedDbMatches, error: refreshError } = await supabaseAdmin
      .from("matches")
      .select("*");
    if (refreshError) throw refreshError;
    if (!refreshedDbMatches) throw new Error("Error al refrescar partidos locales");

    const flagMap = buildFlagMap(refreshedDbMatches);
    let updatedCount = 0;

    for (const apiGame of apiGames) {
      const apiHomeSpanish = translateTeam(apiGame.home_team_name_en || "");
      const apiAwaySpanish = translateTeam(apiGame.away_team_name_en || "");

      // Buscar partido por api_id, con fallback a nombres
      let matchingDbMatch = refreshedDbMatches.find(dbM => dbM.api_id === apiGame.id);
      if (!matchingDbMatch) {
        matchingDbMatch = refreshedDbMatches.find(dbM => {
          const homeMatch = dbM.home_team.toLowerCase() === apiHomeSpanish.toLowerCase();
          const awayMatch = dbM.away_team.toLowerCase() === apiAwaySpanish.toLowerCase();
          const reverseHomeMatch = dbM.home_team.toLowerCase() === apiAwaySpanish.toLowerCase();
          const reverseAwayMatch = dbM.away_team.toLowerCase() === apiHomeSpanish.toLowerCase();
          return (homeMatch && awayMatch) || (reverseHomeMatch && reverseAwayMatch);
        });
      }

      if (!matchingDbMatch) continue;

      // Si es eliminatoria y la API tiene nombres de equipos resueltos, actualizar nombres locales
      if (parseInt(apiGame.id, 10) >= 73) {
        const homeEnglish = apiGame.home_team_name_en;
        const awayEnglish = apiGame.away_team_name_en;
        if (homeEnglish && awayEnglish) {
          const resolvedHome = translateTeam(homeEnglish);
          const resolvedAway = translateTeam(awayEnglish);
          
          if (matchingDbMatch.home_team !== resolvedHome || matchingDbMatch.away_team !== resolvedAway) {
            console.log(`[Sync Matches] Resolviendo nombres de eliminatoria ${matchingDbMatch.id}: ${resolvedHome} vs ${resolvedAway}`);
            const homeFlag = flagMap[resolvedHome.toLowerCase()] || "❓";
            const awayFlag = flagMap[resolvedAway.toLowerCase()] || "❓";
            
            const { error: nameError } = await supabaseAdmin
              .from("matches")
              .update({
                home_team: resolvedHome,
                away_team: resolvedAway,
                home_flag: homeFlag,
                away_flag: awayFlag
              })
              .eq("id", matchingDbMatch.id);

            if (nameError) {
              console.error(`Error al actualizar nombres de eliminatoria ${matchingDbMatch.id}:`, nameError);
            } else {
              matchingDbMatch.home_team = resolvedHome;
              matchingDbMatch.away_team = resolvedAway;
              matchingDbMatch.home_flag = homeFlag;
              matchingDbMatch.away_flag = awayFlag;
              updatedCount++;
            }
          }
        }
      }

      // Sincronizar fecha/hora del partido si difiere de la API externa
      if (apiGame.local_date) {
        const apiSpainDate = getSpainIsoDate(apiGame.local_date, apiGame.stadium_id || "16");
        const dbTime = new Date(matchingDbMatch.match_date).getTime();
        const apiTime = new Date(apiSpainDate).getTime();
        if (dbTime !== apiTime) {
          console.log(`[Sync Matches] Actualizando fecha del partido ${matchingDbMatch.id} (${matchingDbMatch.home_team} vs ${matchingDbMatch.away_team}): ${matchingDbMatch.match_date} -> ${apiSpainDate}`);
          const { error: dateError } = await supabaseAdmin
            .from("matches")
            .update({ match_date: apiSpainDate })
            .eq("id", matchingDbMatch.id);
          if (dateError) {
            console.error(`Error al actualizar fecha del partido ${matchingDbMatch.id}:`, dateError);
          } else {
            matchingDbMatch.match_date = apiSpainDate;
            updatedCount++;
          }
        }
      }

      const isFinished = apiGame.finished === "TRUE";

      if (!isFinished) {
        // If the match is not finished but has active scores, store the live score in the category column
        const liveHome = parseInt(apiGame.home_score || "", 10);
        const liveAway = parseInt(apiGame.away_score || "", 10);
        const liveScoreStr = (!isNaN(liveHome) && !isNaN(liveAway)) ? `LIVE:${liveHome}-${liveAway}` : null;

        if (matchingDbMatch.category !== liveScoreStr) {
          console.log(`[Sync Matches] Actualizando marcador EN VIVO para ${matchingDbMatch.home_team} vs ${matchingDbMatch.away_team} -> ${liveScoreStr}`);
          await supabaseAdmin
            .from("matches")
            .update({ category: liveScoreStr })
            .eq("id", matchingDbMatch.id);
          
          matchingDbMatch.category = liveScoreStr;
          updatedCount++;
        }

        // AUTOCORRECCIÓN: Si el partido no ha terminado, pero tiene marcador local final, restaurar a NULL
        if (matchingDbMatch.home_score !== null || matchingDbMatch.away_score !== null) {
          console.log(`[Sync Matches] Restaurando a NULL (no terminado): ${matchingDbMatch.home_team} vs ${matchingDbMatch.away_team}`);
          const { error: resetError } = await supabaseAdmin
            .from("matches")
            .update({
              home_score: null,
              away_score: null
            })
            .eq("id", matchingDbMatch.id);

          if (resetError) {
            console.error(`Error al restaurar a NULL partido ${matchingDbMatch.id}:`, resetError);
          } else {
            updatedCount++;
          }
        }
        continue;
      }

      // Sincronizar marcador si el partido terminó en la API
      const homeScoreNum = parseInt(apiGame.home_score || "", 10);
      const awayScoreNum = parseInt(apiGame.away_score || "", 10);

      if (isNaN(homeScoreNum) || isNaN(awayScoreNum)) {
        continue;
      }

      const needsUpdate = 
        matchingDbMatch.home_score !== homeScoreNum || 
        matchingDbMatch.away_score !== awayScoreNum ||
        matchingDbMatch.category !== null; // Clear live category when finished

      if (needsUpdate) {
        console.log(`[Sync Matches] Actualizando finalizado ${matchingDbMatch.home_team} vs ${matchingDbMatch.away_team} -> ${homeScoreNum}-${awayScoreNum}`);
        const { error: updateError } = await supabaseAdmin
          .from("matches")
          .update({
            home_score: homeScoreNum,
            away_score: awayScoreNum,
            category: null // Clear live category
          })
          .eq("id", matchingDbMatch.id);

        if (updateError) {
          console.error(`Error al actualizar partido ${matchingDbMatch.id}:`, updateError);
        } else {
          matchingDbMatch.home_score = homeScoreNum;
          matchingDbMatch.away_score = awayScoreNum;
          matchingDbMatch.category = null;
          updatedCount++;
        }
      }
    }

    lastSyncTime = now;

    // Calcular y hacer avanzar los cruces locales en TypeScript
    await generateKnockoutMatchesTS();

    return {
      success: true,
      message: `Sincronización exitosa. Partidos actualizados: ${updatedCount}`,
      updatedCount
    };
  } catch (err) {
    console.error("[Sync Matches] Falló la sincronización:", err);
    return {
      success: false,
      message: err instanceof Error ? err.message : "Error desconocido",
      updatedCount: 0
    };
  }
}
