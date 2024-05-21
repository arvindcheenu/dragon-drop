import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useSessionStorage } from "@uidotdev/usehooks";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import useHotkeys from "@reecelucas/react-use-hotkeys";
import { AlertCircle, AppWindow, BadgeHelpIcon, CornerDownLeft, Edit3Icon, FocusIcon, Loader, LockIcon, LucideUnlock, PlusIcon, SearchXIcon, SparklesIcon, Sticker, StickyNote, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import History from "./components/HistoryDrawer";
import { ScrollArea } from "./components/ui/scroll-area";
import { Card } from "./components/ui/card";
import { Badge } from "./components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Input } from "./components/ui/input";
import { useState, useRef, useCallback, useEffect } from "react";
import { Rnd } from "react-rnd";
import useResizeObserver from "use-resize-observer";
import useAxisLabels, { AxisLabels } from "@/hooks/useAxisLabels";
import { capitalize } from "./lib/utils";
import useSessionTitler from "./hooks/useSessionTitler";
import useAddNote from "./hooks/useAddNote";
import useFitNote from "./hooks/useFitNote";
import useGenerateNote from "./hooks/useGenerateNote";
import ReactTimeAgo from 'react-time-ago'

export interface StickyNote {
  id: number;
  ax: number;
  ay: number;
  rx: number;
  ry: number;
  width: number;
  height: number;
  content: string;
  locked: boolean;
  selected: boolean;
  brief?: string;
  isai?: boolean;
  session: number;
}
export interface SessionState {
  id: number;
  title: string;
  created_at: Date;
}
function App() {
  const gridRef = useRef<HTMLDivElement>(null);
  const { width: gridWidth, height: gridHeight } = useResizeObserver({ ref: gridRef });
  const [stickies, setStickies] = useSessionStorage<StickyNote[]>("dnd-stickies", []);
  const [sessions, setSessions] = useSessionStorage<SessionState[]>("dnd-sessions", []);
  const [activeSession, setActiveSession] = useSessionStorage("dnd-active-session", 0);
  const [selectedStickyId, setSelectedStickyId] = useState<number | null>(null);
  const [editingStickyId, setEditingStickyId] = useState<number | null>(null);
  const [contextMenuCoords, setContextMenuCoords] = useState({ x: 0, y: 0 });
  const [sessionTitle, setSessionTitle] = useState("Title of the Session");
  const [note, setNote] = useState("");
  const [axisLabelsResult, setAxisLabelsResult] = useState<AxisLabels>({
    x: { label: "X Axis Label", brief: "This label is for the X axis" },
    y: { label: "Y Axis Label", brief: "This label is for the Y axis" },
  });
  const {
    loading: axisLabelsLoading,
    error: axisLabelsError,
    generate: generateAxisLabels,
  } = useAxisLabels();
  const handleGenerateAxisLabels = async () => {
    const result = await generateAxisLabels(sessionTitle);
    if (result?.parsed) setAxisLabelsResult(result.parsed);
  }
  const {
    loading: sessionTitlerLoading,
    error: sessionTitlerError,
    generate: generateSessionTitle,
  } = useSessionTitler(axisLabelsResult, stickies);
  const handleGenerateSessionTitle = async () => {
    const result = await generateSessionTitle(sessionTitle);
    if (result?.parsed) setSessionTitle(result.parsed.label);
  }
  const {
    loading: addNoteLoading,
    error: addNoteError,
    generate: generateAddNote,
  } = useAddNote(axisLabelsResult, stickies);
  const handleAddToFitNew = async () => {
    const result = await generateAddNote(note);
    if (result?.parsed) {
      const { rx, ry, reason } = result.parsed;
      const { ax, ay } = computeAbsolutePosition(Number(rx), Number(ry), 120, 120);
      addSticky(Number(ax), Number(ay), note, reason, true);
      setNote("");
    }
  }
  const {
    loading: fitNoteLoading,
    generate: generateFitNote,
  } = useFitNote(axisLabelsResult, stickies);
  const handleFitNote = async (id: number) => {
    const noteContent = stickies.find(s => s.id === id)?.content;
    if (!noteContent) return;
    const result = await generateFitNote(noteContent);
    if (result?.parsed) {
      const { rx, ry, reason } = result.parsed;
      console.log(result.parsed)
      const { ax, ay } = computeAbsolutePosition(Number(rx), Number(ry), 120, 120);
      console.log(ax, ay)
      setStickies(stickies.map(s => s.id === id ? {
        ...s,
        ax: Number(ax),
        ay: Number(ay),
        rx: Number(rx),
        ry: Number(ry),
        isai: true,
        brief: reason
      } : s));
    }
  }
  const {
    loading: generateNoteLoading,
    generate: generateNote,
  } = useGenerateNote(axisLabelsResult, stickies);
  const handleGenerateNote = async (coordinates: {
    x: number;
    y: number;
  }) => {
    const result = await generateNote(JSON.stringify(coordinates, null, 2));
    if (result?.parsed) {
      const { content, reason } = result.parsed;
      addSticky(coordinates.x, coordinates.y, content, reason, true);
    }
  }
  const addSession = () => {
    setSessions([...sessions, {
      id: sessions.length + 1,
      title: "Title of the Session",
      created_at: new Date(),
    }]);
  }
  useHotkeys("Escape", () => {
    setSelectedStickyId(null);
    setEditingStickyId(null);
    setStickies(stickies.map(s => ({ ...s, selected: false })));
  });
  useHotkeys("Meta+Backspace", () => {
    if (selectedStickyId !== null) deleteSticky(selectedStickyId);
  });
  useHotkeys("Meta+Enter", () => {
    if (selectedStickyId !== null) enableEditing(selectedStickyId);
  });
  const computeAbsolutePosition = useCallback((rx: number, ry: number, width: number, height: number) => {
    if (gridWidth === undefined || gridHeight === undefined) return { ax: 0, ay: 0 };
    const ax = (rx / 10) * gridWidth - width / 2;
    const ay = (1 - ry / 10) * gridHeight - height / 2;
    return { ax, ay };
  }, [gridWidth, gridHeight]);
  const addSticky = (ax: number, ay: number, content = "", brief = "", isai = false) => {
    if (gridWidth === undefined || gridHeight === undefined) return;
    const rx = (ax / gridWidth) * 10;
    const ry = 10 - (ay / gridHeight) * 10;
    const newSticky: StickyNote = {
      id: Date.now(),
      ax,
      ay,
      rx,
      ry,
      width: 120,
      height: 120,
      content: content,
      locked: false,
      selected: true,
      brief: brief,
      isai: isai,
      session: activeSession,
    };
    setStickies([...stickies.map(s => ({ ...s, selected: false })), newSticky]);
    setSelectedStickyId(newSticky.id);
    setEditingStickyId(newSticky.id);
  };

  const updateStickyPosition = (id: number, ax: number, ay: number, width: number, height: number) => {
    if (gridWidth === undefined || gridHeight === undefined) return;
    const rx = (ax + width / 2) / gridWidth * 10;
    const ry = 10 - (ay + height / 2) / gridHeight * 10;
    setStickies(stickies.map(sticky => sticky.id === id ? { ...sticky, ax, ay, rx, ry } : sticky));
  };
  const enableEditing = (id: number) => {
    setEditingStickyId(id);
  };
  const editStickyContent = (id: number, newContent: string) => {
    setStickies(stickies.map(sticky => sticky.id === id ? { ...sticky, content: newContent, isai: false } : sticky));
  };
  const deleteSticky = (id: number) => {
    setStickies(stickies.filter(sticky => sticky.id !== id));
    if (id === selectedStickyId) setSelectedStickyId(null);
  };
  const lockUnlockSticky = (id: number, lock: boolean) => {
    setStickies(stickies.map(sticky => sticky.id === id ? { ...sticky, locked: lock } : sticky));
  };
  const handleContextMenuAction = (action: string) => {
    if (action === "add") {
      addSticky(contextMenuCoords.x, contextMenuCoords.y);
    }
    else if (action === "generate") {
      console.log(contextMenuCoords);
      handleGenerateNote(contextMenuCoords);
    }
    else if (selectedStickyId !== null) {
      if (action === "edit") enableEditing(selectedStickyId);
      else if (action === "delete") deleteSticky(selectedStickyId);
      else if (action === "lock") lockUnlockSticky(selectedStickyId, true);
      else if (action === "unlock") lockUnlockSticky(selectedStickyId, false);
      else if (action === "fit") handleFitNote(selectedStickyId);
    }
  };
  const handleContextMenu = (e: React.MouseEvent) => {
    if (!gridRef.current) return;
    const sticky = stickies.find(s => {
      const [left, top] = gridRef?.current?.getBoundingClientRect() ? [gridRef.current.getBoundingClientRect().left, gridRef.current.getBoundingClientRect().top] : [0, 0];
      const x = e.clientX - left;
      const y = e.clientY - top;
      return x >= s.ax && x <= s.ax + s.width && y >= s.ay && y <= s.ay + s.height;
    });
    setSelectedStickyId(sticky ? sticky.id : null);
    if (!sticky) {
      setEditingStickyId(null);
    }
    setStickies(stickies.map(s => ({ ...s, selected: s.id === (sticky ? sticky.id : null) })));
    const rect = gridRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setContextMenuCoords({ x, y });
  };
  useEffect(() => {
    if (gridWidth === undefined || gridHeight === undefined) return;
    setStickies(stickies.map(sticky => {
      const { ax, ay } = computeAbsolutePosition(sticky.rx, sticky.ry, sticky.width, sticky.height);
      return { ...sticky, ax, ay };
    }));
  }, [gridWidth, gridHeight, computeAbsolutePosition, stickies]);
  return (
    <main className="flex flex-col items-center justify-center h-screen">
      <ResizablePanelGroup direction="horizontal" className="bg-zinc-900/30 border-t border-zinc-800">
        <ResizablePanel defaultSize={20} minSize={20} maxSize={20} className="bg-muted/10 border-r">
          <div className="flex flex-col items-center h-full">
            <h1 className="text-left text-lg px-4 font-medium py-4 pb-2 w-full">Sessions</h1>
            <ScrollArea className="h-full w-full relative">
              <div className="w-[calc(100%-16px)] left-2 bottom-2 absolute">
                <Button tabIndex={0} className="w-full gap-2" variant={"secondary"} onClick={addSession}>
                  <PlusIcon className="size-4" />
                  <span className="text-ellipsis overflow-hidden whitespace-nowrap">
                    Add Session
                  </span>
                </Button>
              </div>
              {sessions.map((session) => (
                <div className="group p-2 px-4" key={session.id - 1}>
                  <Card
                    className={"w-full border rounded-lg p-4 py-2.5 pr-2.5 cursor-pointer group-hover:bg-muted shadow-sm transition-all" + (activeSession === session.id - 1 ? " bg-green-700" : "")}
                    onClick={() => setActiveSession(session.id - 1)}
                  >
                    <div className="flex flex-col justify-between gap-1">
                      <div className="text-sm font-medium">{sessionTitle}</div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="w-fit font-normal text-xs"><ReactTimeAgo date={session.created_at} locale="en-US" timeStyle={"round"}></ReactTimeAgo></div>
                        <Badge className="group-hover:bg-white/50">
                          <div className="flex items-center gap-2">
                            <Sticker className="size-3" />
                            <span>{stickies.filter(s => s.session === session.id - 1).length}</span>
                          </div>
                        </Badge>
                      </div>
                    </div>
                  </Card>
                </div>
              ))}
            </ScrollArea>
          </div>
        </ResizablePanel>
        <ResizablePanel minSize={4} className="m-5">
          <div className="relative flex h-full min-h-[50vh] flex-col border border-zinc-800 rounded-xl bg-muted/30 p-4 lg:col-span-2 gap-1">
            <h1>
              <Popover>
                <PopoverTrigger asChild>
                  <Button tabIndex={0} variant="ghost" className="text-lg font-medium">{sessionTitle}</Button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <h4 className="font-medium leading-none">Customize Current Session Title</h4>
                      <p className="text-sm text-muted-foreground">
                        Create or Generate a Contextual Title for the Session you are currently working on.
                      </p>
                    </div>
                    <div className="grid gap-4">
                      <div className="grid grid-cols-3 items-center gap-4">
                        <Label htmlFor="width">Session Title</Label>
                        <Input
                          id="width"
                          value={sessionTitle}
                          disabled={sessionTitlerLoading}
                          onChange={(e) => setSessionTitle(e.target.value)}
                          className="col-span-2 h-8"
                        />
                      </div>
                      <div className="grid grid-cols-3 items-center gap-2">
                        <Button tabIndex={1} variant="default" onClick={handleGenerateSessionTitle} className="col-span-4 disabled:bg-muted disabled:text-muted-foreground disabled:border disabled:border-gray-700" disabled={
                          sessionTitlerLoading || stickies.length === 0 || stickies.every(s => s.content === "" || axisLabelsResult === null)
                        }>
                          <div className="flex items-center justify-center gap-2">
                            {sessionTitlerLoading ? <Loader className="animate-spin size-6" /> : <SparklesIcon className="size-4" />}
                            <span>Generate from Stickies and Axes</span>
                          </div>
                        </Button>
                        {sessionTitlerError && <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>Error</AlertTitle>
                          <AlertDescription>
                            {sessionTitlerError}
                          </AlertDescription>
                        </Alert>}
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </h1>
            <div>
              <History>
                {stickies.filter(s => s.session === activeSession).length === 0 && <div className="flex flex-col items-center justify-center h-[80vh] text-muted-foreground">
                  <SearchXIcon className="size-16 mb-5" />
                  <div className="text-xl font-semibold mb-4">Nothing to see here.</div>
                  <div className="text-sm">No notes created yet to show in this session.</div>
                  <div className="text-sm">Start by adding a note.</div>
                </div>}
                {stickies.filter(s => s.session === activeSession).length > 0 && <Card className="mb-2">
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2">
                          <AppWindow className="size-4" />
                          <div className="flex flex-col">
                            <div className="text-xs text-muted-foreground">New session created <ReactTimeAgo date={sessions[activeSession].created_at} locale="en-US" timeStyle={"round"}></ReactTimeAgo></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>}
                {stickies.filter(s => s.session === activeSession).map((sticky, i) => (
                  <Card key={i} className="mb-2 hover:bg-muted/40">
                    <div className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-2">
                            <StickyNote className="size-4" />
                            <div className="flex flex-col">
                              <div className="text-xs text-muted-foreground">New sticky created <ReactTimeAgo date={sticky.id} locale="en-US" timeStyle={"round"}></ReactTimeAgo></div>
                              <div className="text-sm mt-1">{
                                sticky.content.length > 20 ? sticky.content.slice(0, 20) + "..." : sticky.content
                              }</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </History>
            </div>
            <div className="flex gap-0 h-full w-full rounded-md relative">
              <ContextMenu>
                <ContextMenuTrigger onContextMenu={handleContextMenu} className="flex items-center justify-center border rounded-md bg-background bg-plus-pattern w-full" ref={gridRef}>
                  {stickies.filter(s => s.session === activeSession).length <= 0 && <div className="flex flex-col items-center justify-center h-full text-muted pointer-events-none z-0">
                    <svg width="402" height="178" viewBox="0 0 402 178" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M357.43 132.696V137.104C357.583 137.257 357.835 137.334 358.186 137.334C358.537 137.334 358.789 137.213 358.943 136.972C359.096 136.731 359.173 136.314 359.173 135.722V132.367C359.173 130.262 359.085 128.869 358.91 128.19C358.734 127.488 358.405 127.137 357.923 127.137C357.616 127.137 357.353 127.247 357.134 127.466C357.331 129.637 357.43 131.38 357.43 132.696ZM346.937 118.519C346.937 119.177 347.321 119.506 348.088 119.506C349.404 117.445 350.95 115.92 352.726 114.934C354.502 113.925 356.64 113.421 359.14 113.421C361.64 113.421 363.921 113.815 365.982 114.605C368.811 115.723 371.047 117.521 372.692 119.999C374.753 123.135 375.784 127.247 375.784 132.334C375.784 138.057 374.249 142.509 371.179 145.689C368.131 148.846 363.899 150.425 358.482 150.425C355.456 150.425 353.099 150.052 351.41 149.307C351.257 149.395 351.18 149.581 351.18 149.866C351.18 150.524 351.684 150.995 352.693 151.28C353.724 151.565 355.489 151.774 357.989 151.905V160.655C355.73 161.664 353.252 162.168 350.555 162.168C347.375 162.168 344.974 161.587 343.351 160.425C341.509 159.175 340.588 157.256 340.588 154.668V128.19C339.295 126.369 338.648 124.111 338.648 121.414C338.648 120.317 338.823 119.122 339.174 117.828C339.525 116.534 339.996 115.427 340.588 114.506H345.259C347.167 114.506 348.625 114.769 349.634 115.296C347.836 116.633 346.937 117.708 346.937 118.519Z" fill="currentColor" />
                      <path d="M318.813 132.137V137.893C318.967 138.046 319.219 138.123 319.57 138.123C319.921 138.123 320.173 138.003 320.326 137.761C320.48 137.52 320.557 137.104 320.557 136.511V131.808C320.557 129.703 320.469 128.31 320.293 127.63C320.118 126.929 319.789 126.578 319.307 126.578C319 126.578 318.737 126.687 318.517 126.907C318.715 129.078 318.813 130.821 318.813 132.137ZM306.511 146.708C302.915 143.244 301.117 138.551 301.117 132.63C301.117 126.687 302.805 122.006 306.182 118.585C309.581 115.142 314.033 113.421 319.537 113.421C325.041 113.421 329.493 115.208 332.891 118.782C336.268 122.357 337.957 127.016 337.957 132.762C337.957 138.485 336.323 143.035 333.056 146.412C329.811 149.789 325.392 151.478 319.8 151.478C314.208 151.478 309.779 149.888 306.511 146.708Z" fill="currentColor" />
                      <path d="M280.098 150.886C277.489 150.886 275.406 150.414 273.849 149.471C272.116 148.485 271.25 147.026 271.25 145.097V128.157C269.956 126.337 269.309 124.1 269.309 121.446C269.309 118.771 269.956 116.458 271.25 114.506H276.283C278.87 114.506 280.723 115.339 281.842 117.006C281.293 117.62 280.811 118.398 280.394 119.341C279.978 120.284 279.769 120.964 279.769 121.381C279.769 121.775 279.868 122.071 280.065 122.269C280.285 122.466 280.592 122.565 280.986 122.565C281.754 119.517 283.212 117.28 285.361 115.855C287.137 114.649 289.33 114.046 291.94 114.046C295.185 114.046 297.729 114.736 299.571 116.118C300.229 117.872 300.558 120.021 300.558 122.565C300.558 125.087 300.053 127.378 299.045 129.439C298.299 129.834 297.268 130.174 295.953 130.459C294.637 130.722 293.31 130.854 291.973 130.854C290.635 130.854 289.429 130.766 288.354 130.591C287.302 130.393 286.534 130.218 286.052 130.064C285.876 130.24 285.789 130.492 285.789 130.821C285.789 131.15 285.997 131.402 286.414 131.578C286.852 131.731 287.576 131.906 288.585 132.104V148.616C286.194 150.129 283.366 150.886 280.098 150.886Z" fill="currentColor" />
                      <path d="M248.455 127.762C248.455 125.569 248.357 124.067 248.159 123.256C247.962 122.422 247.6 122.006 247.074 122.006C246.745 122.006 246.449 122.115 246.186 122.335C246.229 122.729 246.295 123.256 246.383 123.913C246.471 124.571 246.515 125.975 246.515 128.124V130.262C246.515 131.753 246.482 132.838 246.416 133.518C246.35 134.198 246.295 134.779 246.251 135.262C246.229 135.525 246.208 135.788 246.186 136.051C246.449 136.27 246.745 136.38 247.074 136.38C247.6 136.38 247.962 135.974 248.159 135.163C248.357 134.33 248.455 132.816 248.455 130.624V127.762ZM236.186 150.491C233.752 150.491 231.866 149.844 230.529 148.55C229.213 147.257 228.555 145.305 228.555 142.695V113.092C228.555 111.425 230.222 110.022 233.555 108.881C236.91 107.719 240.649 107.138 244.771 107.138C252.03 107.138 257.698 108.892 261.777 112.401C266.163 116.173 268.355 121.797 268.355 129.275C268.355 136.007 266.228 141.226 261.974 144.932C257.742 148.638 251.92 150.491 244.508 150.491H236.186Z" fill="currentColor" />
                      <path d="M225.331 134.176C225.331 135.755 225.507 137.027 225.858 137.992C226.209 138.957 226.823 139.713 227.7 140.261C227.722 140.371 227.733 140.579 227.733 140.886V141.478C227.733 144.504 226.856 146.862 225.101 148.55C223.369 150.217 221.121 151.05 218.358 151.05C215.617 151.05 213.391 150.272 211.681 148.715C209.685 146.939 208.688 144.241 208.688 140.623C208.688 139.088 208.753 137.739 208.885 136.577C209.038 135.393 209.137 134.549 209.181 134.044C209.247 133.54 209.313 133.069 209.378 132.63C209.444 132.192 209.477 131.545 209.477 130.689C209.477 129.834 209.356 129.22 209.115 128.847C208.896 128.475 208.578 128.288 208.161 128.288C207.767 128.288 207.416 128.376 207.109 128.551L207.536 133.913C207.142 136.128 206.944 138.474 206.944 140.952C206.944 143.43 207.503 145.689 208.622 147.728C206.473 149.943 203.458 151.05 199.576 151.05C197.361 151.05 195.443 150.469 193.82 149.307C191.934 147.991 190.991 146.248 190.991 144.077V128.157C189.697 126.337 189.051 124.1 189.051 121.446C189.051 118.771 189.697 116.458 190.991 114.506H196.846C198.403 114.506 199.73 115.087 200.826 116.249C199.861 117.148 199.379 117.894 199.379 118.486C199.379 119.166 199.763 119.506 200.53 119.506C201.495 117.839 202.964 116.458 204.938 115.361C206.933 114.265 209.192 113.717 211.714 113.717C215.507 113.717 218.588 114.649 220.957 116.513C223.939 118.859 225.43 122.499 225.43 127.433L225.331 134.176Z" fill="currentColor" />
                      <path d="M152.802 126.874C152.802 126.084 152.506 125.69 151.914 125.69C151.366 125.69 151.092 126.019 151.092 126.676V130.064C151.267 130.218 151.531 130.295 151.881 130.295C152.232 130.295 152.474 130.163 152.605 129.9C152.737 129.637 152.802 129.154 152.802 128.453V126.874ZM154.019 140.195C152.616 140.195 151.421 140.097 150.434 139.899C150.368 140.097 150.335 140.283 150.335 140.459C150.335 140.941 150.675 141.27 151.355 141.445C152.057 141.599 152.945 141.676 154.019 141.676C157.44 141.676 160.357 141.171 162.769 140.163C165.137 140.777 166.979 142.114 168.295 144.176C169.37 145.864 169.907 147.849 169.907 150.129C169.907 154.186 168.185 157.344 164.743 159.602C161.3 161.861 156.859 162.99 151.421 162.99C146.005 162.99 141.816 162.025 138.856 160.096C136.115 158.341 134.744 156.061 134.744 153.254C134.744 152.18 134.996 151.149 135.501 150.162C136.005 149.153 136.586 148.463 137.244 148.09C138.34 149.011 139.952 149.756 142.079 150.327C144.228 150.897 146.432 151.182 148.691 151.182C150.949 151.182 152.397 151.094 153.033 150.919C153.691 150.743 154.019 150.436 154.019 149.998C154.019 149.778 153.954 149.559 153.822 149.34C152.726 149.581 151.355 149.702 149.71 149.702C145.478 149.702 142.156 149.099 139.744 147.892C136.805 146.445 135.336 144.263 135.336 141.347C135.336 140.206 135.567 139.154 136.027 138.189C136.488 137.202 137.167 136.468 138.066 135.985C136.86 135.24 135.83 134.11 134.974 132.597C134.141 131.084 133.725 129.22 133.725 127.005C133.725 122.795 135.303 119.473 138.461 117.039C141.619 114.605 145.719 113.388 150.763 113.388C153.197 113.388 155.544 113.793 157.802 114.605V112.302C159.096 111.798 160.806 111.546 162.933 111.546C165.082 111.546 166.716 111.908 167.835 112.631C169.194 113.508 169.874 115.054 169.874 117.269C169.874 118.497 169.742 119.484 169.479 120.229C169.238 120.975 168.876 121.753 168.394 122.565C168.964 124.012 169.249 125.81 169.249 127.959C169.249 131.841 167.867 134.856 165.104 137.005C162.363 139.132 158.668 140.195 154.019 140.195Z" fill="currentColor" />
                      <path d="M130.764 134.176C130.764 135.755 130.94 137.027 131.29 137.992C131.641 138.957 132.255 139.713 133.132 140.261C133.154 140.371 133.165 140.579 133.165 140.886V141.478C133.165 144.592 132.222 147.015 130.337 148.748C128.67 150.283 126.609 151.05 124.153 151.05C122.486 151.05 120.962 150.655 119.581 149.866C118.199 149.077 117.212 147.936 116.62 146.445C115.875 146.445 115.502 146.807 115.502 147.531C115.502 148.145 115.886 148.835 116.653 149.603C115.228 150.568 113.079 151.05 110.206 151.05C106.149 151.05 102.904 149.954 100.47 147.761C98.0576 145.546 96.8515 142.465 96.8515 138.518C96.8515 134.549 98.1343 131.479 100.7 129.308C103.046 127.356 106.083 126.38 109.811 126.38C111.083 126.38 112.311 126.468 113.495 126.644C114.285 126.797 114.712 126.885 114.778 126.907C114.844 126.687 114.877 126.501 114.877 126.348C114.877 125.777 114.394 125.394 113.43 125.196C112.465 124.999 111.204 124.9 109.647 124.9C106.336 124.9 103.507 125.569 101.16 126.907C100.086 125.087 99.5487 122.784 99.5487 119.999C99.5487 118.42 99.7461 117.247 100.141 116.48C101.72 115.756 103.726 115.12 106.16 114.572C108.594 114.002 111.16 113.717 113.857 113.717C119.427 113.717 123.637 114.934 126.488 117.368C129.339 119.802 130.764 123.256 130.764 127.729V134.176ZM113.693 135.788C112.772 135.788 112.311 136.204 112.311 137.038C112.311 137.827 112.848 138.222 113.923 138.222C114.669 138.222 115.217 138.046 115.568 137.696C115.918 137.323 116.094 136.687 116.094 135.788C116.094 135.788 115.293 135.788 113.693 135.788Z" fill="currentColor" />
                      <path d="M77.5433 150.886C74.9338 150.886 72.8506 150.414 71.2936 149.471C69.5613 148.485 68.6951 147.026 68.6951 145.097V128.157C67.4013 126.337 66.7544 124.1 66.7544 121.446C66.7544 118.771 67.4013 116.458 68.6951 114.506H73.7277C76.3153 114.506 78.1683 115.339 79.2866 117.006C78.7384 117.62 78.256 118.398 77.8393 119.341C77.4227 120.284 77.2144 120.964 77.2144 121.381C77.2144 121.775 77.313 122.071 77.5104 122.269C77.7297 122.466 78.0367 122.565 78.4314 122.565C79.1989 119.517 80.6572 117.28 82.8062 115.855C84.5824 114.649 86.7753 114.046 89.3848 114.046C92.6302 114.046 95.1739 114.736 97.0159 116.118C97.6738 117.872 98.0027 120.021 98.0027 122.565C98.0027 125.087 97.4984 127.378 96.4896 129.439C95.7441 129.834 94.7134 130.174 93.3977 130.459C92.082 130.722 90.7553 130.854 89.4177 130.854C88.08 130.854 86.8739 130.766 85.7994 130.591C84.7469 130.393 83.9794 130.218 83.4969 130.064C83.3215 130.24 83.2338 130.492 83.2338 130.821C83.2338 131.15 83.4421 131.402 83.8587 131.578C84.2973 131.731 85.021 131.906 86.0297 132.104V148.616C83.6395 150.129 80.8107 150.886 77.5433 150.886Z" fill="currentColor" />
                      <path d="M45.9003 127.762C45.9003 125.569 45.8016 124.067 45.6042 123.256C45.4069 122.422 45.045 122.006 44.5187 122.006C44.1898 122.006 43.8938 122.115 43.6306 122.335C43.6745 122.729 43.7403 123.256 43.828 123.913C43.9157 124.571 43.9596 125.975 43.9596 128.124V130.262C43.9596 131.753 43.9267 132.838 43.8609 133.518C43.7951 134.198 43.7403 134.779 43.6964 135.262C43.6745 135.525 43.6526 135.788 43.6306 136.051C43.8938 136.27 44.1898 136.38 44.5187 136.38C45.045 136.38 45.4069 135.974 45.6042 135.163C45.8016 134.33 45.9003 132.816 45.9003 130.624V127.762ZM33.6312 150.491C31.1971 150.491 29.3112 149.844 27.9736 148.55C26.6579 147.257 26 145.305 26 142.695V113.092C26 111.425 27.6666 110.022 30.9997 108.881C34.3548 107.719 38.0937 107.138 42.2162 107.138C49.4746 107.138 55.1432 108.892 59.2219 112.401C63.6076 116.173 65.8005 121.797 65.8005 129.275C65.8005 136.007 63.6734 141.226 59.4193 144.932C55.187 148.638 49.365 150.491 41.9531 150.491H33.6312Z" fill="currentColor" />
                      <path fill-rule="evenodd" clipRule="evenodd" d="M118.054 64.6432L147.01 59.3382L131.792 70.79C130.111 72.4706 131.302 75.3431 133.677 75.3431H170.806C169.232 70.9418 168.35 66.262 168.35 61.4422V54.395L148.389 39.7905C144.417 37.143 139.171 37.4548 135.541 40.5557L115.969 59.9517C113.905 61.6739 115.393 65.0233 118.054 64.6432ZM210.895 70.3282L194.113 61.9407C192.784 61.2762 191.666 60.2549 190.885 58.9911C190.104 57.7272 189.69 56.2709 189.69 54.7851V48.6682H200.36L205.043 52.4411C206.043 53.4414 207.4 54.0032 208.816 54.0032H213.979C214.97 54.0031 215.941 53.7272 216.783 53.2063C217.626 52.6854 218.307 51.9401 218.75 51.054L221.136 46.2825C221.579 45.3963 221.767 44.4043 221.678 43.4176C221.589 42.4309 221.227 41.4884 220.633 40.6958L208.207 24.1273C207.198 22.7836 205.618 22 203.939 22H164.352C163.163 22 162.568 23.4288 163.408 24.269L173.685 32.6633L163.752 36.8046C162.768 37.2964 162.768 38.6985 163.752 39.1903L173.685 43.3332V61.4422C173.685 73.4592 179.692 84.681 189.69 91.3481C157.981 92.4521 133.622 97.8738 118.576 101.223L117.317 101.503C115.964 101.803 115 103.005 115 104.392C115 106.026 116.325 107.36 117.961 107.36H170.999C170.995 107.492 170.992 107.627 170.992 107.763C170.992 109.714 171.65 111.315 172.966 112.565C174.172 113.771 175.685 114.374 177.505 114.374C178.865 114.374 179.928 114.144 180.696 113.683C180.783 113.815 180.86 113.925 180.926 114.012C181.014 114.078 181.057 114.221 181.057 114.44C181.057 114.901 180.718 115.251 180.038 115.493C179.38 115.734 178.415 115.854 177.143 115.854C175.893 115.854 174.665 115.482 173.459 114.736C172.933 115.35 172.67 116.172 172.67 117.203C172.67 118.541 173.185 119.593 174.216 120.361C175.246 121.106 176.606 121.479 178.294 121.479C180.992 121.479 183.305 120.492 185.235 118.519C187.187 116.523 188.162 113.716 188.162 110.098C188.162 109.13 188.073 108.217 187.894 107.36H196.721C198.043 107.96 199.474 108.055 201.011 107.643C201.346 107.553 201.658 107.454 201.948 107.345C202.804 107.314 203.651 107.23 204.485 107.097C204.448 107.431 204.202 107.755 203.747 108.067C203.174 108.471 202.273 108.837 201.045 109.166C199.837 109.49 198.555 109.447 197.197 109.039C196.847 109.769 196.806 110.631 197.073 111.627C197.419 112.919 198.189 113.802 199.383 114.277C200.572 114.73 201.982 114.738 203.613 114.301C206.218 113.603 208.197 112.051 209.55 109.645C210.317 108.283 210.722 106.755 210.765 105.06C216.861 101.969 221.29 96.0287 221.671 88.894C222.091 81.0115 217.882 73.8226 210.895 70.3282ZM196.555 33.0451L204.166 34.9473C203.707 36.7662 202.087 38.0966 200.143 37.9916C197.982 37.8732 195.833 35.9026 196.555 33.0451Z" fill="currentColor" fillOpacity="0.61" />
                    </svg>
                    <div className="text-muted text-md font-bold">Right Click on the canvas to start adding your first note.</div>
                  </div>}
                  {stickies.filter(s => s.session === activeSession).map(sticky => (
                    <Rnd
                      key={sticky.id}
                      size={{ width: sticky.width, height: sticky.height }}
                      position={{ x: sticky.ax, y: sticky.ay }}
                      onDragStop={(_e, d) => updateStickyPosition(sticky.id, d.x, d.y, sticky.width, sticky.height)}
                      onResizeStop={(_e, _dir, ref, _delta, position) => {
                        const newWidth = parseInt(ref.style.width, 10);
                        const newHeight = parseInt(ref.style.height, 10);
                        updateStickyPosition(sticky.id, position.x, position.y, newWidth, newHeight);
                        setStickies(stickies.map(s => s.id === sticky.id ? { ...s, width: newWidth, height: newHeight } : s));
                      }}
                      enableUserSelectHack={true}
                      disableDragging={sticky.locked}
                      enableResizing={!sticky.locked}
                      bounds="parent"
                      onClick={() => {
                        setSelectedStickyId(sticky.id);
                        setStickies(stickies.map(s => ({ ...s, selected: s.id === sticky.id })));
                      }}
                      className={`sticky break-words rounded-lg ${sticky.isai ? "bg-amber-600 outline-amber-500" : "bg-lime-600 outline-lime-500"} shadow-lg cursor-pointer ${sticky.selected ? "outline outline-offset-4" : ""}`}
                    >
                      <Tooltip>
                        <TooltipTrigger asChild>
                          {sticky.id === editingStickyId ? (
                            <Textarea
                              value={sticky.content}
                              onChange={(e) => editStickyContent(sticky.id, e.target.value)}
                              onBlur={() => setEditingStickyId(null)}
                              onKeyDown={(e) => e.key === "Escape" && setEditingStickyId(null)}
                              className="w-full h-full resize-none bg-muted border-2 border-stone-700 rounded-lg"
                              placeholder="Click to start typing..."
                              autoFocus
                            />
                          ) : (
                            <div className="p-2 px-3">{sticky.content}</div>
                          )}
                        </TooltipTrigger>
                        <TooltipContent className="mb-3">
                          {sticky.id === editingStickyId ?
                            <span>Press <kbd>esc</kbd> to exit editing mode</span>
                            : <span>Press <kbd>⌘ ⏎</kbd> to edit this note</span>
                          }
                        </TooltipContent>
                      </Tooltip>
                      {(sticky.brief && sticky.id !== editingStickyId) && <Popover>
                        <PopoverTrigger><BadgeHelpIcon fill="white" className={`size-5 ${sticky.isai ? "text-amber-600" : "text-lime-600"} absolute right-2 bottom-2`} /></PopoverTrigger>
                        <PopoverContent className="text-sm mt-16 items-center justify-center" side="bottom">
                          {sticky.brief}
                        </PopoverContent>
                      </Popover>}
                    </Rnd>
                  ))}
                </ContextMenuTrigger>
                <ContextMenuContent className="w-44">
                  <ContextMenuItem onClick={() => handleContextMenuAction("add")} disabled={selectedStickyId !== null || sessions.length === 0}>
                    <div className="flex flex-1 items-center justify-left gap-2">
                      <StickyNote className="size-4" />
                      <span>Add Note</span>
                    </div>
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => handleContextMenuAction("edit")} disabled={selectedStickyId === null}>
                    <div className="flex flex-1 items-center justify-left gap-2">
                      <Edit3Icon className="size-4" />
                      <span>Edit Note</span>
                    </div>
                    <ContextMenuShortcut>⌘⏎</ContextMenuShortcut>
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => handleContextMenuAction("delete")} disabled={selectedStickyId === null}>
                    <div className="flex flex-1 items-center justify-left gap-2">
                      <Trash2Icon className="size-4" />
                      <span>Delete Note</span>
                    </div>
                    <ContextMenuShortcut>⌘⌫</ContextMenuShortcut>
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem onClick={() => handleContextMenuAction("lock")} disabled={selectedStickyId === null || stickies.find(s => s.id === selectedStickyId)?.locked}>
                    <div className="flex flex-1 items-center justify-left gap-2">
                      <LockIcon className="size-4" />
                      <span>Learn Note</span>
                    </div>
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => handleContextMenuAction("unlock")} disabled={selectedStickyId === null || !stickies.find(s => s.id === selectedStickyId)?.locked}>
                    <div className="flex flex-1 items-center justify-left gap-2">
                      <LucideUnlock className="size-4" />
                      <span>Unlearn Note</span>
                    </div>
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem onClick={() => handleContextMenuAction("fit")} disabled={selectedStickyId === null || fitNoteLoading}>
                    <div className="flex flex-1 items-center justify-left gap-2">
                      {fitNoteLoading ? <Loader className="animate-spin size-6" /> : <FocusIcon className="size-4" />}
                      <span>Fit Note</span>
                    </div>
                  </ContextMenuItem>
                  {<ContextMenuItem onClick={() => handleContextMenuAction("generate")} disabled={selectedStickyId !== null || generateNoteLoading || sessions.length === 0}>
                    <div className="flex flex-1 items-center justify-left gap-2">
                      {generateNoteLoading ? <Loader className="animate-spin size-6" /> : <SparklesIcon className="size-4" />}
                      <span>Generate Note</span>
                    </div>
                  </ContextMenuItem>}
                </ContextMenuContent>
              </ContextMenu>
              <div className="absolute -left-4 top-[50%] -rotate-90">
                <Popover>
                  <PopoverTrigger tabIndex={0}>
                    <Button variant="outline">{axisLabelsResult?.y.label || "Y Axis Label"}</Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80">
                    <div className="grid gap-4">
                      <div className="space-y-2">
                        <div className="flex flex-row justify-between items-center">
                          <h4 className="font-medium leading-none">Customize Y Axis</h4>
                          <div className="flex items-center gap-2">
                            <Popover>
                              <PopoverTrigger>
                                <BadgeHelpIcon className="size-4" />
                              </PopoverTrigger>
                              <PopoverContent className="text-sm" side="top">
                                {axisLabelsResult.y.brief}
                              </PopoverContent>
                            </Popover>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Create or Generate a Contextual Label for the Y axis. Changes are autosaved.
                        </p>
                      </div>
                      <div className="grid gap-4">
                        <div className="grid gap-2">
                          <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="width">Label</Label>
                            <Input
                              id="width"
                              disabled={axisLabelsLoading}
                              value={axisLabelsResult && capitalize(axisLabelsResult?.y.label) || "Y Axis Label"}
                              onChange={(e) => {
                                setAxisLabelsResult({ ...axisLabelsResult, y: { ...axisLabelsResult?.y, label: e.target.value } })
                              }}
                              className="col-span-3 h-8"
                              tabIndex={1}
                              autoFocus
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 items-center gap-4">
                          <Button tabIndex={1} variant="default" onClick={handleGenerateAxisLabels} disabled={axisLabelsLoading || sessionTitle === "Title of the Session"} className="col-span-4 disabled:bg-muted disabled:text-muted-foreground disabled:border disabled:border-gray-700">
                            <div className="flex items-center justify-center gap-2">
                              {axisLabelsLoading ? <Loader className="animate-spin size-6" /> : <SparklesIcon className="size-4" />}
                              <span>Generate Axes Labels from Title</span>
                            </div>
                          </Button>
                          {axisLabelsError && <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>
                              {axisLabelsError}
                            </AlertDescription>
                          </Alert>}
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="absolute bottom-4 left-[50%]">
                <Popover>
                  <PopoverTrigger tabIndex={0} className="flex justify-center items-center">
                    <Button variant="outline">{axisLabelsResult?.x.label || "X Axis Label"}</Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80">
                    <div className="grid gap-4">
                      <div className="space-y-2">
                        <div className="flex flex-row justify-between items-center">
                          <h4 className="font-medium leading-none">Customize X Axis</h4>
                          <div className="flex items-center gap-2">
                            <Popover>
                              <PopoverTrigger>
                                <BadgeHelpIcon className="size-4" />
                              </PopoverTrigger>
                              <PopoverContent className="text-sm" side="top">
                                {axisLabelsResult.x.brief}
                              </PopoverContent>
                            </Popover>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Create or Generate a Contextual Label for the X axis. Changes are autosaved.
                        </p>
                      </div>
                      <div className="grid gap-4">
                        <div className="grid gap-2">
                          <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="width">Label</Label>
                            <Input
                              id="width"
                              disabled={axisLabelsLoading}
                              value={axisLabelsResult && capitalize(axisLabelsResult?.x.label) || "X Axis Label"}
                              onChange={(e) => {
                                setAxisLabelsResult({ ...axisLabelsResult, x: { ...axisLabelsResult?.x, label: e.target.value } })
                              }}
                              className="col-span-3 h-8"
                              tabIndex={1}
                              autoFocus
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 items-center gap-4">
                          <Button tabIndex={1} variant="default" onClick={handleGenerateAxisLabels} disabled={axisLabelsLoading || sessionTitle === "Title of the Session"} className="col-span-4 disabled:bg-muted disabled:text-muted-foreground disabled:border disabled:border-gray-700">
                            <div className="flex items-center justify-center gap-2">
                              {axisLabelsLoading ? <Loader className="animate-spin size-6" /> : <SparklesIcon className="size-4" />}
                              <span>Generate Axes Labels from Title</span>
                            </div>
                          </Button>
                        </div>
                        {axisLabelsError && <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>Error</AlertTitle>
                          <AlertDescription>
                            {axisLabelsError}
                          </AlertDescription>
                        </Alert>}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <form
              className="overflow-hidden rounded-lg border bg-background focus-within:ring-1 focus-within:ring-ring mt-2 relative"
            >
              <Label htmlFor="note" className="sr-only">
                Note
              </Label>
              {addNoteError && <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                  {addNoteError}
                </AlertDescription>
              </Alert>}
              <Textarea
                id="note"
                placeholder="Type your note to fit here..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="min-h-24 resize-none border-0 p-3 shadow-none focus-visible:ring-0"
              />
              <div className="flex items-center p-3 pt-0">
                <Button tabIndex={0} onClick={handleAddToFitNew} size="sm" className="ml-auto gap-1.5 shadow-md transition-all hover:shadow-green-700/40  absolute bottom-2 right-2 disabled:bg-muted disabled:text-muted-foreground disabled:border disabled:border-gray-700" disabled={addNoteLoading || stickies.length === 0 || stickies.every(s => s.content === "")}>
                  Add Note to Fit
                  {addNoteLoading ? <Loader className="animate-spin size-6" /> : <CornerDownLeft className="size-3.5" />}
                </Button>
              </div>
            </form>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </main >
  );
}

export default App;
