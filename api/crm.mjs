import { handleCrm } from "../server/crm/http.mjs";

export default {
  fetch(request) {
    const env = process.env;
    return handleCrm(request, env.VERCEL_PROJECT_ID === "prj_M19hHqI7fq25KgKnXWIqUYRXmxhq" ? env : {});
  },
};
