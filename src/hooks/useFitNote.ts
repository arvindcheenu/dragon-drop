import useGPT from './useGPT';
import { AxisLabels } from './useAxisLabels';
import { StickyNote } from '@/App';

export interface FitNoteProps {
  rx: string | number;
  ry: string | number;
  reason: string;
}

export default function useFitNote(labels: AxisLabels, items: StickyNote[]) {
  const systemMessage = 'You are a helpful assistant that maps data to a numerical two-dimensional coordinate system.';
  function contextBuilder(labels: AxisLabels, items: StickyNote[], noteToFit: StickyNote) {
    const lockedNotes = items.filter(note => note.locked);
    const labelsJSON = JSON.stringify(labels, null, 2);
    const lockedNotesJSON = JSON.stringify(lockedNotes, null, 2);
    const noteToFitJSON = JSON.stringify(noteToFit, null, 2);
    return `
    Axis Labels: 
    ${labelsJSON}

    Locked Sticky Note Items: 
    ${lockedNotesJSON}

    Note to Fit:
    ${noteToFitJSON}`;
  }
  function promptGenerator(noteToFit: StickyNote) {
    return `Given the context of the following Axis Labels and Locked Sticky Note Items, define relative coordinates rx and ry where the "Note to Fit" would fit better semantically and reply only as raw JSON data without special characters. Do not choose the same coordinates as the "Note to Fit".

    Sample Response:
    {"rx": number for relative x coordinate (0,9), "ry": number for relative y coordinate (0,9), "reason": "reason for choosing this relative coordinate" }:

    ${contextBuilder(labels, items, noteToFit)}
    `;
  }

  return useGPT<FitNoteProps>({ systemMessage, promptGenerator, parsable: true });
}
