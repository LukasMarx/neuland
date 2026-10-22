import { actingSeats, applyAction, guardSpots, progressStackSize, legalRobberHexes, legalRoadEdges, legalSetupRoads, legalSetupVertices, legalShipEdges, neutralSpots, robberVictims, vulnerableCities } from './rules';
import { Action, CARDS, count, emptyResources, GameState, RESOURCES, setCount, TRACKS } from './types';

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
    case 'gold': {
      // Gold: von dem, was die Bank am meisten hat.
      const bank = { ...s.bank };
      const out = emptyResources();
      for (let i = 0; i < phase.pending[seat]; i++) {
        const r = [...RESOURCES].sort((a, b) => bank[b] - bank[a])[0];
        bank[r]--;
        out[r]++;
      }
      return { type: 'chooseGold', resources: out };
    }
    case 'discard': {
      // Von den größten Stapeln abwerfen, damit möglichst viele Sorten übrig bleiben.
      const left = { ...s.players[seat].resources };
      const out = emptyResources();
      for (let i = 0; i < phase.pending[seat]; i++) {
        const r = [...CARDS].sort((a, b) => count(left, b) - count(left, a))[0];
        setCount(left, r, count(left, r) - 1);
        setCount(out, r, count(out, r) + 1);
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
      if (edge !== undefined) return { type: 'buildRoad', edge };
      const ship = pick(legalShipEdges(s, seat));
      return ship === undefined ? null : { type: 'buildShip', edge: ship };
    }
    case 'neutral': {
      // Duell: irgendein erlaubter Platz für irgendeinen Neutralen.
      const options = neutralSpots(s, phase.piece).filter((n) => n.spots.length);
      const choice = pick(options);
      if (!choice) return null;
      const spot = pick(choice.spots)!;
      return phase.piece === 'road' ? { type: 'placeNeutral', owner: choice.owner, edge: spot } : { type: 'placeNeutral', owner: choice.owner, vertex: spot };
    }
    case 'raid': {
      // Stadtwacht: irgendeine gewöhnliche Stadt abgeben.
      const vertex = pick(vulnerableCities(s, seat));
      return vertex === undefined ? null : { type: 'loseCity', vertex };
    }
    case 'displace':
      return { type: 'placeDisplaced', vertex: pick(guardSpots(s, seat)) ?? null };
    case 'peek': {
      // Schuldschein und Kundschafter: von den größten Stapeln nehmen bzw. die erste Karte.
      if (phase.what === 'progress') return { type: 'takePeek', progress: s.progress![phase.target][0] };
      const left = { ...s.players[phase.target].resources };
      const out = emptyResources();
      for (let i = 0; i < phase.take; i++) {
        const r = [...CARDS].sort((a, b) => count(left, b) - count(left, a))[0];
        setCount(left, r, count(left, r) - 1);
        setCount(out, r, count(out, r) + 1);
      }
      return { type: 'takePeek', cards: out };
    }
    case 'progressPick': {
      // Stadtwacht III: aus dem größten Stapel ziehen.
      const track = [...TRACKS].sort((a, b) => progressStackSize(s, b) - progressStackSize(s, a))[0];
      return { type: 'pickProgress', track };
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
