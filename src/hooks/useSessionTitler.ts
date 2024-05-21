import useGPT from './useGPT';
import { AxisLabels } from './useAxisLabels';
import { StickyNote } from '@/App';
export interface SessionTitle {
  label: string;
}
export default function useSessionTitler(labels: AxisLabels, items: StickyNote[]) {
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
    return  `Given the context of the following Axis Labels and Sticky Note Items, define a title for the session and reply as raw JSON data without special characters like: {"label": "custom label for session title" }:
    ${contextBuilder(labels, items)}
    ${context}
    `
  }
  return useGPT<SessionTitle>({ systemMessage, promptGenerator, parsable: true });
}
