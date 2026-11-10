import cors from "cors";
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
import { errorHandler } from "./middleware/error";
import { authSecret } from "./middleware/auth";

// Fail-fast: valida secret antes de abrir a porta.
authSecret();

const app = express();
const port = Number(process.env.API_PORT || 4000);
const origin = process.env.CORS_ORIGIN || "http://localhost:3000";

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
app.use("/dashboard", dashboardRouter);
app.use("/modelos-projeto", modelosRouter);
app.use("/iniciativas/wizard", wizardRouter);
app.use("/iniciativas", iniciativasRouter);
app.use("/admin", adminRouter);
app.use("/reports", reportsRouter);
app.use("/import", importRouter);
app.use("/planejamento", planejamentoRouter);
app.use("/integracoes", integracoesRouter);

app.use(errorHandler);

app.listen(port, () => {
  console.log(`[cip-api] listening on http://localhost:${port}`);
});
