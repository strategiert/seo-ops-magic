import { v } from "convex/values";

export const campaignTypeValidator = v.union(
  v.literal("linkbuilding"),
  v.literal("pr"),
  v.literal("sales"),
  v.literal("partnership"),
  v.literal("seeding")
);

export const outreachCampaignStatusValidator = v.union(
  v.literal("draft"),
  v.literal("ready"),
  v.literal("needs_review"),
  v.literal("active"),
  v.literal("paused"),
  v.literal("review"),
  v.literal("done")
);

export const prospectStatusValidator = v.union(
  v.literal("new"),
  v.literal("qualified"),
  v.literal("contacted"),
  v.literal("replied"),
  v.literal("won"),
  v.literal("lost"),
  v.literal("suppressed")
);

export const contactStatusValidator = v.union(
  v.literal("missing"),
  v.literal("found"),
  v.literal("unverified"),
  v.literal("verified"),
  v.literal("bad")
);

export const prospectTierValidator = v.union(
  v.literal("A"),
  v.literal("B"),
  v.literal("C"),
  v.literal("D")
);

export const sequenceApprovalStatusValidator = v.union(
  v.literal("draft"),
  v.literal("approved")
);

export const goalTypeValidator = v.union(
  v.literal("backlink"),
  v.literal("press_mention"),
  v.literal("interview"),
  v.literal("quote"),
  v.literal("meeting"),
  v.literal("opportunity"),
  v.literal("partnership"),
  v.literal("referral")
);

export const goalStatusValidator = v.union(
  v.literal("open"),
  v.literal("won"),
  v.literal("lost"),
  v.literal("verified")
);

export const placementRelValidator = v.union(
  v.literal("dofollow"),
  v.literal("nofollow"),
  v.literal("sponsored"),
  v.literal("ugc")
);

export const placementStatusValidator = v.union(
  v.literal("live"),
  v.literal("changed"),
  v.literal("lost"),
  v.literal("manual")
);
