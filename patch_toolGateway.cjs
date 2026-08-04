const fs = require('fs');
const file = 'src/core/services/toolGateway.ts';
let data = fs.readFileSync(file, 'utf8');

const newLogic = `
    } else if (tool.name === 'getSongChart' || tool.name === 'transposeSongChart' || tool.name === 'renderSongChartDocument') {
      const { resolveSongChart, generateChartDelivery } = require('./chartDelivery');
      const projection = resolveSongChart(typedInput?.songId || 'song_demo_01');
      let mode = 'full_text';
      if (tool.name === 'renderSongChartDocument') mode = 'document_stub';
      
      const targetKey = typedInput?.requestedKey || projection?.key || 'C';
      
      if (projection) {
        simulatedData = generateChartDelivery(projection, mode, targetKey);
      } else {
        simulatedData = { error: 'Song not found' };
      }
    } else if (tool.name === 'getScheduleSongCharts' || tool.name === 'renderScheduleSongbook') {
      const { generateScheduleSongbook, resolveSongChart } = require('./chartDelivery');
      const s1 = resolveSongChart('song_demo_01');
      const s2 = resolveSongChart('song_demo_02');
      const songs = [];
      if (s1) songs.push(s1);
      if (s2) songs.push(s2);
      
      const scheduleProj = {
        scheduleId: typedInput?.scheduleId || 'sch_2026_07_28',
        organizationId: invocationContext.organization.id,
        title: 'Culto Demo',
        date: '2026-08-02',
        time: '19:00',
        songs,
        documentStatus: tool.name === 'renderScheduleSongbook' ? 'available_stub' : 'unavailable'
      };
      
      simulatedData = generateScheduleSongbook(scheduleProj);
`;

data = data.replace(/    } else if \(tool\.name === 'addSongToLivingLibrary'\) \{[\s\S]*?message: '.*?',\n      \};\n    \}/, `    } else if (tool.name === 'addSongToLivingLibrary') {
      simulatedData = {
        globalSongId: \`g_song_\${Math.random().toString(36).substring(2, 8)}\`,
        title: typedInput?.title || 'Música Nova',
        status: 'HOMOLOGADO_BIBLIOTECA_VIVA',
        message: 'Música homologada no acervo global compartilhada com todo o ecossistema MillionsNest.',
      };${newLogic}`);
fs.writeFileSync(file, data);
