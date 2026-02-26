function eFilho(codigoPai: string, codigoFilho: string): boolean {
  // Padrão 1: filho começa com pai + "."
  if (codigoFilho.startsWith(codigoPai + '.')) {
    return true;
  }
  
  // Padrão 2: extensão numérica na última parte
  const partesPai = codigoPai.split('.');
  const partesFilho = codigoFilho.split('.');
  
  if (partesFilho.length < partesPai.length) {
    return false;
  }
  
  for (let i = 0; i < partesPai.length - 1; i++) {
    if (partesPai[i] !== partesFilho[i]) {
      return false;
    }
  }
  
  const ultimaPartePai = partesPai[partesPai.length - 1];
  const parteCorrespondente = partesFilho[partesPai.length - 1];
  
  if (parteCorrespondente.startsWith(ultimaPartePai)) {
    if (parteCorrespondente.length > ultimaPartePai.length) {
      return true;
    }
    if (partesFilho.length > partesPai.length) {
      return true;
    }
  }
  
  return false;
}

// Teste
const casos = [
  ['4.2.11.8', '4.2.11.800.001'],
  ['4.2.11.8', '4.2.11.80'],
  ['4.2.11.8', '4.2.11.800'],
  ['4.2.11.9', '4.2.11.900.001'],
  ['4.2.11', '4.2.11.100.001'],
  ['4.2.11.500', '4.2.11.500.001'],
];

console.log('=== TESTE DA FUNÇÃO eFilho ===');
casos.forEach(([pai, filho]) => {
  const resultado = eFilho(pai, filho);
  console.log(`eFilho("${pai}", "${filho}") = ${resultado}`);
});
