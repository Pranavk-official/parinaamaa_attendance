"use client";

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const dailyConfig = {
  date: { label: "Date" },
  WFO: { label: "WFO", color: "var(--chart-1)" },
  WFH: { label: "WFH", color: "var(--chart-2)" },
  OFFDAY_WORK: { label: "Offday work", color: "var(--chart-4)" },
} satisfies ChartConfig;

export function DailySplitChart({
  data,
}: {
  data: { date: string; WFO: number; WFH: number; OFFDAY_WORK: number }[];
}) {
  return (
    <ChartContainer config={dailyConfig}>
      <BarChart data={data} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="WFO" stackId="a" fill="var(--color-WFO)" />
        <Bar dataKey="WFH" stackId="a" fill="var(--color-WFH)" />
        <Bar
          dataKey="OFFDAY_WORK"
          stackId="a"
          fill="var(--color-OFFDAY_WORK)"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ChartContainer>
  );
}

const leaveConfig = {
  month: { label: "Month" },
  days: { label: "Days", color: "var(--chart-3)" },
} satisfies ChartConfig;

export function MonthlyLeaveChart({
  data,
}: {
  data: { month: string; days: number }[];
}) {
  return (
    <ChartContainer config={leaveConfig}>
      <BarChart data={data} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="days" fill="var(--color-days)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}