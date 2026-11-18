export function prepararDocumento(form: FormData) {
  const arquivo = form.get("arquivo");
  if (!(arquivo instanceof File) || !arquivo.name) {
    throw new Error("Selecione um arquivo PDF, DOC ou DOCX.");
  }
  const titulo = String(form.get("titulo") ?? "").trim();
  const descricao = String(form.get("observacao") ?? "").trim();
  if (titulo.length < 3) {
    throw new Error("Informe um título com pelo menos 3 caracteres.");
  }
  if (descricao.length < 3) {
    throw new Error("Descreva do que trata o documento com pelo menos 3 caracteres.");
  }
  form.set("titulo", titulo);
  form.set("observacao", descricao);
  return form;
}
