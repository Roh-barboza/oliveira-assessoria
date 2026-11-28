import { handlePublicIntake } from "../server/crm/public-intake.mjs";

const project = "prj_M19hHqI7fq25KgKnXWIqUYRXmxhq";
const origins = new Set(["https://pincio-assessoria.vercel.app", "https://oliveira-assessoria.vercel.app"]);

export default {
  fetch(request) {
    const env = process.env;
    const scoped = env.VERCEL_ENV === "production" && env.VERCEL_PROJECT_ID === project;
    return handlePublicIntake(request, scoped ? env : {}, origins);
  },
};
