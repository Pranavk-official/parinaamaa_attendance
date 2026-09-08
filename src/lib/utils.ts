import { isValidElement } from "react";
export { cn } from "cn"

// Base UI's `nativeButton` says whether a component's rendered element really is
// a <button>. A `render` prop holding a <Link> or an <a> is not, and Base UI
// warns when it is told otherwise. No render prop means the default <button>.
export function rendersNativeButton(render: unknown): boolean {
  if (render === undefined || render === null) return true;
  return isValidElement(render) && render.type === "button";
}
