"use client";

import type { ReactNode } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

/** Centered confirm on desktop, swipeable bottom drawer on phones. The caller
 *  supplies the action buttons (generic `<Button>`s) — AlertDialog's own cancel
 *  and action primitives only work inside an AlertDialog, so this owns cancel. */
export function ResponsiveConfirm({
  open,
  onOpenChange,
  title,
  description,
  children,
  actions,
  cancelLabel = "Cancel",
  cancelDisabled = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  /** Body between the header and the footer, e.g. a mail editor. */
  children?: ReactNode;
  actions: ReactNode;
  cancelLabel?: string;
  cancelDisabled?: boolean;
}) {
  const isMobile = useIsMobile();

  const cancel = (
    <Button
      type="button"
      variant="outline"
      disabled={cancelDisabled}
      onClick={() => onOpenChange(false)}
    >
      {cancelLabel}
    </Button>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} showSwipeHandle>
        <DrawerContent className="pb-[env(safe-area-inset-bottom)]">
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
            {description && <DrawerDescription>{description}</DrawerDescription>}
          </DrawerHeader>
          {children}
          <DrawerFooter>
            {actions}
            {cancel}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          {cancel}
          {actions}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}