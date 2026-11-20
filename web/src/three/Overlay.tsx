import { Html } from '@react-three/drei';
import { createContext, useContext, useRef, type ComponentProps, type ReactNode } from 'react';

/**
 * drei <Html> appends its DOM root into the div that <Canvas> renders. When the Canvas unmounts,
 * react-dom and Html's own root both try to detach it ("removeChild ... not a child of this node").
 * Portaling every label into an overlay div that we own avoids that race.
 */
export const OverlayContext = createContext<React.RefObject<HTMLDivElement | null> | null>(null);

export function OverlayRoot({ children }: { children: (ref: React.RefObject<HTMLDivElement | null>) => ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <OverlayContext.Provider value={ref}>
      {children(ref)}
      <div ref={ref} className="canvas-overlay" />
    </OverlayContext.Provider>
  );
}

/** Labels inside a provider with value false are not rendered (used to hide zones the camera is not visiting). */
export const LabelVisibility = createContext(true);

export function Label(props: ComponentProps<typeof Html>) {
  const ref = useContext(OverlayContext);
  const visible = useContext(LabelVisibility);
  if (!visible) return null;
  return <Html {...props} portal={(ref ?? undefined) as React.RefObject<HTMLElement> | undefined} />;
}
