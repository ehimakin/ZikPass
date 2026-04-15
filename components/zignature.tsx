import clsx from "clsx";
import {
  generateZignaturePathData,
  type ZignatureGenerationOptions
} from "@/lib/shared/zignature";

export type ZignatureProps = {
  seedInput: string;
  width?: number;
  height?: number;
  stroke?: string;
  strokeWidth?: number;
  className?: string;
  variant?: ZignatureGenerationOptions["variant"];
  animate?: boolean;
};

export function Zignature({
  seedInput,
  width = 320,
  height = 96,
  stroke = "#d7f171",
  strokeWidth = 3.1,
  className,
  variant = "full",
  animate = false
}: ZignatureProps) {
  const pathData = generateZignaturePathData(seedInput, {
    width,
    height,
    variant
  });

  return (
    <svg
      aria-label="Zignature unique to this pass"
      className={className}
      fill="none"
      viewBox={`0 0 ${width} ${height}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        className={clsx(animate ? "animate-zignature-draw" : undefined)}
        d={pathData}
        pathLength={1}
        stroke={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
        style={
          animate
            ? {
                strokeDasharray: 1,
                strokeDashoffset: 1,
                filter: "drop-shadow(0 0 8px rgba(215, 241, 113, 0.28))"
              }
            : {
                filter: "drop-shadow(0 0 8px rgba(215, 241, 113, 0.18))"
              }
        }
      />
    </svg>
  );
}
