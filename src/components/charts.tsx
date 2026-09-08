"use client";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis } from "recharts";
import { CalendarOff, ChartPie } from "lucide-react";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";

const dailyConfig = {
  WFO: { label: "WFO", color: "var(--chart-1)" },
  WFH: { label: "WFH", color: "var(--chart-2)" },
  OFFDAY_WORK: { label: "Offday work", color: "var(--chart-4)" },
} satisfies ChartConfig;

export function DailySplitChart({
  data,
}: {
  data: { date: string; WFO: number; WFH: number; OFFDAY_WORK: number }[];
}) {
  const totals = data.reduce(
    (acc, d) => ({
      WFO: acc.WFO + d.WFO,
      WFH: acc.WFH + d.WFH,
      OFFDAY_WORK: acc.OFFDAY_WORK + d.OFFDAY_WORK,
    }),
    { WFO: 0, WFH: 0, OFFDAY_WORK: 0 }
  );

  const slices = [
    { name: "WFO", value: totals.WFO, fill: "var(--color-WFO)" },
    { name: "WFH", value: totals.WFH, fill: "var(--color-WFH)" },
    { name: "OFFDAY_WORK", value: totals.OFFDAY_WORK, fill: "var(--color-OFFDAY_WORK)" },
  ].filter((s) => s.value > 0);

  if (slices.length === 0) {
    return (
      <Empty className="py-8">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ChartPie />
          </EmptyMedia>
          <EmptyTitle>No attendance yet</EmptyTitle>
          <EmptyDescription>Punches appear here once the day starts.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ChartContainer config={dailyConfig} className="mx-auto aspect-square max-h-[260px]">
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
        <Pie data={slices} dataKey="value" nameKey="name" innerRadius={55} strokeWidth={2}>
          {slices.map((s) => (
            <Cell key={s.name} fill={s.fill} />
          ))}
        </Pie>
        <ChartLegend content={<ChartLegendContent nameKey="name" />} className="flex-wrap gap-2" />
      </PieChart>
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
  if (data.length === 0) {
    return (
      <Empty className="py-8">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CalendarOff />
          </EmptyMedia>
          <EmptyTitle>No approved leave</EmptyTitle>
          <EmptyDescription>Approved requests are charted by month.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ChartContainer config={leaveConfig} className="max-h-[260px] w-full">
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