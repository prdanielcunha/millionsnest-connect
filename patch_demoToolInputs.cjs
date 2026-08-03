const fs = require('fs');
let content = fs.readFileSync('src/features/tools/demoToolInputs.ts', 'utf8');

const newFactories = `
  searchSongs: () => ({ title: 'Fictícia' }),
  getSongChart: () => ({ songId: 'song_demo_01' }),
  getScheduleSongCharts: () => ({ scheduleId: 'sch_2026_07_28' }),
  transposeSongChart: () => ({ songId: 'song_demo_01', requestedKey: 'D' }),
  renderSongChartDocument: () => ({ songId: 'song_demo_01' }),
  renderScheduleSongbook: () => ({ scheduleId: 'sch_2026_07_28' }),
`;

content = content.replace('searchLivingLibrary: () => ({', newFactories + '\n  searchLivingLibrary: () => ({');
fs.writeFileSync('src/features/tools/demoToolInputs.ts', content);
