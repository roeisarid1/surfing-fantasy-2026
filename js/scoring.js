/* ============================================================
   scoring.js — Pure deterministic scoring functions.
   No side effects. No DOM. No localStorage.

   actualRankings = array of { rank, name, country, points }
   predictions.men   = string[5]  (names, index 0 = predicted rank 1)
   predictions.women = string[3]  (names, index 0 = predicted rank 1)
   ============================================================ */

const Scoring = {

  /* ---- Men: score a single pick ---- */
  scoreMenPick(predictedRank, surferName, actualRankings) {
    if (!surferName) return 0;

    const actual = actualRankings.find(
      s => s.name.trim().toLowerCase() === surferName.trim().toLowerCase()
    );

    // Not found or outside top 5 → 0
    if (!actual || actual.rank > 5) return 0;

    const actualRank = actual.rank;

    // Champion bonus: predicted 1st AND actually 1st
    if (predictedRank === 1 && actualRank === 1) return 7;

    const diff = Math.abs(predictedRank - actualRank);
    if (diff === 0) return 5;
    if (diff === 1) return 3;
    if (diff === 2) return 2;
    return 1; // diff >= 3 but still in top 5
  },

  /* ---- Women: score a single pick ---- */
  scoreWomenPick(predictedRank, surferName, actualRankings) {
    if (!surferName) return 0;

    const actual = actualRankings.find(
      s => s.name.trim().toLowerCase() === surferName.trim().toLowerCase()
    );

    // Not found or outside top 3 → 0
    if (!actual || actual.rank > 3) return 0;

    const actualRank = actual.rank;

    // Champion bonus: predicted 1st AND actually 1st
    if (predictedRank === 1 && actualRank === 1) return 4;

    const diff = Math.abs(predictedRank - actualRank);
    if (diff === 0) return 3;
    return 1; // in top 3 but not exact
  },

  /* ---- Score all picks for one participant ---- */
  // Returns { total, men: [{rank, name, points, actualRank}], women: [...] }
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
      men.push({
        predictedRank,
        name,
        points: pts,
        actualRank: actualEntry ? actualEntry.rank : null
      });
    });

    (predictions.women || []).forEach((name, i) => {
      const predictedRank = i + 1;
      const pts = this.scoreWomenPick(predictedRank, name, womenRankings);
      const actualEntry = womenRankings.find(
        s => s.name.trim().toLowerCase() === (name || '').trim().toLowerCase()
      );
      total += pts;
      women.push({
        predictedRank,
        name,
        points: pts,
        actualRank: actualEntry ? actualEntry.rank : null
      });
    });

    return { total, men, women };
  },

  /* ---- Score all participants, return sorted leaderboard ---- */
  // Returns [{ participant, score: { total, men, women } }] sorted desc
  buildLeaderboard(participants, menRankings, womenRankings) {
    const rows = participants.map(p => {
      const predictions = Storage.get('predictions_' + p.id);
      const score = this.scoreParticipant(predictions, menRankings, womenRankings);
      return { participant: p, score, hasPredictions: !!predictions };
    });

    rows.sort((a, b) => b.score.total - a.score.total);

    // Assign display rank (ties share same rank)
    let displayRank = 1;
    rows.forEach((row, i) => {
      if (i > 0 && rows[i].score.total < rows[i - 1].score.total) {
        displayRank = i + 1;
      }
      row.displayRank = displayRank;
    });

    return rows;
  },

  /* ---- Helper: classify points for color coding ---- */
  // Returns 'full' | 'partial' | 'zero'
  classify(points, maxPoints) {
    if (points === 0) return 'zero';
    if (points === maxPoints) return 'full';
    return 'partial';
  }
};
