// Leave requests go to the MD with accounts in copy. Kept free of `process.env`
// so the leave form can render the same draft the server would send.
export const LEAVE_MAIL = {
  to: "neethu@parinaamaa.ai",
  cc: "accounts@parinaamaa.ai",
  managerName: "Neethu",
} as const;

const SESSION_LABEL = {
  MORNING: "the morning session (9:30 AM to 2:00 PM)",
  AFTERNOON: "the afternoon session (2:00 PM to 6:30 PM)",
} as const;

const TYPE_LABEL: Record<string, string> = {
  REGULAR: "regular (unpaid)",
  PAID: "paid",
  COMPENSATORY: "compensatory",
};

export type LeaveMailInput = {
  employeeName: string;
  designation: string | null;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  isHalfDay: boolean;
  halfDaySession: "MORNING" | "AFTERNOON" | null;
  reason: string;
};

/** Anything the form has not filled in yet reads as a square-bracket placeholder. */
function or(value: string | null | undefined, placeholder: string) {
  const v = (value ?? "").trim();
  return v === "" ? `[${placeholder}]` : v;
}

function whenLabel(i: LeaveMailInput) {
  if (!i.startDate) return "[dates]";
  return i.startDate === i.endDate ? i.startDate : `${i.startDate} to ${i.endDate}`;
}

export function leaveMailSubject(i: LeaveMailInput) {
  return `Leave request — ${or(i.employeeName, "your name")} — ${whenLabel(i)}`;
}

export function leaveMailBody(i: LeaveMailInput) {
  const dayCount =
    i.days > 0 ? (i.days === 1 ? "1 day" : `${i.days} days`) : "[number of days]";
  return [
    `Dear ${LEAVE_MAIL.managerName},`,
    "",
    `I would like to apply for ${TYPE_LABEL[i.type] ?? "leave"} leave on ${whenLabel(i)}, totalling ${dayCount}.`,
    ...(i.isHalfDay
      ? [
          `This is a half day, covering ${
            i.halfDaySession ? SESSION_LABEL[i.halfDaySession] : "[morning or afternoon]"
          }.`,
        ]
      : []),
    "",
    `Reason: ${or(i.reason, "reason for the leave")}`,
    "",
    "My work is planned so that nothing is left pending for this period, and I will be reachable by email if anything urgent comes up.",
    "",
    "Kind regards,",
    or(i.employeeName, "your name"),
    or(i.designation, "your designation"),
  ].join("\n");
}

/** Opens the Gmail compose window: the web app, or the desktop app if the OS routes it. */
export function gmailComposeUrl(args: {
  to: string;
  cc?: string;
  subject: string;
  body: string;
}) {
  const q = new URLSearchParams({
    view: "cm",
    fs: "1",
    to: args.to,
    ...(args.cc ? { cc: args.cc } : {}),
    su: args.subject,
    body: args.body,
  });
  return `https://mail.google.com/mail/?${q.toString()}`;
}

export type DecisionMailInput = {
  employeeName: string;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
};

function decisionWhen(i: DecisionMailInput) {
  if (!i.startDate) return "[dates]";
  return i.startDate === i.endDate ? i.startDate : `${i.startDate} to ${i.endDate}`;
}

function decisionDays(i: DecisionMailInput) {
  if (i.days <= 0) return "[number of days]";
  return i.days === 1 ? "1 day" : `${i.days} days`;
}

export function rejectMailSubject(i: DecisionMailInput) {
  return `Leave request declined — ${decisionWhen(i)}`;
}

export function rejectMailBody(i: DecisionMailInput) {
  return [
    `Dear ${or(i.employeeName, "employee name")},`,
    "",
    `Thank you for your ${TYPE_LABEL[i.type] ?? ""} leave request for ${decisionWhen(i)}, totalling ${decisionDays(i)}.`,
    "",
    "Having looked at the schedule, I am not able to approve it on this occasion.",
    "",
    "Reason: [reason for declining]",
    "",
    "Do come and talk to me if you would like to look at alternative dates.",
    "",
    "Kind regards,",
    LEAVE_MAIL.managerName,
  ].join("\n");
}
