import { upload } from "@vercel/blob/client";
const handleUpload = async () => {
  if (!selectedFile || !companyId) return;

  setUploading(true);
  setUploadStatus("idle");

  try {
    // ✅ Upload direto para Vercel Blob usando o handler server-side
    const safeName = selectedFile.name.replace(/[^\w.\-() ]+/g, "_");
    const folder = `uploads/${companyId}/de-para`;
    const pathname = `${folder}/${Date.now()}-${safeName}`;

    const blob = await upload(pathname, selectedFile, {
      access: "private",
      handleUploadUrl: "/api/upload/presigned",
      contentType:
        selectedFile.type ||
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    // ✅ Use blob.pathname (ou blob.url) como cloudStoragePath
    const cloudStoragePath = blob.pathname;

    // 2) Salva referência no banco (seu endpoint atual)
    const saveRes = await fetch("/api/files/de-para", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId,
        cloudStoragePath,
        fileName: selectedFile.name,
      }),
    });

    const saveData = await saveRes.json();

    if (!saveRes.ok) {
      throw new Error(saveData.error || "Erro ao salvar referência do arquivo");
    }

    if (saveData.overwritten) {
      setUploadStatus("warning");
      setStatusMessage("Arquivo De x Para sobrescrito com sucesso!");
    } else {
      setUploadStatus("success");
      setStatusMessage("Arquivo enviado com sucesso!");
    }

    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    fetchExistingFile(companyId);
  } catch (error) {
    console.error("Upload error:", error);
    setUploadStatus("error");
    setStatusMessage(error instanceof Error ? error.message : "Erro desconhecido");
  } finally {
    setUploading(false);
  }
};