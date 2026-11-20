// Temas de campanha do encarte digital.
// Cada tema muda o fundo, o título grande do topo e o estilo do preço,
// no espírito dos encartes de supermercado (cores fortes, preço em selo oval).
// Tudo é desenhado em CSS: nenhuma arte de terceiros é usada.

export const TEMAS_CAMPANHA = [
  {
    id: 'ofertao', nome: 'Ofertão da Semana', titulo: 'Ofertão', destaque: 'da Semana', chamada: 'Preço baixo todo dia!',
    fundo: 'linear-gradient(160deg,#0a3d91 0%,#1565d8 45%,#0a3d91 100%)', corTitulo: '#ffffff', corDestaque: '#ffc928', contorno: '#06245a',
    precoFundo: '#ffc928', precoCor: '#0a3d91', precoSombra: '#e4232e', faixa: '#ffc928', faixaTexto: '#0a3d91',
  },
  {
    id: 'acougue', nome: 'Açougue Nota 10', titulo: 'Açougue', destaque: 'Nota 10', chamada: 'Carnes selecionadas, preço imbatível',
    fundo: 'linear-gradient(160deg,#5a0f0a 0%,#b3170f 50%,#5a0f0a 100%)', corTitulo: '#ffffff', corDestaque: '#ffc928', contorno: '#3a0705',
    precoFundo: '#ffc928', precoCor: '#b3170f', precoSombra: '#3a0705', faixa: '#ffc928', faixaTexto: '#5a0f0a',
  },
  {
    id: 'hortifruti', nome: 'Hortifruti Imbatível', titulo: 'Hortifruti', destaque: 'Imbatível', chamada: 'Hoje é dia de feira!',
    fundo: 'linear-gradient(160deg,#0f6b2f 0%,#2e9e3f 45%,#f2c200 100%)', corTitulo: '#ffffff', corDestaque: '#ffe14d', contorno: '#0a4a20',
    precoFundo: '#ffe14d', precoCor: '#0f6b2f', precoSombra: '#0a4a20', faixa: '#ffe14d', faixaTexto: '#0a4a20',
  },
  {
    id: 'fecha-mes', nome: 'Fecha Mês', titulo: 'Fecha', destaque: 'Mês', chamada: 'Fechando o mês com chave de ouro!',
    fundo: 'linear-gradient(160deg,#2a1a00 0%,#8a5a00 45%,#f2b600 100%)', corTitulo: '#fff6d6', corDestaque: '#ffd84d', contorno: '#2a1a00',
    precoFundo: '#ffd84d', precoCor: '#b3170f', precoSombra: '#2a1a00', faixa: '#ffd84d', faixaTexto: '#2a1a00',
  },
  {
    id: 'fim-de-semana', nome: 'FDS com Economia', titulo: 'FDS', destaque: 'com Economia', chamada: 'Final de semana para encher a despensa!',
    fundo: 'linear-gradient(160deg,#c2410c 0%,#f59e0b 55%,#fde047 100%)', corTitulo: '#ffffff', corDestaque: '#7c1d06', contorno: '#7c1d06',
    precoFundo: '#fde047', precoCor: '#c2410c', precoSombra: '#7c1d06', faixa: '#7c1d06', faixaTexto: '#ffffff',
  },
  {
    id: 'fire', nome: 'Ofertas Fire', titulo: 'Ofertas', destaque: 'Fire!', chamada: 'Tá barato!',
    fundo: 'radial-gradient(120% 80% at 50% 0%,#ffb703 0%,#fb5607 35%,#c1121f 70%,#5c0a0a 100%)', corTitulo: '#ffffff', corDestaque: '#ffe066', contorno: '#5c0a0a',
    precoFundo: '#ffe066', precoCor: '#c1121f', precoSombra: '#5c0a0a', faixa: '#ffe066', faixaTexto: '#5c0a0a',
  },
  {
    id: 'rasga-preco', nome: 'Rasga Preço', titulo: 'Rasga', destaque: 'Preço!', chamada: 'Seu mercado ainda mais barato!',
    fundo: 'repeating-linear-gradient(135deg,#d90429 0 26px,#b0021f 26px 52px)', corTitulo: '#ffffff', corDestaque: '#ffd60a', contorno: '#5e0010',
    precoFundo: '#ffd60a', precoCor: '#b0021f', precoSombra: '#5e0010', faixa: '#ffd60a', faixaTexto: '#5e0010',
  },
  {
    id: 'semana-maluca', nome: 'Semana Maluca', titulo: 'Semana', destaque: 'Maluca', chamada: 'Abaixou tudo!',
    fundo: 'linear-gradient(160deg,#9d0b5a 0%,#e5157a 50%,#ffb703 100%)', corTitulo: '#ffffff', corDestaque: '#ffe14d', contorno: '#5c0636',
    precoFundo: '#ffe14d', precoCor: '#c2185b', precoSombra: '#5c0636', faixa: '#ffe14d', faixaTexto: '#5c0636',
  },
  {
    id: 'peixe', nome: 'Dia do Peixe', titulo: 'Dia do', destaque: 'Peixe', chamada: 'Hoje é dia de pescado!',
    fundo: 'linear-gradient(160deg,#023e8a 0%,#0096c7 55%,#90e0ef 100%)', corTitulo: '#ffffff', corDestaque: '#ffd60a', contorno: '#03045e',
    precoFundo: '#ffd60a', precoCor: '#023e8a', precoSombra: '#03045e', faixa: '#ffd60a', faixaTexto: '#03045e',
  },
  {
    id: 'mercado', nome: 'Cores do mercado', titulo: 'Ofertas', destaque: 'da Semana', chamada: 'Economia de verdade!',
    fundo: 'linear-gradient(160deg,#082b4f 0%,#123f6b 60%,#e4232e 100%)', corTitulo: '#ffffff', corDestaque: '#ffc928', contorno: '#041a30',
    precoFundo: '#ffc928', precoCor: '#bf1721', precoSombra: '#e4232e', faixa: '#e4232e', faixaTexto: '#ffffff',
  },
]

export const temaCampanhaById = (id) => TEMAS_CAMPANHA.find((t) => t.id === id) || TEMAS_CAMPANHA[TEMAS_CAMPANHA.length - 1]
