import cors from "cors";
import { comunicadosRouter } from "./routes/comunicados";
import express from "express";
import { authRouter } from "./routes/auth";
import { dashboardRouter } from "./routes/dashboard";
import { iniciativasRouter } from "./routes/iniciativas";
import { adminRouter } from "./routes/admin";
import { reportsRouter } from "./routes/reports";
import { importRouter } from "./routes/import";
import { planejamentoRouter } from "./routes/planejamento";
import { modelosRouter } from "./routes/modelos";
import { wizardRouter } from "./routes/wizard";
import { integracoesRouter } from "./routes/integracoes";
import { conhecimentoRouter } from "./routes/conhecimento";
import { execucaoRouter, notificacoesRouter } from "./routes/execucao";
import { errorHandler } from "./middleware/error";
import { authSecret } from "./middleware/auth";

// Fail-fast: valida secret (em produção aborta sem NEXTAUTH_SECRET/JWT_SECRET).
authSecret();

const app = express();
const port = Number(process.env.API_PORT || 4000);
// Lista separada por vírgula: ambiente das prefeituras e console gestao.<domínio>.
const origin = (process.env.CORS_ORIGIN || "http://localhost:3000,http://gestao.localhost:3000")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin,
    credentials: true,
  }),
);
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "cip-api",
    product: "CIP — Centro de Inteligência Pública",
    ts: new Date().toISOString(),
  });
});

app.use("/auth", authRouter);
app.use("/comunicados", comunicadosRouter);
app.use("/dashboard", dashboardRouter);
app.use("/modelos-projeto", modelosRouter);
app.use("/iniciativas/wizard", wizardRouter);
app.use("/iniciativas", iniciativasRouter);
app.use("/admin", adminRouter);
app.use("/reports", reportsRouter);
app.use("/import", importRouter);
app.use("/planejamento", planejamentoRouter);
app.use("/conhecimento", conhecimentoRouter);
app.use("/integracoes", integracoesRouter);
app.use("/execucao", execucaoRouter);
app.use("/notificacoes", notificacoesRouter);

app.use(errorHandler);

// Vercel serverless: exporta o app. Localmente sobe HTTP.
if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`[cip-api] listening on http://localhost:${port}`);
  });
}

export default app;
