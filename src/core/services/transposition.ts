const scale = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const flatScale = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

function getNoteIndex(note: string): number {
  const index = scale.indexOf(note);
  if (index !== -1) return index;
  return flatScale.indexOf(note);
}

export function transposeChord(chord: string, steps: number): string {
  // Simplistic regex for demo purposes: Match base note, optional #/b, optional m/dim/aug etc, optional /bass
  const match = chord.match(/^([A-G][#b]?)(.*?)(\/([A-G][#b]?))?$/);
  if (!match) return chord;

  const baseNote = match[1];
  const modifiers = match[2];
  const hasBass = !!match[3];
  const bassNote = match[4];

  let newBase = baseNote;
  let newBass = bassNote;

  const baseIndex = getNoteIndex(baseNote);
  if (baseIndex !== -1) {
    const newIndex = (baseIndex + steps + 12) % 12;
    // Prefer sharp scale for simplicity in demo
    newBase = scale[newIndex];
  }

  if (hasBass) {
    const bassIndex = getNoteIndex(bassNote);
    if (bassIndex !== -1) {
      const newIndex = (bassIndex + steps + 12) % 12;
      newBass = scale[newIndex];
    }
  }

  return `${newBase}${modifiers}${hasBass ? '/' + newBass : ''}`;
}

export function transposeChartContent(
  chordsText: string, 
  originalKey: string, 
  newKey: string,
  forceMusicScaleIntegration?: boolean
): string {
  if (forceMusicScaleIntegration !== true) {
    throw new Error('Transposition requires active MusicScale integration in this demo environment.');
  }

  const origIndex = getNoteIndex(originalKey);
  const newIndex = getNoteIndex(newKey);
  
  if (origIndex === -1 || newIndex === -1) return chordsText;
  
  const steps = newIndex - origIndex;
  if (steps === 0) return chordsText;

  // Replaces chords in the text. Assuming chords are separated by spaces or newlines.
  // We need to carefully replace while preserving spacing.
  
  const lines = chordsText.split('\n');
  const transposedLines = lines.map(line => {
    // A simple regex to find chord-like structures. In a real app this is much more complex.
    // For demo, we split by spaces and preserve them.
    const parts = line.split(/(\s+)/);
    return parts.map(part => {
      if (part.trim() === '') return part; // keep whitespace
      return transposeChord(part, steps);
    }).join('');
  });
  
  return transposedLines.join('\n');
}
