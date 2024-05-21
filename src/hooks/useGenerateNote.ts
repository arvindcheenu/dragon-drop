import useGPT from './useGPT';
import { AxisLabels } from './useAxisLabels';
import { StickyNote } from '@/App';

export interface GenerateNoteProps {
  content: string;
  reason: string;
}

export default function useGenerateNote(labels: AxisLabels, items: StickyNote[]) {
  const systemMessage = 'You are a helpful assistant that maps data to a numerical two-dimensional coordinate system.';
  function contextBuilder() {
    const labelsJSON = JSON.stringify(labels, null, 2);
    const itemsJSON = JSON.stringify(items, null, 2);
    return `
    Axis Labels: 
    ${labelsJSON}

    Existing Notes: 
    ${itemsJSON}
    `;
  }

  function promptGenerator(context: string) {
    return `Given the context of the following Axis Labels and Existing Notes, create new note that semantically fits the Chosen Coordinates. Only reply with raw JSON data without any special characters.

    Sample Response:
    { "content": "content for the new note", "reason": "reason for choosing this content for the relative coordinate" }

    ${contextBuilder()}
    
    Chosen Coordinates:
    ${context}`
    ;
  }

  return useGPT<GenerateNoteProps>({
    systemMessage,
    promptGenerator,
    parsable: true
  });
}
