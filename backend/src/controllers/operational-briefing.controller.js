const operationalBriefingService = require("../service/operational-briefing.service");

exports.getBriefing = async (_req, res) => {
  const data = await operationalBriefingService.buildBriefing();
  res.json(data);
};

exports.postNarrate = async (req, res) => {
  const body = req.body || {};
  const data = await operationalBriefingService.narrateBriefing({
    locale: body.locale || "it",
    enhance: body.enhance !== false,
  });
  res.json(data);
};
