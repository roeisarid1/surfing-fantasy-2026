/* ============================================================
   scoring.js — Pure deterministic scoring functions.
   ============================================================ */
export const Scoring = {

  EVENT_SCORE_MEN:    [5, 4, 3, 2, 1],
  EVENT_SCORE_WOMEN:  [5, 4, 3],
  SEASON_SCORE_MEN:   [20, 13, 8, 5, 3],
  SEASON_SCORE_WOMEN: [10, 7, 5],

  _scorePick(predictedRank, surferName, results, scores) {
    if (!surferName) return { points: 0, actualRank: null };
    const actual = results.find(
      s => s.name.trim().toLowerCase() === surferName.trim().toLowerCase()
    );
    const actualRank = actual ? actual.rank : null;
    if (!actualRank || actualRank > scores.length) return { points: 0, actualRank };
    const points = (actualRank === predictedRank) ? (scores[actualRank - 1] || 0) : 0;
    return { points, actualRank };
  },

  scoreParticipantForEvent(predictions, eventData) {
    if (!predictions || !eventData) return { total: 0, men: [], women: [] };
    const isSeason    = eventData.type === 'season';
    const menScores   = isSeason ? this.SEASON_SCORE_MEN   : this.EVENT_SCORE_MEN;
    const womenScores = isSeason ? this.SEASON_SCORE_WOMEN : this.EVENT_SCORE_WOMEN;

    let total = 0;
    const men   = [];
    const women = [];

    (predictions.men || []).forEach((name, i) => {
      const predictedRank = i + 1;
      const { points, actualRank } = this._scorePick(predictedRank, name, eventData.men || [], menScores);
      total += points;
      men.push({ predictedRank, name, points, actualRank, maxPoints: menScores[i] || 0 });
    });

    (predictions.women || []).forEach((name, i) => {
      const predictedRank = i + 1;
      const { points, actualRank } = this._scorePick(predictedRank, name, eventData.women || [], womenScores);
      total += points;
      women.push({ predictedRank, name, points, actualRank, maxPoints: womenScores[i] || 0 });
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
