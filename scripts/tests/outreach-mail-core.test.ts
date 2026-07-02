import assert from "node:assert/strict";
import {
  appendOptOutFooter,
  buildOutreachEmailDraft,
  evaluateOutreachRecipient,
  normalizeEmail,
  renderTemplate,
  type OutreachContactLike,
  type OutreachProspectLike,
  type OutreachSuppressionLike,
} from "../../src/lib/outreach/mailCore";

assert.equal(normalizeEmail("  Redaktion@Example.COM "), "redaktion@example.com");
assert.equal(normalizeEmail("keine-email"), undefined);

assert.equal(
  renderTemplate("Hallo {{firstName}}, {{topic}} fuer {{siteName}}", {
    firstName: "Anna",
    topic: "Eltern-Notfallkarten",
    siteName: "Familienmagazin",
  }),
  "Hallo Anna, Eltern-Notfallkarten fuer Familienmagazin"
);

const prospect: OutreachProspectLike = {
  _id: "prospect-1",
  domain: "familienmagazin.de",
  status: "qualified",
  contactStatus: "verified",
};

const contact: OutreachContactLike = {
  _id: "contact-1",
  email: "redaktion@familienmagazin.de",
  name: "Anna Redaktion",
  suppressed: false,
};

assert.deepEqual(evaluateOutreachRecipient({ prospect, contact, suppressions: [] }), {
  eligible: true,
  normalizedEmail: "redaktion@familienmagazin.de",
});

assert.deepEqual(
  evaluateOutreachRecipient({
    prospect,
    contact,
    suppressions: [
      {
        scope: "domain",
        value: "familienmagazin.de",
        active: true,
      },
    ],
  }),
  {
    eligible: false,
    reason: "suppressed",
    normalizedEmail: "redaktion@familienmagazin.de",
  }
);

const unverifiedProspect: OutreachProspectLike = {
  ...prospect,
  contactStatus: "unverified",
};

assert.deepEqual(
  evaluateOutreachRecipient({ prospect: unverifiedProspect, contact, suppressions: [] }),
  {
    eligible: false,
    reason: "contact_unverified",
    normalizedEmail: "redaktion@familienmagazin.de",
  }
);

const footerBody = appendOptOutFooter({
  body: "Hallo Anna,\n\nkurzer Hinweis.",
  optOutUrl: "https://notamsign.com/outreach/opt-out/token",
  senderAddress: "Klaus Arent, Musterstrasse 1, 12345 Berlin",
});

assert.match(footerBody, /Keine weiteren E-Mails/);
assert.match(footerBody, /https:\/\/notamsign\.com\/outreach\/opt-out\/token/);
assert.match(footerBody, /Impressum: Klaus Arent/);

const draft = buildOutreachEmailDraft({
  prospect,
  contact,
  suppressions: [] satisfies OutreachSuppressionLike[],
  step: {
    subject: "Ressource fuer {{siteName}}",
    body: "Hallo {{firstName}},\n\n{{topic}} passt zu {{siteName}}.",
  },
  variables: {
    firstName: "Anna",
    topic: "Eltern-Notfallkarte",
    siteName: "Familienmagazin",
  },
  optOutUrl: "https://notamsign.com/outreach/opt-out/token",
  senderAddress: "Klaus Arent, Musterstrasse 1, 12345 Berlin",
});

assert.equal(draft.eligible, true);
assert.equal(draft.toEmail, "redaktion@familienmagazin.de");
assert.equal(draft.subject, "Ressource fuer Familienmagazin");
assert.match(draft.body, /Eltern-Notfallkarte passt zu Familienmagazin/);
assert.match(draft.body, /Keine weiteren E-Mails/);

console.log("outreach-mail-core tests passed");
