// Optional AI boundary: no credentials, files, identifiers or names leave this interface.
// An approved provider may be injected later; the shipped app uses deterministic local rules.
export async function suggestWithModel({
  generate,
  enabled = false,
  service,
  pendingCount,
  paused = false,
  closed = false,
  optIn = false,
}) {
  if (paused || closed || !optIn)
    return { suggestion: null, needsHuman: true, sent: false };
  if (!enabled || typeof generate !== "function")
    return {
      suggestion:
        "Confira as pendências no canal autenticado e solicite revisão humana.",
      engine: "local",
      needsHuman: true,
      sent: false,
    };
  try {
    const result = await generate({
      service,
      pendingCount,
      instructions:
        "Retorne somente intent=reminder ou human_review. Não redija aconselhamento, prazos ou resultados.",
    });
    if (!["reminder", "human_review"].includes(result?.intent))
      throw Error("Formato inválido");
    return {
      suggestion:
        result.intent === "reminder"
          ? "Confira as pendências no canal autenticado."
          : "Solicite revisão humana do atendimento.",
      engine: "injected-model",
      needsHuman: true,
      sent: false,
    };
  } catch {
    return {
      suggestion: null,
      engine: "failed",
      needsHuman: true,
      sent: false,
    };
  }
}
