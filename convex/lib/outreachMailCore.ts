export type OutreachProspectLike = {
  _id?: string;
  domain?: string;
  status?: string;
  contactStatus?: string;
};

export type OutreachContactLike = {
  _id?: string;
  email?: string;
  name?: string;
  suppressed?: boolean;
};

export type OutreachSuppressionLike = {
  scope: "email" | "domain";
  value: string;
  active?: boolean;
};

export type OutreachSequenceStepLike = {
  subject?: string;
  body?: string;
};

export type OutreachTemplateVariables = Record<string, string | undefined>;

export type OutreachBlockReason =
  | "missing_email"
  | "contact_suppressed"
  | "suppressed"
  | "prospect_suppressed"
  | "contact_unverified";

export type OutreachRecipientEvaluation =
  | {
      eligible: true;
      normalizedEmail: string;
    }
  | {
      eligible: false;
      reason: OutreachBlockReason;
      normalizedEmail?: string;
    };

export type OutreachEmailDraft =
  | {
      eligible: true;
      toEmail: string;
      subject: string;
      body: string;
    }
  | {
      eligible: false;
      reason: OutreachBlockReason;
      toEmail?: string;
    };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: string | undefined): string | undefined {
  const email = value?.trim().toLowerCase();
  return email && EMAIL_PATTERN.test(email) ? email : undefined;
}

function normalizeDomain(value: string | undefined): string | undefined {
  const domain = value?.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "");
  return domain ? domain.split("/")[0] : undefined;
}

function emailDomain(email: string): string | undefined {
  return normalizeDomain(email.split("@")[1]);
}

export function renderTemplate(
  template: string | undefined,
  variables: OutreachTemplateVariables
): string {
  return (template || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => {
    return variables[key]?.trim() || "";
  });
}

function isSuppressed(
  normalizedEmail: string,
  suppressions: OutreachSuppressionLike[]
): boolean {
  const domain = emailDomain(normalizedEmail);

  return suppressions.some((suppression) => {
    if (suppression.active === false) return false;

    const value = suppression.value.trim().toLowerCase();
    if (!value) return false;

    if (suppression.scope === "email") {
      return normalizeEmail(value) === normalizedEmail;
    }

    return normalizeDomain(value) === domain;
  });
}

export function evaluateOutreachRecipient({
  prospect,
  contact,
  suppressions,
}: {
  prospect: OutreachProspectLike;
  contact: OutreachContactLike;
  suppressions: OutreachSuppressionLike[];
}): OutreachRecipientEvaluation {
  const normalizedEmail = normalizeEmail(contact.email);

  if (!normalizedEmail) {
    return { eligible: false, reason: "missing_email" };
  }

  if (contact.suppressed) {
    return { eligible: false, reason: "contact_suppressed", normalizedEmail };
  }

  if (prospect.status === "suppressed") {
    return { eligible: false, reason: "prospect_suppressed", normalizedEmail };
  }

  if (prospect.contactStatus === "unverified" || prospect.contactStatus === "bad") {
    return { eligible: false, reason: "contact_unverified", normalizedEmail };
  }

  if (isSuppressed(normalizedEmail, suppressions)) {
    return { eligible: false, reason: "suppressed", normalizedEmail };
  }

  return { eligible: true, normalizedEmail };
}

export function appendOptOutFooter({
  body,
  optOutUrl,
  senderAddress,
}: {
  body: string;
  optOutUrl: string;
  senderAddress: string;
}): string {
  return [
    body.trim(),
    "",
    "--",
    `Keine weiteren E-Mails: ${optOutUrl}`,
    `Impressum: ${senderAddress}`,
  ].join("\n");
}

export function buildOutreachEmailDraft({
  prospect,
  contact,
  suppressions,
  step,
  variables,
  optOutUrl,
  senderAddress,
}: {
  prospect: OutreachProspectLike;
  contact: OutreachContactLike;
  suppressions: OutreachSuppressionLike[];
  step: OutreachSequenceStepLike;
  variables: OutreachTemplateVariables;
  optOutUrl: string;
  senderAddress: string;
}): OutreachEmailDraft {
  const evaluation = evaluateOutreachRecipient({ prospect, contact, suppressions });
  if (evaluation.eligible === false) {
    return {
      eligible: false,
      reason: evaluation.reason,
      toEmail: evaluation.normalizedEmail,
    };
  }

  const subject = renderTemplate(step.subject, variables).trim();
  const body = appendOptOutFooter({
    body: renderTemplate(step.body, variables),
    optOutUrl,
    senderAddress,
  });

  return {
    eligible: true,
    toEmail: evaluation.normalizedEmail,
    subject,
    body,
  };
}
