const axios = require("axios");
const constants = require("../../commands/utils/constants.js");
const { createHttpsAgent } = require("../../commands/utils/proxy_agent.js");

const TIMEOUT_MS = 5000;

const asList = (value) => (Array.isArray(value) ? value : []);

// Advisory, never rejects: an unknown id excludes nothing, so a typo is
// otherwise indistinguishable from a rule that did not fire.
function validate_exclusions(lt_config, env = "prod", rejectUnauthorized) {
  return new Promise(function (resolve) {
    const run_settings = lt_config["run_settings"] || {};
    const excludeRules = asList(run_settings["accessibility.excludeRules"]);
    const excludeRuleCategories = asList(
      run_settings["accessibility.excludeRuleCategories"]
    );

    if (excludeRules.length === 0 && excludeRuleCategories.length === 0) {
      return resolve();
    }

    const auth = lt_config["lambdatest_auth"] || {};
    if (!auth["username"] || !auth["access_key"]) {
      return resolve();
    }

    const token = Buffer.from(
      `${auth["username"]}:${auth["access_key"]}`
    ).toString("base64");

    axios({
      method: "post",
      url: constants[env].ACCESSIBILITY_VALIDATE_URL,
      headers: { Authorization: "Basic " + token },
      data: { platform: "web", excludeRules, excludeRuleCategories },
      timeout: TIMEOUT_MS,
      proxy: false,
      httpsAgent: createHttpsAgent(rejectUnauthorized !== false),
    })
      .then(function (response) {
        const data = response.data || {};
        (data.unknownRules || []).forEach((id) =>
          console.log(
            `Accessibility: unknown rule id "${id}", it will not exclude anything`
          )
        );
        (data.unknownCategories || []).forEach((slug) =>
          console.log(
            `Accessibility: unknown category "${slug}", it will not exclude anything`
          )
        );
        if (data.effectiveEmpty) {
          console.log(
            "Accessibility: these exclusions leave no rules to evaluate, the scan will report nothing"
          );
        }
        resolve();
      })
      .catch(function (error) {
        console.log(
          `Accessibility: could not validate exclusions (${error.message}), continuing without the check`
        );
        resolve();
      });
  });
}

module.exports = { validate_exclusions: validate_exclusions };
