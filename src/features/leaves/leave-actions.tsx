"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Mail, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { LEAVE_MAIL, rejectMailBody, rejectMailSubject } from "@/lib/domain/leave-mail";
import { ResponsiveConfirm } from "@/features/shell/responsive-confirm";
import { useRouter } from "next/navigation";
import {
  approveLeaveAction,
  deleteLeaveAction,
  rejectLeaveAction,
} from "@/lib/server/actions/leave";

/** Only a pending request can go; an approved one has already spent balance. */
export function LeaveDelete({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const remove = () => {
    setOpen(false);
    startTransition(async () => {
      const res = await deleteLeaveAction(id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Request deleted");
      router.refresh();
    });
  };

  return (
    <>
      <Button
        size="icon"
        variant="outline"
        disabled={pending}
        aria-label="Delete request"
        onClick={() => setOpen(true)}
      >
        {pending ? <Spinner /> : <Trash2 />}
      </Button>
      <ResponsiveConfirm
        open={open}
        onOpenChange={setOpen}
        title="Delete this leave request?"
        description="The request is removed for good. Submit a new one if you change your mind."
        cancelLabel="Keep it"
        cancelDisabled={pending}
        actions={
          <Button variant="destructive" disabled={pending} onClick={remove}>
            Delete
          </Button>
        }
      />
    </>
  );
}

export function LeaveActions({
  id,
  name,
  type,
  startDate,
  endDate,
  days,
}: {
  id: string;
  name: string;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
}) {
  const [pending, startTransition] = useTransition();
  const [action, setAction] = useState<"approve" | "reject" | null>(null);
  const [open, setOpen] = useState(false);
  // null means "still following the generated draft".
  const [mailSubject, setMailSubject] = useState<string | null>(null);
  const [mailBody, setMailBody] = useState<string | null>(null);
  const [mailCc, setMailCc] = useState<string | null>(null);

  // Only rejection is edited here; an approval mail reports the outcome the
  // server works out (paid, or downgraded to unpaid), so it is written there.
  const draft = { employeeName: name, type, startDate, endDate, days };
  const subject = mailSubject ?? rejectMailSubject(draft);
  const body = mailBody ?? rejectMailBody(draft);
  const edited = mailSubject !== null || mailBody !== null || mailCc !== null;

  const openFor = (next: "approve" | "reject") => {
    setAction(next);
    setMailSubject(null);
    setMailBody(null);
    setMailCc(null);
    setOpen(true);
  };

  const run = (sendMail: boolean) => {
    setOpen(false);
    startTransition(async () => {
      const res =
        action === "approve"
          ? await approveLeaveAction(id)
          : await rejectLeaveAction(id, { subject, body, cc: mailCc ?? "" });
      if (action === "approve" && !res.ok) {
        toast.error("Approval failed");
        return;
      }
      toast.success(action === "approve" ? "Request approved" : "Request rejected");
      if (sendMail && res.composeUrl) window.open(res.composeUrl, "_blank", "noopener");
    });
  };

  const verb = action === "reject" ? "Reject" : "Approve";

  return (
    <>
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={pending}
          onClick={() => openFor("approve")}
        >
          Approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => openFor("reject")}
        >
          Reject
        </Button>
      </div>
      <ResponsiveConfirm
        open={open}
        onOpenChange={setOpen}
        title={`${verb} leave for ${name}?`}
        description={`The request is ${action === "reject" ? "rejected" : "approved"} either way. Choose whether ${name} also gets an email about it.`}
        cancelDisabled={pending}
        actions={
          <>
            <Button
              type="button"
              variant={action === "reject" ? "destructive" : "outline"}
              disabled={pending}
              onClick={() => run(false)}
            >
              {verb}
            </Button>
            <Button type="button" disabled={pending} onClick={() => run(true)}>
              {pending ? <Spinner /> : <Mail />}
              {verb} and send mail
            </Button>
          </>
        }
      >
        {action === "reject" && (
            <Accordion>
              <AccordionItem value="mail">
                <AccordionTrigger>Email to {name} (optional — edit before sending)</AccordionTrigger>
                <AccordionContent>
                  <FieldGroup>
                    <FieldDescription>
                      Cc {LEAVE_MAIL.cc}. Square brackets mark what still needs your words.
                    </FieldDescription>
                    <Field>
                      <FieldLabel htmlFor="reject-subject">Subject</FieldLabel>
                      <Input
                        id="reject-subject"
                        value={subject}
                        onChange={(e) => setMailSubject(e.target.value)}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="reject-cc">Cc</FieldLabel>
                      <Input
                        id="reject-cc"
                        placeholder="Comma-separated extra recipients — leave blank for none"
                        value={mailCc ?? ""}
                        onChange={(e) => setMailCc(e.target.value)}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="reject-body">Message</FieldLabel>
                      <Textarea
                        id="reject-body"
                        rows={11}
                        value={body}
                        onChange={(e) => setMailBody(e.target.value)}
                      />
                    </Field>
                    {edited && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="self-start"
                        onClick={() => {
                          setMailSubject(null);
                          setMailBody(null);
                          setMailCc(null);
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
          )}
      </ResponsiveConfirm>
    </>
  );
}