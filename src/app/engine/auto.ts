import { actingSeats, applyAction, legalRobberHexes, legalRoadEdges, legalSetupRoads, legalSetupVertices, robberVictims } from './rules';
import { Action, emptyResources, GameState, RESOURCES } from './types';

/**
 * Ein zurückhaltender, legaler Zug für einen Sitz, dessen Spieler nicht verbunden ist.
 * Er soll das Spiel nur weiterbringen: aufbauen, würfeln, abwerfen, Räuber versetzen, Zug beenden.
 * Gebaut oder gehandelt wird nicht. Liefert null, wenn dieser Sitz gerade nicht dran ist.
 */
export function autoAction(s: GameState, seat: number, random: () => number = Math.random): Action | null {
  if (!actingSeats(s).includes(seat)) return null;
  const pick = <T>(xs: T[]): T | undefined => xs[Math.floor(random() * xs.length)];
  const phase = s.phase;
  switch (phase.kind) {
    case 'setup': {
      if (phase.step === 'settlement') {
        const vertex = pick(legalSetupVertices(s));
        return vertex === undefined ? null : { type: 'placeSettlement', vertex };
      }
      const edge = pick(legalSetupRoads(s));
      return edge === undefined ? null : { type: 'placeRoad', edge };
    }
    case 'roll':
      return { type: 'roll' };
    case 'discard': {
      // Von den größten Stapeln abwerfen, damit möglichst viele Sorten übrig bleiben.
      const left = { ...s.players[seat].resources };
      const out = emptyResources();
      for (let i = 0; i < phase.pending[seat]; i++) {
        const r = [...RESOURCES].sort((a, b) => left[b] - left[a])[0];
        left[r]--;
        out[r]++;
      }
      return { type: 'discard', resources: out };
    }
    case 'robber': {
      // Ein Feld, auf dem der Räuber niemandem schadet, sonst irgendeins.
      const hexes = legalRobberHexes(s);
      const quiet = hexes.filter((id) => robberVictims(s, seat, id).length === 0);
      const hex = pick(quiet.length ? quiet : hexes)!;
      return { type: 'moveRobber', hex, victim: robberVictims(s, seat, hex)[0] ?? null };
    }
    case 'roadBuilding': {
      const edge = pick(legalRoadEdges(s, seat));
      return edge === undefined ? null : { type: 'buildRoad', edge };
    }
    case 'main':
    case 'specialBuild':
      return { type: 'endTurn' };
    default:
      return null;
  }
}

/** Prüft, ob der Automat für diesen Sitz einen Zug hat, den die Regeln auch annehmen. */
export function canAutoAct(s: GameState, seat: number): boolean {
  const action = autoAction(s, seat, () => 0);
  if (!action) return false;
  try {
    applyAction(s, seat, action);
    return true;
  } catch {
    return false;
  }
}
