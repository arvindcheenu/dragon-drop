import useGPT from './useGPT';
import { AxisLabels } from './useAxisLabels';
import { StickyNote } from '@/App';
export interface AddNoteProps {
  rx: string | number;
  ry: string | number;
  reason: string;
}
export default function useAddNote(labels: AxisLabels, items: StickyNote[]) {
  const systemMessage = 'You are a helpful assistant that maps data to a numerical two-dimensional coordinate system.';
  function contextBuilder (labels: AxisLabels, items: StickyNote[]) {
    const labelsJSON = JSON.stringify(labels, null, 2);
    const itemsJSON = JSON.stringify(items, null, 2);
    return `
    Axis Labels: 
    ${labelsJSON}
    
    Sticky Note Items: 
    ${itemsJSON}`;
  }
  function promptGenerator (context: string) {
    return  `Given the context of the following Axis Labels and Sticky Note Items, define relative coordinates rx and ry for the given New Note Content and reply only as the raw JSON data without special characters. 
    
    Sample Response:
    {"rx": number for relative x coordinate (0,9), "ry": number for relative y coordinate (0,9), "reason": "reason for choosing this relative coordinate" }:
    
    ${contextBuilder(labels, items)}

    New Note Content:
    ${context}
    `
  }
  return useGPT<AddNoteProps>({ systemMessage, promptGenerator, parsable: true });
}
