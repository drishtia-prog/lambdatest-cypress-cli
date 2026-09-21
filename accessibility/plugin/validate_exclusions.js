const axios = require("axios");
const constants = require("../../commands/utils/constants.js");

const VALIDATE_PATH = "/accessibility/api/v1/validate-rules";
const TIMEOUT_MS = 3000;

// The orchestrators serialise the lists as JSON, since env vars are flat strings.
const parseList = (raw) => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
};

// Derived from an existing per-env URL so a new environment needs no edit here.
const validateURL = (env) => {
  const known = constants[env] ? env : "prod";
  const base = constants[known].BUILD_STOP_URL.split("/api/v1/test/stop")[0];
  return base + VALIDATE_PATH;
};

// Advisory only, and never throws: the extension drops an id axe does not know,
// so the scan runs either way. This only tells the user about a typo, which
// otherwise looks identical to a rule that did not fire.
const validateExclusions = async (env) => {
  const excludeRules = parseList(env.EXCLUDE_RULES);
  const excludeRuleCategories = parseList(env.EXCLUDE_RULE_CATEGORIES);

  if (excludeRules.length === 0 && excludeRuleCategories.length === 0) return;

  const username = process.env[constants.LT_USERNAME_ENV];
  const accessKey = process.env[constants.LT_ACCESS_KEY_ENV];
  if (!username || !accessKey) {
    console.log(
      "Accessibility: skipping exclusion validation, no LambdaTest credentials in the environment"
    );
    return;
  }

  try {
    const { data } = await axios({
      method: "post",
      url: validateURL(process.env.LT_ENV || "prod"),
      headers: { Authorization: "Token " + accessKey, Username: username },
      data: { platform: "web", excludeRules, excludeRuleCategories },
      timeout: TIMEOUT_MS,
      proxy: false,
    });

    (data.unknownRules || []).forEach((id) =>
      console.log(`Accessibility: unknown rule id "${id}", it will not exclude anything`)
    );
    (data.unknownCategories || []).forEach((slug) =>
      console.log(`Accessibility: unknown category "${slug}", it will not exclude anything`)
    );
    if (data.effectiveEmpty) {
      console.log(
        "Accessibility: these exclusions leave no rules to evaluate, the scan will report nothing"
      );
    }
  } catch (err) {
    console.log(
      `Accessibility: could not validate exclusions (${err.message}), continuing without the check`
    );
  }
};

module.exports = { validateExclusions, parseList };
