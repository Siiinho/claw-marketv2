"""Junta a mercadologia do mercado com a base de produtos (descrição + foto).

Uso:
  python3 scripts/mesclar-mercadologia.py <base_produtos.csv>

- Lê src/data/catalogoMercadologiaBengala.json (a mercadologia da loja, com o preço real).
- Lê o CSV da base (EAN;DESCRICAO;CATEGORIA;PRECO;ESTOQUE;ARQUIVO_IMAGEM;CAMINHO), separado por ';'.
- Produto que está nas duas: mantém preço, estoque, unidade e código interno da loja e ganha
  a descrição completa da base (o nome curto da loja fica em `nomeBengala`) e a marca de foto.
- Produto só da base: continua em public/catalogo/base-produtos.json (descrição + foto),
  sem preço — o preço é sempre o da loja e é preenchido na hora de bipar.
"""
import csv, json, sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
LOJA = RAIZ / 'src/data/catalogoMercadologiaBengala.json'
BASE = RAIZ / 'public/catalogo/base-produtos.json'

SETOR_POR_CATEGORIA = {
    'Hortifruti': 'hortifruti', 'Congelados': 'congelados', 'Mercearia e Grãos': 'mercearia',
    'Cuidados Pessoais': 'higiene', 'Produtos de Limpeza': 'limpeza', 'Bebidas Não Alcoólicas': 'bebidas',
    'Biscoitos, Doces e Sobremesas': 'mercearia', 'Farmácia e Medicamentos': 'farmacia',
    'Rações e Acessórios': 'petshop', 'Açougue e Peixaria': 'acougue', 'Frios e Laticínios': 'frios',
    'Artigos para Casa': 'utilidades', 'Bebidas Alcoólicas': 'bebidas', 'Cuidados com os Cabelos': 'higiene',
    'Higiene Oral': 'higiene', 'Cuidados Infantis': 'higiene', 'Mercearia': 'mercearia',
}
SETORES_CONFIAVEIS = {'higiene', 'limpeza', 'petshop', 'farmacia', 'utilidades'}
sem_zeros = lambda c: str(c or '').strip().lstrip('0')


def ler_base(caminho):
    linhas = list(csv.reader(open(caminho, encoding='utf-8-sig'), delimiter=';'))
    itens = {}
    for l in linhas[1:]:
        if len(l) < 3 or not l[0].strip().isdigit():
            continue
        itens[sem_zeros(l[0])] = {'ean': l[0].strip(), 'nome': ' '.join(l[1].split()), 'categoria': l[2].strip(), 'foto': bool(len(l) > 5 and l[5].strip())}
    return itens


def main():
    base = ler_base(sys.argv[1])
    loja = json.loads(LOJA.read_text(encoding='utf-8'))
    juntos = 0
    for p in loja['produtos']:
        b = base.get(sem_zeros(p['codigoBarras']))
        if not b:
            continue
        juntos += 1
        p['nomeBengala'] = p.get('nomeBengala') or p['nome']
        if len(b['nome']) >= 6:
            p['nome'] = b['nome']
        p['categoria'] = b['categoria']
        # A loja põe quase tudo em "mercearia"; a categoria da base separa higiene, limpeza etc.
        # Só esses setores são trocados (a base erra em hortifruti/frios, ex.: molho em Hortifruti).
        setor_base = SETOR_POR_CATEGORIA.get(b['categoria'].split('>')[-1].strip())
        if p.get('setor') == 'mercearia' and setor_base in SETORES_CONFIAVEIS:
            p['setor'] = setor_base
        if b['foto']:
            p['foto'] = 1
    loja['meta'].update({'mescladoCom': Path(sys.argv[1]).name, 'comDescricaoDaBase': juntos})
    LOJA.write_text(json.dumps(loja, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

    da_loja = {sem_zeros(p['codigoBarras']) for p in loja['produtos']}
    categorias = sorted({b['categoria'] for b in base.values()})
    idx = {c: i for i, c in enumerate(categorias)}
    produtos = []
    for chave, b in base.items():
        if chave in da_loja:
            continue
        secao = b['categoria'].split('>')[-1].strip()
        produtos.append([b['ean'], b['nome'], SETOR_POR_CATEGORIA.get(secao, 'mercearia'), None, idx[b['categoria']]])
    BASE.write_text(json.dumps({'meta': {'fonte': Path(sys.argv[1]).name, 'total': len(produtos),
        'campos': ['codigoBarras', 'nome', 'setor', 'preco (sempre vazio: o preço é o da loja)', 'categoria'],
        'categorias': categorias}, 'produtos': produtos}, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f'loja: {len(loja["produtos"])} produtos, {juntos} com descrição e foto da base; base sem preço: {len(produtos)}')


if __name__ == '__main__':
    main()
