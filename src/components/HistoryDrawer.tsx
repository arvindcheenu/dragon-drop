import { Drawer } from "vaul";
import { cn } from '@/lib/utils';
import { Button } from "./ui/button";
import { PanelRightClose, TimerResetIcon } from "lucide-react";
import React from "react";
import { ScrollArea } from "./ui/scroll-area";
interface Props {
  className?: string;
  children?: React.ReactNode;
}

const DrawerTitle = React.forwardRef<
  React.ElementRef<typeof Drawer.Title>,
  React.ComponentPropsWithoutRef<typeof Drawer.Title>
>(({ className, ...props }, ref) => (
  <Drawer.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
DrawerTitle.displayName = Drawer.Title.displayName

const DrawerDescription = React.forwardRef<
  React.ElementRef<typeof Drawer.Description>,
  React.ComponentPropsWithoutRef<typeof Drawer.Description>
>(({ className, ...props }, ref) => (
  <Drawer.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DrawerDescription.displayName = Drawer.Description.displayName

function HistoryDrawer({ className, children }: Props) {
  return (
    <Drawer.Root direction="right">
      <Drawer.Trigger asChild>
        <Button size="sm" className="absolute top-4 right-4 gap-1.5" variant={"outline"} tabIndex={0}>
          <TimerResetIcon className="size-3.5" />
          History
        </Button>
      </Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Content className={cn(
          "flex flex-col border rounded-l h-full w-[400px] mt-24 fixed bottom-0 right-0 bg-background z-50 focus:outline-none transition-transform duration-200 ease-in-out transform translate-x-full",
          className
        )}>
          <div className="p-4 flex-1 h-full">
            <div className="max-w-md mx-auto">
              <DrawerTitle className="mb-4">
                <div className="flex items-center gap-2">
                  <div className="flex-1 items-center gap-2">
                    <div className="flex items-center gap-2">
                      <TimerResetIcon className="size-4" />
                      History
                    </div>
                  </div>
                  <Drawer.Close asChild>
                    <Button size="sm" variant="outline" className="gap-1.5">
                      <PanelRightClose className="size-3.5" />
                    </Button>
                  </Drawer.Close>
                </div>
              </DrawerTitle>
              <DrawerDescription>
                A list of all the notes made during the Session.
              </DrawerDescription>
              <ScrollArea className="h-[85vh] w-full rounded-md mt-4 pr-3">
                {children}
              </ScrollArea>
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
export default HistoryDrawer;