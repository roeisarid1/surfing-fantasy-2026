/* ============================================================
   scoring.js — Pure deterministic scoring functions.
   ============================================================ */
export const Scoring = {

  // Per-event: index = abs diff between predicted and actual rank
  EVENT_MEN_SCORES:    [5, 3, 2, 1, 1],   // diff 0,1,2,3,4+
  EVENT_WOMEN_SCORES:  [3, 1, 1],          // diff 0,1,2+

  // Season bonus: same logic, higher stakes
  SEASON_MEN_SCORES:   [20, 13, 8, 5, 3], // diff 0,1,2,3,4+
  SEASON_WOMEN_SCORES: [10, 7, 5],         // diff 0,1,2+

  _scorePick(predictedRank, surferName, results, topN, scores, firstPlaceBonus, isSeason) {
    if (!surferName) return { points: 0, actualRank: null };
    const actual = results.find(
      s => s.name.trim().toLowerCase() === surferName.trim().toLowerCase()
    );
    const actualRank = actual ? actual.rank : null;

    // WSL bridge rules (per-event only):
    // Semi-losers stored as ranks 3 & 4 (both truly tied 3rd).
    // QF-losers stored as ranks 5–8 (all truly tied 5th).
    if (!isSeason && actualRank) {
      if (topN === 5) {
        // ranks 3 & 4 are the same tier — symmetrical exact match
        if ((predictedRank === 3 && actualRank === 4) ||
            (predictedRank === 4 && actualRank === 3)) {
          return { points: scores[0], actualRank };
        }
        // ranks 5–8 are the same tier — predicted 5 matches any QF-loser
        if (predictedRank === 5 && actualRank >= 6 && actualRank <= 8) {
          return { points: scores[0], actualRank };
        }
      }
      if (topN === 3) {
        // ranks 3 & 4 are both semi-losers for women
        if (predictedRank === 3 && actualRank === 4) {
          return { points: scores[0], actualRank };
        }
      }
    }

    if (!actualRank || actualRank > topN) return { points: 0, actualRank };
    // Bonus for nailing 1st place exactly
    if (predictedRank === 1 && actualRank === 1) return { points: firstPlaceBonus, actualRank };
    const diff   = Math.abs(predictedRank - actualRank);
    const points = scores[Math.min(diff, scores.length - 1)] || 0;
    return { points, actualRank };
  },

  scoreParticipantForEvent(predictions, eventData) {
    if (!predictions || !eventData) return { total: 0, men: [], women: [] };
    const isSeason    = eventData.type === 'season';
    const menScores   = isSeason ? this.SEASON_MEN_SCORES   : this.EVENT_MEN_SCORES;
    const womenScores = isSeason ? this.SEASON_WOMEN_SCORES : this.EVENT_WOMEN_SCORES;

    let total = 0;
    const men   = [];
    const women = [];

    const men1stBonus   = isSeason ? 30 : 7;
    const women1stBonus = isSeason ? 30 : 7;

    (predictions.men || []).forEach((name, i) => {
      const predictedRank = i + 1;
      const { points, actualRank } = this._scorePick(predictedRank, name, eventData.men || [], 5, menScores, men1stBonus, isSeason);
      total += points;
      men.push({ predictedRank, name, points, actualRank, maxPoints: men1stBonus });
    });

    (predictions.women || []).forEach((name, i) => {
      const predictedRank = i + 1;
      const { points, actualRank } = this._scorePick(predictedRank, name, eventData.women || [], 3, womenScores, women1stBonus, isSeason);
      total += points;
      women.push({ predictedRank, name, points, actualRank, maxPoints: women1stBonus });
    });

    return { total, men, women };
  },

  buildCumulativeLeaderboard(participants, predictionsMap, events) {
    const completedEvents = events.filter(e => e.completed);

    const rows = participants.map(p => {
      const predictions = predictionsMap[p.id] || null;
      const eventScores = completedEvents.map(event => ({
        event,
        score: this.scoreParticipantForEvent(predictions, event)
      }));
      const total = eventScores.reduce((sum, es) => sum + es.score.total, 0);
      return { participant: p, total, eventScores, hasPredictions: !!predictions };
    });

    rows.sort((a, b) => b.total - a.total);

    let displayRank = 1;
    rows.forEach((row, i) => {
      if (i > 0 && rows[i].total < rows[i - 1].total) displayRank = i + 1;
      row.displayRank = displayRank;
    });

    return rows;
  },

  classify(points, maxPoints) {
    if (points === 0) return 'zero';
    if (points === maxPoints) return 'full';
    return 'partial';
  }
};
