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

  // Converts a raw WSL result rank into the scoring tier used for diff calculation.
  // Men:   1→1, 2→2, 3-4→3, 5-8→5, 9+→null (outside)
  // Women: 1→1, 2→2, 3-4→3, 5+→null (outside)
  _wslTier(actualRank, topN) {
    if (actualRank === 1) return 1;
    if (actualRank === 2) return 2;
    if (actualRank === 3 || actualRank === 4) return 3;
    if (topN === 5 && actualRank >= 5 && actualRank <= 8) return 5;
    return null;
  },

  _scorePick(predictedRank, surferName, results, topN, scoreMatrix, isSeason) {
    // For per-event we normalize the *predicted* position to its WSL tier too, so a
    // pick's target lines up with how the actual result gets tiered. WSL has no
    // unique 4th — #3/#4 collapse into the semifinal tier (3) — so predicting a
    // surfer 4th is treated exactly like predicting them 3rd. Otherwise a correct
    // "4th" pick could never reach an exact match. Season bonus keeps raw, unique ranks.
    const predScoringRank = isSeason ? predictedRank : this._wslTier(predictedRank, topN);
    const rowScores = scoreMatrix[predScoringRank - 1];
    const maxPoints = rowScores[0];
    if (!surferName) return { points: 0, actualRank: null, maxPoints };

    const actual = results.find(
      s => s.name.trim().toLowerCase() === surferName.trim().toLowerCase()
    );
    const actualRank = actual ? actual.rank : null;
    if (!actualRank) return { points: 0, actualRank, maxPoints };

    // For per-event: normalize actual rank to WSL scoring tier before computing diff.
    // For season bonus: use raw rank with a simple topN cut-off (rankings are unique).
    const scoringRank = isSeason
      ? (actualRank <= topN ? actualRank : null)
      : this._wslTier(actualRank, topN);

    if (!scoringRank) return { points: 0, actualRank, maxPoints };

    const diff   = Math.abs(predScoringRank - scoringRank);
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
