"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { format, differenceInCalendarDays } from "date-fns";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { submitLeaveAction } from "@/lib/actions/leave";
import type { HalfDaySession, LeaveType } from "@/generated/prisma/client";

const schema = z
  .object({
    type: z.enum(["REGULAR", "PAID", "COMPENSATORY", "HALF_DAY"]),
    startDate: z.string().min(1, "Start date required"),
    endDate: z.string().min(1, "End date required"),
    isHalfDay: z.boolean(),
    halfDaySession: z.enum(["MORNING", "AFTERNOON"]).nullable(),
    reason: z.string().min(1, "Reason required").max(500),
  })
  .superRefine((v, ctx) => {
    if ((v.isHalfDay || v.type === "HALF_DAY") && !v.halfDaySession) {
      ctx.addIssue({
        code: "custom",
        path: ["halfDaySession"],
        message: "Choose morning or afternoon.",
      });
    }
  });

type FormValues = z.infer<typeof schema>;

const LEAVE_TYPES: LeaveType[] = ["REGULAR", "PAID", "COMPENSATORY", "HALF_DAY"];

export function LeaveForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { type: "REGULAR", isHalfDay: false, halfDaySession: null, reason: "" },
  });

  const [range, setRange] = useState<{ from?: Date; to?: Date }>({});

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      const res = await submitLeaveAction(values);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Leave request submitted");
      if ("composeUrl" in res && res.composeUrl) {
        window.open(res.composeUrl, "_blank");
      }
      router.push("/leaves");
      router.refresh();
    });
  });

  const selectRange = (r: { from?: Date; to?: Date }) => {
    setRange(r);
    if (r.from) {
      setValue("startDate", format(r.from, "yyyy-MM-dd"), { shouldValidate: true });
      const end = r.to ?? r.from;
      setValue("endDate", format(end, "yyyy-MM-dd"), { shouldValidate: true });
    }
  };

  const isHalfDay = useWatch({ control, name: "isHalfDay" });
  const leaveType = useWatch({ control, name: "type" });
  const halfDaySession = useWatch({ control, name: "halfDaySession" });
  const days = range.from
    ? (range.to ? differenceInCalendarDays(range.to, range.from) : 0) + 1
    : 0;
  const requested = (isHalfDay ? 0.5 : days) * (leaveType === "HALF_DAY" ? 0.5 : 1);

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Apply for leave</CardTitle>
        <CardDescription>
          Requests notify your manager for approval.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          <FieldGroup>
            <Field>
              <FieldLabel>Leave type</FieldLabel>
              <Select value={leaveType} onValueChange={(v) => setValue("type", v as LeaveType)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {LEAVE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t.replaceAll("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel>Date range</FieldLabel>
              <Popover>
                <PopoverTrigger
                  render={
                    <Button variant="outline" className="w-full justify-start font-normal">
                      {range.from ? (
                        range.to && range.to !== range.from ? (
                          `${format(range.from, "MMM d")} - ${format(range.to, "MMM d")}`
                        ) : (
                          format(range.from, "MMM d")
                        )
                      ) : (
                        "Pick dates"
                      )}
                    </Button>
                  }
                />
                <PopoverContent align="start" className="w-auto p-0" sideOffset={4}>
                  <Calendar
                    mode="range"
                    selected={range.from ? { from: range.from, to: range.to } : undefined}
                    onSelect={(r) => selectRange(r ?? {})}
                    numberOfMonths={1}
                  />
                </PopoverContent>
              </Popover>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="startDate">Start (ISO)</FieldLabel>
                <Input
                  id="startDate"
                  placeholder="yyyy-mm-dd"
                  {...register("startDate")}
                />
                <FieldError errors={errors.startDate ? [errors.startDate] : undefined} />
              </Field>
              <Field>
                <FieldLabel htmlFor="endDate">End (ISO)</FieldLabel>
                <Input id="endDate" placeholder="yyyy-mm-dd" {...register("endDate")} />
                <FieldError errors={errors.endDate ? [errors.endDate] : undefined} />
              </Field>
            </div>

            <Field orientation="horizontal">
              <Checkbox
                id="isHalfDay"
                checked={isHalfDay}
                onCheckedChange={(c) => setValue("isHalfDay", c === true)}
              />
              <FieldLabel htmlFor="isHalfDay" className="font-normal">
                Half day
              </FieldLabel>
            </Field>

            {(isHalfDay || leaveType === "HALF_DAY") && (
              <Field>
                <FieldLabel>Session</FieldLabel>
                <Select
                  value={halfDaySession ?? undefined}
                  onValueChange={(v) => {
                    if (!v) return;
                    setValue("halfDaySession", v as HalfDaySession);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Morning or afternoon" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MORNING">Morning (9:30 AM - 2:00 PM)</SelectItem>
                    <SelectItem value="AFTERNOON">Afternoon (2:00 PM - 6:30 PM)</SelectItem>
                  </SelectContent>
                </Select>
                <FieldError
                  errors={errors.halfDaySession ? [errors.halfDaySession] : undefined}
                />
              </Field>
            )}

            {days > 0 && (
              <p className="text-sm text-muted-foreground">
                {requested === 0.5 ? "Half day" : `${requested} day(s)`} requested.
              </p>
            )}

            <Field>
              <FieldLabel htmlFor="reason">Reason</FieldLabel>
              <Input id="reason" {...register("reason")} />
              <FieldError errors={errors.reason ? [errors.reason] : undefined} />
            </Field>
          </FieldGroup>

          <Button type="submit" disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Submit request
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}