"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { format, differenceInCalendarDays, startOfDay } from "date-fns";
import { CalendarDays as CalendarIcon, Mail, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldDescription,
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
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { LEAVE_MAIL, leaveMailBody, leaveMailSubject } from "@/lib/leave-mail";
import { submitLeaveAction } from "@/lib/actions/leave";
import type { HalfDaySession, LeaveType } from "@/generated/prisma/client";

const schema = z
  .object({
    type: z.enum(["REGULAR", "PAID", "COMPENSATORY"]),
    startDate: z.string().min(1, "Start date required"),
    endDate: z.string().min(1, "End date required"),
    isHalfDay: z.boolean(),
    halfDaySession: z.enum(["MORNING", "AFTERNOON"]).nullable(),
    reason: z.string().min(1, "Reason required").max(500),
  })
  .superRefine((v, ctx) => {
    if (v.isHalfDay && !v.halfDaySession) {
      ctx.addIssue({
        code: "custom",
        path: ["halfDaySession"],
        message: "Choose morning or afternoon.",
      });
    }
  });

type FormValues = z.infer<typeof schema>;

const LEAVE_TYPES: LeaveType[] = ["REGULAR", "PAID", "COMPENSATORY"];

export function LeaveForm({
  employeeName,
  designation,
}: {
  employeeName: string;
  designation: string | null;
}) {
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
  const [mailSubject, setMailSubject] = useState<string | null>(null);
  const [mailBody, setMailBody] = useState<string | null>(null);
  // Half days cannot be backdated, so the picker stops before today.
  const [today] = useState(() => startOfDay(new Date()));

  // Each button submits the same form; the flag says whether to open Gmail.
  const submitWith = (sendMail: boolean) =>
    handleSubmit((values) => {
      startTransition(async () => {
        const res = await submitLeaveAction({ ...values, mailSubject: subject, mailBody: body });
        if (res.error) {
          toast.error(res.error);
          return;
        }
        const settled = "type" in res ? res.type : values.type;
        toast.success(
          settled === values.type
            ? "Leave request submitted"
            : settled === "PAID"
              ? "You had paid days left — submitted as paid leave."
              : "Paid balance is used up — submitted as unpaid regular leave."
        );
        if (sendMail && "composeUrl" in res) {
          window.open(res.composeUrl, "_blank", "noopener");
        }
        router.push("/leaves");
        router.refresh();
      });
    })();

  // Half day and full day accept different dates, so a flip resets the picker.
  const clearDates = () => {
    setRange({});
    setValue("startDate", "");
    setValue("endDate", "");
  };

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
  const watchedReason = useWatch({ control, name: "reason" });
  const isHalf = isHalfDay;
  const days = range.from
    ? (range.to ? differenceInCalendarDays(range.to, range.from) : 0) + 1
    : 0;
  // A half day is always 0.5 days and never spans a range.
  const requested = isHalf ? 0.5 : days;

  // The draft follows the form until the employee edits it; after that their
  // text wins, and "Reset" drops back to the generated draft.
  const draft = {
    employeeName,
    designation,
    type: leaveType,
    startDate: range.from ? format(range.from, "yyyy-MM-dd") : "",
    endDate: range.to && !isHalf ? format(range.to, "yyyy-MM-dd") : range.from ? format(range.from, "yyyy-MM-dd") : "",
    days: requested,
    isHalfDay: isHalf,
    halfDaySession,
    reason: watchedReason,
  };
  const subject = mailSubject ?? leaveMailSubject(draft);
  const body = mailBody ?? leaveMailBody(draft);

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Apply for leave</CardTitle>
        <CardDescription>
          Requests notify your manager for approval. A half day is always 0.5 days and
          can only be taken today or later. Your paid balance decides the rest: leave is
          paid while paid days remain, and becomes unpaid regular leave — deducted from
          salary — once they run out.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitWith(false);
          }}
          className="flex flex-col gap-5"
        >
          <FieldGroup>
            <Field>
              <FieldLabel>Leave type</FieldLabel>
              <Select
                value={leaveType}
                onValueChange={(v) => v && setValue("type", v as LeaveType)}
              >
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
              <FieldLabel>{isHalf ? "Date" : "Date range"}</FieldLabel>
              <Popover>
                <PopoverTrigger
                  render={
                    <Button variant="outline" className="w-full justify-start font-normal">
                      <CalendarIcon />
                      {range.from ? (
                        range.to && range.to !== range.from ? (
                          `${format(range.from, "EEE d MMM")} – ${format(range.to, "EEE d MMM")}`
                        ) : (
                          format(range.from, "EEE d MMM yyyy")
                        )
                      ) : isHalf ? (
                        "Pick a date"
                      ) : (
                        "Pick dates"
                      )}
                    </Button>
                  }
                />
                <PopoverContent align="start" className="w-auto p-0" sideOffset={4}>
                  {isHalf ? (
                    <Calendar
                      mode="single"
                      selected={range.from}
                      onSelect={(d) => selectRange(d ? { from: d } : {})}
                      disabled={{ before: today }}
                      numberOfMonths={1}
                      autoFocus
                    />
                  ) : (
                    <Calendar
                      mode="range"
                      selected={range.from ? { from: range.from, to: range.to } : undefined}
                      onSelect={(r) => selectRange(r ?? {})}
                      numberOfMonths={1}
                      autoFocus
                    />
                  )}
                </PopoverContent>
              </Popover>
              {/* The picker is the only way to set these; the fields stay registered
                  so zod still guards an empty submit. */}
              <input type="hidden" {...register("startDate")} />
              <input type="hidden" {...register("endDate")} />
              <FieldError
                errors={errors.startDate ? [errors.startDate] : undefined}
              />
            </Field>

            <Field orientation="horizontal">
                <Checkbox
                  id="isHalfDay"
                  checked={isHalfDay}
                  onCheckedChange={(c) => {
                    setValue("isHalfDay", c === true);
                    clearDates();
                  }}
                />
              <FieldLabel htmlFor="isHalfDay" className="font-normal">
                Half day
              </FieldLabel>
            </Field>

            {isHalf && (
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

            {range.from && (
              <p className="bg-muted px-3 py-2 text-sm text-muted-foreground">
                Requesting{" "}
                <span className="font-medium text-foreground tabular-nums">
                  {requested === 0.5 ? "half a day" : `${requested} day${requested === 1 ? "" : "s"}`}
                </span>
                .
              </p>
            )}

            <Field>
              <FieldLabel htmlFor="reason">Reason</FieldLabel>
              <Input
                id="reason"
                placeholder="Family function, medical appointment, …"
                {...register("reason")}
              />
              <FieldError errors={errors.reason ? [errors.reason] : undefined} />
            </Field>
          </FieldGroup>

          <Accordion>
            <AccordionItem value="email">
              <AccordionTrigger>
                Email to {LEAVE_MAIL.managerName} (optional — edit before sending)
              </AccordionTrigger>
              <AccordionContent>
                <FieldGroup>
                  <FieldDescription>
                    To {LEAVE_MAIL.to}, cc {LEAVE_MAIL.cc}. Square brackets mark anything
                    the form has not filled in yet.
                  </FieldDescription>
                  <Field>
                    <FieldLabel htmlFor="mail-subject">Subject</FieldLabel>
                    <Input
                      id="mail-subject"
                      value={subject}
                      onChange={(e) => setMailSubject(e.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="mail-body">Message</FieldLabel>
                    <Textarea
                      id="mail-body"
                      rows={12}
                      value={body}
                      onChange={(e) => setMailBody(e.target.value)}
                    />
                  </Field>
                  {(mailSubject !== null || mailBody !== null) && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="self-start"
                      onClick={() => {
                        setMailSubject(null);
                        setMailBody(null);
                      }}
                    >
                      <RotateCcw />
                      Reset to the suggested wording
                    </Button>
                  )}
                </FieldGroup>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              size="lg"
              variant="outline"
              disabled={pending}
              onClick={() => submitWith(false)}
            >
              Submit request
            </Button>
            <Button
              type="button"
              size="lg"
              disabled={pending}
              onClick={() => submitWith(true)}
            >
              {pending ? <Spinner /> : <Mail />}
              Submit and send mail
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}