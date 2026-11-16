import { reportConversionError, runConversionCli } from "./convert-demo-local-cli";

runConversionCli(process.argv.slice(2), process.env).catch(reportConversionError);
