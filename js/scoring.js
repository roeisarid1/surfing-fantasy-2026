/* ============================================================
   scoring.js — Pure deterministic scoring functions.
   ============================================================ */
export const Scoring = {

  scoreMenPick(predictedRank, surferName, actualRankings) {
    if (!surferName) return 0;
    const actual = actualRankings.find(
      s => s.name.trim().toLowerCase() === surferName.trim().toLowerCase()
    );
    if (!actual || actual.rank > 5) return 0;
    const actualRank = actual.rank;
    if (predictedRank === 1 && actualRank === 1) return 7;
    const diff = Math.abs(predictedRank - actualRank);
    if (diff === 0) return 5;
    if (diff === 1) return 3;
    if (diff === 2) return 2;
    return 1;
  },

  scoreWomenPick(predictedRank, surferName, actualRankings) {
    if (!surferName) return 0;
    const actual = actualRankings.find(
      s => s.name.trim().toLowerCase() === surferName.trim().toLowerCase()
    );
    if (!actual || actual.rank > 3) return 0;
    const actualRank = actual.rank;
    if (predictedRank === 1 && actualRank === 1) return 4;
    const diff = Math.abs(predictedRank - actualRank);
    if (diff === 0) return 3;
    return 1;
  },

  scoreParticipant(predictions, menRankings, womenRankings) {
    if (!predictions) return { total: 0, men: [], women: [] };
    let total = 0;
    const men = [];
    const women = [];

    (predictions.men || []).forEach((name, i) => {
      const predictedRank = i + 1;
      const pts = this.scoreMenPick(predictedRank, name, menRankings);
      const actualEntry = menRankings.find(
        s => s.name.trim().toLowerCase() === (name || '').trim().toLowerCase()
      );
      total += pts;
      men.push({ predictedRank, name, points: pts, actualRank: actualEntry ? actualEntry.rank : null });
    });

    (predictions.women || []).forEach((name, i) => {
      const predictedRank = i + 1;
      const pts = this.scoreWomenPick(predictedRank, name, womenRankings);
      const actualEntry = womenRankings.find(
        s => s.name.trim().toLowerCase() === (name || '').trim().toLowerCase()
      );
      total += pts;
      women.push({ predictedRank, name, points: pts, actualRank: actualEntry ? actualEntry.rank : null });
    });

    return { total, men, women };
  },

  // predictionsMap: { [participantId]: predictionsObject }
  buildLeaderboard(participants, predictionsMap, menRankings, womenRankings) {
    const rows = participants.map(p => {
      const predictions = predictionsMap[p.id] || null;
      const score = this.scoreParticipant(predictions, menRankings, womenRankings);
      return { participant: p, score, hasPredictions: !!predictions };
    });

    rows.sort((a, b) => b.score.total - a.score.total);

    let displayRank = 1;
    rows.forEach((row, i) => {
      if (i > 0 && rows[i].score.total < rows[i - 1].score.total) displayRank = i + 1;
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
