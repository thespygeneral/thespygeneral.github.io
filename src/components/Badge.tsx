import { useMemo } from "react";
import { badgeSvg } from "../lib/logo";

/** The Spy General Elite badge. `size` is the width in pixels. */
export function SpyBadge({ size = 40, className }: { size?: number; className?: string }) {
  const html = useMemo(() => badgeSvg({ size }), [size]);
  return <span className={className} style={{ display: "inline-block", width: size, lineHeight: 0 }} dangerouslySetInnerHTML={{ __html: html }} />;
}
