export function prepararDocumento(form: FormData) {
  const arquivo = form.get("arquivo");
  if (!(arquivo instanceof File) || !arquivo.name) {
    throw new Error("Selecione um arquivo PDF, DOC ou DOCX.");
  }
  const nome = arquivo.name.replace(/\.(pdf|docx?)$/i, "").trim();
  form.set("titulo", nome.length >= 3 ? nome : "Documento");
  return form;
}
