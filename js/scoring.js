/* ============================================================
   scoring.js — Pure deterministic scoring functions.
   ============================================================ */
export const Scoring = {

  // Per-event scores: matrix[predictedRank-1][diff]  diff = 0 (exact), 1, 2, 3+
  EVENT_MEN_SCORES: [
    [10, 7, 5, 3],  // predicted 1st
    [ 8, 5, 3, 2],  // predicted 2nd
    [ 7, 4, 2, 1],  // predicted 3rd
    [ 6, 3, 1, 1],  // predicted 4th
    [ 5, 2, 1, 1],  // predicted 5th
  ],

  EVENT_WOMEN_SCORES: [
    [8, 5, 3],  // predicted 1st
    [6, 3, 2],  // predicted 2nd
    [5, 2, 1],  // predicted 3rd
  ],

  // Season bonus: same decay ratios as per-event, higher exact values
  SEASON_MEN_SCORES: [
    [40, 28, 20, 8],  // predicted 1st
    [32, 20, 12, 4],  // predicted 2nd
    [28, 16,  8, 4],  // predicted 3rd
    [24, 12,  4, 0],  // predicted 4th
    [20,  8,  4, 0],  // predicted 5th
  ],

  SEASON_WOMEN_SCORES: [
    [32, 20, 12],  // predicted 1st
    [24, 12,  4],  // predicted 2nd
    [20,  8,  0],  // predicted 3rd
  ],

  _scorePick(predictedRank, surferName, results, topN, scoreMatrix, isSeason) {
    const rowScores = scoreMatrix[predictedRank - 1];
    const maxPoints = rowScores[0];
    if (!surferName) return { points: 0, actualRank: null, maxPoints };

    const actual = results.find(
      s => s.name.trim().toLowerCase() === surferName.trim().toLowerCase()
    );
    const actualRank = actual ? actual.rank : null;

    // WSL bridge rules (per-event only):
    // Semi-losers stored as ranks 3 & 4 (both truly tied 3rd).
    // QF-losers stored as ranks 5–8 (all truly tied 5th).
    // Points come from the predicted slot, not a fixed value.
    if (!isSeason && actualRank) {
      if (topN === 5) {
        if ((predictedRank === 3 && actualRank === 4) ||
            (predictedRank === 4 && actualRank === 3)) {
          return { points: rowScores[0], actualRank, maxPoints };
        }
        if (predictedRank === 5 && actualRank >= 6 && actualRank <= 8) {
          return { points: rowScores[0], actualRank, maxPoints };
        }
      }
      if (topN === 3 && predictedRank === 3 && actualRank === 4) {
        return { points: rowScores[0], actualRank, maxPoints };
      }
    }

    if (!actualRank || actualRank > topN) return { points: 0, actualRank, maxPoints };
    const diff   = Math.abs(predictedRank - actualRank);
    const points = rowScores[Math.min(diff, rowScores.length - 1)] || 0;
    return { points, actualRank, maxPoints };
  },

  scoreParticipantForEvent(predictions, eventData) {
    if (!predictions || !eventData) return { total: 0, men: [], women: [] };
    const isSeason    = eventData.type === 'season';
    const menMatrix   = isSeason ? this.SEASON_MEN_SCORES   : this.EVENT_MEN_SCORES;
    const womenMatrix = isSeason ? this.SEASON_WOMEN_SCORES : this.EVENT_WOMEN_SCORES;

    let total = 0;
    const men   = [];
    const women = [];

    (predictions.men || []).forEach((name, i) => {
      const predictedRank = i + 1;
      const { points, actualRank, maxPoints } = this._scorePick(predictedRank, name, eventData.men || [], 5, menMatrix, isSeason);
      total += points;
      men.push({ predictedRank, name, points, actualRank, maxPoints });
    });

    (predictions.women || []).forEach((name, i) => {
      const predictedRank = i + 1;
      const { points, actualRank, maxPoints } = this._scorePick(predictedRank, name, eventData.women || [], 3, womenMatrix, isSeason);
      total += points;
      women.push({ predictedRank, name, points, actualRank, maxPoints });
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
