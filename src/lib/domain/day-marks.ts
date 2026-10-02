import type { AttendanceType, LeaveStatus } from "@/generated/prisma/client";

export type MarkKind = AttendanceType | "LEAVE" | "LEAVE_PENDING";
export type DayMark = { kind: MarkKind; text: string };
/** Keyed by "YYYY-MM-DD" (IST day); plain data so it crosses to the client. */
export type DayMarks = Record<string, DayMark[]>;

const iso = (d: Date) => d.toISOString().slice(0, 10);
const time = (d: Date) =>
  d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });

const ATTENDANCE_TEXT: Record<AttendanceType, string> = {
  WFO: "Office",
  WFH: "Home",
  OFFDAY_WORK: "Off-day work",
};

/** Attendance and non-rejected leave flattened to per-day calendar marks. */
export function dayMarks(
  attendance: { date: Date; type: AttendanceType; punchIn: Date; punchOut: Date | null }[],
  leaves: {
    type: string;
    status: LeaveStatus;
    startDate: Date;
    endDate: Date;
    isHalfDay: boolean;
    halfDaySession: string | null;
  }[]
): DayMarks {
  const marks: DayMarks = {};
  const add = (day: string, m: DayMark) => (marks[day] ??= []).push(m);

  for (const a of attendance) {
    add(iso(a.date), {
      kind: a.type,
      text: `${ATTENDANCE_TEXT[a.type]} · ${time(a.punchIn)}${a.punchOut ? ` – ${time(a.punchOut)}` : ", still in"}`,
    });
  }
  for (const l of leaves) {
    if (l.status === "REJECTED") continue;
    const label = `${l.type.charAt(0)}${l.type.slice(1).toLowerCase()} leave${
      l.isHalfDay ? `, ${l.halfDaySession?.toLowerCase() ?? "half day"}` : ""
    }${l.status === "PENDING" ? " (pending)" : ""}`;
    // @db.Date values are UTC midnight, so stepping a UTC day at a time is exact.
    for (let t = l.startDate.getTime(); t <= l.endDate.getTime(); t += 86_400_000) {
      add(iso(new Date(t)), { kind: l.status === "PENDING" ? "LEAVE_PENDING" : "LEAVE", text: label });
    }
  }
  return marks;
}
