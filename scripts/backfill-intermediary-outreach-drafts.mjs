#!/usr/bin/env node
/**
 * One-off: queue intermediary check-in drafts from CAPA-17 research for approval.
 * Usage: node scripts/backfill-intermediary-outreach-drafts.mjs [baseUrl] [companyId]
 */
const baseUrl = process.argv[2] ?? "http://localhost:3100/api";
const companyId =
  process.argv[3] ?? "f2538202-a0fe-4b65-ac3b-a4f3abc60aa2";

const drafts = [
  {
    intermediaryId: "8dc60654-f3e2-4ab3-ac93-69843bf6eb51",
    subject: "123 Capital — CPG mandate check-in",
    body:
      "Hi Brian — saw your team has been busy with some great CPG deals recently including Bloom Nutrition, California Custom Fruits & Flavors, and Heartisan Foods. I am with 123 Capital, a private equity firm actively sourcing platform and add-on acquisition opportunities in the CPG space, with a particular focus on food & beverage, branded consumer goods, and specialty ingredients. We are looking for quality businesses in the $20M–$150M revenue range. Would love to connect and share our investment criteria so we are top of mind when you have CPG clients considering a sale or recapitalization. Open for a brief call next week?",
  },
  {
    intermediaryId: "f4c8bb73-a190-4323-ab4b-b05beabc965a",
    subject: "123 Capital — consumer/CPG intro",
    body:
      "John — I have been following Harris Williams' consumer group activity and the 2025/2026 M&A outlook you published. As co-CEO and head of the consumer practice, you likely have broad visibility into CPG companies exploring strategic alternatives. I am with 123 Capital, a private equity firm actively seeking platform acquisitions in branded food & beverage, personal care, and household products. We are looking for the $20M–$150M revenue range. Would be great to introduce our firm and discuss how we might partner on deals that fit our thesis. Are you available for a brief call in the coming weeks?",
  },
  {
    intermediaryId: "879fd325-4e27-4fa1-a208-afd420022dfd",
    subject: "123 Capital — food & beverage intro",
    body:
      "Joe — congrats on the Crain's Notable M&A Dealmaker recognition and the Grote Company transaction. I have been reading PMCF's Food & Beverage M&A Pulse reports — great insights on the sector. I am with 123 Capital, a PE firm focused on acquiring food & beverage and CPG businesses. We are seeking platform investments ($20M–$150M revenue) in branded foods, ingredients, and specialty manufacturers. Would love to connect, share our criteria, and see where there could be alignment with companies you are representing. Open for a quick call?",
  },
  {
    intermediaryId: "1ab12fda-1a0d-4fcc-bcbf-16d4652caf52",
    subject: "123 Capital — CPG relationship intro",
    body:
      "Paul — enjoyed your thoughts on CPG M&A with Naturally Chicago. At Mesirow, your food, beverage and agribusiness team clearly has deep roots in the sector — from Hammond's Candies to your broader work across branded and private label CPG. I am with 123 Capital, a PE firm looking to acquire CPG platforms particularly in packaged food, specialty ingredients, and branded consumer goods ($20M–$150M revenue). We would like to establish a relationship so we can move quickly when opportunities arise. Would you be open to a brief introductory call?",
  },
];

for (const draft of drafts) {
  const res = await fetch(
    `${baseUrl}/companies/${companyId}/deal-desk/tools/intermediaries/outreach/draft`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    },
  );
  const body = await res.text();
  console.log(res.status, draft.intermediaryId.slice(0, 8), body.slice(0, 120));
}
