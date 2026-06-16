const db = require('../db/postgres');
const { TRAINING_MODULES } = require('../data/training-videos');

async function upsertTrainingModules() {
  for (const mod of TRAINING_MODULES) {
    const { rows } = await db.query('SELECT id FROM training_modules WHERE title = $1', [mod.title]);
    if (rows[0]) {
      await db.query(
        `UPDATE training_modules
         SET description = $1, category = $2, video_url = $3, duration_minutes = $4,
             skill_level = $5, target_audience = $6, sort_order = $7
         WHERE id = $8`,
        [
          mod.description, mod.category, mod.video_url, mod.duration_minutes,
          mod.skill_level, mod.target_audience, mod.sort_order, rows[0].id,
        ]
      );
    } else {
      await db.query(
        `INSERT INTO training_modules
          (title, description, category, video_url, duration_minutes, skill_level, target_audience, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          mod.title, mod.description, mod.category, mod.video_url, mod.duration_minutes,
          mod.skill_level, mod.target_audience, mod.sort_order,
        ]
      );
    }
  }
  console.log(`Training modules synced (${TRAINING_MODULES.length} videos)`);
}

module.exports = { upsertTrainingModules };

if (require.main === module) {
  upsertTrainingModules()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
