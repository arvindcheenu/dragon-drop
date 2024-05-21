import useGPT from './useGPT';
export interface AxisLabels {
  x: { label: string; brief: string };
  y: { label: string; brief: string };
}
export default function useAxisLabels() {
  const systemMessage = 'You are a helpful assistant that maps data to a numerical two-dimensional coordinate system.';
  const promptGenerator = (context: string) => `Given the context of: "${context}", define the directions of the axis and reply as raw JSON data without special characters:
  {
    "x": {"label": "custom label for x axis", "brief": "brief for choosing this label for x axis"},
    "y": {"label": "custom label for y axis", "brief": "brief for choosing this label for y axis"}
  }`;
  return useGPT<AxisLabels>({ systemMessage, promptGenerator, parsable: true });
}
